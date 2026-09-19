import { useEffect, useState } from "react";

/**
 * Custom hook to debounce any fast-changing value (e.g. search input).
 *
 * Delays updating the debounced value until after the specified delay (default 300ms)
 * has elapsed since the last time the value changed.
 *
 * @param value The value to debounce.
 * @param delay Delay duration in milliseconds (default: 300ms).
 * @returns The debounced value.
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
