import axios from "axios";
import { getAccessToken, setAccessTokenGetter } from "./accessTokenBinding";

export { setAccessTokenGetter } from "./accessTokenBinding";

type SessionTokenStore = {
  session: { accessToken: string | undefined };
};

/** Call once from composition root after `createRootStore()` so refresh uses session token. */
export function bindApiClientSession(store: SessionTokenStore): void {
  setAccessTokenGetter(() => store.session.accessToken ?? null);
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
