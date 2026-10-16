// secret-bearing header names always masked in access-line logs
export const REDACTED_HEADERS = new Set(["authorization", "cookie", "set-cookie", "x-api-key", "proxy-authorization"]);
