import { ConstructorType } from "@bytium-core/common";

/**
 * A token a provider is registered and overridden under in a testing module.
 */
export type ProviderToken = string | symbol | ConstructorType;
