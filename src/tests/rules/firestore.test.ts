import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const PROJECT_ID = 'xpns-test';
const RULES_PATH = resolve(process.cwd(), 'firestore.rules');

let env: RulesTestEnvironment;

function makeAuth(_uid: string, email: string, orgId: string, role: 'admin' | 'employee') {
  return { email, orgId, role };
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(RULES_PATH, 'utf8'),
      host: 'localhost',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

// ── Seed helpers ──────────────────────────────────────────────────────────────

async function seedExpense(orgId: string, expenseId: string, submittedBy: string) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `orgs/${orgId}/expenses/${expenseId}`), {
      submittedBy,
      submitterName: 'Test User',
      amount: 1000,
      currency: 'CLP',
      category: 'food',
      paymentSource: 'corporate_credit',
      description: 'Lunch',
      receiptStoragePath: `orgs/${orgId}/receipts/${expenseId}/receipt.jpg`,
      status: 'pending',
      date: new Date(),
      createdAt: new Date(),
    });
  });
}

async function seedInvite(orgId: string, token: string, email: string, expiresAt: Date) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `orgs/${orgId}/invites/${token}`), {
      email,
      createdAt: new Date(),
      expiresAt,
    });
  });
}

// ── Expenses ──────────────────────────────────────────────────────────────────

describe('expenses — employee isolation', () => {
  it('employee reads own expense', async () => {
    await seedExpense('org1', 'exp1', 'uid-alice');
    const alice = env.authenticatedContext('uid-alice', makeAuth('uid-alice', 'alice@test.com', 'org1', 'employee'));
    await assertSucceeds(getDoc(doc(alice.firestore(), 'orgs/org1/expenses/exp1')));
  });

  it('employee cannot read another employee expense (same org)', async () => {
    await seedExpense('org1', 'exp1', 'uid-bob');
    const alice = env.authenticatedContext('uid-alice', makeAuth('uid-alice', 'alice@test.com', 'org1', 'employee'));
    await assertFails(getDoc(doc(alice.firestore(), 'orgs/org1/expenses/exp1')));
  });

  it('employee cannot read expenses from another org', async () => {
    await seedExpense('org2', 'exp1', 'uid-alice');
    const alice = env.authenticatedContext('uid-alice', makeAuth('uid-alice', 'alice@test.com', 'org1', 'employee'));
    await assertFails(getDoc(doc(alice.firestore(), 'orgs/org2/expenses/exp1')));
  });
});

describe('expenses — admin', () => {
  it('admin reads any expense in their org', async () => {
    await seedExpense('org1', 'exp1', 'uid-bob');
    const admin = env.authenticatedContext('uid-admin', makeAuth('uid-admin', 'admin@test.com', 'org1', 'admin'));
    await assertSucceeds(getDoc(doc(admin.firestore(), 'orgs/org1/expenses/exp1')));
  });

  it('admin cannot read expenses from another org', async () => {
    await seedExpense('org2', 'exp1', 'uid-bob');
    const admin = env.authenticatedContext('uid-admin', makeAuth('uid-admin', 'admin@test.com', 'org1', 'admin'));
    await assertFails(getDoc(doc(admin.firestore(), 'orgs/org2/expenses/exp1')));
  });

  it('admin can mark expense as paid', async () => {
    await seedExpense('org1', 'exp1', 'uid-bob');
    const admin = env.authenticatedContext('uid-admin', makeAuth('uid-admin', 'admin@test.com', 'org1', 'admin'));
    await assertSucceeds(updateDoc(doc(admin.firestore(), 'orgs/org1/expenses/exp1'), { status: 'paid' }));
  });

  it('employee cannot mark expense as paid', async () => {
    await seedExpense('org1', 'exp1', 'uid-alice');
    const alice = env.authenticatedContext('uid-alice', makeAuth('uid-alice', 'alice@test.com', 'org1', 'employee'));
    await assertFails(updateDoc(doc(alice.firestore(), 'orgs/org1/expenses/exp1'), { status: 'paid' }));
  });
});

describe('expenses — create', () => {
  it('employee can create expense with correct submittedBy', async () => {
    const alice = env.authenticatedContext('uid-alice', makeAuth('uid-alice', 'alice@test.com', 'org1', 'employee'));
    await assertSucceeds(setDoc(doc(alice.firestore(), 'orgs/org1/expenses/exp-new'), {
      submittedBy: 'uid-alice',
      submitterName: 'Alice',
      amount: 5000,
      currency: 'CLP',
      category: 'food',
      paymentSource: 'corporate_credit',
      description: 'Lunch',
      receiptStoragePath: 'orgs/org1/receipts/exp-new/r.jpg',
      status: 'pending',
      date: new Date(),
      createdAt: new Date(),
    }));
  });

  it('employee cannot spoof submittedBy', async () => {
    const alice = env.authenticatedContext('uid-alice', makeAuth('uid-alice', 'alice@test.com', 'org1', 'employee'));
    await assertFails(setDoc(doc(alice.firestore(), 'orgs/org1/expenses/exp-spoof'), {
      submittedBy: 'uid-bob',
      submitterName: 'Bob',
      amount: 5000,
      currency: 'CLP',
      category: 'food',
      paymentSource: 'corporate_credit',
      description: 'Lunch',
      receiptStoragePath: 'orgs/org1/receipts/exp-spoof/r.jpg',
      status: 'pending',
      date: new Date(),
      createdAt: new Date(),
    }));
  });

  it('employee cannot create expense with status != pending', async () => {
    const alice = env.authenticatedContext('uid-alice', makeAuth('uid-alice', 'alice@test.com', 'org1', 'employee'));
    await assertFails(setDoc(doc(alice.firestore(), 'orgs/org1/expenses/exp-paid'), {
      submittedBy: 'uid-alice',
      submitterName: 'Alice',
      amount: 5000,
      currency: 'CLP',
      category: 'food',
      paymentSource: 'corporate_credit',
      description: 'Lunch',
      receiptStoragePath: 'orgs/org1/receipts/exp-paid/r.jpg',
      status: 'paid',
      date: new Date(),
      createdAt: new Date(),
    }));
  });
});

describe('expenses — paymentSource validation', () => {
  const baseDoc = (overrides: Record<string, unknown> = {}) => ({
    submittedBy: 'uid-alice',
    submitterName: 'Alice',
    amount: 5000,
    currency: 'CLP',
    category: 'food',
    paymentSource: 'corporate_credit',
    description: 'Lunch',
    receiptStoragePath: 'orgs/org1/receipts/exp-ps/r.jpg',
    status: 'pending',
    date: new Date(),
    createdAt: new Date(),
    ...overrides,
  });

  const validSources = [
    'corporate_credit',
    'corporate_debit',
    'personal_credit',
    'personal_debit',
    'cash',
  ];

  for (const source of validSources) {
    it(`accepts paymentSource = ${source}`, async () => {
      const alice = env.authenticatedContext('uid-alice', makeAuth('uid-alice', 'alice@test.com', 'org1', 'employee'));
      await assertSucceeds(setDoc(doc(alice.firestore(), `orgs/org1/expenses/exp-ps-${source}`), baseDoc({ paymentSource: source })));
    });
  }

  it('rejects paymentSource = banana (not in enum)', async () => {
    const alice = env.authenticatedContext('uid-alice', makeAuth('uid-alice', 'alice@test.com', 'org1', 'employee'));
    await assertFails(setDoc(doc(alice.firestore(), 'orgs/org1/expenses/exp-ps-bad'), baseDoc({ paymentSource: 'banana' })));
  });

  it('rejects missing paymentSource field', async () => {
    const alice = env.authenticatedContext('uid-alice', makeAuth('uid-alice', 'alice@test.com', 'org1', 'employee'));
    const { paymentSource: _omitted, ...noPaymentSource } = baseDoc();
    void _omitted;
    await assertFails(setDoc(doc(alice.firestore(), 'orgs/org1/expenses/exp-ps-missing'), noPaymentSource));
  });

  it('rejects paymentSource = "" (empty string)', async () => {
    const alice = env.authenticatedContext('uid-alice', makeAuth('uid-alice', 'alice@test.com', 'org1', 'employee'));
    await assertFails(setDoc(doc(alice.firestore(), 'orgs/org1/expenses/exp-ps-empty'), baseDoc({ paymentSource: '' })));
  });
});

describe('expenses — employee update of receiptStoragePath', () => {
  it('employee can set receiptStoragePath on own doc', async () => {
    await seedExpense('org1', 'exp-rsp', 'uid-alice');
    const alice = env.authenticatedContext('uid-alice', makeAuth('uid-alice', 'alice@test.com', 'org1', 'employee'));
    await assertSucceeds(
      updateDoc(doc(alice.firestore(), 'orgs/org1/expenses/exp-rsp'), {
        receiptStoragePath: 'orgs/org1/receipts/uid-alice/exp-rsp/r.jpg',
      })
    );
  });

  it('employee cannot change status on own doc', async () => {
    await seedExpense('org1', 'exp-rsp', 'uid-alice');
    const alice = env.authenticatedContext('uid-alice', makeAuth('uid-alice', 'alice@test.com', 'org1', 'employee'));
    await assertFails(
      updateDoc(doc(alice.firestore(), 'orgs/org1/expenses/exp-rsp'), { status: 'paid' })
    );
  });

  it('employee cannot change amount on own doc', async () => {
    await seedExpense('org1', 'exp-rsp', 'uid-alice');
    const alice = env.authenticatedContext('uid-alice', makeAuth('uid-alice', 'alice@test.com', 'org1', 'employee'));
    await assertFails(
      updateDoc(doc(alice.firestore(), 'orgs/org1/expenses/exp-rsp'), { amount: 9999 })
    );
  });

  it('employee cannot change receiptStoragePath on doc owned by another user', async () => {
    await seedExpense('org1', 'exp-rsp', 'uid-bob');
    const alice = env.authenticatedContext('uid-alice', makeAuth('uid-alice', 'alice@test.com', 'org1', 'employee'));
    await assertFails(
      updateDoc(doc(alice.firestore(), 'orgs/org1/expenses/exp-rsp'), {
        receiptStoragePath: 'orgs/org1/receipts/uid-alice/exp-rsp/r.jpg',
      })
    );
  });
});

// ── Invites ───────────────────────────────────────────────────────────────────

describe('invites — email-specific gate', () => {
  it('invited email can read their token', async () => {
    await seedInvite('org1', 'tok1', 'alice@test.com', new Date(Date.now() + 86400000));
    const alice = env.authenticatedContext('uid-alice', makeAuth('uid-alice', 'alice@test.com', 'org1', 'employee'));
    await assertSucceeds(getDoc(doc(alice.firestore(), 'orgs/org1/invites/tok1')));
  });

  it('different email cannot read invite token', async () => {
    await seedInvite('org1', 'tok1', 'alice@test.com', new Date(Date.now() + 86400000));
    const bob = env.authenticatedContext('uid-bob', makeAuth('uid-bob', 'bob@test.com', 'org1', 'employee'));
    await assertFails(getDoc(doc(bob.firestore(), 'orgs/org1/invites/tok1')));
  });

  it('unauthenticated cannot read invite token', async () => {
    await seedInvite('org1', 'tok1', 'alice@test.com', new Date(Date.now() + 86400000));
    const anon = env.unauthenticatedContext();
    await assertFails(getDoc(doc(anon.firestore(), 'orgs/org1/invites/tok1')));
  });

  it('admin can create invite token', async () => {
    const admin = env.authenticatedContext('uid-admin', makeAuth('uid-admin', 'admin@test.com', 'org1', 'admin'));
    await assertSucceeds(setDoc(doc(admin.firestore(), 'orgs/org1/invites/tok-new'), {
      email: 'newuser@test.com',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 604800000),
    }));
  });

  it('employee cannot create invite token', async () => {
    const alice = env.authenticatedContext('uid-alice', makeAuth('uid-alice', 'alice@test.com', 'org1', 'employee'));
    await assertFails(setDoc(doc(alice.firestore(), 'orgs/org1/invites/tok-bad'), {
      email: 'newuser@test.com',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 604800000),
    }));
  });
});
