// In-memory lookup over the downloaded card data, and the mapping from a
// YGOPRODeck card to the record's card-characteristic fields.

import type { ApiCard, CardData, CardRecord, SetEntry } from '../types';
import { normalizeNumber, prefixOf } from './cardNumber';

export interface Printing {
  code: string;
  rarity: string;
  setName: string;
  card: ApiCard;
}

export class CardIndex {
  byNumber = new Map<string, Printing[]>();
  byPrefix = new Map<string, Printing[]>();
  byId = new Map<number, ApiCard>();
  private names: { lower: string; card: ApiCard }[] = [];

  constructor(public data: CardData) {
    for (const card of data.cards) {
      this.byId.set(card.i, card);
      this.names.push({ lower: card.n.toLowerCase(), card });
      for (const [code, rarity, setName] of card.ps) {
        const p: Printing = { code: normalizeNumber(code), rarity, setName, card };
        push(this.byNumber, p.code, p);
        push(this.byPrefix, prefixOf(p.code), p);
      }
    }
  }

  lookup(cardNumber: string): Printing[] {
    return this.byNumber.get(normalizeNumber(cardNumber)) ?? [];
  }

  /** Distinct rarities a card number was printed in. */
  rarities(cardNumber: string): string[] {
    return [...new Set(this.lookup(cardNumber).map((p) => p.rarity))];
  }

  searchNames(query: string, limit = 20): ApiCard[] {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const starts: ApiCard[] = [];
    const contains: ApiCard[] = [];
    for (const { lower, card } of this.names) {
      if (lower.startsWith(q)) starts.push(card);
      else if (lower.includes(q)) contains.push(card);
      if (starts.length >= limit) break;
    }
    return [...starts, ...contains].slice(0, limit);
  }

  /** Every distinct card YGOPRODeck lists under a set code, in card-number order. */
  cardsInSet(setCode: string): { card: ApiCard; numbers: string[] }[] {
    const out = new Map<number, { card: ApiCard; numbers: string[] }>();
    const printings = [...(this.byPrefix.get(normalizeNumber(setCode)) ?? [])].sort((a, b) =>
      a.code.localeCompare(b.code, 'en', { numeric: true }),
    );
    for (const p of printings) {
      const entry = out.get(p.card.i) ?? { card: p.card, numbers: [] };
      if (!entry.numbers.includes(p.code)) entry.numbers.push(p.code);
      out.set(p.card.i, entry);
    }
    return [...out.values()];
  }
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

const FRAME_NAMES: Record<string, string> = {
  normal: 'Normal', effect: 'Effect', ritual: 'Ritual', fusion: 'Fusion', synchro: 'Synchro',
  xyz: 'Xyz', link: 'Link', token: 'Token',
};
const ABILITIES = ['Tuner', 'Flip', 'Gemini', 'Spirit', 'Toon', 'Union'];
const BANLIST: Record<string, string> = { Banned: 'Forbidden', Forbidden: 'Forbidden', Limited: 'Limited', 'Semi-Limited': 'Semi-Limited' };

// First set to fully use "Spell Card" wording (Magician's Force, Oct 10 2003).
const SPELL_WORDING_FROM = '2003-10-10';

export function categoryOf(card: ApiCard): string {
  if (card.t.includes('Monster')) return 'Monster';
  if (card.t === 'Spell Card') return 'Spell';
  if (card.t === 'Trap Card') return 'Trap';
  if (card.t === 'Token') return 'Token';
  if (card.t === 'Skill Card') return 'Skill Card';
  return 'Other';
}

const stat = (v: number | undefined) => (v == null ? undefined : v === -1 ? '?' : String(v));

/** Card characteristics for a record, from a YGOPRODeck card. */
export function characteristicsFrom(card: ApiCard, set?: SetEntry): Partial<CardRecord> {
  const category = categoryOf(card);
  const out: Partial<CardRecord> = {
    cardId: card.i,
    name: card.n,
    category,
    banlist: card.b ? BANLIST[card.b] ?? card.b : 'Unlimited',
    autofilled: true,
  };
  if (category === 'Monster' || category === 'Token') {
    const frame = category === 'Token' ? 'Token' : FRAME_NAMES[card.f ?? ''] ?? undefined;
    out.frame = frame;
    out.hasEffect = card.e != null ? card.e === 1 : frame !== 'Normal' && frame !== 'Token';
    out.pendulum = card.p === 1;
    out.abilities = ABILITIES.filter((a) => card.t.includes(a));
    out.attribute = card.a;
    out.monsterType = card.r;
    out.level = frame === 'Link' ? card.lv : card.l;
    if (frame === 'Link') out.linkArrows = card.m ?? [];
    if (card.p === 1) out.scale = card.s;
    out.atk = stat(card.k);
    if (frame !== 'Link') out.def = stat(card.d);
    out.wording = 'N/A';
  } else if (category === 'Spell' || category === 'Trap') {
    out.property = card.r;
    out.wording =
      category === 'Spell' ? (set && set.release < SPELL_WORDING_FROM ? 'Magic Card' : 'Spell Card') : 'N/A';
  } else {
    out.wording = 'N/A';
  }
  return out;
}

/**
 * Suggests a set override from the printing's set name. Example: the 2023
 * 25th Anniversary Ra prints as LC01-EN003 but is tracked as LC01-25.
 */
export function suggestOverride(p: Printing, sets: Map<string, SetEntry>): string | undefined {
  if (!/25th Anniversary/i.test(p.setName)) return undefined;
  const code = `${prefixOf(p.code)}-25`;
  return sets.has(code) ? code : undefined;
}
