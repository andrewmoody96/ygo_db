import { useState } from 'preact/hooks';
import { db, exportAll, markBackedUp, parseBackup, restoreAll, type BackupFile } from '../db';
import { useLive, useSetting, type CardDataState } from '../state';
import { toCsv } from '../logic/csv';

const NUDGE_AFTER = 25;

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');

export function BackupNudge({ go }: { go: () => void }) {
  const [changes] = useSetting('changesSinceBackup', 0);
  if (changes < NUDGE_AFTER) return null;
  return (
    <button class="nudge" onClick={go}>
      {changes} changes since your last backup. Back up now
    </button>
  );
}

export function Backup({ cards }: { cards: CardDataState }) {
  const [lastBackup] = useSetting<string | null>('lastBackupAt', null);
  const [changes] = useSetting('changesSinceBackup', 0);
  const counts = useLive(async () => ({ records: await db.records.count(), sets: await db.sets.count() }), []);
  const snapshots = useLive(() => db.snapshots.orderBy('createdAt').reverse().toArray(), []) ?? [];
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  async function backup() {
    const data = await exportAll();
    download(`ygo-collection-${stamp()}.json`, JSON.stringify(data), 'application/json');
    await markBackedUp();
    setDone(`Backup saved with ${data.records.length} printings.`);
  }

  async function csv() {
    const records = await db.records.toArray();
    download(`ygo-cards-${stamp()}.csv`, toCsv(records), 'text/csv');
  }

  async function pick(file: File | undefined) {
    setError('');
    setDone('');
    if (!file) return;
    try {
      setPending(parseBackup(await file.text()));
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
  }

  async function restore(file: BackupFile, reason?: string) {
    await restoreAll(file, reason);
    setPending(null);
    setDone(`Restored ${file.records.length} printings and ${file.sets.length} sets. Your previous data was kept as a snapshot below.`);
  }

  return (
    <section class="view">
      <div class="card">
        <h2>Back up</h2>
        <p class="muted small">
          Your collection lives only in this browser. {lastBackup ? `Last backup: ${new Date(lastBackup).toLocaleString()}.` : 'No backup yet.'}{' '}
          {changes > 0 && `${changes} changes since.`}
        </p>
        <div class="row">
          <button class="primary" onClick={backup}>Download backup (.json)</button>
          <button class="secondary" onClick={csv}>Export cards (.csv)</button>
        </div>
        <p class="muted small">The JSON file restores everything on another device. The CSV opens in Excel or Google Sheets.</p>
      </div>

      <div class="card">
        <h2>Restore</h2>
        <p class="muted small">Replaces everything on this device with a backup file. Your current data is saved as a snapshot first.</p>
        <input type="file" accept="application/json,.json" onChange={(e) => pick(e.currentTarget.files?.[0])} />
        {error && <p class="warn">{error}</p>}
        {pending && counts && (
          <div class="confirm">
            <table>
              <thead>
                <tr><th></th><th>On this device</th><th>In the file</th></tr>
              </thead>
              <tbody>
                <tr><td>Card printings</td><td>{counts.records}</td><td>{pending.records.length}</td></tr>
                <tr><td>Sets</td><td>{counts.sets}</td><td>{pending.sets.length}</td></tr>
                <tr><td>Copies</td><td>—</td><td>{pending.records.reduce((n, r) => n + (r.quantity || 0), 0)}</td></tr>
              </tbody>
            </table>
            <p class="small">Backup from {new Date(pending.exportedAt).toLocaleString()}.</p>
            <div class="row">
              <button class="danger" onClick={() => restore(pending)}>Replace my data with this backup</button>
              <button class="secondary" onClick={() => setPending(null)}>Cancel</button>
            </div>
          </div>
        )}
        {done && <p class="ok">{done}</p>}
      </div>

      <div class="card">
        <h2>Automatic snapshots</h2>
        <p class="muted small">Taken before each restore; the last 5 are kept on this device.</p>
        {snapshots.length === 0 && <p class="muted small">None yet.</p>}
        <ul class="compact">
          {snapshots.map((s) => (
            <li key={s.id}>
              {new Date(s.createdAt).toLocaleString()} — {s.reason}, {s.data.records.length} printings{' '}
              <button
                class="link"
                onClick={() => confirm('Replace your current data with this snapshot?') && restore(s.data, 'Before rolling back')}
              >
                Roll back to this
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div class="card">
        <h2>Card data</h2>
        {cards.status === 'ready' && (
          <p class="small">
            {cards.index.data.cardCount.toLocaleString()} cards from YGOPRODeck, database version {cards.index.data.dbVersion} (updated{' '}
            {cards.index.data.lastUpdate.slice(0, 10)}). Refreshed daily.
          </p>
        )}
        {cards.status === 'loading' && <p class="small">Loading card data…</p>}
        {cards.status === 'missing' && <p class="warn small">Card data unavailable: {cards.error}</p>}
        <p class="muted small">
          Card data courtesy of <a href="https://ygoprodeck.com/" target="_blank" rel="noopener">YGOPRODeck</a>. Yu-Gi-Oh! card names and text are
          © Konami / 4K Media. This is a personal, unofficial app, not affiliated with or endorsed by Konami, 4K Media or YGOPRODeck.
        </p>
      </div>
    </section>
  );
}
