import { useSyncExternalStore } from 'react';

const noop = () => () => {};

/** True after hydration, false during SSR, without a setState-in-effect round trip. */
export function useMounted() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
