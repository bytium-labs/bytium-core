// secret-named data keys always masked in the logged query, params and body
export const REDACTED_KEY_NAMES = new Set(["password", "token", "secret", "apikey", "api_key", "authorization"]);
