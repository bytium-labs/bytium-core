/**
 * Options for a route decorator (`@Get`, `@Post`, ...).
 */
export interface RouteOptions {
  /** Read the request body as binary (`ArrayBuffer`) instead of a UTF-8 string. */
  binary?: boolean;
}
