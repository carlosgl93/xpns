import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSetCustomUserClaims = vi.fn().mockResolvedValue(undefined);
const mockInviteUpdate = vi.fn().mockResolvedValue(undefined);
const mockInviteGet = vi.fn();
const mockInviteRef = { get: mockInviteGet, update: mockInviteUpdate };
const mockDocFn = vi.fn().mockReturnValue(mockInviteRef);

vi.mock('firebase-admin/app', () => ({
  initializeApp: vi.fn(),
  getApps: vi.fn().mockReturnValue([]),
}));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn().mockReturnValue({
    doc: mockDocFn,
  }),
  FieldValue: { serverTimestamp: vi.fn().mockReturnValue('__ts__') },
}));

vi.mock('firebase-admin/auth', () => ({
  getAuth: vi.fn().mockReturnValue({
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
    mockInviteUpdate.mockResolvedValue(undefined);
    mockSetCustomUserClaims.mockResolvedValue(undefined);
  });

  it('sets employee claims when invite is valid', async () => {
    mockInviteGet.mockResolvedValue(makeInviteSnap());
    const { processInviteLogic } = await import('./processInvite');
    await processInviteLogic('uid-alice', 'alice@test.com', { token: 'tok1', orgId: 'org1' });

    expect(mockSetCustomUserClaims).toHaveBeenCalledWith('uid-alice', {
      orgId: 'org1',
      role: 'employee',
    });
  });

  it('marks invite as used (usedAt + usedBy)', async () => {
    mockInviteGet.mockResolvedValue(makeInviteSnap());
    const { processInviteLogic } = await import('./processInvite');
    await processInviteLogic('uid-alice', 'alice@test.com', { token: 'tok1', orgId: 'org1' });

    expect(mockInviteUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ usedAt: '__ts__', usedBy: 'uid-alice' })
    );
  });

  it('returns orgId on success', async () => {
    mockInviteGet.mockResolvedValue(makeInviteSnap());
    const { processInviteLogic } = await import('./processInvite');
    const result = await processInviteLogic('uid-alice', 'alice@test.com', { token: 'tok1', orgId: 'org1' });

    expect(result).toEqual({ orgId: 'org1' });
  });

  it('reads invite from orgs/{orgId}/invites/{token}', async () => {
    mockInviteGet.mockResolvedValue(makeInviteSnap());
    const { processInviteLogic } = await import('./processInvite');
    await processInviteLogic('uid-alice', 'alice@test.com', { token: 'tok-abc', orgId: 'org-xyz' });

    expect(mockDocFn).toHaveBeenCalledWith('orgs/org-xyz/invites/tok-abc');
  });

  it('throws not-found when invite does not exist', async () => {
    mockInviteGet.mockResolvedValue({ exists: false, data: () => null });
    const { processInviteLogic } = await import('./processInvite');
    await expect(
      processInviteLogic('uid-alice', 'alice@test.com', { token: 'bad', orgId: 'org1' })
    ).rejects.toThrow();
  });

  it('throws when invite email does not match user email', async () => {
    mockInviteGet.mockResolvedValue(makeInviteSnap({ email: 'other@test.com' }));
    const { processInviteLogic } = await import('./processInvite');
    await expect(
      processInviteLogic('uid-alice', 'alice@test.com', { token: 'tok1', orgId: 'org1' })
    ).rejects.toThrow();
  });

  it('throws when invite is expired', async () => {
    mockInviteGet.mockResolvedValue(
      makeInviteSnap({ expiresAt: { toMillis: () => Date.now() - 1000 } })
    );
    const { processInviteLogic } = await import('./processInvite');
    await expect(
      processInviteLogic('uid-alice', 'alice@test.com', { token: 'tok1', orgId: 'org1' })
    ).rejects.toThrow();
  });

  it('throws when invite has already been used', async () => {
    mockInviteGet.mockResolvedValue(
      makeInviteSnap({ usedAt: { toMillis: () => Date.now() - 3600000 } })
    );
    const { processInviteLogic } = await import('./processInvite');
    await expect(
      processInviteLogic('uid-alice', 'alice@test.com', { token: 'tok1', orgId: 'org1' })
    ).rejects.toThrow();
  });

  it('allows join if invite has no email restriction', async () => {
    mockInviteGet.mockResolvedValue(makeInviteSnap({ email: undefined }));
    const { processInviteLogic } = await import('./processInvite');
    await expect(
      processInviteLogic('uid-bob', 'bob@test.com', { token: 'tok1', orgId: 'org1' })
    ).resolves.toEqual({ orgId: 'org1' });
  });
});
