import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DocumentReference } from 'firebase/firestore';

const mockAddDoc = vi.fn();
const mockCollection = vi.fn();
const mockServerTimestamp = vi.fn(() => ({ _type: 'serverTimestamp' }));
const mockRef = vi.fn();

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
  serverTimestamp: mockServerTimestamp,
  doc: mockRef,
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
    vi.clearAllMocks();
    mockUploadTask.on.mockImplementation(
      (_event: string, _progress: unknown, _error: unknown, complete: () => void) => {
        complete();
      }
    );
    mockAddDoc.mockResolvedValue({ id: 'expense-abc' } as unknown as DocumentReference);
    mockGetDownloadURL.mockResolvedValue('https://storage/receipt.jpg');
    mockRef.mockReturnValue({ fullPath: 'orgs/org-1/receipts/expense-abc/receipt.jpg' });
    mockCollection.mockReturnValue('col-ref');
  });

  it('uploads photo to orgs/{orgId}/receipts/{expenseId}/{filename} in Storage', async () => {
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

  it('includes all ExpenseWrite fields plus receiptStoragePath in the doc', async () => {
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
      receiptStoragePath: expect.stringContaining('orgs/org-1/receipts/'),
    });
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
});

function makeExpenseWrite() {
  return {
    submittedBy: 'user-1',
    submitterName: 'Carlos',
    amount: 5000,
    currency: 'CLP',
    category: 'food' as const,
    description: 'Almuerzo',
    receiptStoragePath: '',
    status: 'pending' as const,
    date: { seconds: 0, nanoseconds: 0 } as any,
    paidAt: undefined,
  };
}
