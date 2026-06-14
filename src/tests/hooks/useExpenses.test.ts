import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DocumentReference } from 'firebase/firestore';

const mockAddDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const mockCollection = vi.fn();
const mockServerTimestamp = vi.fn(() => ({ _type: 'serverTimestamp' }));
const mockTimestamp = { fromDate: vi.fn((d: Date) => ({ _type: 'timestamp', _date: d })) };
const mockRef = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockGetDocs = vi.fn();
const mockUpdateDoc = vi.fn();
const mockDoc = vi.fn();

const mockUploadTask = {
  on: vi.fn((_event: string, _progress: unknown, _error: unknown, complete: () => void) => {
    complete();
  }),
  snapshot: { ref: {} },
};
const mockUploadBytesResumable = vi.fn(() => mockUploadTask);
const mockGetDownloadURL = vi.fn();

vi.mock('../../lib/firebase', () => ({
  getDb: vi.fn().mockResolvedValue({}),
  getStorage: vi.fn().mockResolvedValue({}),
}));

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  addDoc: mockAddDoc,
  deleteDoc: mockDeleteDoc,
  serverTimestamp: mockServerTimestamp,
  Timestamp: mockTimestamp,
  doc: mockDoc,
  query: mockQuery,
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
  getDocs: mockGetDocs,
  updateDoc: mockUpdateDoc,
}));

vi.mock('firebase/storage', () => ({
  ref: mockRef,
  uploadBytesResumable: mockUploadBytesResumable,
  getDownloadURL: mockGetDownloadURL,
}));

vi.mock('../../hooks/useAuth', () => ({
  authUser: { value: { uid: 'user-1', displayName: 'Carlos' } },
  authClaims: { value: { orgId: 'org-1', role: 'employee' } },
}));

describe('addExpense', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    // Restore auth mock in case a prior test overrode it with vi.doMock
    vi.doMock('../../hooks/useAuth', () => ({
      authUser: { value: { uid: 'user-1', displayName: 'Carlos' } },
      authClaims: { value: { orgId: 'org-1', role: 'employee' } },
    }));
    vi.doMock('../../lib/firebase', () => ({
      getDb: vi.fn().mockResolvedValue({}),
      getStorage: vi.fn().mockResolvedValue({}),
    }));
    vi.doMock('firebase/firestore', () => ({
      collection: mockCollection,
      addDoc: mockAddDoc,
      deleteDoc: mockDeleteDoc,
      serverTimestamp: mockServerTimestamp,
      Timestamp: mockTimestamp,
      doc: mockDoc,
      query: mockQuery,
      where: mockWhere,
      orderBy: mockOrderBy,
      limit: mockLimit,
      getDocs: mockGetDocs,
      updateDoc: mockUpdateDoc,
    }));
    vi.doMock('firebase/storage', () => ({
      ref: mockRef,
      uploadBytesResumable: mockUploadBytesResumable,
      getDownloadURL: mockGetDownloadURL,
    }));
    mockUploadTask.on.mockImplementation(
      (_event: string, _progress: unknown, _error: unknown, complete: () => void) => {
        complete();
      }
    );
    mockAddDoc.mockResolvedValue({ id: 'expense-abc' } as unknown as DocumentReference);
    mockDeleteDoc.mockResolvedValue(undefined);
    mockUpdateDoc.mockResolvedValue(undefined);
    mockGetDownloadURL.mockResolvedValue('https://storage/receipt.jpg');
    mockRef.mockReturnValue({ fullPath: 'orgs/org-1/receipts/user-1/expense-abc/receipt.jpg' });
    mockCollection.mockReturnValue('col-ref');
    mockDoc.mockReturnValue('doc-ref');
  });

  it('uploads photo to orgs/{orgId}/receipts/{uid}/{expenseId}/{filename} in Storage', async () => {
    const { addExpense } = await import('../../hooks/useExpenses');
    const photo = new File(['bytes'], 'receipt.jpg', { type: 'image/jpeg' });
    const data = makeExpenseWrite();

    await addExpense(data, photo);

    expect(mockUploadBytesResumable).toHaveBeenCalledOnce();
    const [storageRef, uploadedFile] = mockUploadBytesResumable.mock.calls[0];
    expect(uploadedFile).toBe(photo);
    // storageRef was built from the ref() call — verify ref was called with storage path containing orgId
    expect(mockRef).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('orgs/org-1/receipts/'));
    expect(mockRef).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('receipt.jpg'));
  });

  it('writes expense doc to orgs/{orgId}/expenses collection', async () => {
    const { addExpense } = await import('../../hooks/useExpenses');
    const photo = new File(['bytes'], 'receipt.jpg', { type: 'image/jpeg' });
    const data = makeExpenseWrite();

    await addExpense(data, photo);

    expect(mockCollection).toHaveBeenCalledWith(expect.anything(), 'orgs/org-1/expenses');
    expect(mockAddDoc).toHaveBeenCalledOnce();
  });

  it('includes all ExpenseWrite fields in the initial doc (receiptStoragePath set via updateDoc)', async () => {
    const { addExpense } = await import('../../hooks/useExpenses');
    const photo = new File(['bytes'], 'receipt.jpg', { type: 'image/jpeg' });
    const data = makeExpenseWrite();

    await addExpense(data, photo);

    const [, docData] = mockAddDoc.mock.calls[0];
    expect(docData).toMatchObject({
      amount: data.amount,
      currency: data.currency,
      category: data.category,
      description: data.description,
      submittedBy: 'user-1',
    });
    // Storage path is written via updateDoc after upload, not in the initial addDoc
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ receiptStoragePath: expect.stringContaining('orgs/org-1/receipts/') })
    );
  });

  it('returns the new expense document id', async () => {
    const { addExpense } = await import('../../hooks/useExpenses');
    const photo = new File(['bytes'], 'receipt.jpg', { type: 'image/jpeg' });

    const id = await addExpense(makeExpenseWrite(), photo);

    expect(id).toBe('expense-abc');
  });

  it('resolves only after Firestore addDoc completes (no optimistic resolve)', async () => {
    const { addExpense } = await import('../../hooks/useExpenses');
    const photo = new File(['bytes'], 'receipt.jpg', { type: 'image/jpeg' });
    let addDocResolved = false;
    mockAddDoc.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => {
            addDocResolved = true;
            resolve({ id: 'expense-abc' } as unknown as DocumentReference);
          }, 0)
        )
    );

    const promise = addExpense(makeExpenseWrite(), photo);
    expect(addDocResolved).toBe(false);
    await promise;
    expect(addDocResolved).toBe(true);
  });

  it('throws if authUser is null', async () => {
    vi.resetModules();
    vi.doMock('../../hooks/useAuth', () => ({
      authUser: { value: null },
      authClaims: { value: null },
    }));
    vi.doMock('../../lib/firebase', () => ({
      getDb: vi.fn().mockResolvedValue({}),
      getStorage: vi.fn().mockResolvedValue({}),
    }));
    const { addExpense } = await import('../../hooks/useExpenses');
    const photo = new File(['bytes'], 'receipt.jpg', { type: 'image/jpeg' });
    await expect(addExpense(makeExpenseWrite(), photo)).rejects.toThrow();
  });

  // P1-B: uid-scoped storage path
  it('storage path includes uid as orgs/{orgId}/receipts/{uid}/{expenseId}/{filename}', async () => {
    const { addExpense } = await import('../../hooks/useExpenses');
    const photo = new File(['bytes'], 'receipt.jpg', { type: 'image/jpeg' });
    await addExpense(makeExpenseWrite(), photo);
    expect(mockRef).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringMatching(/^orgs\/org-1\/receipts\/user-1\/[^/]+\/receipt\.jpg$/)
    );
  });

  // P1-C: doc-first write order
  it('creates Firestore doc before uploading to Storage', async () => {
    const callOrder: string[] = [];
    mockAddDoc.mockImplementation(async () => {
      callOrder.push('addDoc');
      return { id: 'expense-abc' } as unknown as DocumentReference;
    });
    mockUploadBytesResumable.mockImplementation(() => {
      callOrder.push('upload');
      return mockUploadTask;
    });
    const { addExpense } = await import('../../hooks/useExpenses');
    await addExpense(makeExpenseWrite(), new File(['b'], 'r.jpg', { type: 'image/jpeg' }));
    expect(callOrder.indexOf('addDoc')).toBeLessThan(callOrder.indexOf('upload'));
  });

  it('updates expense doc with receiptStoragePath after successful upload', async () => {
    const { addExpense } = await import('../../hooks/useExpenses');
    await addExpense(makeExpenseWrite(), new File(['b'], 'receipt.jpg', { type: 'image/jpeg' }));
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ receiptStoragePath: expect.stringMatching(/^orgs\/org-1\/receipts\/user-1\//) })
    );
  });

  it('deletes expense doc and rethrows if storage upload fails', async () => {
    mockUploadTask.on.mockImplementation(
      (_event: string, _progress: unknown, error: (e: Error) => void) => {
        error(new Error('upload failed'));
      }
    );
    const { addExpense } = await import('../../hooks/useExpenses');
    const photo = new File(['b'], 'receipt.jpg', { type: 'image/jpeg' });
    await expect(addExpense(makeExpenseWrite(), photo)).rejects.toThrow('upload failed');
    expect(mockDeleteDoc).toHaveBeenCalledOnce();
  });
});

describe('fetchExpenses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockReturnValue('query-ref');
    mockWhere.mockReturnValue('where-ref');
    mockOrderBy.mockReturnValue('order-ref');
    mockLimit.mockReturnValue('limit-ref');
    mockCollection.mockReturnValue('col-ref');
    mockGetDocs.mockResolvedValue({
      docs: [
        {
          id: 'exp-1',
          data: () => ({
            submittedBy: 'user-1',
            submitterName: 'Carlos',
            amount: 5000,
            currency: 'CLP',
            category: 'food',
            description: 'Almuerzo',
            receiptStoragePath: 'orgs/org-1/receipts/exp-1/r.jpg',
            status: 'pending',
            date: { seconds: 1700000000, nanoseconds: 0 },
            createdAt: { seconds: 1700000000, nanoseconds: 0 },
          }),
        },
      ],
    });
  });

  it('queries orgs/{orgId}/expenses collection', async () => {
    const { fetchExpenses } = await import('../../hooks/useExpenses');
    await fetchExpenses('org-1', {});
    expect(mockCollection).toHaveBeenCalledWith(expect.anything(), 'orgs/org-1/expenses');
  });

  it('returns expenses with id from doc snapshot', async () => {
    const { fetchExpenses } = await import('../../hooks/useExpenses');
    const result = await fetchExpenses('org-1', {});
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('exp-1');
    expect(result[0]!.amount).toBe(5000);
  });

  it('applies status filter when provided', async () => {
    const { fetchExpenses } = await import('../../hooks/useExpenses');
    await fetchExpenses('org-1', { status: 'pending' });
    expect(mockWhere).toHaveBeenCalledWith('status', '==', 'pending');
  });

  it('applies submittedBy filter when provided', async () => {
    const { fetchExpenses } = await import('../../hooks/useExpenses');
    await fetchExpenses('org-1', { submittedBy: 'user-1' });
    expect(mockWhere).toHaveBeenCalledWith('submittedBy', '==', 'user-1');
  });

  it('applies category filter when provided', async () => {
    const { fetchExpenses } = await import('../../hooks/useExpenses');
    await fetchExpenses('org-1', { category: 'food' });
    expect(mockWhere).toHaveBeenCalledWith('category', '==', 'food');
  });

  it('applies paymentSource filter when provided', async () => {
    const { fetchExpenses } = await import('../../hooks/useExpenses');
    await fetchExpenses('org-1', { paymentSource: 'personal_debit' as any });
    expect(mockWhere).toHaveBeenCalledWith('paymentSource', '==', 'personal_debit');
  });

  it('omits paymentSource where() clause when filter is undefined', async () => {
    const { fetchExpenses } = await import('../../hooks/useExpenses');
    await fetchExpenses('org-1', {});
    const whereFields = mockWhere.mock.calls.map((c) => c[0]);
    expect(whereFields).not.toContain('paymentSource');
  });

  it('orders results by date descending', async () => {
    const { fetchExpenses } = await import('../../hooks/useExpenses');
    await fetchExpenses('org-1', {});
    expect(mockOrderBy).toHaveBeenCalledWith('date', 'desc');
  });

  it('limits to 100 results', async () => {
    const { fetchExpenses } = await import('../../hooks/useExpenses');
    await fetchExpenses('org-1', {});
    expect(mockLimit).toHaveBeenCalledWith(100);
  });

  // P1-A: date range filters
  it('applies dateFrom filter as where(date >= Timestamp)', async () => {
    const { fetchExpenses } = await import('../../hooks/useExpenses');
    const from = new Date('2024-01-01');
    await fetchExpenses('org-1', { dateFrom: from });
    expect(mockTimestamp.fromDate).toHaveBeenCalledWith(from);
    expect(mockWhere).toHaveBeenCalledWith('date', '>=', expect.objectContaining({ _date: from }));
  });

  it('applies dateTo filter as where(date <= Timestamp)', async () => {
    const { fetchExpenses } = await import('../../hooks/useExpenses');
    const to = new Date('2024-12-31');
    await fetchExpenses('org-1', { dateTo: to });
    expect(mockTimestamp.fromDate).toHaveBeenCalledWith(to);
    expect(mockWhere).toHaveBeenCalledWith('date', '<=', expect.objectContaining({ _date: to }));
  });

  it('applies both dateFrom and dateTo together', async () => {
    const { fetchExpenses } = await import('../../hooks/useExpenses');
    const from = new Date('2024-01-01');
    const to = new Date('2024-12-31');
    await fetchExpenses('org-1', { dateFrom: from, dateTo: to });
    expect(mockWhere).toHaveBeenCalledWith('date', '>=', expect.objectContaining({ _date: from }));
    expect(mockWhere).toHaveBeenCalledWith('date', '<=', expect.objectContaining({ _date: to }));
  });

  it('does not add date constraints when dateFrom/dateTo are absent', async () => {
    const { fetchExpenses } = await import('../../hooks/useExpenses');
    await fetchExpenses('org-1', {});
    const whereCalls = mockWhere.mock.calls.map((c) => c[0]);
    expect(whereCalls).not.toContain('date');
  });
});

describe('markAsPaid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateDoc.mockResolvedValue(undefined);
    mockDoc.mockReturnValue('doc-ref');
  });

  it('calls updateDoc with status:paid and paidAt:serverTimestamp', async () => {
    const { markAsPaid } = await import('../../hooks/useExpenses');
    await markAsPaid('org-1', 'exp-1');
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      'doc-ref',
      expect.objectContaining({ status: 'paid', paidAt: expect.anything() })
    );
  });

  it('targets the correct expense document path', async () => {
    const { markAsPaid } = await import('../../hooks/useExpenses');
    await markAsPaid('org-1', 'exp-1');
    expect(mockDoc).toHaveBeenCalledWith(
      expect.anything(),
      'orgs/org-1/expenses/exp-1'
    );
  });
});

function makeExpenseWrite() {
  return {
    submittedBy: 'user-1',
    submitterName: 'Carlos',
    amount: 5000,
    currency: 'CLP',
    category: 'food' as const,
    paymentSource: 'corporate_credit' as const,
    description: 'Almuerzo',
    receiptStoragePath: '',
    status: 'pending' as const,
    date: { seconds: 0, nanoseconds: 0 } as any,
    paidAt: undefined,
  };
}
