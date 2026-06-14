import type { Expense, ExpenseCategory, ExpenseStatus, ExpenseWrite, PaymentSource } from '../types/models';
import { authUser, authClaims } from './useAuth';

export interface ExpenseFilters {
  status?: ExpenseStatus;
  submittedBy?: string;
  category?: ExpenseCategory | string;
  paymentSource?: PaymentSource;
  dateFrom?: Date;
  dateTo?: Date;
}

export async function fetchExpenses(orgId: string, filters: ExpenseFilters): Promise<Expense[]> {
  const { getDb } = await import('../lib/firebase');
  const { collection, query, where, orderBy, limit, getDocs, Timestamp } = await import('firebase/firestore');

  const db = await getDb();
  const col = collection(db, `orgs/${orgId}/expenses`);

  const constraints: any[] = [];
  if (filters.status) constraints.push(where('status', '==', filters.status));
  if (filters.submittedBy) constraints.push(where('submittedBy', '==', filters.submittedBy));
  if (filters.category) constraints.push(where('category', '==', filters.category));
  if (filters.paymentSource) constraints.push(where('paymentSource', '==', filters.paymentSource));
  if (filters.dateFrom) constraints.push(where('date', '>=', Timestamp.fromDate(filters.dateFrom)));
  if (filters.dateTo) constraints.push(where('date', '<=', Timestamp.fromDate(filters.dateTo)));
  constraints.push(orderBy('date', 'desc'));
  constraints.push(limit(100));

  const q = query(col, ...constraints);
  try {
    const snap = await getDocs(q);
    return snap.docs.map((d: any) => ({ id: d.id, ...d.data() })) as Expense[];
  } catch (err) {
    // P2 (review): surface FAILED_PRECONDITION (index building) and UNAVAILABLE distinctly.
    // First deploy of 4 new composite indexes is at elevated risk of FAILED_PRECONDITION.
    const code = (err as { code?: string })?.code;
    if (code === 'failed-precondition') {
      throw new Error('Index de Firestore en construccion. Intenta de nuevo en unos minutos.');
    }
    if (code === 'unavailable') {
      throw new Error('Servicio no disponible. Intenta de nuevo.');
    }
    throw err;
  }
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
  const { collection, addDoc, deleteDoc, updateDoc, serverTimestamp } = await import('firebase/firestore');
  const { ref, uploadBytesResumable } = await import('firebase/storage');

  const db = await getDb();
  const storage = await getStorage();
  const submitterName = user.displayName || user.email?.split('@')[0] || '';

  // P1-C: create doc first so there is no orphaned storage file on addDoc failure
  const docRef = await addDoc(collection(db, `orgs/${claims.orgId}/expenses`), {
    ...data,
    submittedBy: user.uid,
    submitterName,
    receiptStoragePath: '',
    createdAt: serverTimestamp(),
  });

  // P1-B: uid-scoped path prevents any org member from overwriting another's receipt
  const storagePath = `orgs/${claims.orgId}/receipts/${user.uid}/${docRef.id}/${photoFile.name}`;
  const storageRef = ref(storage, storagePath);

  try {
    await new Promise<void>((resolve, reject) => {
      const task = uploadBytesResumable(storageRef, photoFile);
      task.on('state_changed', undefined, reject, resolve);
    });
  } catch (uploadErr) {
    // P1-C: upload failed — clean up the expense doc to avoid phantom records
    await deleteDoc(docRef);
    throw uploadErr;
  }

  await updateDoc(docRef, { receiptStoragePath: storagePath });

  return docRef.id;
}
