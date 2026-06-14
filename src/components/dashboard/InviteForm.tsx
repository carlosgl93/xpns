import { useState } from 'preact/hooks';
import { authClaims } from '../../hooks/useAuth';

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
    } catch (err) {
      console.error('clipboard write failed', err);
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
    <div>
      <h3>Invitar empleado</h3>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="email@empresa.com"
          value={email}
          onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
          required
          disabled={loading}
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Generando…' : 'Generar link'}
        </button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {link && (
        <div>
          <p>Link de invitación (válido 7 días):</p>
          <input type="text" readOnly value={link} style={{ width: '100%' }} onClick={(e) => (e.target as HTMLInputElement).select()} />
          <button type="button" onClick={handleCopy}>
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      )}
    </div>
  );
}
