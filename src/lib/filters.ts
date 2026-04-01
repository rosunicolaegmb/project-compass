const STORAGE_PREFIX = "app_filters_";

export function saveFilters(pageKey: string, filters: Record<string, string>) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${pageKey}`, JSON.stringify(filters));
  } catch {}
}

export function loadFilters(pageKey: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${pageKey}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
