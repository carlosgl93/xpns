import type { OrgMember } from '../types/models';

export async function fetchOrgMembers(orgId: string): Promise<OrgMember[]> {
  const { getDb } = await import('../lib/firebase');
  const { collection, getDocs } = await import('firebase/firestore');
  const db = await getDb();
  const snap = await getDocs(collection(db, `orgs/${orgId}/members`));
  return snap.docs.map((d: any) => ({ id: d.id, ...d.data() })) as OrgMember[];
}
