import { useEffect, useState } from 'react';

/**
 * Mirrors `value` but updates only after it has been stable for `delayMs`.
 * Useful for search fields so filtering does not run on every keystroke.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
