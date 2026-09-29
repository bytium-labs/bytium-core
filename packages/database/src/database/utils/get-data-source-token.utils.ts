/**
 * Returns the DI token string for registering and resolving a named `DataSource`.
 *
 * @example
 * ```ts
 * {
 *   provide: AlbumsService,
 *   useFactory: (ds: DataSource) => new AlbumsService(ds),
 *   inject: [getDataSourceToken("albumsConnection")],
 * }
 * ```
 */
export function getDataSourceToken(dataSourceName = "default"): string {
  return `DataSource_${dataSourceName}`;
}
