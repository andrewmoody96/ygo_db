import { useEffect, useState } from 'preact/hooks';
import { liveQuery } from 'dexie';
import type { CardData } from './types';
import { CardIndex } from './logic/cardIndex';
import { DEFAULT_ENUMS, type EnumKey } from './enums';
import { db, getSetting, setSetting } from './db';

/** Re-runs a Dexie query whenever the data it reads changes. */
export function useLive<T>(query: () => Promise<T>, deps: unknown[] = []): T | undefined {
  const [value, setValue] = useState<T>();
  useEffect(() => {
    const sub = liveQuery(query).subscribe({ next: setValue, error: (e) => console.error(e) });
    return () => sub.unsubscribe();
  }, deps);
  return value;
}

export type CardDataState =
  | { status: 'loading' }
  | { status: 'ready'; index: CardIndex }
  | { status: 'missing'; error: string };

let cached: Promise<CardIndex> | null = null;

const DATA_URL = `${import.meta.env.BASE_URL}data/`;
const CACHE = 'ygo-card-data';

/**
 * Card data is kept on the device (Cache Storage) so autofill works offline.
 * When online, the small meta.json says whether a newer version exists; the
 * 4 MB cards.json is downloaded only when it does.
 */
async function fetchCardData(): Promise<CardData> {
  const cache = 'caches' in globalThis ? await caches.open(CACHE) : undefined;
  const stored = await cache?.match(DATA_URL + 'cards.json');
  const storedVersion = stored?.headers.get('x-db-version');

  let latest: string | undefined;
  try {
    const meta = await fetch(DATA_URL + 'meta.json', { cache: 'no-store' });
    if (meta.ok) latest = (await meta.json()).dbVersion;
  } catch {
    // offline: use what's stored
  }

  if (stored && (!latest || latest === storedVersion)) return stored.json();

  try {
    const res = await fetch(DATA_URL + 'cards.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const data = JSON.parse(text) as CardData;
    await cache?.put(
      DATA_URL + 'cards.json',
      new Response(text, { headers: { 'content-type': 'application/json', 'x-db-version': String(data.dbVersion) } }),
    );
    return data;
  } catch (err) {
    if (stored) return stored.json();
    throw err;
  }
}

function loadCardData(): Promise<CardIndex> {
  cached ??= fetchCardData()
    .then((data) => new CardIndex(data))
    .catch((err) => {
      cached = null;
      throw err;
    });
  return cached;
}

export function useCardData(): CardDataState {
  const [state, setState] = useState<CardDataState>({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    loadCardData()
      .then((index) => alive && setState({ status: 'ready', index }))
      .catch((err) => alive && setState({ status: 'missing', error: String(err?.message ?? err) }));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

/** Choice lists: defaults plus any values the user has added. */
export function useEnums(): Record<EnumKey, string[]> {
  const extra = useLive(() => getSetting<Partial<Record<EnumKey, string[]>>>('enumExtras', {}), []);
  const out = { ...DEFAULT_ENUMS } as Record<EnumKey, string[]>;
  for (const [k, vals] of Object.entries(extra ?? {})) {
    const key = k as EnumKey;
    out[key] = [...DEFAULT_ENUMS[key], ...(vals ?? []).filter((v) => !DEFAULT_ENUMS[key].includes(v))];
  }
  return out;
}

/** Remembers values typed into choice fields that aren't in the list yet. */
export async function rememberEnumValues(values: Partial<Record<EnumKey, string | undefined>>) {
  const extras = await getSetting<Partial<Record<EnumKey, string[]>>>('enumExtras', {});
  let changed = false;
  for (const [k, v] of Object.entries(values)) {
    const key = k as EnumKey;
    if (!v || DEFAULT_ENUMS[key].includes(v) || extras[key]?.includes(v)) continue;
    extras[key] = [...(extras[key] ?? []), v];
    changed = true;
  }
  if (changed) await setSetting('enumExtras', extras);
}

export function useSetting<T>(key: string, fallback: T): [T, (v: T) => void] {
  const value = useLive(() => getSetting(key, fallback), [key]);
  return [value ?? fallback, (v: T) => void setSetting(key, v)];
}

export const allSets = () => db.sets.orderBy('order').toArray();
