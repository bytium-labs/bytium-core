/**
 * Reflect-metadata keys Bytium stamps on classes, methods, and parameters.
 */
export enum BytiumMetadataEnum {
  /** TypeScript-emitted constructor parameter types. */
  DESIGN_PARAMTYPES = "design:paramtypes",

  /** The dependency kind (provider, controller, module). */
  DEPENDENCY_TYPE = "bytium:dependency:type",

  /** Options passed to the dependency decorator. */
  DEPENDENCY_OPTIONS = "bytium:dependency:options",

  /** Public name a transferable dependency is exported under. */
  DEPENDENCY_PUBLIC_EXPORT_NAME = "bytium:dependency:publicExportName",

  /** Lifecycle scope of the dependency. */
  DEPENDENCY_SCOPE = "bytium:dependency:scope",

  /** Whether the module is global. */
  DEPENDENCY_GLOBAL = "bytium:dependency:global",

  /** Constructor parameter indexes marked optional. */
  DEPENDENCY_OPTIONAL_PARAMS = "bytium:dependency:optionalParams",

  /** Injected properties marked optional. */
  DEPENDENCY_OPTIONAL_PROPERTIES = "bytium:dependency:optionalProperties",

  /** Property injections declared on the class. */
  PROPERTY_INJECTIONS = "bytium:dependency:propertyInjections",

  /** The handler kind a method is registered as. */
  METHOD_TYPE = "bytium:method:type",

  /** Options passed to the method decorator. */
  METHOD_OPTIONS = "bytium:method:options",

  /** Parameter decorators declared on a method. */
  PARAM_DECORATORS = "bytium:method:paramDecorators",

  /** Guards attached to a method or class. */
  GUARDS = "bytium:method:guards",

  /** Pipes attached to a method or class. */
  PIPES = "bytium:method:pipes",

  /** Interceptors attached to a method or class. */
  INTERCEPTORS = "bytium:method:interceptors",

  /** Exception filters attached to a method or class. */
  FILTERS = "bytium:method:filters",

  /** Exception types a filter handles. */
  CATCH = "bytium:filter:catch",
}
