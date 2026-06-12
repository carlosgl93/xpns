import type { ExpenseWrite } from '../types/models';
import { authUser, authClaims } from './useAuth';

export async function addExpense(data: ExpenseWrite, photoFile: File): Promise<string> {
  const user = authUser.value;
  const claims = authClaims.value;
  if (!user || !claims?.orgId) throw new Error('Not authenticated');

  const { getDb, getStorage } = await import('../lib/firebase');
  const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
  const { ref, uploadBytesResumable } = await import('firebase/storage');

  const db = await getDb();
  const storage = await getStorage();

  // Generate a temporary ID for the storage path, then use the Firestore doc id
  const tempId = crypto.randomUUID();
  const storagePath = `orgs/${claims.orgId}/receipts/${tempId}/${photoFile.name}`;
  const storageRef = ref(storage, storagePath);

  await new Promise<void>((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, photoFile);
    task.on('state_changed', undefined, reject, resolve);
  });

  const docRef = await addDoc(collection(db, `orgs/${claims.orgId}/expenses`), {
    ...data,
    submittedBy: user.uid,
    receiptStoragePath: storagePath,
    createdAt: serverTimestamp(),
  });

  return docRef.id;
}
