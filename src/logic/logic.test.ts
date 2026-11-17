import { describe, expect, it, beforeEach } from 'vitest';
import { numberFromSuffix, numberingStyles, prefixOf, setCodeOf } from './cardNumber';
import { CardIndex, characteristicsFrom, suggestOverride } from './cardIndex';
import { cardKey, computeTracker, orderForRelease } from './tracker';
import { SEED_SETS } from '../data/seedSets';
import type { ApiCard, CardData, CardRecord, SetEntry } from '../types';
import { addOrBump, db, exportAll, parseBackup, restoreAll, undoAdd } from '../db';

const rec = (over: Partial<CardRecord>): CardRecord => ({
  cardNumber: 'LOB-001',
  name: 'Blue-Eyes White Dragon',
  category: 'Monster',
  quantity: 1,
  createdAt: '',
  updatedAt: '',
  ...over,
});

describe('card numbers', () => {
  it('takes the set code from the prefix before the first dash', () => {
    expect(prefixOf('LDK2-ENS04')).toBe('LDK2');
    expect(prefixOf('sgx1-enb01')).toBe('SGX1');
    expect(setCodeOf({ cardNumber: 'LC01-EN003', setOverride: 'LC01-25' })).toBe('LC01-25');
  });

  it('builds numbers from what is typed in set mode', () => {
    expect(numberFromSuffix('DCR', '56', 'NA')).toBe('DCR-056');
    expect(numberFromSuffix('LOB', '056', 'EN')).toBe('LOB-EN056');
    expect(numberFromSuffix('LOB', '21', 'EU')).toBe('LOB-E021');
    expect(numberFromSuffix('LDK2', 's04', 'EN')).toBe('LDK2-ENS04');
    expect(numberFromSuffix('LDK2', 'ENS04', 'EN')).toBe('LDK2-ENS04');
    expect(numberFromSuffix('DCR', 'SYE-024', 'NA')).toBe('SYE-024');
  });

  it('detects which numbering styles a set uses', () => {
    expect(numberingStyles('LOB', ['LOB-001', 'LOB-E001', 'LOB-EN001', 'LOBX-1'])).toEqual(['NA', 'EN', 'EU']);
    expect(numberingStyles('STAS', ['STAS-EN001'])).toEqual(['EN']);
  });
});

const card = (over: Partial<ApiCard>): ApiCard => ({ i: 1, n: 'X', t: 'Effect Monster', ps: [], ...over });

describe('autofill mapping', () => {
  const lob = SEED_SETS.find((s) => s.code === 'LOB') as SetEntry;
  const mfc = SEED_SETS.find((s) => s.code === 'MFC') as SetEntry;

  it('maps a pendulum xyz', () => {
    const c = characteristicsFrom(card({ t: 'XYZ Pendulum Effect Monster', f: 'xyz', p: 1, l: 4, s: 3, k: -1, d: 2000, a: 'DARK', r: 'Dragon', e: 1 }));
    expect(c).toMatchObject({ category: 'Monster', frame: 'Xyz', pendulum: true, level: 4, scale: 3, atk: '?', def: '2000', hasEffect: true });
  });

  it('maps a link monster without DEF', () => {
    const c = characteristicsFrom(card({ t: 'Link Monster', f: 'link', lv: 3, k: 2500, d: undefined, m: ['Top', 'Bottom'] }));
    expect(c.level).toBe(3);
    expect(c.def).toBeUndefined();
    expect(c.linkArrows).toEqual(['Top', 'Bottom']);
  });

  it('uses Magic wording for spells from sets before Magician’s Force', () => {
    const spell = card({ t: 'Spell Card', f: 'spell', r: 'Equip' });
    expect(characteristicsFrom(spell, lob)).toMatchObject({ category: 'Spell', property: 'Equip', wording: 'Magic Card' });
    expect(characteristicsFrom(spell, mfc).wording).toBe('Spell Card');
  });

  it('reads tuner and banlist', () => {
    const c = characteristicsFrom(card({ t: 'Synchro Tuner Monster', f: 'synchro', b: 'Limited' }));
    expect(c.abilities).toEqual(['Tuner']);
    expect(c.banlist).toBe('Limited');
  });

  it('suggests the LC01-25 override for 25th Anniversary printings', () => {
    const data: CardData = {
      dbVersion: '1', lastUpdate: '', builtAt: '', cardCount: 1, sets: [],
      cards: [card({ i: 10, n: 'The Winged Dragon of Ra', ps: [['LC01-EN003', 'Ultra Rare', 'Legendary Collection: 25th Anniversary Edition']] })],
    };
    const index = new CardIndex(data);
    const [p] = index.lookup('lc01-en003');
    const sets = new Map(SEED_SETS.map((s) => [s.code, s as SetEntry]));
    expect(suggestOverride(p, sets)).toBe('LC01-25');
  });
});

describe('set tracker', () => {
  const sets = SEED_SETS as SetEntry[];

  it('seeds 280 sets, 56 with unverified totals', () => {
    expect(sets).toHaveLength(280);
    expect(sets.filter((s) => s.total == null)).toHaveLength(56);
  });

  it('counts each card once per set across rarities and numbering', () => {
    const t = computeTracker(sets, [
      rec({ cardNumber: 'LOB-001', rarity: 'Ultra Rare', quantity: 2 }),
      rec({ cardNumber: 'LOB-EN001', rarity: 'Ultra Rare' }),
      rec({ cardNumber: 'LOB-002', name: 'Mystical Elf' }),
    ]);
    const lob = t.sets.find((s) => s.set.code === 'LOB')!;
    expect(lob.owned).toBe(2);
    expect(lob.total).toBe(126);
    expect(lob.copies).toBe(4);
    expect(lob.status).toBe('In progress');
  });

  it('honours set overrides and sister-deck codes', () => {
    const t = computeTracker(sets, [
      rec({ cardNumber: 'LC01-EN003', setOverride: 'LC01-25' }),
      rec({ cardNumber: 'LDK2-ENS04' }),
      rec({ cardNumber: 'LDK2-ENK04' }),
    ]);
    expect(t.sets.find((s) => s.set.code === 'LC01-25')!.owned).toBe(1);
    expect(t.sets.find((s) => s.set.code === 'LC01')!.owned).toBe(0);
    expect(t.sets.find((s) => s.set.code === 'LDK2')!.owned).toBe(2);
  });

  it('shows unverified totals as ? and keeps them out of percentages', () => {
    const t = computeTracker(sets, [rec({ cardNumber: 'DDS-001' })]);
    const dds = t.sets.find((s) => s.set.code === 'DDS')!;
    expect(dds.total).toBeNull();
    expect(dds.pct).toBeNull();
    expect(dds.status).toBe('Total unverified');
    expect(t.overall.owned).toBe(0);
    expect(t.overall.unverifiedOwned).toBe(1);
  });

  it('keeps OCG cards out and flags unknown sets', () => {
    const t = computeTracker(sets, [
      rec({ cardNumber: 'LOB-001', language: 'Korean (OCG)' }),
      rec({ cardNumber: 'ZZZZ-001' }),
    ]);
    expect(t.sets.find((s) => s.set.code === 'LOB')!.owned).toBe(0);
    expect(t.unknown.map((u) => u.setCode)).toEqual(['ZZZZ']);
  });

  it('treats region letters as the same card when unmatched', () => {
    expect(cardKey({ cardNumber: 'LOB-EN001' })).toBe(cardKey({ cardNumber: 'LOB-001' }));
    expect(cardKey({ cardNumber: 'LDK2-ENS04' })).not.toBe(cardKey({ cardNumber: 'LDK2-ENK04' }));
  });

  it('places a new set by release date', () => {
    const o = orderForRelease(sets, '2026-10-01');
    expect(o).toBeGreaterThan(sets.find((s) => s.code === 'MAMO')!.order);
  });
});

describe('storage', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('seeds the catalog on first open', async () => {
    expect(await db.sets.count()).toBe(280);
  });

  it('bumps quantity for a duplicate printing and can undo', async () => {
    const base = rec({ cardNumber: 'dcr-056', rarity: 'Rare', edition: '1st Edition', condition: 'Near Mint' });
    const first = await addOrBump(base);
    expect(first.kind).toBe('added');
    const second = await addOrBump(base);
    expect(second.kind).toBe('bumped');
    expect(second.record.quantity).toBe(2);
    expect(await db.records.count()).toBe(1);
    const other = await addOrBump({ ...base, condition: 'Lightly Played' });
    expect(other.kind).toBe('added');
    await undoAdd(second);
    expect((await db.records.get(first.record.id!))!.quantity).toBe(1);
  });

  it('backs up and restores identically, with a snapshot', async () => {
    await addOrBump(rec({ cardNumber: 'SDY-001' }));
    await db.sets.update('LOB', { notes: 'edited' });
    const file = parseBackup(JSON.stringify(await exportAll()));
    await db.records.clear();
    await restoreAll(file);
    expect(await db.records.count()).toBe(1);
    expect((await db.sets.get('LOB'))!.notes).toBe('edited');
    expect(await db.snapshots.count()).toBe(1);
  });

  it('rejects files that are not backups', () => {
    expect(() => parseBackup('{"hello":1}')).toThrow();
  });
});

import { languageFor } from './cardNumber';
describe('language from card number', () => {
  it('follows the numbering style unless a non-English language is chosen', () => {
    expect(languageFor('DCR-056')).toBe('English (NA)');
    expect(languageFor('LOB-E021', 'English (NA)')).toBe('English (EU)');
    expect(languageFor('STAS-EN001')).toBe('English (Worldwide -EN)');
    expect(languageFor('LOCH-KR001', 'Korean (OCG)')).toBe('Korean (OCG)');
  });
});
