// Card number parsing. A card number's set code is the part before the first
// dash (LDK2-ENS04 -> LDK2); a record's set override wins over it.

export type Numbering = 'NA' | 'EU' | 'EN';

export const NUMBERING_LABEL: Record<Numbering, string> = {
  NA: 'NA (LOB-001)',
  EU: 'EU (LOB-E001)',
  EN: 'Worldwide (LOB-EN001)',
};

export const NUMBERING_LANGUAGE: Record<Numbering, string> = {
  NA: 'English (NA)',
  EU: 'English (EU)',
  EN: 'English (Worldwide -EN)',
};

export function normalizeNumber(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, '');
}

export function prefixOf(cardNumber: string): string {
  const n = normalizeNumber(cardNumber);
  const dash = n.indexOf('-');
  return dash === -1 ? n : n.slice(0, dash);
}

export function setCodeOf(rec: { cardNumber: string; setOverride?: string }): string {
  return rec.setOverride ? normalizeNumber(rec.setOverride) : prefixOf(rec.cardNumber);
}

/**
 * Builds a full card number from what is typed in set-focused entry.
 *  "56"    + DCR (NA)  -> DCR-056
 *  "56"    + LOB (EN)  -> LOB-EN056
 *  "S04"   + LDK2 (EN) -> LDK2-ENS04
 *  "ENS04" + LDK2      -> LDK2-ENS04
 *  "LOB-001" (already full) -> LOB-001
 */
export function numberFromSuffix(setCode: string, typed: string, numbering: Numbering): string {
  const s = normalizeNumber(typed);
  if (!s) return '';
  if (s.includes('-')) return s; // full number typed
  const set = normalizeNumber(setCode);
  if (/^\d+$/.test(s)) {
    const digits = s.padStart(3, '0');
    if (numbering === 'NA') return `${set}-${digits}`;
    if (numbering === 'EU') return `${set}-E${digits}`;
    return `${set}-EN${digits}`;
  }
  if (numbering === 'EN' && !s.startsWith('EN')) return `${set}-EN${s}`;
  return `${set}-${s}`;
}

/**
 * Language implied by how the number is printed (DCR-056 = NA, DCR-EN056 =
 * worldwide, LOB-E021 = EU). A non-English default (e.g. a Korean card) wins.
 */
export function languageFor(cardNumber: string, preferred?: string): string | undefined {
  const english = Object.values(NUMBERING_LANGUAGE);
  if (preferred && !english.includes(preferred)) return preferred;
  const rest = normalizeNumber(cardNumber).split('-').slice(1).join('-');
  if (/^\d+$/.test(rest)) return NUMBERING_LANGUAGE.NA;
  if (/^E\d+$/.test(rest)) return NUMBERING_LANGUAGE.EU;
  if (rest.startsWith('EN')) return NUMBERING_LANGUAGE.EN;
  return preferred;
}

/** Which numbering styles appear among a set's card numbers. */
export function numberingStyles(setCode: string, numbers: Iterable<string>): Numbering[] {
  const set = normalizeNumber(setCode);
  const found = new Set<Numbering>();
  for (const n of numbers) {
    if (!n.startsWith(set + '-')) continue;
    const rest = n.slice(set.length + 1);
    if (/^\d+$/.test(rest)) found.add('NA');
    else if (/^E\d+$/.test(rest)) found.add('EU');
    else if (rest.startsWith('EN')) found.add('EN');
  }
  return (['NA', 'EN', 'EU'] as Numbering[]).filter((x) => found.has(x));
}
