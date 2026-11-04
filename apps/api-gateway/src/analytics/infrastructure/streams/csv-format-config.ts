/**
 * CSV Format Configuration
 *
 * Определяет маппинг полей аналитического лога на CSV колонки.
 * Позволяет легко менять порядок и состав экспортируемых полей.
 */

export interface CsvColumn {
  name: string;
  label: string;
  getter: (data: Record<string, any>) => string;
}

export interface CsvFormatConfig {
  columns: CsvColumn[];
  delimiter: string;
  lineEnding: string;
  includeHeader: boolean;
}

export const DEFAULT_CSV_CONFIG: CsvFormatConfig = {
  columns: [
    {
      name: 'correlationId',
      label: 'Correlation ID',
      getter: (data) => data.correlationId || '',
    },
    {
      name: 'action',
      label: 'Action',
      getter: (data) => data.action || '',
    },
    {
      name: 'payload',
      label: 'Payload',
      getter: (data) =>
        typeof data.payload === 'string'
          ? data.payload
          : JSON.stringify(data.payload || {}),
    },
    {
      name: 'createdAt',
      label: 'Timestamp',
      getter: (data) => data.createdAt || '',
    },
  ],
  delimiter: ',',
  lineEnding: '\r\n',
  includeHeader: true,
};

export const EXTENDED_CSV_CONFIG: CsvFormatConfig = {
  ...DEFAULT_CSV_CONFIG,
  columns: [
    ...DEFAULT_CSV_CONFIG.columns,
    {
      name: 'userId',
      label: 'User ID',
      getter: (data) =>
        (data.payload as any)?.userId?.toString() || 'N/A',
    },
    {
      name: 'eventName',
      label: 'Event Name',
      getter: (data) =>
        (data.payload as any)?.eventName?.toString() || 'N/A',
    },
  ],
};

export function getCsvConfig(extended: boolean = false): CsvFormatConfig {
  return extended ? EXTENDED_CSV_CONFIG : DEFAULT_CSV_CONFIG;
}
