let getter: () => string | null = () => null;

export function setAccessTokenGetter(fn: () => string | null): void {
  getter = fn;
}

export function getAccessToken(): string | null {
  return getter();
}
