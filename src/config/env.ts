const HTTP_PROTOCOLS = new Set(["http:", "https:"]);

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

export function parseMapboxAccessToken(value: string | undefined): string | undefined {
  const accessToken = value?.trim();
  return accessToken || undefined;
}

export const env = Object.freeze({
  apiBaseUrl: parseApiBaseUrl(import.meta.env.VITE_API_BASE_URL),
  mapboxAccessToken: parseMapboxAccessToken(import.meta.env.VITE_MAPBOX_ACCESS_TOKEN),
});
