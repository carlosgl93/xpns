"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setOrgClaims = void 0;
exports.setOrgClaimsLogic = setOrgClaimsLogic;
const https_1 = require("firebase-functions/v2/https");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const auth_1 = require("firebase-admin/auth");
if (!(0, app_1.getApps)().length)
    (0, app_1.initializeApp)();
async function setOrgClaimsLogic(uid, email, input) {
    if (!input.orgName?.trim()) {
        throw new https_1.HttpsError('invalid-argument', 'orgName is required');
    }
    if (!input.defaultCurrency?.trim()) {
        throw new https_1.HttpsError('invalid-argument', 'defaultCurrency is required');
    }
    const db = (0, firestore_1.getFirestore)();
    const auth = (0, auth_1.getAuth)();
    const orgRef = db.collection('orgs').doc();
    const orgId = orgRef.id;
    await db.runTransaction(async (txn) => {
        txn.set(orgRef, {
            name: input.orgName.trim(),
            ownerEmail: email,
            plan: 'free',
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            defaultCurrency: input.defaultCurrency,
        });
        txn.set(db.doc(`orgs/${orgId}/members/${uid}`), {
            email,
            displayName: email.split('@')[0],
            role: 'admin',
            status: 'active',
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
    });
    await auth.setCustomUserClaims(uid, { orgId, role: 'admin' });
    return { orgId };
}
exports.setOrgClaims = (0, https_1.onCall)({ region: 'us-east1' }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be authenticated');
    }
    const { uid, token } = request.auth;
    const email = token.email ?? '';
    return setOrgClaimsLogic(uid, email, request.data);
});
//# sourceMappingURL=setOrgClaims.js.map