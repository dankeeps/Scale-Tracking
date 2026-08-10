"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** window.location.origin de forma segura para SSR (vazio no servidor). */
export function useOrigin(): string {
  return useSyncExternalStore(
    subscribe,
    () => window.location.origin,
    () => "",
  );
}
