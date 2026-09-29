import { Inject } from "@bytium-core/common";
import { getDataSourceToken } from "@database/utils/get-data-source-token.utils";

/**
 * Injects a named TypeORM `DataSource`.
 *
 * @param dataSourceName Name of the data source to inject.
 */
export function InjectDataSource(dataSourceName = "default"): ParameterDecorator {
  return Inject(getDataSourceToken(dataSourceName));
}
