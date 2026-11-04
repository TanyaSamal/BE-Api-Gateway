/**
 * CQRS Query: Download Analytics CSV
 *
 * Запрос для выгрузки аналитики в CSV.
 * Инкапсулирует параметры экспорта (фильтры, формат).
 */

import { ExportMetadata } from '../../domain/value-objects/export-metadata.vo';

export class DownloadAnalyticsCsvQuery {
  constructor(
    readonly metadata: ExportMetadata = new ExportMetadata(),
    readonly userId?: string,
  ) {}
}
