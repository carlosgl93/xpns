"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processInvite = void 0;
exports.processInviteLogic = processInviteLogic;
const https_1 = require("firebase-functions/v2/https");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const auth_1 = require("firebase-admin/auth");
if (!(0, app_1.getApps)().length)
    (0, app_1.initializeApp)();
async function processInviteLogic(uid, email, input) {
    const db = (0, firestore_1.getFirestore)();
    const auth = (0, auth_1.getAuth)();
    const inviteRef = db.doc(`orgs/${input.orgId}/invites/${input.token}`);
    const inviteSnap = await inviteRef.get();
    if (!inviteSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Invite not found');
    }
    const invite = inviteSnap.data();
    if (invite['email'] && invite['email'] !== email) {
        throw new https_1.HttpsError('permission-denied', 'Invite is for a different email');
    }
    if (invite['expiresAt'].toMillis() <= Date.now()) {
        throw new https_1.HttpsError('deadline-exceeded', 'Invite has expired');
    }
    if (invite['usedAt']) {
        throw new https_1.HttpsError('already-exists', 'Invite has already been used');
    }
    await inviteRef.update({
        usedAt: firestore_1.FieldValue.serverTimestamp(),
        usedBy: uid,
    });
    await auth.setCustomUserClaims(uid, { orgId: input.orgId, role: 'employee' });
    return { orgId: input.orgId };
}
exports.processInvite = (0, https_1.onCall)({ region: 'us-east1' }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be authenticated');
    }
    const { uid, token } = request.auth;
    const email = token.email ?? '';
    return processInviteLogic(uid, email, request.data);
});
//# sourceMappingURL=processInvite.js.map