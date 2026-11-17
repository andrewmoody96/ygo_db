import type { CardRecord } from '../types';
import { setCodeOf } from './cardNumber';

// Column order follows the spreadsheet's Card Database tab as closely as the app's fields allow.
const COLUMNS: [string, (r: CardRecord) => unknown][] = [
  ['Card Name', (r) => r.name],
  ['Card Number', (r) => r.cardNumber],
  ['Set Override', (r) => r.setOverride],
  ['Set Code', (r) => setCodeOf(r)],
  ['Category', (r) => r.category],
  ['Monster Frame', (r) => r.frame],
  ['Has Effect', (r) => r.hasEffect],
  ['Pendulum', (r) => r.pendulum],
  ['Monster Ability', (r) => r.abilities?.join(' / ')],
  ['Spell/Trap Property', (r) => r.property],
  ['Printed Wording', (r) => r.wording],
  ['Attribute', (r) => r.attribute],
  ['Monster Type', (r) => r.monsterType],
  ['Level/Rank/Link', (r) => r.level],
  ['Link Arrows', (r) => r.linkArrows?.join(' / ')],
  ['Pendulum Scale', (r) => r.scale],
  ['ATK', (r) => r.atk],
  ['DEF', (r) => r.def],
  ['Rarity', (r) => r.rarity],
  ['Edition', (r) => r.edition],
  ['Language/Region', (r) => r.language],
  ['Condition', (r) => r.condition],
  ['Quantity', (r) => r.quantity],
  ['In Deck', (r) => r.inDeck],
  ['Deck Name', (r) => r.deckName],
  ['Qty in Deck', (r) => r.deckQty],
  ['Banlist Status', (r) => r.banlist],
  ['Banlist Date Checked', (r) => r.banlistChecked],
  ['Storage Location', (r) => r.storage],
  ['Binder Page', (r) => r.binderPage],
  ['Binder Slot', (r) => r.binderSlot],
  ['Graded', (r) => r.graded],
  ['Grading Company', (r) => r.gradingCompany],
  ['Grade', (r) => r.grade],
  ['Value per Copy (USD)', (r) => r.value],
  ['Total Value (USD)', (r) => (r.value != null ? +(r.value * r.quantity).toFixed(2) : undefined)],
  ['Notes', (r) => r.notes],
];

function cell(v: unknown): string {
  if (v == null) return '';
  let s = typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v);
  if (/^[=+@]/.test(s)) s = `'${s}`; // keep spreadsheets from treating text as a formula
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV with a BOM so Excel reads UTF-8 names correctly. */
export function toCsv(records: CardRecord[]): string {
  const sorted = [...records].sort((a, b) => a.cardNumber.localeCompare(b.cardNumber, 'en', { numeric: true }));
  const lines = [COLUMNS.map(([h]) => cell(h)).join(','), ...sorted.map((r) => COLUMNS.map(([, f]) => cell(f(r))).join(','))];
  return '﻿' + lines.join('\r\n') + '\r\n';
}
