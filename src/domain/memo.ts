/**
 * Remembers a pure function's result for the same records object and key, such as a date.
 * Records are never changed in place, so the same object always gives the same answer, and
 * the result is frozen so that no caller can change what another will read. Results go when
 * the records object does.
 */
export function remembered<Data extends object, Result extends object>(
  work: (data: Data, key: string) => Result,
  limit = 8,
) {
  const cache = new WeakMap<Data, Map<string, Result>>();
  return (data: Data, key: string): Result => {
    let byKey = cache.get(data);
    if (!byKey) {
      byKey = new Map();
      cache.set(data, byKey);
    }
    const known = byKey.get(key);
    if (known) return known;
    const result = Object.freeze(work(data, key));
    // A few dates at most are asked for at once; older ones make room.
    if (byKey.size >= limit) {
      const oldest = byKey.keys().next().value;
      if (oldest !== undefined) byKey.delete(oldest);
    }
    byKey.set(key, result);
    return result;
  };
}
