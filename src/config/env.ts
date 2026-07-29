const HTTP_PROTOCOLS = new Set(["http:", "https:"]);
const DEFAULT_SIGNALR_HUB_PATH = "/project";

export function parseApiBaseUrl(value: string | undefined): string | undefined {
  const baseUrl = value?.trim();

  if (!baseUrl) {
    return undefined;
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(baseUrl);
  } catch {
    throw new Error("VITE_API_BASE_URL must be a valid absolute URL.");
  }

  if (!HTTP_PROTOCOLS.has(parsedUrl.protocol)) {
    throw new Error("VITE_API_BASE_URL must use the http or https protocol.");
  }

  return baseUrl.replace(/\/+$/, "");
}

export function parseSignalRHubUrl(value: string | undefined): string | undefined {
  const hubUrl = value?.trim();

  if (!hubUrl) {
    return undefined;
  }

  if (hubUrl.startsWith("/")) {
    return hubUrl.replace(/\/+$/, "") || "/";
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(hubUrl);
  } catch {
    throw new Error("VITE_SIGNALR_HUB_URL must be an absolute URL or a root-relative path.");
  }

  if (!HTTP_PROTOCOLS.has(parsedUrl.protocol)) {
    throw new Error("VITE_SIGNALR_HUB_URL must use the http or https protocol.");
  }

  return hubUrl.replace(/\/+$/, "");
}

export function resolveSignalRHubUrl(
  signalRHubUrl: string | undefined,
  apiBaseUrl: string | undefined,
): string {
  const configuredHubUrl = parseSignalRHubUrl(signalRHubUrl);

  if (configuredHubUrl) {
    return configuredHubUrl;
  }

  const configuredApiBaseUrl = parseApiBaseUrl(apiBaseUrl);

  if (configuredApiBaseUrl) {
    return new URL(DEFAULT_SIGNALR_HUB_PATH, configuredApiBaseUrl).toString().replace(/\/$/, "");
  }

  return DEFAULT_SIGNALR_HUB_PATH;
}

export const env = Object.freeze({
  apiBaseUrl: parseApiBaseUrl(import.meta.env.VITE_API_BASE_URL),
  signalRHubUrl: resolveSignalRHubUrl(
    import.meta.env.VITE_SIGNALR_HUB_URL,
    import.meta.env.VITE_API_BASE_URL,
  ),
});
