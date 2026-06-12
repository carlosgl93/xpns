import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const PROJECT_ID = 'xpns-test';
const RULES_PATH = resolve(process.cwd(), 'storage.rules');

let env: RulesTestEnvironment;

function makeAuth(_uid: string, orgId: string) {
  return { orgId, role: 'employee' };
}

const FAKE_IMAGE = new Uint8Array([0xff, 0xd8, 0xff]); // JPEG magic bytes

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    storage: {
      rules: readFileSync(RULES_PATH, 'utf8'),
      host: 'localhost',
      port: 9199,
    },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearStorage();
});

describe('storage — receipt upload', () => {
  it('member uploads receipt to uid-scoped path in own org', async () => {
    const alice = env.authenticatedContext('uid-alice', makeAuth('uid-alice', 'org1'));
    const storage = alice.storage();
    const receiptRef = ref(storage, 'orgs/org1/receipts/uid-alice/exp1/receipt.jpg');
    await assertSucceeds(
      uploadBytes(receiptRef, FAKE_IMAGE, { contentType: 'image/jpeg' })
    );
  });

  it('member cannot overwrite another member receipt (uid-scoped)', async () => {
    const alice = env.authenticatedContext('uid-alice', makeAuth('uid-alice', 'org1'));
    const storage = alice.storage();
    const receiptRef = ref(storage, 'orgs/org1/receipts/uid-bob/exp1/receipt.jpg');
    await assertFails(
      uploadBytes(receiptRef, FAKE_IMAGE, { contentType: 'image/jpeg' })
    );
  });

  it('member cannot upload to different org', async () => {
    const alice = env.authenticatedContext('uid-alice', makeAuth('uid-alice', 'org1'));
    const storage = alice.storage();
    const receiptRef = ref(storage, 'orgs/org2/receipts/uid-alice/exp1/receipt.jpg');
    await assertFails(
      uploadBytes(receiptRef, FAKE_IMAGE, { contentType: 'image/jpeg' })
    );
  });

  it('unauthenticated cannot upload', async () => {
    const anon = env.unauthenticatedContext();
    const storage = anon.storage();
    const receiptRef = ref(storage, 'orgs/org1/receipts/uid-alice/exp1/receipt.jpg');
    await assertFails(
      uploadBytes(receiptRef, FAKE_IMAGE, { contentType: 'image/jpeg' })
    );
  });

  it('member can read receipt from own org', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(
        ref(ctx.storage(), 'orgs/org1/receipts/uid-alice/exp1/receipt.jpg'),
        FAKE_IMAGE,
        { contentType: 'image/jpeg' }
      );
    });
    const alice = env.authenticatedContext('uid-alice', makeAuth('uid-alice', 'org1'));
    await assertSucceeds(getDownloadURL(ref(alice.storage(), 'orgs/org1/receipts/uid-alice/exp1/receipt.jpg')));
  });

  it('member cannot read receipt from different org', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(
        ref(ctx.storage(), 'orgs/org2/receipts/uid-alice/exp1/receipt.jpg'),
        FAKE_IMAGE,
        { contentType: 'image/jpeg' }
      );
    });
    const alice = env.authenticatedContext('uid-alice', makeAuth('uid-alice', 'org1'));
    await assertFails(getDownloadURL(ref(alice.storage(), 'orgs/org2/receipts/uid-alice/exp1/receipt.jpg')));
  });
});
