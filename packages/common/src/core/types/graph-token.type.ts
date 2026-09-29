import { ConstructorType } from "@shared";

/** Identity of a graph node - a class constructor, a string token, or a symbol token. */
export type GraphTokenType = ConstructorType | string | symbol;
