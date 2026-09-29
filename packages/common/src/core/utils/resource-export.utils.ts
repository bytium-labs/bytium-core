export function getResourceExport(resourceName: string, exportName: string): any {
  try {
    return global.exports[resourceName][exportName];
  } catch {
    return undefined;
  }
}
