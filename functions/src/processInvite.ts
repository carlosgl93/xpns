import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

if (!getApps().length) initializeApp();

export interface ProcessInviteInput {
  token: string;
  orgId: string;
}

export async function processInviteLogic(
  uid: string,
  email: string,
  input: ProcessInviteInput
): Promise<{ orgId: string }> {
  const db = getFirestore();
  const auth = getAuth();

  // Idempotent: if this user already has the right claims (retry after partial failure), skip.
  const existingUser = await auth.getUser(uid);
  if (existingUser.customClaims?.['orgId'] === input.orgId) {
    return { orgId: input.orgId };
  }

  const inviteRef = db.doc(`orgs/${input.orgId}/invites/${input.token}`);

  // Transaction: atomic read-check-mark prevents concurrent double-redemption (TOCTOU).
  await db.runTransaction(async (txn) => {
    const inviteSnap = await txn.get(inviteRef);

    if (!inviteSnap.exists) {
      throw new HttpsError('not-found', 'Invite not found');
    }

    const invite = inviteSnap.data()!;

    if (invite['email'] && invite['email'] !== email) {
      throw new HttpsError('permission-denied', 'Invite is for a different email');
    }

    if (invite['expiresAt'].toMillis() <= Date.now()) {
      throw new HttpsError('deadline-exceeded', 'Invite has expired');
    }

    if (invite['usedAt']) {
      throw new HttpsError('already-exists', 'Invite has already been used');
    }

    txn.update(inviteRef, {
      usedAt: FieldValue.serverTimestamp(),
      usedBy: uid,
    });
  });

  // Claims set after transaction commits. If this throws, the idempotency check
  // above lets the user retry and skip straight to here.
  await auth.setCustomUserClaims(uid, { orgId: input.orgId, role: 'employee' });

  return { orgId: input.orgId };
}

export const processInvite = onCall(
  { region: 'us-east1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated');
    }
    const { uid, token } = request.auth;
    const email = token.email ?? '';
    return processInviteLogic(uid, email, request.data as ProcessInviteInput);
  }
);
