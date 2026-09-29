import { BytiumExternalDependencyDataInterface } from "@core/interfaces/bytium-external-dependency-data.interface";

const EXTERNAL_TOKEN_PATTERN = /^[^:]+:[^:]+:[^:]+$/;

export function isExternalTokenString(token: string): boolean {
  return EXTERNAL_TOKEN_PATTERN.test(token);
}

export function parseExternalDependencyName(name: string): BytiumExternalDependencyDataInterface {
  const [resourceName, moduleName, providerName] = name.split(":");

  return {
    name,
    resourceName,
    moduleName,
    providerName,
  };
}
