import { ConstructorType } from "@shared";

export function getTokenName(token: string | symbol | ConstructorType | undefined | null): string {
  if (token === undefined || token === null) return "(undefined)";

  if (typeof token === "string") return token;

  if (typeof token === "symbol") return token.toString();

  return token.name;
}
