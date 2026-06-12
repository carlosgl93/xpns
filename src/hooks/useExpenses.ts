import type { Expense, ExpenseCategory, ExpenseStatus, ExpenseWrite } from '../types/models';
import { authUser, authClaims } from './useAuth';

export interface ExpenseFilters {
  status?: ExpenseStatus;
  submittedBy?: string;
  category?: ExpenseCategory | string;
  dateFrom?: Date;
  dateTo?: Date;
}

export async function fetchExpenses(orgId: string, filters: ExpenseFilters): Promise<Expense[]> {
  const { getDb } = await import('../lib/firebase');
  const { collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');

  const db = await getDb();
  const col = collection(db, `orgs/${orgId}/expenses`);

  const constraints: any[] = [];
  if (filters.status) constraints.push(where('status', '==', filters.status));
  if (filters.submittedBy) constraints.push(where('submittedBy', '==', filters.submittedBy));
  if (filters.category) constraints.push(where('category', '==', filters.category));
  constraints.push(orderBy('date', 'desc'));
  constraints.push(limit(100));

  const q = query(col, ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d: any) => ({ id: d.id, ...d.data() })) as Expense[];
}

export async function markAsPaid(orgId: string, expenseId: string): Promise<void> {
  const { getDb } = await import('../lib/firebase');
  const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
  const db = await getDb();
  await updateDoc(doc(db, `orgs/${orgId}/expenses/${expenseId}`), {
    status: 'paid',
    paidAt: serverTimestamp(),
  });
}

export async function addExpense(data: ExpenseWrite, photoFile: File): Promise<string> {
  const user = authUser.value;
  const claims = authClaims.value;
  if (!user || !claims?.orgId) throw new Error('Not authenticated');

  const { getDb, getStorage } = await import('../lib/firebase');
  const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
  const { ref, uploadBytesResumable } = await import('firebase/storage');

  const db = await getDb();
  const storage = await getStorage();

  const tempId = crypto.randomUUID();
  const storagePath = `orgs/${claims.orgId}/receipts/${tempId}/${photoFile.name}`;
  const storageRef = ref(storage, storagePath);

  await new Promise<void>((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, photoFile);
    task.on('state_changed', undefined, reject, resolve);
  });

  const submitterName = user.displayName || user.email?.split('@')[0] || '';

  const docRef = await addDoc(collection(db, `orgs/${claims.orgId}/expenses`), {
    ...data,
    submittedBy: user.uid,
    submitterName,
    receiptStoragePath: storagePath,
    createdAt: serverTimestamp(),
  });

  return docRef.id;
}
