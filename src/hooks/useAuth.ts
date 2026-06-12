import { signal } from '@preact/signals';
import type { User } from 'firebase/auth';

export interface AuthClaims {
  orgId?: string;
  role?: 'admin' | 'employee';
}

export const authUser = signal<User | null>(null);
export const authClaims = signal<AuthClaims | null>(null);
export const authLoading = signal(true);

export async function handleAuthChange(user: User | null): Promise<void> {
  if (user) {
    const tokenResult = await user.getIdTokenResult();
    authClaims.value = {
      orgId: tokenResult.claims['orgId'] as string | undefined,
      role: tokenResult.claims['role'] as 'admin' | 'employee' | undefined,
    };
    authUser.value = user;
  } else {
    authUser.value = null;
    authClaims.value = null;
  }
  authLoading.value = false;
}

export async function initAuth(): Promise<() => void> {
  const { onAuthStateChanged } = await import('firebase/auth');
  const { getAuth } = await import('../lib/firebase');
  const auth = await getAuth();
  return onAuthStateChanged(auth, handleAuthChange);
}

export function useAuth() {
  return {
    user: authUser.value,
    claims: authClaims.value,
    loading: authLoading.value,
  };
}

export async function signIn(email: string, password: string): Promise<void> {
  const { signInWithEmailAndPassword } = await import('firebase/auth');
  const { getAuth } = await import('../lib/firebase');
  const auth = await getAuth();
  await signInWithEmailAndPassword(auth, email, password);
}

export async function signUp(email: string, password: string): Promise<void> {
  const { createUserWithEmailAndPassword } = await import('firebase/auth');
  const { getAuth } = await import('../lib/firebase');
  const auth = await getAuth();
  await createUserWithEmailAndPassword(auth, email, password);
}

export async function signOut(): Promise<void> {
  const { signOut: fbSignOut } = await import('firebase/auth');
  const { getAuth } = await import('../lib/firebase');
  const auth = await getAuth();
  await fbSignOut(auth);
}
