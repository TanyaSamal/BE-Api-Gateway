/**
 * Domain Exception Layer
 *
 * Специализированные исключения, которые отражают бизнес-правила домена.
 * Используются для явной обработки ошибок на уровне приложения.
 */

export class AnalyticsDomainException extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class AnalyticsDownloadException extends AnalyticsDomainException {
  constructor(message: string) {
    super(
      `Analytics download failed: ${message}`,
      'ANALYTICS_DOWNLOAD_FAILED',
      500,
    );
  }
}

export class AnalyticsLogParsingException extends AnalyticsDomainException {
  constructor(message: string, readonly lineNumber?: number) {
    super(
      `Failed to parse analytics log: ${message}${
        lineNumber ? ` at line ${lineNumber}` : ''
      }`,
      'LOG_PARSING_FAILED',
      400,
    );
  }
}

export class AnalyticsRepositoryException extends AnalyticsDomainException {
  constructor(message: string) {
    super(
      `Analytics repository error: ${message}`,
      'REPOSITORY_ERROR',
      503,
    );
  }
}

export class AnalyticsMicroserviceException extends AnalyticsDomainException {
  constructor(message: string, readonly originalError?: Error) {
    super(
      `Microservice error: ${message}`,
      'MICROSERVICE_ERROR',
      502,
    );
  }
}

export class InvalidExportMetadataException extends AnalyticsDomainException {
  constructor(message: string) {
    super(
      `Invalid export metadata: ${message}`,
      'INVALID_EXPORT_METADATA',
      400,
    );
  }
}
