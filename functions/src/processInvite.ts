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

  // P1-E: capture orgId from the invite document so claims are never set from client-controlled input.
  let authorizedOrgId = input.orgId;

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

    // Read orgId from the authoritative invite document, not from the client payload.
    if (invite['orgId']) {
      authorizedOrgId = invite['orgId'] as string;
    }

    txn.update(inviteRef, {
      usedAt: FieldValue.serverTimestamp(),
      usedBy: uid,
    });
  });

  // Claims set after transaction commits — orgId comes from the invite doc.
  // Read the org's defaultCurrency so the client can pre-fill the expense form.
  const orgSnap = await db.doc(`orgs/${authorizedOrgId}`).get();
  const defaultCurrency = (orgSnap.data()?.['defaultCurrency'] as string) ?? 'CLP';
  await auth.setCustomUserClaims(uid, {
    orgId: authorizedOrgId,
    role: 'employee',
    defaultCurrency,
  });

  // Add employee to org members so they appear in the admin filter.
  const memberRef = db.doc(`orgs/${authorizedOrgId}/members/${uid}`);
  await memberRef.set({
    email,
    displayName: email.split('@')[0],
    role: 'employee',
    status: 'active',
    createdAt: FieldValue.serverTimestamp(),
  });

  return { orgId: authorizedOrgId };
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
