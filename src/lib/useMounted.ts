import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** false during SSR and hydration, true afterwards — lets client-only state (sessionStorage) be read during render safely. */
export function useMounted(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}
