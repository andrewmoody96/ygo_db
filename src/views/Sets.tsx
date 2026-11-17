import { useMemo, useState } from 'preact/hooks';
import type { SetEntry } from '../types';
import { db } from '../db';
import { computeTracker, cardKey, countsTowardSets, orderForRelease, type SetProgress, type SetStatus } from '../logic/tracker';
import { setCodeOf, normalizeNumber } from '../logic/cardNumber';
import { allSets, useLive, type CardDataState } from '../state';
import { Field, NumberInput, Text } from '../components/fields';

const pct = (n: number | null) => (n == null ? '—' : `${Math.round(n * 100)}%`);
const STATUSES: (SetStatus | 'All' | 'Started')[] = ['All', 'Started', 'In progress', 'Complete', 'Total unverified', 'Not started'];

export function Sets({ cards }: { cards: CardDataState }) {
  const sets = useLive(allSets, []) ?? [];
  const records = useLive(() => db.records.toArray(), []) ?? [];
  const tracker = useMemo(() => computeTracker(sets, records), [sets, records]);
  const [filter, setFilter] = useState<(typeof STATUSES)[number]>('All');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);

  const shown = tracker.sets.filter((p) => {
    if (filter === 'Started' && p.owned === 0) return false;
    if (filter !== 'All' && filter !== 'Started' && p.status !== filter) return false;
    const q = query.trim().toLowerCase();
    return !q || p.set.code.toLowerCase().includes(q) || p.set.name.toLowerCase().includes(q);
  });
  const years = [...new Set(shown.map((p) => p.set.year))];
  const yearStats = new Map(tracker.byYear.map((y) => [y.year, y]));

  return (
    <section class="view">
      <div class="card summary">
        <div>
          <div class="big">{pct(tracker.overall.pct)}</div>
          <div class="muted small">
            {tracker.overall.owned} / {tracker.overall.total} cards across sets with verified totals
          </div>
        </div>
        <div class="muted small">
          {tracker.overall.copies} copies in tracked sets
          {tracker.overall.unverifiedOwned > 0 && ` · ${tracker.overall.unverifiedOwned} cards in sets with unverified totals`}
        </div>
      </div>

      {tracker.unknown.length > 0 && (
        <div class="card warn-card">
          <h3>Cards in sets not in your catalog</h3>
          <ul>
            {tracker.unknown.map((u) => (
              <li key={u.setCode}>
                <strong>{u.setCode}</strong> — {u.records.length} printing(s){' '}
                <button class="link" onClick={() => setAdding(u.setCode)}>Add set</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div class="card filters">
        <input type="search" placeholder="Find a set" value={query} onInput={(e) => setQuery(e.currentTarget.value)} />
        <select value={filter} onChange={(e) => setFilter(e.currentTarget.value as typeof filter)} aria-label="Status">
          {STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button class="secondary" onClick={() => setAdding('')}>Add set</button>
      </div>

      {years.map((year) => {
        const ys = yearStats.get(year)!;
        return (
          <div key={year} class="year">
            <h3 class="year-head">
              {year} <span class="muted small">{ys.total ? `${ys.owned} / ${ys.total} · ${pct(ys.owned / ys.total)}` : ''}</span>
            </h3>
            <ul class="sets">
              {shown.filter((p) => p.set.year === year).map((p) => (
                <li key={p.set.code}>
                  <button class="set-row" onClick={() => setOpen(open === p.set.code ? null : p.set.code)} aria-expanded={open === p.set.code}>
                    <span class="code">{p.set.code}</span>
                    <span class="name">{p.set.name}</span>
                    <span class="count">
                      {p.owned} / {p.total ?? '?'}
                    </span>
                    <span class="bar" aria-hidden="true">
                      <span style={{ width: pct(p.pct ?? 0) }} />
                    </span>
                    <span class={`status s-${p.status.replace(/\s/g, '-').toLowerCase()}`}>{p.status}</span>
                  </button>
                  {open === p.set.code && <SetDetail p={p} cards={cards} />}
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {adding !== null && <AddSetDialog code={adding} sets={sets} cards={cards} onClose={() => setAdding(null)} />}
    </section>
  );
}

function SetDetail({ p, cards }: { p: SetProgress; cards: CardDataState }) {
  const records = useLive(() => db.records.toArray(), []) ?? [];
  const mine = records.filter((r) => setCodeOf(r) === p.set.code && r.quantity > 0);
  const ownedKeys = new Set(mine.filter(countsTowardSets).map(cardKey));
  const listed = cards.status === 'ready' ? cards.index.cardsInSet(p.set.code) : [];
  const missing = listed.filter((c) => !ownedKeys.has(`id:${c.card.i}`));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<SetEntry>(p.set);

  return (
    <div class="set-detail">
      <p class="muted small">
        Released {p.set.releaseLabel} · {p.copies} copies · {pct(p.pct)}
        {p.set.notes && ` · ${p.set.notes}`}{' '}
        <button class="link" onClick={() => setEditing(!editing)}>Edit set</button>
      </p>
      {editing && (
        <div class="grid">
          <Text label="Name" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v ?? '' })} />
          <NumberInput label="Total cards (blank = unverified)" value={draft.total ?? undefined} min={0} onChange={(v) => setDraft({ ...draft, total: v ?? null })} />
          <Text label="Notes" value={draft.notes} onChange={(v) => setDraft({ ...draft, notes: v ?? '' })} wide />
          <button class="primary" onClick={async () => { await db.sets.put(draft); setEditing(false); }}>Save set</button>
        </div>
      )}
      <h4>Owned ({mine.length} printings)</h4>
      <ul class="compact">
        {mine
          .sort((a, b) => a.cardNumber.localeCompare(b.cardNumber, 'en', { numeric: true }))
          .map((r) => (
            <li key={r.id}>
              <span class="code">{r.cardNumber}</span> {r.name} <span class="muted">{r.rarity ?? ''} ×{r.quantity}</span>
            </li>
          ))}
      </ul>
      {listed.length > 0 && (
        <>
          <details>
          <summary>
            Missing: {missing.length} of {listed.length} cards YGOPRODeck lists under {p.set.code}
          </summary>
          {p.total != null && listed.length !== p.total && (
            <p class="muted small">YGOPRODeck lists {listed.length} cards here and your catalog total is {p.total}; the extra entries are usually reprints or promos sharing the code.</p>
          )}
          <ul class="compact">
            {missing.map((c) => (
              <li key={c.card.i}>
                <span class="code">{c.numbers.slice(0, 3).join(', ')}</span> {c.card.n}
              </li>
            ))}
          </ul>
          </details>
        </>
      )}
    </div>
  );
}

function AddSetDialog({ code, sets, cards, onClose }: { code: string; sets: SetEntry[]; cards: CardDataState; onClose: () => void }) {
  const known = cards.status === 'ready' ? cards.index.data.sets : [];
  const guess = known.find((s) => s.code === code);
  const [draft, setDraft] = useState({
    code,
    name: guess?.name ?? '',
    release: guess?.date ?? '',
    total: guess?.count as number | undefined,
    notes: '',
  });
  const exists = sets.some((s) => s.code === normalizeNumber(draft.code));
  const valid = !!draft.code && !!draft.name && /^\d{4}(-\d{2}(-\d{2})?)?$/.test(draft.release) && !exists;

  function fromCode(c: string) {
    const up = normalizeNumber(c);
    const g = known.find((s) => s.code === up);
    setDraft({ ...draft, code: up, ...(g ? { name: g.name, release: g.date ?? draft.release, total: g.count } : {}) });
  }

  async function save() {
    const entry: SetEntry = {
      code: normalizeNumber(draft.code),
      name: draft.name,
      year: Number(draft.release.slice(0, 4)),
      release: draft.release,
      releaseLabel: draft.release,
      total: draft.total ?? null,
      notes: draft.notes,
      order: orderForRelease(sets, draft.release),
      custom: true,
    };
    await db.sets.add(entry);
    onClose();
  }

  return (
    <div class="dialog-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="dialog" role="dialog" aria-modal="true" aria-label="Add set">
        <h2>Add a set</h2>
        <p class="muted small">Typing a code fills in what YGOPRODeck knows about it. Check the total before saving.</p>
        <div class="grid">
          <Field label="Set code">
            <input value={draft.code} onInput={(e) => fromCode(e.currentTarget.value)} autocapitalize="characters" />
          </Field>
          <Text label="Name" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v ?? '' })} />
          <Field label="Release date (YYYY-MM-DD)">
            <input value={draft.release} placeholder="2026-09-04" onInput={(e) => setDraft({ ...draft, release: e.currentTarget.value })} />
          </Field>
          <NumberInput label="Total cards (blank = unverified)" value={draft.total} min={0} onChange={(v) => setDraft({ ...draft, total: v })} />
          <Text label="Notes" value={draft.notes} onChange={(v) => setDraft({ ...draft, notes: v ?? '' })} wide />
        </div>
        {exists && <p class="warn small">{draft.code} is already in the catalog.</p>}
        <footer>
          <span class="spacer" />
          <button class="secondary" onClick={onClose}>Cancel</button>
          <button class="primary" disabled={!valid} onClick={save}>Add set</button>
        </footer>
      </div>
    </div>
  );
}
