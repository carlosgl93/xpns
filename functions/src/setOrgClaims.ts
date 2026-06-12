import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

if (!getApps().length) initializeApp();

export interface SetOrgClaimsInput {
  orgName: string;
  defaultCurrency: string;
}

export async function setOrgClaimsLogic(
  uid: string,
  email: string,
  input: SetOrgClaimsInput
): Promise<{ orgId: string }> {
  if (!input.orgName?.trim()) {
    throw new HttpsError('invalid-argument', 'orgName is required');
  }
  if (!input.defaultCurrency?.trim()) {
    throw new HttpsError('invalid-argument', 'defaultCurrency is required');
  }

  const db = getFirestore();
  const auth = getAuth();

  const orgRef = db.collection('orgs').doc();
  const orgId = orgRef.id;

  await db.runTransaction(async (txn) => {
    txn.set(orgRef, {
      name: input.orgName.trim(),
      ownerEmail: email,
      plan: 'free',
      createdAt: FieldValue.serverTimestamp(),
      defaultCurrency: input.defaultCurrency,
    });
    txn.set(db.doc(`orgs/${orgId}/members/${uid}`), {
      email,
      displayName: email.split('@')[0],
      role: 'admin',
      status: 'active',
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  await auth.setCustomUserClaims(uid, { orgId, role: 'admin' });

  return { orgId };
}

export const setOrgClaims = onCall(
  { region: 'us-east1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated');
    }
    const { uid, token } = request.auth;
    const email = token.email ?? '';
    return setOrgClaimsLogic(uid, email, request.data as SetOrgClaimsInput);
  }
);
