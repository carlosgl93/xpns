import { describe, it, expect, vi, beforeEach } from 'vitest';

// Module-level mocks (vitest hoists vi.mock, but variables in scope are accessible)
const mockGetUser = vi.fn().mockResolvedValue({ customClaims: null });
const mockSetCustomUserClaims = vi.fn().mockResolvedValue(undefined);
const mockTxnSet = vi.fn();
const mockRunTransaction = vi.fn().mockImplementation(async (fn: (txn: { set: typeof mockTxnSet }) => Promise<void>) => {
  await fn({ set: mockTxnSet });
});
const mockOrgDocRef = { id: 'org-generated-id' };
const mockCollectionDoc = vi.fn().mockReturnValue(mockOrgDocRef);
const mockCollectionFn = vi.fn().mockReturnValue({ doc: mockCollectionDoc });
const mockDocFn = vi.fn().mockImplementation((path: string) => ({ id: `ref-${path}` }));

vi.mock('firebase-admin/app', () => ({
  initializeApp: vi.fn(),
  getApps: vi.fn().mockReturnValue([]),
}));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn().mockReturnValue({
    collection: mockCollectionFn,
    doc: mockDocFn,
    runTransaction: mockRunTransaction,
  }),
  FieldValue: { serverTimestamp: vi.fn().mockReturnValue('__ts__') },
}));

vi.mock('firebase-admin/auth', () => ({
  getAuth: vi.fn().mockReturnValue({
    getUser: mockGetUser,
    setCustomUserClaims: mockSetCustomUserClaims,
  }),
}));

describe('setOrgClaimsLogic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ customClaims: null });
    mockRunTransaction.mockImplementation(async (fn: (txn: { set: typeof mockTxnSet }) => Promise<void>) => {
      await fn({ set: mockTxnSet });
    });
    mockCollectionDoc.mockReturnValue(mockOrgDocRef);
    mockSetCustomUserClaims.mockResolvedValue(undefined);
  });

  it('creates org doc inside transaction with correct fields', async () => {
    const { setOrgClaimsLogic } = await import('./setOrgClaims');
    await setOrgClaimsLogic('uid-1', 'admin@test.com', { orgName: 'Acme Corp', defaultCurrency: 'CLP' });

    expect(mockTxnSet).toHaveBeenCalledWith(
      mockOrgDocRef,
      expect.objectContaining({
        name: 'Acme Corp',
        ownerEmail: 'admin@test.com',
        plan: 'free',
        defaultCurrency: 'CLP',
        createdAt: '__ts__',
      })
    );
  });

  it('creates member doc with role admin inside transaction', async () => {
    const { setOrgClaimsLogic } = await import('./setOrgClaims');
    await setOrgClaimsLogic('uid-1', 'admin@test.com', { orgName: 'Acme Corp', defaultCurrency: 'CLP' });

    expect(mockTxnSet).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        email: 'admin@test.com',
        role: 'admin',
        status: 'active',
        createdAt: '__ts__',
      })
    );
    expect(mockDocFn).toHaveBeenCalledWith(`orgs/org-generated-id/members/uid-1`);
  });

  it('sets custom claims with orgId and role admin', async () => {
    const { setOrgClaimsLogic } = await import('./setOrgClaims');
    await setOrgClaimsLogic('uid-1', 'admin@test.com', { orgName: 'Acme Corp', defaultCurrency: 'CLP' });

    expect(mockSetCustomUserClaims).toHaveBeenCalledWith('uid-1', {
      orgId: 'org-generated-id',
      role: 'admin',
    });
  });

  it('returns the generated orgId', async () => {
    const { setOrgClaimsLogic } = await import('./setOrgClaims');
    const result = await setOrgClaimsLogic('uid-1', 'admin@test.com', { orgName: 'Acme Corp', defaultCurrency: 'CLP' });

    expect(result).toEqual({ orgId: 'org-generated-id' });
  });

  it('throws if user already belongs to an org', async () => {
    mockGetUser.mockResolvedValue({ customClaims: { orgId: 'existing-org', role: 'admin' } });
    const { setOrgClaimsLogic } = await import('./setOrgClaims');
    await expect(
      setOrgClaimsLogic('uid-1', 'admin@test.com', { orgName: 'Acme Corp', defaultCurrency: 'CLP' })
    ).rejects.toThrow();
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it('throws on empty orgName', async () => {
    const { setOrgClaimsLogic } = await import('./setOrgClaims');
    await expect(
      setOrgClaimsLogic('uid-1', 'admin@test.com', { orgName: '  ', defaultCurrency: 'CLP' })
    ).rejects.toThrow();
  });

  it('throws on empty defaultCurrency', async () => {
    const { setOrgClaimsLogic } = await import('./setOrgClaims');
    await expect(
      setOrgClaimsLogic('uid-1', 'admin@test.com', { orgName: 'Acme', defaultCurrency: '' })
    ).rejects.toThrow();
  });

  it('calls collection("orgs") to generate org ref', async () => {
    const { setOrgClaimsLogic } = await import('./setOrgClaims');
    await setOrgClaimsLogic('uid-1', 'admin@test.com', { orgName: 'Acme Corp', defaultCurrency: 'USD' });

    expect(mockCollectionFn).toHaveBeenCalledWith('orgs');
    expect(mockCollectionDoc).toHaveBeenCalled();
  });
});
