/**
 * Thrown when the requested TypeORM data source is not found (it was not registered via `TypeOrmModule.forRoot`).
 */
export class DataSourceNotFoundException extends Error {
  constructor(message?: string) {
    super(message);

    this.name = "DataSourceNotFoundException";
  }
}
