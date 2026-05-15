import * as appInsights from 'applicationinsights';

let started = false;

export function initTelemetry(): appInsights.TelemetryClient | undefined {
  if (started) return appInsights.defaultClient;
  const conn = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
  if (!conn) return undefined;
  appInsights
    .setup(conn)
    .setAutoCollectConsole(true, true)
    .setAutoCollectExceptions(true)
    .setAutoCollectRequests(true)
    .setAutoCollectDependencies(true)
    .start();
  started = true;
  return appInsights.defaultClient;
}

export function trackPublish(properties: {
  episodeId: string;
  userSlug: string;
  durationMs: number;
}): void {
  const client = initTelemetry();
  client?.trackEvent({
    name: 'EchoEpisodePublished',
    properties: {
      episodeId: properties.episodeId,
      userSlug: properties.userSlug,
      durationMs: String(properties.durationMs)
    }
  });
}
