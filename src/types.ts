// Data model. One CardRecord = one distinct printing owned
// (same card number, rarity, edition, language and condition).

export interface CardRecord {
  id?: number;
  cardNumber: string; // e.g. LOB-001, LC01-EN002, LDK2-ENS04
  setOverride?: string; // tracked set code that wins over the printed prefix
  cardId?: number; // YGOPRODeck card id when the number was matched

  name: string;
  category: string; // Monster | Spell | Trap | Token | Skill Card | Other
  frame?: string; // Normal | Effect | Ritual | Fusion | Synchro | Xyz | Link | Token
  hasEffect?: boolean;
  pendulum?: boolean;
  abilities?: string[]; // Tuner, Flip, Gemini, Spirit, Toon, Union
  property?: string; // Spell/Trap property
  wording?: string; // Magic Card | Spell Card | N/A
  attribute?: string;
  monsterType?: string;
  level?: number; // Level, Rank (Xyz) or Link rating (Link)
  linkArrows?: string[];
  scale?: number;
  atk?: string;
  def?: string;

  rarity?: string;
  edition?: string;
  language?: string;
  condition?: string;
  quantity: number;

  inDeck?: boolean;
  deckName?: string;
  deckQty?: number;
  banlist?: string;
  banlistChecked?: string; // ISO date
  storage?: string;
  binderPage?: number;
  binderSlot?: number;
  graded?: boolean;
  gradingCompany?: string;
  grade?: string;
  value?: number; // USD per copy
  notes?: string;

  autofilled?: boolean; // true once card characteristics came from card data
  createdAt: string;
  updatedAt: string;
}

export interface SetEntry {
  code: string;
  name: string;
  year: number;
  release: string; // YYYY, YYYY-MM or YYYY-MM-DD
  releaseLabel: string; // as written in the catalog
  total: number | null; // null = unverified (X / ?)
  notes: string;
  order: number; // binder (release) order
  custom?: boolean; // added by the user
}

export interface Settings {
  key: string;
  value: unknown;
}

// Trimmed card from public/data/cards.json (see scripts/build-card-data.mjs)
export interface ApiCard {
  i: number;
  n: string;
  t: string;
  f?: string;
  r?: string;
  p?: 1;
  a?: string;
  l?: number;
  lv?: number;
  k?: number;
  d?: number;
  s?: number;
  m?: string[];
  e?: 0 | 1;
  b?: string;
  ps: [code: string, rarity: string, setName: string][];
}

export interface CardData {
  dbVersion: string;
  lastUpdate: string;
  builtAt: string;
  cardCount: number;
  cards: ApiCard[];
  sets: { code: string; name: string; count: number; date: string | null }[];
}
