export type FeatureApiFetch = <T = unknown>(
  path: string,
  options?: RequestInit,
  token?: string | null,
) => Promise<T>;

export function hasCloudSession(token: string | null | undefined): boolean {
  if (token && token.trim().length > 0) return true;
  try {
    const user = localStorage.getItem("clio_user");
    if (user && user !== "null" && user !== "undefined") return true;
    const clioToken = localStorage.getItem("clio_token");
    if (clioToken && clioToken.trim().length > 0) return true;
  } catch {
    // ignore
  }
  return false;
}

export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
