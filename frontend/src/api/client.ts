import axios from "axios";

let getAccessToken: () => string | null = () => null;

export function setAccessTokenGetter(fn: () => string | null): void {
  getAccessToken = fn;
}

const rawBase = import.meta.env.VITE_API_BASE_URL;
const baseURL =
  typeof rawBase === "string" && rawBase.length > 0 ? rawBase.replace(/\/$/, "") : undefined;

export const apiClient = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
  validateStatus: () => true,
});

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
