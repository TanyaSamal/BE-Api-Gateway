import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

export function initTracing(defaultServiceName: string): NodeSDK {
  const traceExporter = new OTLPTraceExporter({
    url:
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
      'http://localhost:4318/v1/traces',
  });

  const sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME || defaultServiceName,
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Отключаем лишний шум от системных вызовов fs, оставляя HTTP, Express, Nest, ioredis и amqplib
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-socket.io': { enabled: false },
      }),
    ],
  });

  sdk.start();

  process.on('SIGTERM', () => {
    sdk.shutdown().catch((err) => console.error('OTel shutdown error', err));
  });

  return sdk;
}
