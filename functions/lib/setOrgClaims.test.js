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
// Module-level mocks (vitest hoists vi.mock, but variables in scope are accessible)
const mockSetCustomUserClaims = vitest_1.vi.fn().mockResolvedValue(undefined);
const mockTxnSet = vitest_1.vi.fn();
const mockRunTransaction = vitest_1.vi.fn().mockImplementation(async (fn) => {
    await fn({ set: mockTxnSet });
});
const mockOrgDocRef = { id: 'org-generated-id' };
const mockCollectionDoc = vitest_1.vi.fn().mockReturnValue(mockOrgDocRef);
const mockCollectionFn = vitest_1.vi.fn().mockReturnValue({ doc: mockCollectionDoc });
const mockDocFn = vitest_1.vi.fn().mockImplementation((path) => ({ id: `ref-${path}` }));
vitest_1.vi.mock('firebase-admin/app', () => ({
    initializeApp: vitest_1.vi.fn(),
    getApps: vitest_1.vi.fn().mockReturnValue([]),
}));
vitest_1.vi.mock('firebase-admin/firestore', () => ({
    getFirestore: vitest_1.vi.fn().mockReturnValue({
        collection: mockCollectionFn,
        doc: mockDocFn,
        runTransaction: mockRunTransaction,
    }),
    FieldValue: { serverTimestamp: vitest_1.vi.fn().mockReturnValue('__ts__') },
}));
vitest_1.vi.mock('firebase-admin/auth', () => ({
    getAuth: vitest_1.vi.fn().mockReturnValue({
        setCustomUserClaims: mockSetCustomUserClaims,
    }),
}));
(0, vitest_1.describe)('setOrgClaimsLogic', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        mockRunTransaction.mockImplementation(async (fn) => {
            await fn({ set: mockTxnSet });
        });
        mockCollectionDoc.mockReturnValue(mockOrgDocRef);
        mockSetCustomUserClaims.mockResolvedValue(undefined);
    });
    (0, vitest_1.it)('creates org doc inside transaction with correct fields', async () => {
        const { setOrgClaimsLogic } = await Promise.resolve().then(() => __importStar(require('./setOrgClaims')));
        await setOrgClaimsLogic('uid-1', 'admin@test.com', { orgName: 'Acme Corp', defaultCurrency: 'CLP' });
        (0, vitest_1.expect)(mockTxnSet).toHaveBeenCalledWith(mockOrgDocRef, vitest_1.expect.objectContaining({
            name: 'Acme Corp',
            ownerEmail: 'admin@test.com',
            plan: 'free',
            defaultCurrency: 'CLP',
            createdAt: '__ts__',
        }));
    });
    (0, vitest_1.it)('creates member doc with role admin inside transaction', async () => {
        const { setOrgClaimsLogic } = await Promise.resolve().then(() => __importStar(require('./setOrgClaims')));
        await setOrgClaimsLogic('uid-1', 'admin@test.com', { orgName: 'Acme Corp', defaultCurrency: 'CLP' });
        (0, vitest_1.expect)(mockTxnSet).toHaveBeenCalledWith(vitest_1.expect.anything(), vitest_1.expect.objectContaining({
            email: 'admin@test.com',
            role: 'admin',
            status: 'active',
            createdAt: '__ts__',
        }));
        (0, vitest_1.expect)(mockDocFn).toHaveBeenCalledWith(`orgs/org-generated-id/members/uid-1`);
    });
    (0, vitest_1.it)('sets custom claims with orgId and role admin', async () => {
        const { setOrgClaimsLogic } = await Promise.resolve().then(() => __importStar(require('./setOrgClaims')));
        await setOrgClaimsLogic('uid-1', 'admin@test.com', { orgName: 'Acme Corp', defaultCurrency: 'CLP' });
        (0, vitest_1.expect)(mockSetCustomUserClaims).toHaveBeenCalledWith('uid-1', {
            orgId: 'org-generated-id',
            role: 'admin',
        });
    });
    (0, vitest_1.it)('returns the generated orgId', async () => {
        const { setOrgClaimsLogic } = await Promise.resolve().then(() => __importStar(require('./setOrgClaims')));
        const result = await setOrgClaimsLogic('uid-1', 'admin@test.com', { orgName: 'Acme Corp', defaultCurrency: 'CLP' });
        (0, vitest_1.expect)(result).toEqual({ orgId: 'org-generated-id' });
    });
    (0, vitest_1.it)('throws on empty orgName', async () => {
        const { setOrgClaimsLogic } = await Promise.resolve().then(() => __importStar(require('./setOrgClaims')));
        await (0, vitest_1.expect)(setOrgClaimsLogic('uid-1', 'admin@test.com', { orgName: '  ', defaultCurrency: 'CLP' })).rejects.toThrow();
    });
    (0, vitest_1.it)('throws on empty defaultCurrency', async () => {
        const { setOrgClaimsLogic } = await Promise.resolve().then(() => __importStar(require('./setOrgClaims')));
        await (0, vitest_1.expect)(setOrgClaimsLogic('uid-1', 'admin@test.com', { orgName: 'Acme', defaultCurrency: '' })).rejects.toThrow();
    });
    (0, vitest_1.it)('calls collection("orgs") to generate org ref', async () => {
        const { setOrgClaimsLogic } = await Promise.resolve().then(() => __importStar(require('./setOrgClaims')));
        await setOrgClaimsLogic('uid-1', 'admin@test.com', { orgName: 'Acme Corp', defaultCurrency: 'USD' });
        (0, vitest_1.expect)(mockCollectionFn).toHaveBeenCalledWith('orgs');
        (0, vitest_1.expect)(mockCollectionDoc).toHaveBeenCalled();
    });
});
//# sourceMappingURL=setOrgClaims.test.js.map