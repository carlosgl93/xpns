import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetUser = vi.fn().mockResolvedValue({ customClaims: null });
const mockSetCustomUserClaims = vi.fn().mockResolvedValue(undefined);
const mockTxnGet = vi.fn();
const mockTxnUpdate = vi.fn();
const mockRunTransaction = vi.fn().mockImplementation(
  async (fn: (txn: { get: typeof mockTxnGet; update: typeof mockTxnUpdate }) => Promise<void>) => {
    await fn({ get: mockTxnGet, update: mockTxnUpdate });
  }
);
const mockDocSet = vi.fn().mockResolvedValue(undefined);
const mockDocFn = vi.fn().mockReturnValue({ id: 'mock-invite-ref', set: mockDocSet });

vi.mock('firebase-admin/app', () => ({
  initializeApp: vi.fn(),
  getApps: vi.fn().mockReturnValue([]),
}));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn().mockReturnValue({
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

function makeInviteSnap(overrides: Record<string, unknown> = {}) {
  return {
    exists: true,
    data: () => ({
      email: 'alice@test.com',
      createdAt: { toMillis: () => Date.now() - 1000 },
      expiresAt: { toMillis: () => Date.now() + 86400000 },
      usedAt: null,
      ...overrides,
    }),
  };
}

describe('processInviteLogic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ customClaims: null });
    mockTxnUpdate.mockResolvedValue(undefined);
    mockSetCustomUserClaims.mockResolvedValue(undefined);
    mockDocSet.mockResolvedValue(undefined);
    mockDocFn.mockReturnValue({ id: 'mock-invite-ref', set: mockDocSet });
    mockRunTransaction.mockImplementation(
      async (fn: (txn: { get: typeof mockTxnGet; update: typeof mockTxnUpdate }) => Promise<void>) => {
        await fn({ get: mockTxnGet, update: mockTxnUpdate });
      }
    );
  });

  it('sets employee claims when invite is valid', async () => {
    mockTxnGet.mockResolvedValue(makeInviteSnap());
    const { processInviteLogic } = await import('./processInvite');
    await processInviteLogic('uid-alice', 'alice@test.com', { token: 'tok1', orgId: 'org1' });

    expect(mockSetCustomUserClaims).toHaveBeenCalledWith('uid-alice', {
      orgId: 'org1',
      role: 'employee',
    });
  });

  it('marks invite as used (usedAt + usedBy) inside transaction', async () => {
    mockTxnGet.mockResolvedValue(makeInviteSnap());
    const { processInviteLogic } = await import('./processInvite');
    await processInviteLogic('uid-alice', 'alice@test.com', { token: 'tok1', orgId: 'org1' });

    expect(mockTxnUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ usedAt: '__ts__', usedBy: 'uid-alice' })
    );
  });

  it('returns orgId on success', async () => {
    mockTxnGet.mockResolvedValue(makeInviteSnap());
    const { processInviteLogic } = await import('./processInvite');
    const result = await processInviteLogic('uid-alice', 'alice@test.com', { token: 'tok1', orgId: 'org1' });

    expect(result).toEqual({ orgId: 'org1' });
  });

  it('reads invite from orgs/{orgId}/invites/{token}', async () => {
    mockTxnGet.mockResolvedValue(makeInviteSnap());
    const { processInviteLogic } = await import('./processInvite');
    await processInviteLogic('uid-alice', 'alice@test.com', { token: 'tok-abc', orgId: 'org-xyz' });

    expect(mockDocFn).toHaveBeenCalledWith('orgs/org-xyz/invites/tok-abc');
  });

  it('returns early without touching Firestore when user already has matching claims', async () => {
    mockGetUser.mockResolvedValue({ customClaims: { orgId: 'org1', role: 'employee' } });
    const { processInviteLogic } = await import('./processInvite');
    const result = await processInviteLogic('uid-alice', 'alice@test.com', { token: 'tok1', orgId: 'org1' });

    expect(result).toEqual({ orgId: 'org1' });
    expect(mockRunTransaction).not.toHaveBeenCalled();
    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
  });

  it('throws not-found when invite does not exist', async () => {
    mockTxnGet.mockResolvedValue({ exists: false, data: () => null });
    const { processInviteLogic } = await import('./processInvite');
    await expect(
      processInviteLogic('uid-alice', 'alice@test.com', { token: 'bad', orgId: 'org1' })
    ).rejects.toThrow();
  });

  it('throws when invite email does not match user email', async () => {
    mockTxnGet.mockResolvedValue(makeInviteSnap({ email: 'other@test.com' }));
    const { processInviteLogic } = await import('./processInvite');
    await expect(
      processInviteLogic('uid-alice', 'alice@test.com', { token: 'tok1', orgId: 'org1' })
    ).rejects.toThrow();
  });

  it('throws when invite is expired', async () => {
    mockTxnGet.mockResolvedValue(
      makeInviteSnap({ expiresAt: { toMillis: () => Date.now() - 1000 } })
    );
    const { processInviteLogic } = await import('./processInvite');
    await expect(
      processInviteLogic('uid-alice', 'alice@test.com', { token: 'tok1', orgId: 'org1' })
    ).rejects.toThrow();
  });

  it('throws when invite has already been used', async () => {
    mockTxnGet.mockResolvedValue(
      makeInviteSnap({ usedAt: { toMillis: () => Date.now() - 3600000 } })
    );
    const { processInviteLogic } = await import('./processInvite');
    await expect(
      processInviteLogic('uid-alice', 'alice@test.com', { token: 'tok1', orgId: 'org1' })
    ).rejects.toThrow();
  });

  it('allows join if invite has no email restriction', async () => {
    mockTxnGet.mockResolvedValue(makeInviteSnap({ email: undefined }));
    const { processInviteLogic } = await import('./processInvite');
    await expect(
      processInviteLogic('uid-bob', 'bob@test.com', { token: 'tok1', orgId: 'org1' })
    ).resolves.toEqual({ orgId: 'org1' });
  });

  // P1-E: orgId in claims must come from the invite doc, not from client input
  it('sets claims with orgId from invite doc, not input.orgId', async () => {
    // Invite doc has orgId: 'org-from-doc'; client passes orgId: 'org1' (same path, but claims must use doc value)
    mockTxnGet.mockResolvedValue(makeInviteSnap({ orgId: 'org-from-doc' }));
    const { processInviteLogic } = await import('./processInvite');
    await processInviteLogic('uid-alice', 'alice@test.com', { token: 'tok1', orgId: 'org1' });

    expect(mockSetCustomUserClaims).toHaveBeenCalledWith('uid-alice', {
      orgId: 'org-from-doc',
      role: 'employee',
    });
  });

  it('creates member doc under org from invite doc, not input.orgId', async () => {
    mockTxnGet.mockResolvedValue(makeInviteSnap({ orgId: 'org-from-doc' }));
    const { processInviteLogic } = await import('./processInvite');
    await processInviteLogic('uid-alice', 'alice@test.com', { token: 'tok1', orgId: 'org1' });

    expect(mockDocFn).toHaveBeenCalledWith('orgs/org-from-doc/members/uid-alice');
  });
});
