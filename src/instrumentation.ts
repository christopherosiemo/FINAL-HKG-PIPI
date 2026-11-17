import type { Instrumentation } from 'next';
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const event = {
    event: 'server.request.error',
    type: error instanceof Error ? error.name : 'UnknownError',
    digest:
      typeof error === 'object' && error !== null && 'digest' in error
        ? String(error.digest).slice(0, 256)
        : null,
    method: request.method,
    route: context.routePath,
    routeType: context.routeType,
    time: new Date().toISOString(),
  };
  // Never transmit headers, bodies, query strings, cookies or raw exception messages.
  console.error(JSON.stringify(event));
  const destination = process.env.ERROR_MONITORING_WEBHOOK_URL;
  if (destination?.startsWith('https://'))
    try {
      await fetch(destination, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
        signal: AbortSignal.timeout(3000),
      });
    } catch {
      console.error('error_monitoring_delivery_failed');
    }
};
