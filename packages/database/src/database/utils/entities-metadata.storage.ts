import { EntityTarget } from "typeorm";

/**
 * Process-global registry of entities declared per data source, consumed by `TypeOrmModule`.
 */
export class EntitiesMetadataStorage {
  private static readonly storage = new Map<string, EntityTarget<any>[]>();

  static addEntitiesByDataSource(dataSourceName: string, entities: EntityTarget<any>[]): void {
    const existing = this.storage.get(dataSourceName) ?? [];
    const next = [...existing];

    for (const entity of entities) {
      if (!next.includes(entity)) next.push(entity);
    }

    this.storage.set(dataSourceName, next);
  }

  static getEntitiesByDataSource(dataSourceName: string): EntityTarget<any>[] {
    return this.storage.get(dataSourceName) ?? [];
  }

  static clear(dataSourceName?: string): void {
    if (dataSourceName === undefined) {
      this.storage.clear();

      return;
    }

    this.storage.delete(dataSourceName);
  }
}
