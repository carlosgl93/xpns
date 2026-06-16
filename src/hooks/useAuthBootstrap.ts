// Auth bootstrap helpers — use these from Astro pages / Preact components
// that need to wait for the auth state to settle before rendering.
//
// `bootstrapAuth`  : wraps `initAuth` (which is async and side-effectful —
//                   it sets up onAuthStateChanged and updates signals).
//                   Returns the unsubscribe function.
// `whenAuthReady`  : resolves once `authLoading` is false. Uses a signal
//                   effect under the hood (no setInterval polling) so it
//                   tears down cleanly when the promise resolves.

import { effect } from '@preact/signals';
import { authLoading, initAuth } from './useAuth';

export type Cleanup = () => void;

export async function bootstrapAuth(): Promise<Cleanup> {
  return initAuth();
}

export function whenAuthReady(): Promise<void> {
  return new Promise((resolve) => {
    if (!authLoading.value) {
      resolve();
      return;
    }
    const dispose = effect(() => {
      if (!authLoading.value) {
        dispose();
        resolve();
      }
    });
  });
}
