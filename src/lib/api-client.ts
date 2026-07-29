import Axios, {
  type AxiosError,
  AxiosHeaders,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";

import { env } from "@/config/env";

type AccessTokenProvider = () => string | null | undefined;

export type ApiClientOptions = {
  baseURL?: string;
  getAccessToken?: AccessTokenProvider;
  headers?: AxiosRequestConfig["headers"];
  onError?: (error: AxiosError) => void;
  onUnauthorized?: (error: AxiosError) => void;
  withCredentials?: boolean;
};

export type ApiClient = {
  delete: <TResponse>(url: string, config?: AxiosRequestConfig) => Promise<TResponse>;
  get: <TResponse>(url: string, config?: AxiosRequestConfig) => Promise<TResponse>;
  patch: <TResponse, TBody = unknown>(
    url: string,
    data?: TBody,
    config?: AxiosRequestConfig,
  ) => Promise<TResponse>;
  post: <TResponse, TBody = unknown>(
    url: string,
    data?: TBody,
    config?: AxiosRequestConfig,
  ) => Promise<TResponse>;
  put: <TResponse, TBody = unknown>(
    url: string,
    data?: TBody,
    config?: AxiosRequestConfig,
  ) => Promise<TResponse>;
  raw: AxiosInstance;
  request: <TResponse>(config: AxiosRequestConfig) => Promise<TResponse>;
};

function addAccessToken(
  config: InternalAxiosRequestConfig,
  getAccessToken: AccessTokenProvider,
): InternalAxiosRequestConfig {
  const accessToken = getAccessToken();

  if (!accessToken) {
    return config;
  }

  const headers = AxiosHeaders.from(config.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);

  return { ...config, headers };
}

export function createApiClient({
  baseURL = env.apiBaseUrl,
  getAccessToken,
  headers,
  onError,
  onUnauthorized,
  withCredentials = false,
}: ApiClientOptions = {}): ApiClient {
  const client = Axios.create({
    baseURL,
    headers: {
      Accept: "application/json",
      ...headers,
    },
    withCredentials,
  });

  if (getAccessToken) {
    client.interceptors.request.use((config) => addAccessToken(config, getAccessToken));
  }

  client.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      if (error.response?.status === 401) {
        onUnauthorized?.(error);
      }

      onError?.(error);
      return Promise.reject(error);
    },
  );

  return {
    delete<TResponse>(url: string, config?: AxiosRequestConfig) {
      return client.delete<TResponse>(url, config).then((response) => response.data);
    },
    get<TResponse>(url: string, config?: AxiosRequestConfig) {
      return client.get<TResponse>(url, config).then((response) => response.data);
    },
    patch<TResponse, TBody = unknown>(url: string, data?: TBody, config?: AxiosRequestConfig) {
      return client.patch<TResponse>(url, data, config).then((response) => response.data);
    },
    post<TResponse, TBody = unknown>(url: string, data?: TBody, config?: AxiosRequestConfig) {
      return client.post<TResponse>(url, data, config).then((response) => response.data);
    },
    put<TResponse, TBody = unknown>(url: string, data?: TBody, config?: AxiosRequestConfig) {
      return client.put<TResponse>(url, data, config).then((response) => response.data);
    },
    raw: client,
    request<TResponse>(config: AxiosRequestConfig) {
      return client.request<TResponse>(config).then((response) => response.data);
    },
  } satisfies ApiClient;
}

export const apiClient = createApiClient();
