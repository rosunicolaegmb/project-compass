/**
 * Fetch all rows from a Supabase query, paginating past the default 1000-row cap.
 * Pass a builder function so each page gets a fresh query with the same filters.
 */
export async function fetchAllRows<T>(
  build: () => any,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  // Hard safety cap to avoid runaway loops
  for (let i = 0; i < 50; i++) {
    const { data, error } = await build().range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
}
