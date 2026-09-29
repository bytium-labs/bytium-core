import { AnyExecutionContext, Injectable, Interceptor } from "@bytium-core/common";
import { HttpRequest } from "@bytium-core/http";
import { ParsedMultipart } from "@multipart/interfaces/parsed-multipart.interface";
import { multipartCache } from "@multipart/multipart-cache";
import { extractBoundary } from "@multipart/utils/extract-boundary.util";
import { httpRequestOf } from "@multipart/utils/http-request-of.util";
import { parseMultipart } from "@multipart/utils/parse-multipart.util";

/** Parses a `multipart/form-data` body so its files and fields can be read with `@UploadedFile(s)`/`@Field`. */
@Injectable()
export class MultipartInterceptor implements Interceptor {
  async intercept(context: AnyExecutionContext, next: () => Promise<unknown>): Promise<unknown> {
    const request = httpRequestOf(context);

    if (request) multipartCache.set(request, this.parse(request));

    return next();
  }

  private parse(request: HttpRequest): ParsedMultipart {
    const boundary = extractBoundary(request.headers["content-type"]);

    if (!boundary || !(request.body instanceof ArrayBuffer)) return { fields: {}, files: [] };

    return parseMultipart(request.body, boundary);
  }
}
