// Browser storage (IndexedDB via Dexie). Bump the version number and add an
// upgrade step whenever the schema changes, so existing data is migrated.

import Dexie, { type Table } from 'dexie';
import type { CardRecord, SetEntry, Settings } from './types';
import { SEED_SETS } from './data/seedSets';
import { normalizeNumber } from './logic/cardNumber';

export interface Snapshot {
  id?: number;
  createdAt: string;
  reason: string;
  data: BackupFile;
}

export interface BackupFile {
  app: 'ygo_db';
  format: 1;
  exportedAt: string;
  records: CardRecord[];
  sets: SetEntry[];
  settings: Settings[];
}

class YgoDb extends Dexie {
  records!: Table<CardRecord, number>;
  sets!: Table<SetEntry, string>;
  settings!: Table<Settings, string>;
  snapshots!: Table<Snapshot, number>;

  constructor(name = 'ygo_db') {
    super(name);
    this.version(1).stores({
      records: '++id, cardNumber, cardId, updatedAt',
      sets: 'code, order',
      settings: 'key',
      snapshots: '++id, createdAt',
    });
    this.on('populate', (tx) => {
      tx.table('sets').bulkAdd(SEED_SETS.map((s) => ({ ...s })));
    });
  }
}

export const db = new YgoDb();

const MAX_SNAPSHOTS = 5;

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return row ? (row.value as T) : fallback;
}

export async function setSetting(key: string, value: unknown) {
  await db.settings.put({ key, value });
}

async function noteChange(n = 1) {
  const count = await getSetting('changesSinceBackup', 0);
  await setSetting('changesSinceBackup', count + n);
}

const now = () => new Date().toISOString();

/** Same printing = same number, rarity, edition, language, condition (and override). */
export function samePrinting(a: Partial<CardRecord>, b: Partial<CardRecord>): boolean {
  return (
    normalizeNumber(a.cardNumber ?? '') === normalizeNumber(b.cardNumber ?? '') &&
    (a.rarity ?? '') === (b.rarity ?? '') &&
    (a.edition ?? '') === (b.edition ?? '') &&
    (a.language ?? '') === (b.language ?? '') &&
    (a.condition ?? '') === (b.condition ?? '') &&
    (a.setOverride ?? '') === (b.setOverride ?? '')
  );
}

export async function findSamePrinting(rec: Partial<CardRecord>): Promise<CardRecord | undefined> {
  const candidates = await db.records.where('cardNumber').equals(normalizeNumber(rec.cardNumber ?? '')).toArray();
  return candidates.find((c) => samePrinting(c, rec));
}

export type AddResult = { kind: 'added' | 'bumped'; record: CardRecord; previousQty?: number };

/** Adds a record, or bumps the quantity of the matching printing. */
export async function addOrBump(input: Omit<CardRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<AddResult> {
  return db.transaction('rw', db.records, db.settings, async () => {
    const rec = { ...input, cardNumber: normalizeNumber(input.cardNumber) };
    const existing = await findSamePrinting(rec);
    if (existing) {
      const previousQty = existing.quantity;
      const updated = { ...existing, quantity: existing.quantity + rec.quantity, updatedAt: now() };
      await db.records.put(updated);
      await noteChange();
      return { kind: 'bumped' as const, record: updated, previousQty };
    }
    const stamp = now();
    const full: CardRecord = { ...rec, createdAt: stamp, updatedAt: stamp };
    full.id = await db.records.add(full);
    await noteChange();
    return { kind: 'added' as const, record: full };
  });
}

export async function undoAdd(result: AddResult) {
  if (!result.record.id) return;
  if (result.kind === 'added') await db.records.delete(result.record.id);
  else await db.records.update(result.record.id, { quantity: result.previousQty ?? 0, updatedAt: now() });
  await noteChange();
}

export async function saveRecord(rec: CardRecord) {
  const full = { ...rec, cardNumber: normalizeNumber(rec.cardNumber), updatedAt: now() };
  await db.records.put(full);
  await noteChange();
}

export async function deleteRecord(id: number) {
  await db.records.delete(id);
  await noteChange();
}

// ---------- backup / restore ----------

export async function exportAll(): Promise<BackupFile> {
  const [records, sets, settings] = await Promise.all([
    db.records.toArray(),
    db.sets.toArray(),
    db.settings.toArray(),
  ]);
  return {
    app: 'ygo_db',
    format: 1,
    exportedAt: now(),
    records,
    sets,
    // Backup bookkeeping belongs to this device, not the file.
    settings: settings.filter((s) => !['lastBackupAt', 'changesSinceBackup'].includes(s.key)),
  };
}

export function parseBackup(text: string): BackupFile {
  const data = JSON.parse(text);
  if (data?.app !== 'ygo_db' || data.format !== 1 || !Array.isArray(data.records) || !Array.isArray(data.sets)) {
    throw new Error('This file is not a ygo_db backup.');
  }
  return { ...data, settings: Array.isArray(data.settings) ? data.settings : [] };
}

export async function takeSnapshot(reason: string) {
  await db.snapshots.add({ createdAt: now(), reason, data: await exportAll() });
  const ids = await db.snapshots.orderBy('createdAt').primaryKeys();
  if (ids.length > MAX_SNAPSHOTS) await db.snapshots.bulkDelete(ids.slice(0, ids.length - MAX_SNAPSHOTS));
}

/** Replaces all data with a backup. Takes a snapshot first so it can be undone. */
export async function restoreAll(file: BackupFile, reason = 'Before restore') {
  await takeSnapshot(reason);
  await db.transaction('rw', db.records, db.sets, db.settings, async () => {
    const keep = (await db.settings.toArray()).filter((s) => ['lastBackupAt', 'changesSinceBackup'].includes(s.key));
    await Promise.all([db.records.clear(), db.sets.clear(), db.settings.clear()]);
    await db.records.bulkAdd(file.records);
    await db.sets.bulkAdd(file.sets);
    await db.settings.bulkPut([...file.settings, ...keep]);
  });
}

export async function markBackedUp() {
  await setSetting('lastBackupAt', now());
  await setSetting('changesSinceBackup', 0);
}
