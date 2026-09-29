import {
  BytiumException,
  ConstructorType,
  DiscoveryService,
  GraphTokenType,
  HandlerInvoker,
  Inject,
  Injectable,
  isDevMode,
  ModuleRef,
} from "@bytium-core/common";
import { HttpMiddleware } from "@http/interfaces/http-middleware.interface";
import { HttpRequest } from "@http/models/http-request.model";
import { HttpResponse } from "@http/models/http-response.model";
import { NativeHttpRequest } from "@http/interfaces/native-http-request.interface";
import { NativeHttpResponse } from "@http/interfaces/native-http-response.interface";
import { RouteEntryInterface } from "@http/interfaces/route-entry.interface";
import { HttpExecutionContext } from "@http/interfaces/http-execution-context.interface";
import { HttpRouteInterface } from "@http/interfaces/http-route.interface";
import { HttpHeaderEnum } from "@http/enums/http-header.enum";
import { HttpMethodEnum } from "@http/enums/http-method.enum";
import { HttpMetadataKeyEnum } from "@http/enums/http-metadata-key.enum";
import { HTTP_MIDDLEWARE } from "@http/consts/http-middleware.token";
import { HttpRedirectInterface } from "@http/interfaces/http-redirect.interface";
import { instanceOfOnRequestEnd } from "@http/interfaces/on-request-end.interface";
import { compareRouteSpecificity, matchPath, toSegments } from "@http/utils/match-path.util";
import { parseQuery } from "@http/utils/parse-query.util";
import { normalizeHeaders } from "@http/utils/normalize-headers.util";
import { HttpException } from "@http/exceptions/http.exception";

/**
 * Registers a single `SetHttpHandler` for the resource, builds a routing table from every `@HttpController`
 * and dispatches each request through the shared `HandlerInvoker` (so guards/pipes/interceptors/filters run).
 * Controllers are contextual-scoped, so a fresh controller subtree is resolved per request with the request
 * and response seeded into its store.
 */
@Injectable()
export class HttpRouterService {
  private readonly routes: RouteEntryInterface[] = [];
  private readonly middleware: HttpMiddleware[] = [];

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly moduleRef: ModuleRef,
    private readonly handlerInvoker: HandlerInvoker,
    @Inject(HTTP_MIDDLEWARE) private readonly middlewareClasses: ConstructorType[],
  ) {}

  async onModuleInit(): Promise<void> {
    if (typeof SetHttpHandler !== "function") return;

    await this.buildRoutingTable();

    for (const middlewareClass of this.middlewareClasses) {
      this.middleware.push(this.moduleRef.get<HttpMiddleware>(middlewareClass));
    }

    SetHttpHandler((request: NativeHttpRequest, response: NativeHttpResponse) => {
      void this.handle(request, response);
    });
  }

  private async buildRoutingTable(): Promise<void> {
    for (const controllerToken of this.discoveryService.getControllerClasses()) {
      const prefix = Reflect.getMetadata(HttpMetadataKeyEnum.CONTROLLER_PREFIX, controllerToken) as string | undefined;

      if (prefix === undefined) continue;

      const prototype = controllerToken.prototype;

      for (const methodName of Object.getOwnPropertyNames(prototype)) {
        if (methodName === "constructor") continue;

        const route = Reflect.getMetadata(HttpMetadataKeyEnum.ROUTE, prototype, methodName) as
          HttpRouteInterface | undefined;

        if (!route) continue;

        await this.moduleRef.registerHandlerPipeline(controllerToken, methodName);

        const version = (Reflect.getMetadata(HttpMetadataKeyEnum.VERSION, prototype, methodName) ??
          Reflect.getMetadata(HttpMetadataKeyEnum.VERSION, controllerToken)) as string | undefined;

        this.routes.push({
          method: route.method,
          segments: toSegments(`${prefix}${route.path}`),
          controllerToken,
          methodName,
          binary: route.binary,
          version,
        });
      }
    }

    this.routes.sort((first, second) => compareRouteSpecificity(first.segments, second.segments));
  }

  private async handle(nativeRequest: NativeHttpRequest, nativeResponse: NativeHttpResponse): Promise<void> {
    const response = new HttpResponse(nativeResponse);

    try {
      const [rawPath, rawQuery = ""] = nativeRequest.path.split("?");
      const pathSegments = toSegments(rawPath);
      const method = nativeRequest.method.toUpperCase();
      const requestHeaders = normalizeHeaders(nativeRequest.headers);
      const requestVersion = requestHeaders[HttpHeaderEnum.ApiVersion];

      if (this.middleware.length) {
        const preRouteRequest = new HttpRequest(nativeRequest, {}, parseQuery(rawQuery), "");

        await this.runMiddlewareChain(preRouteRequest, response);

        if (response.sent) return;
      }

      let matchedParams: Record<string, string> | null = null;
      let matchedRoute: RouteEntryInterface | undefined;

      for (const route of this.routes) {
        if (route.method !== HttpMethodEnum.ALL && route.method !== method) continue;

        if (route.version !== undefined && requestVersion !== undefined && route.version !== requestVersion) continue;

        const params = matchPath(route.segments, pathSegments);

        if (params) {
          matchedParams = params;
          matchedRoute = route;

          break;
        }
      }

      if (!matchedRoute || !matchedParams) {
        this.sendError(response, 404, "Not Found");

        return;
      }

      const body = await this.readBody(nativeRequest, matchedRoute, requestHeaders);
      const request = new HttpRequest(nativeRequest, matchedParams, parseQuery(rawQuery), body);
      const store = new Map<GraphTokenType, unknown>([
        [HttpRequest, request],
        [HttpResponse, response],
      ]);

      try {
        const controller = await this.moduleRef.resolveContextual<object>(matchedRoute.controllerToken, store);

        this.applyResponseMetadata(matchedRoute, response);

        const context: HttpExecutionContext = {
          type: "HTTP",
          provider: controller,
          methodName: matchedRoute.methodName,
          request,
          response,
        };
        const result = await this.handlerInvoker.invoke(context);

        if (!response.sent) {
          const redirect = this.routeMetadata<HttpRedirectInterface>(matchedRoute, HttpMetadataKeyEnum.REDIRECT);

          if (redirect) {
            response.status(redirect.statusCode).header("Location", redirect.url).send();
          } else {
            response.json(result);
          }
        }
      } finally {
        await this.runRequestEndHooks(store);
      }
    } catch (error) {
      if (response.sent) return;

      if (error instanceof HttpException) {
        this.sendError(response, error.status, error.message);

        return;
      }

      if (error instanceof BytiumException) {
        const status = typeof error.code === "number" ? error.code : 500;

        this.sendError(response, status, error.message, error.errors ? { errors: error.errors } : {});

        return;
      }

      if (isDevMode() && error instanceof Error) {
        this.sendError(response, 500, error.message, { name: error.name, stack: error.stack });

        return;
      }

      this.sendError(response, 500, "Internal Server Error");
    }
  }

  private sendError(
    response: HttpResponse,
    status: number,
    message: string,
    extra: Record<string, unknown> = {},
  ): void {
    response.status(status).json({ statusCode: status, message, ...extra });
  }

  private routeMetadata<T>(route: RouteEntryInterface, key: string): T | undefined {
    return Reflect.getMetadata(key, route.controllerToken.prototype, route.methodName) as T | undefined;
  }

  private applyResponseMetadata(route: RouteEntryInterface, response: HttpResponse): void {
    const code = this.routeMetadata<number>(route, HttpMetadataKeyEnum.CODE);

    if (code !== undefined) response.status(code);

    const headers = this.routeMetadata<Record<string, string>>(route, HttpMetadataKeyEnum.HEADERS);

    if (headers) {
      for (const [key, value] of Object.entries(headers)) response.header(key, value);
    }
  }

  private readBody(
    nativeRequest: NativeHttpRequest,
    route: RouteEntryInterface,
    headers: Record<string, string>,
  ): Promise<string | ArrayBuffer> {
    const contentType = (headers["content-type"] ?? "").toLowerCase();
    // multipart carries file bytes that a UTF-8 decode would corrupt, so it is always read as binary.
    const binary = route.binary || contentType.includes("multipart/form-data");
    const empty = binary ? new ArrayBuffer(0) : "";
    const contentLength = Number(headers["content-length"]);
    const chunked = (headers["transfer-encoding"] ?? "").toLowerCase().includes("chunked");

    // FiveM only fires the data handler once body bytes arrive; without a body it never fires, so wait for
    // one only when the request announces it - otherwise a body-less POST/PUT would hang forever.
    if (!chunked && !(contentLength > 0)) return Promise.resolve(empty);

    if (binary) {
      return new Promise((resolve) => {
        nativeRequest.setDataHandler((data: ArrayBuffer) => resolve(data ?? new ArrayBuffer(0)), "binary");
        nativeRequest.setCancelHandler(() => resolve(new ArrayBuffer(0)));
      });
    }

    return new Promise((resolve) => {
      nativeRequest.setDataHandler((data: string) => resolve(data ?? ""));
      nativeRequest.setCancelHandler(() => resolve(""));
    });
  }

  private async runMiddlewareChain(request: HttpRequest, response: HttpResponse): Promise<void> {
    const run = async (index: number): Promise<void> => {
      if (index >= this.middleware.length || response.sent) return;

      await this.middleware[index].use(request, response, () => run(index + 1));
    };

    await run(0);
  }

  private async runRequestEndHooks(store: Map<GraphTokenType, unknown>): Promise<void> {
    const instances = [...store.values()].reverse();

    for (const instance of instances) {
      if (!instanceOfOnRequestEnd(instance)) continue;

      try {
        await instance.onRequestEnd();
      } catch {
        // A cleanup failure must not mask the response already sent for this request.
      }
    }
  }
}
