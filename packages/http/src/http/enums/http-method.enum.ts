/**
 * HTTP method of a route.
 */
export enum HttpMethodEnum {
  /** Retrieves a resource. */
  GET = "GET",

  /** Creates a resource. */
  POST = "POST",

  /** Replaces a resource. */
  PUT = "PUT",

  /** Removes a resource. */
  DELETE = "DELETE",

  /** Partially updates a resource. */
  PATCH = "PATCH",

  /** Retrieves a resource's headers without its body. */
  HEAD = "HEAD",

  /** Matches a request of any method. */
  ALL = "ALL",
}
