import { HttpRequest } from "@bytium-core/http";
import { ParsedMultipart } from "@multipart/interfaces/parsed-multipart.interface";

/** Holds the parsed multipart body per request, shared between the interceptor that fills it and the decorators that read it. */
export const multipartCache = new WeakMap<HttpRequest, ParsedMultipart>();
