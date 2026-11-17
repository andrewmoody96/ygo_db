// "X / Y collected" counting.
// X = distinct cards owned in a set (two rarities of one card count once).
// A card is identified by its YGOPRODeck id when matched, otherwise by its
// card number with the region letters removed, so LOB-001 and LOB-EN001
// count as the same card. Y = the catalog total; null means unverified.
// OCG (Japanese/Korean/Chinese) cards are kept out of the English set totals.

import type { CardRecord, SetEntry } from '../types';
import { normalizeNumber, setCodeOf } from './cardNumber';

export type SetStatus = 'Not started' | 'In progress' | 'Complete' | 'Total unverified';

export interface SetProgress {
  set: SetEntry;
  owned: number; // X
  total: number | null; // Y
  copies: number;
  pct: number | null;
  status: SetStatus;
}

export interface TrackerResult {
  sets: SetProgress[];
  byYear: { year: number; owned: number; total: number; verifiedSets: number; unverifiedOwned: number }[];
  overall: { owned: number; total: number; pct: number; copies: number; unverifiedOwned: number };
  unknown: { setCode: string; records: CardRecord[] }[];
}

export function cardKey(rec: Pick<CardRecord, 'cardId' | 'cardNumber'>): string {
  if (rec.cardId) return `id:${rec.cardId}`;
  const n = normalizeNumber(rec.cardNumber);
  const dash = n.indexOf('-');
  const rest = dash === -1 ? n : n.slice(dash + 1);
  return `no:${n.slice(0, dash + 1)}${rest.replace(/^EN?(?=\d)/, '')}`;
}

export function countsTowardSets(rec: CardRecord): boolean {
  return rec.quantity > 0 && !/OCG/.test(rec.language ?? '');
}

export function computeTracker(sets: SetEntry[], records: CardRecord[]): TrackerResult {
  const byCode = new Map(sets.map((s) => [s.code, s]));
  const owned = new Map<string, Set<string>>();
  const copies = new Map<string, number>();
  const unknown = new Map<string, CardRecord[]>();

  for (const rec of records) {
    if (!countsTowardSets(rec)) continue;
    const code = setCodeOf(rec);
    if (!byCode.has(code)) {
      unknown.set(code, [...(unknown.get(code) ?? []), rec]);
      continue;
    }
    const keys = owned.get(code) ?? new Set<string>();
    keys.add(cardKey(rec));
    owned.set(code, keys);
    copies.set(code, (copies.get(code) ?? 0) + rec.quantity);
  }

  const progress: SetProgress[] = [...sets]
    .sort((a, b) => a.order - b.order)
    .map((set) => {
      const x = owned.get(set.code)?.size ?? 0;
      const y = set.total;
      const status: SetStatus =
        x === 0 ? 'Not started' : y == null ? 'Total unverified' : x >= y ? 'Complete' : 'In progress';
      return {
        set,
        owned: x,
        total: y,
        copies: copies.get(set.code) ?? 0,
        pct: y ? Math.min(1, x / y) : null,
        status,
      };
    });

  const years = new Map<number, TrackerResult['byYear'][number]>();
  let ownedV = 0;
  let totalV = 0;
  let unverifiedOwned = 0;
  for (const p of progress) {
    const y = years.get(p.set.year) ?? { year: p.set.year, owned: 0, total: 0, verifiedSets: 0, unverifiedOwned: 0 };
    if (p.total != null) {
      // Cap at the total so extra promos can't push a set over 100%.
      const x = Math.min(p.owned, p.total);
      y.owned += x;
      y.total += p.total;
      y.verifiedSets += 1;
      ownedV += x;
      totalV += p.total;
    } else {
      y.unverifiedOwned += p.owned;
      unverifiedOwned += p.owned;
    }
    years.set(p.set.year, y);
  }

  return {
    sets: progress,
    byYear: [...years.values()].sort((a, b) => a.year - b.year),
    overall: {
      owned: ownedV,
      total: totalV,
      pct: totalV ? ownedV / totalV : 0,
      copies: progress.reduce((n, p) => n + p.copies, 0),
      unverifiedOwned,
    },
    unknown: [...unknown.entries()].map(([setCode, recs]) => ({ setCode, records: recs })),
  };
}

/** Where a new set goes in binder order, from its release date. */
export function orderForRelease(sets: SetEntry[], release: string): number {
  const sorted = [...sets].sort((a, b) => a.order - b.order);
  let order = 5;
  for (const s of sorted) {
    if (s.release <= release) order = s.order + 1;
  }
  // Nudge past any set already at that order.
  while (sorted.some((s) => s.order === order)) order += 0.1;
  return order;
}
