import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase lazy singletons before any import
vi.mock('../../lib/firebase', () => ({
  getAuth: vi.fn().mockResolvedValue({}),
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}));

describe('handleAuthChange', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset module-level signal state between tests
    const mod = await import('../../hooks/useAuth');
    mod.authUser.value = null;
    mod.authClaims.value = null;
    mod.authLoading.value = true;
  });

  it('sets authLoading to false when called with null user', async () => {
    const { handleAuthChange, authLoading } = await import('../../hooks/useAuth');
    await handleAuthChange(null);
    expect(authLoading.value).toBe(false);
  });

  it('clears authUser and authClaims on sign-out', async () => {
    const { handleAuthChange, authUser, authClaims } = await import('../../hooks/useAuth');
    authUser.value = { uid: 'uid-1' } as any;
    authClaims.value = { orgId: 'org-1', role: 'admin' };

    await handleAuthChange(null);

    expect(authUser.value).toBeNull();
    expect(authClaims.value).toBeNull();
  });

  it('sets authUser signal when user signs in', async () => {
    const mockUser = {
      uid: 'uid-1',
      email: 'admin@test.com',
      getIdTokenResult: vi.fn().mockResolvedValue({ claims: {} }),
    };
    const { handleAuthChange, authUser } = await import('../../hooks/useAuth');
    await handleAuthChange(mockUser as any);
    expect(authUser.value).toBe(mockUser);
  });

  it('calls getIdTokenResult on the user', async () => {
    const mockGetIdTokenResult = vi.fn().mockResolvedValue({ claims: {} });
    const mockUser = {
      uid: 'uid-1',
      email: 'admin@test.com',
      getIdTokenResult: mockGetIdTokenResult,
    };
    const { handleAuthChange } = await import('../../hooks/useAuth');
    await handleAuthChange(mockUser as any);
    expect(mockGetIdTokenResult).toHaveBeenCalled();
  });

  it('sets authClaims with orgId and role from token', async () => {
    const mockUser = {
      uid: 'uid-1',
      email: 'admin@test.com',
      getIdTokenResult: vi.fn().mockResolvedValue({
        claims: { orgId: 'org-abc', role: 'admin' },
      }),
    };
    const { handleAuthChange, authClaims } = await import('../../hooks/useAuth');
    await handleAuthChange(mockUser as any);
    expect(authClaims.value).toEqual({ orgId: 'org-abc', role: 'admin' });
  });

  it('sets authLoading to false after processing user', async () => {
    const mockUser = {
      uid: 'uid-1',
      email: 'admin@test.com',
      getIdTokenResult: vi.fn().mockResolvedValue({ claims: { orgId: 'org-1', role: 'employee' } }),
    };
    const { handleAuthChange, authLoading } = await import('../../hooks/useAuth');
    await handleAuthChange(mockUser as any);
    expect(authLoading.value).toBe(false);
  });

  it('useAuth returns current signal values', async () => {
    const { handleAuthChange, useAuth } = await import('../../hooks/useAuth');
    const mockUser = {
      uid: 'uid-1',
      email: 'emp@test.com',
      getIdTokenResult: vi.fn().mockResolvedValue({
        claims: { orgId: 'org-x', role: 'employee' },
      }),
    };
    await handleAuthChange(mockUser as any);

    const state = useAuth();
    expect(state.user).toBe(mockUser);
    expect(state.claims).toEqual({ orgId: 'org-x', role: 'employee' });
    expect(state.loading).toBe(false);
  });
});
