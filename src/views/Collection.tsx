import { useMemo, useState } from 'preact/hooks';
import type { CardRecord } from '../types';
import { db, deleteRecord, saveRecord } from '../db';
import { setCodeOf } from '../logic/cardNumber';
import { rememberEnumValues, useEnums, useLive } from '../state';
import { CharacteristicsEditor, ExtraEditor, OwnershipEditor, enumValuesOf } from '../components/RecordEditor';
import { NumberInput } from '../components/fields';
import { describe } from './Entry';

const PAGE = 100;

export function Collection() {
  const records = useLive(() => db.records.toArray(), []) ?? [];
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [editing, setEditing] = useState<CardRecord | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? records.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            r.cardNumber.toLowerCase().includes(q) ||
            setCodeOf(r).toLowerCase() === q,
        )
      : records;
    return [...list].sort((a, b) => a.cardNumber.localeCompare(b.cardNumber, 'en', { numeric: true }));
  }, [records, query]);

  const copies = filtered.reduce((n, r) => n + r.quantity, 0);

  async function bump(r: CardRecord, delta: number) {
    await saveRecord({ ...r, quantity: Math.max(0, r.quantity + delta) });
  }

  return (
    <section class="view">
      <div class="card">
        <input
          type="search"
          placeholder="Search name, card number or set code"
          value={query}
          onInput={(e) => {
            setQuery(e.currentTarget.value);
            setLimit(PAGE);
          }}
        />
        <p class="muted small">
          {filtered.length} printings · {copies} copies
        </p>
      </div>

      {records.length === 0 && <p class="muted">No cards yet. Add some on the Enter tab.</p>}

      <ul class="records">
        {filtered.slice(0, limit).map((r) => (
          <li key={r.id} class="record">
            <button class="record-main" onClick={() => setEditing(r)}>
              <span class="code">{r.cardNumber}</span>
              <span class="name">{r.name || <em>Unnamed</em>}</span>
              <span class="muted small">
                {[r.rarity, r.edition, r.condition, r.storage === 'Binder' && r.binderPage ? `Binder p${r.binderPage}/s${r.binderSlot ?? '?'}` : r.storage].filter(Boolean).join(' · ')}
              </span>
            </button>
            <div class="qty">
              <button aria-label={`One fewer ${r.name}`} onClick={() => bump(r, -1)} disabled={r.quantity <= 0}>−</button>
              <span aria-label="Quantity">×{r.quantity}</span>
              <button aria-label={`One more ${r.name}`} onClick={() => bump(r, 1)}>+</button>
            </div>
          </li>
        ))}
      </ul>
      {filtered.length > limit && (
        <button class="secondary" onClick={() => setLimit(limit + PAGE)}>
          Show more ({filtered.length - limit} left)
        </button>
      )}

      {editing && <EditDialog rec={editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function EditDialog({ rec, onClose }: { rec: CardRecord; onClose: () => void }) {
  const enums = useEnums();
  const [draft, setDraft] = useState<CardRecord>(rec);
  const patch = (p: Partial<CardRecord>) => setDraft({ ...draft, ...p });

  async function save() {
    await saveRecord(draft);
    await rememberEnumValues(enumValuesOf(draft));
    onClose();
  }

  async function remove() {
    if (!confirm(`Delete ${draft.cardNumber} ${draft.name} (×${draft.quantity})? This can't be undone except from a backup.`)) return;
    await deleteRecord(rec.id!);
    onClose();
  }

  return (
    <div class="dialog-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="dialog" role="dialog" aria-modal="true" aria-label={`Edit ${rec.name}`}>
        <header>
          <h2>
            <span class="code">{draft.cardNumber}</span> {draft.name}
          </h2>
          <p class="muted small">{describe(draft)}</p>
        </header>
        <div class="grid">
          <label class="field">
            <span class="field-label">Card number</span>
            <input value={draft.cardNumber} onInput={(e) => patch({ cardNumber: e.currentTarget.value.toUpperCase() })} />
          </label>
          <NumberInput label="Quantity" value={draft.quantity} min={0} onChange={(v) => patch({ quantity: Math.max(0, v ?? 0) })} />
        </div>
        <h3>On the card</h3>
        <OwnershipEditor rec={draft} patch={patch} enums={enums} />
        <h3>Card details</h3>
        <CharacteristicsEditor rec={draft} patch={patch} enums={enums} />
        <h3>More</h3>
        <ExtraEditor rec={draft} patch={patch} enums={enums} />
        <footer>
          <button class="danger" onClick={remove}>Delete</button>
          <span class="spacer" />
          <button class="secondary" onClick={onClose}>Cancel</button>
          <button class="primary" onClick={save}>Save</button>
        </footer>
      </div>
    </div>
  );
}
