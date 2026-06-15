// Admin-only invite link generator. Creates a 7-day invite token in Firestore
// and shows the resulting /join?token=... URL with a copy-to-clipboard button.

import { useState } from 'preact/hooks';
import { authClaims } from '../../hooks/useAuth';
import { Button } from '../ui/Button';

export default function InviteForm() {
  const [email, setEmail] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('No se pudo copiar al portapapeles. Cópialo manualmente.');
    }
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError(null);
    setLink(null);
    setLoading(true);

    try {
      const orgId = authClaims.value?.orgId;
      if (!orgId) throw new Error('Sin orgId en claims');

      const { getDb } = await import('../../lib/firebase');
      const { doc, collection, setDoc, serverTimestamp, Timestamp } = await import('firebase/firestore');

      const db = await getDb();
      const token = crypto.randomUUID();
      const expiresAt = Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await setDoc(doc(collection(db, `orgs/${orgId}/invites`), token), {
        orgId,
        email,
        expiresAt,
        createdAt: serverTimestamp(),
        usedAt: null,
        usedBy: null,
      });

      setLink(`${window.location.origin}/join?token=${token}&org=${orgId}`);
      setEmail('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al crear invitación');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="invite-card" aria-label="Invitar empleado">
      <h2>Invitar empleado</h2>
      <form onSubmit={handleSubmit}>
        <div className="invite-row">
          <input
            id="invite-email"
            type="email"
            className="form-input"
            placeholder="email@empresa.com"
            value={email}
            onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
            required
            disabled={loading}
            aria-label="Email del invitado"
          />
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? 'Generando…' : 'Generar link'}
          </Button>
        </div>
      </form>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      {link && (
        <div>
          <div className="link-display">{link}</div>
          <div className="link-row">
            <Button type="button" variant="secondary" onClick={handleCopy}>
              {copied ? 'Copiado' : 'Copiar link'}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
