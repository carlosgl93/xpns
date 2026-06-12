"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const mockSetCustomUserClaims = vitest_1.vi.fn().mockResolvedValue(undefined);
const mockInviteUpdate = vitest_1.vi.fn().mockResolvedValue(undefined);
const mockInviteGet = vitest_1.vi.fn();
const mockInviteRef = { get: mockInviteGet, update: mockInviteUpdate };
const mockDocFn = vitest_1.vi.fn().mockReturnValue(mockInviteRef);
vitest_1.vi.mock('firebase-admin/app', () => ({
    initializeApp: vitest_1.vi.fn(),
    getApps: vitest_1.vi.fn().mockReturnValue([]),
}));
vitest_1.vi.mock('firebase-admin/firestore', () => ({
    getFirestore: vitest_1.vi.fn().mockReturnValue({
        doc: mockDocFn,
    }),
    FieldValue: { serverTimestamp: vitest_1.vi.fn().mockReturnValue('__ts__') },
}));
vitest_1.vi.mock('firebase-admin/auth', () => ({
    getAuth: vitest_1.vi.fn().mockReturnValue({
        setCustomUserClaims: mockSetCustomUserClaims,
    }),
}));
function makeInviteSnap(overrides = {}) {
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
(0, vitest_1.describe)('processInviteLogic', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        mockInviteUpdate.mockResolvedValue(undefined);
        mockSetCustomUserClaims.mockResolvedValue(undefined);
    });
    (0, vitest_1.it)('sets employee claims when invite is valid', async () => {
        mockInviteGet.mockResolvedValue(makeInviteSnap());
        const { processInviteLogic } = await Promise.resolve().then(() => __importStar(require('./processInvite')));
        await processInviteLogic('uid-alice', 'alice@test.com', { token: 'tok1', orgId: 'org1' });
        (0, vitest_1.expect)(mockSetCustomUserClaims).toHaveBeenCalledWith('uid-alice', {
            orgId: 'org1',
            role: 'employee',
        });
    });
    (0, vitest_1.it)('marks invite as used (usedAt + usedBy)', async () => {
        mockInviteGet.mockResolvedValue(makeInviteSnap());
        const { processInviteLogic } = await Promise.resolve().then(() => __importStar(require('./processInvite')));
        await processInviteLogic('uid-alice', 'alice@test.com', { token: 'tok1', orgId: 'org1' });
        (0, vitest_1.expect)(mockInviteUpdate).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ usedAt: '__ts__', usedBy: 'uid-alice' }));
    });
    (0, vitest_1.it)('returns orgId on success', async () => {
        mockInviteGet.mockResolvedValue(makeInviteSnap());
        const { processInviteLogic } = await Promise.resolve().then(() => __importStar(require('./processInvite')));
        const result = await processInviteLogic('uid-alice', 'alice@test.com', { token: 'tok1', orgId: 'org1' });
        (0, vitest_1.expect)(result).toEqual({ orgId: 'org1' });
    });
    (0, vitest_1.it)('reads invite from orgs/{orgId}/invites/{token}', async () => {
        mockInviteGet.mockResolvedValue(makeInviteSnap());
        const { processInviteLogic } = await Promise.resolve().then(() => __importStar(require('./processInvite')));
        await processInviteLogic('uid-alice', 'alice@test.com', { token: 'tok-abc', orgId: 'org-xyz' });
        (0, vitest_1.expect)(mockDocFn).toHaveBeenCalledWith('orgs/org-xyz/invites/tok-abc');
    });
    (0, vitest_1.it)('throws not-found when invite does not exist', async () => {
        mockInviteGet.mockResolvedValue({ exists: false, data: () => null });
        const { processInviteLogic } = await Promise.resolve().then(() => __importStar(require('./processInvite')));
        await (0, vitest_1.expect)(processInviteLogic('uid-alice', 'alice@test.com', { token: 'bad', orgId: 'org1' })).rejects.toThrow();
    });
    (0, vitest_1.it)('throws when invite email does not match user email', async () => {
        mockInviteGet.mockResolvedValue(makeInviteSnap({ email: 'other@test.com' }));
        const { processInviteLogic } = await Promise.resolve().then(() => __importStar(require('./processInvite')));
        await (0, vitest_1.expect)(processInviteLogic('uid-alice', 'alice@test.com', { token: 'tok1', orgId: 'org1' })).rejects.toThrow();
    });
    (0, vitest_1.it)('throws when invite is expired', async () => {
        mockInviteGet.mockResolvedValue(makeInviteSnap({ expiresAt: { toMillis: () => Date.now() - 1000 } }));
        const { processInviteLogic } = await Promise.resolve().then(() => __importStar(require('./processInvite')));
        await (0, vitest_1.expect)(processInviteLogic('uid-alice', 'alice@test.com', { token: 'tok1', orgId: 'org1' })).rejects.toThrow();
    });
    (0, vitest_1.it)('throws when invite has already been used', async () => {
        mockInviteGet.mockResolvedValue(makeInviteSnap({ usedAt: { toMillis: () => Date.now() - 3600000 } }));
        const { processInviteLogic } = await Promise.resolve().then(() => __importStar(require('./processInvite')));
        await (0, vitest_1.expect)(processInviteLogic('uid-alice', 'alice@test.com', { token: 'tok1', orgId: 'org1' })).rejects.toThrow();
    });
    (0, vitest_1.it)('allows join if invite has no email restriction', async () => {
        mockInviteGet.mockResolvedValue(makeInviteSnap({ email: undefined }));
        const { processInviteLogic } = await Promise.resolve().then(() => __importStar(require('./processInvite')));
        await (0, vitest_1.expect)(processInviteLogic('uid-bob', 'bob@test.com', { token: 'tok1', orgId: 'org1' })).resolves.toEqual({ orgId: 'org1' });
    });
});
//# sourceMappingURL=processInvite.test.js.map