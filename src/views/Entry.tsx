import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { CardRecord, SetEntry } from '../types';
import { CardIndex, characteristicsFrom, suggestOverride, type Printing } from '../logic/cardIndex';
import { NUMBERING_LABEL, languageFor, normalizeNumber, numberFromSuffix, numberingStyles, prefixOf, type Numbering } from '../logic/cardNumber';
import { computeTracker } from '../logic/tracker';
import { addOrBump, db, undoAdd, type AddResult } from '../db';
import { allSets, rememberEnumValues, useEnums, useLive, useSetting, type CardDataState } from '../state';
import { CharacteristicsEditor, ExtraEditor, OwnershipEditor, enumValuesOf } from '../components/RecordEditor';
import { Check, Field, NumberInput } from '../components/fields';

interface Defaults {
  edition?: string;
  language?: string;
  condition?: string;
  storage?: string;
  binderPage?: number;
  binderSlot?: number;
  autoAdvance?: boolean;
  slotsPerPage?: number;
}

const DEFAULTS: Defaults = { edition: 'Unlimited', condition: 'Near Mint', storage: 'Loose / Unsorted', autoAdvance: true, slotsPerPage: 9 };

export function Entry({ cards }: { cards: CardDataState }) {
  const index = cards.status === 'ready' ? cards.index : undefined;
  const enums = useEnums();
  const sets = useLive(allSets, []) ?? [];
  const setMap = useMemo(() => new Map(sets.map((s) => [s.code, s])), [sets]);

  const [mode, setMode] = useSetting<'set' | 'single'>('entryMode', 'set');
  const [lockedSet, setLockedSet] = useSetting<string>('entrySet', '');
  const [numberingBySet, setNumberingBySet] = useSetting<Record<string, Numbering>>('entryNumbering', {});
  const [defaults, setDefaults] = useSetting<Defaults>('entryDefaults', DEFAULTS);

  const [typed, setTyped] = useState('');
  const [rarity, setRarity] = useState<string | undefined>();
  const [qty, setQty] = useState(1);
  const [manual, setManual] = useState<Partial<CardRecord>>({ category: 'Monster' });
  const [extra, setExtra] = useState<Partial<CardRecord>>({});
  const [showExtra, setShowExtra] = useState(false);
  const [showDefaults, setShowDefaults] = useState(false);
  const [picked, setPicked] = useState<Printing | undefined>();
  const [recent, setRecent] = useState<AddResult[]>([]);
  const [message, setMessage] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  const set = setMap.get(lockedSet);
  const styles = useMemo(
    () => (index && lockedSet ? numberingStyles(lockedSet, (index.byPrefix.get(lockedSet) ?? []).map((p) => p.code)) : []),
    [index, lockedSet],
  );
  const numbering: Numbering = numberingBySet[lockedSet] ?? styles[0] ?? 'EN';

  const cardNumber = mode === 'set' && lockedSet ? numberFromSuffix(lockedSet, typed, numbering) : normalizeNumber(typed);
  const looksLikeNumber = /\d/.test(typed) || typed.includes('-');
  const printings = index && cardNumber ? index.lookup(cardNumber) : [];
  const printing = picked && picked.code === cardNumber ? picked : printings[0];
  const rarities = index && cardNumber ? index.rarities(cardNumber) : [];
  const nameMatches = mode === 'single' && index && !looksLikeNumber ? index.searchNames(typed, 12) : [];

  // Pre-select the rarity when the number was printed in only one.
  useEffect(() => {
    setRarity(rarities.length === 1 ? rarities[0] : picked?.code === cardNumber ? picked.rarity : undefined);
  }, [cardNumber, rarities.join('|')]);

  const recordSetCode = (() => {
    const override = printing ? suggestOverride(printing, setMap) : undefined;
    return override ?? prefixOf(cardNumber);
  })();
  const recordSet = setMap.get(recordSetCode);
  const characteristics = printing ? characteristicsFrom(printing.card, recordSet) : undefined;

  const records = useLive(() => db.records.toArray(), []);
  const progress = useMemo(() => {
    if (!set || !records) return undefined;
    return computeTracker([set], records).sets[0];
  }, [set, records]);

  const canSave = !!cardNumber && cardNumber.includes('-') && (!!characteristics || !!manual.name);

  async function save() {
    if (!canSave) return;
    const override = printing ? suggestOverride(printing, setMap) : undefined;
    const base = characteristics ?? { ...manual, autofilled: false };
    const rec: Omit<CardRecord, 'id' | 'createdAt' | 'updatedAt'> = {
      ...base,
      ...extra,
      name: base.name ?? '',
      category: base.category ?? 'Other',
      cardNumber,
      setOverride: extra.setOverride ?? override,
      rarity,
      edition: defaults.edition,
      language: languageFor(cardNumber, defaults.language),
      condition: defaults.condition,
      storage: defaults.storage,
      binderPage: defaults.storage === 'Binder' ? defaults.binderPage : undefined,
      binderSlot: defaults.storage === 'Binder' ? defaults.binderSlot : undefined,
      quantity: qty,
      banlistChecked: characteristics && index ? index.data.lastUpdate.slice(0, 10) : undefined,
    };
    const result = await addOrBump(rec);
    await rememberEnumValues(enumValuesOf(rec));
    setRecent((r) => [result, ...r].slice(0, 12));
    const label = `${rec.cardNumber} ${rec.name}${rarity ? ` (${rarity})` : ''}`;
    setMessage(result.kind === 'added' ? `Added ${label}` : `Already owned: ${label} is now ×${result.record.quantity}`);
    if (result.kind === 'added' && defaults.storage === 'Binder' && defaults.autoAdvance && defaults.binderSlot) {
      const per = defaults.slotsPerPage || 9;
      const next = defaults.binderSlot + 1;
      setDefaults({ ...defaults, binderSlot: next > per ? 1 : next, binderPage: next > per ? (defaults.binderPage ?? 0) + 1 : defaults.binderPage });
    }
    setTyped('');
    setQty(1);
    setPicked(undefined);
    setExtra({});
    setShowExtra(false);
    setManual({ category: manual.category });
    inputRef.current?.focus();
  }

  async function undoLast() {
    const [last, ...rest] = recent;
    if (!last) return;
    await undoAdd(last);
    if (last.kind === 'added' && last.record.storage === 'Binder' && last.record.binderSlot) {
      setDefaults({ ...defaults, binderPage: last.record.binderPage, binderSlot: last.record.binderSlot });
    }
    setRecent(rest);
    setMessage(`Undid ${last.record.cardNumber} ${last.record.name}`);
  }

  function chooseSet(value: string) {
    const code = normalizeNumber(value.split(' ')[0]);
    if (!setMap.has(code)) return;
    setLockedSet(code);
    setTyped('');
    inputRef.current?.focus();
  }

  function chooseNumbering(n: Numbering) {
    setNumberingBySet({ ...numberingBySet, [lockedSet]: n });
  }

  return (
    <section class="view entry">
      <div class="segmented" role="tablist" aria-label="Entry mode">
        <button role="tab" aria-selected={mode === 'set'} onClick={() => setMode('set')}>Set by set</button>
        <button role="tab" aria-selected={mode === 'single'} onClick={() => setMode('single')}>Any card</button>
      </div>

      {mode === 'set' && (
        <div class="card">
          <SetPicker sets={sets} value={lockedSet} onPick={chooseSet} />
          {set && (
            <p class="muted small">
              {set.name} · {set.releaseLabel}
              {progress && (
                <>
                  {' · '}
                  <strong>{progress.owned} / {progress.total ?? '?'}</strong> collected
                </>
              )}
            </p>
          )}
          {styles.length > 1 && (
            <div class="segmented small" aria-label="Card numbering">
              {styles.map((s) => (
                <button aria-pressed={numbering === s} onClick={() => chooseNumbering(s)} key={s}>
                  {NUMBERING_LABEL[s].replace('LOB', lockedSet)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div class="card">
        <form
          class="number-row"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <Field label={mode === 'set' ? (lockedSet ? `Card number (${lockedSet}-…)` : 'Pick a set first') : 'Card number or name'} wide>
            <input
              ref={inputRef}
              value={typed}
              disabled={mode === 'set' && !lockedSet}
              placeholder={mode === 'set' ? '056' : 'SYE-024 or Dark Magician'}
              autocapitalize="characters"
              autocomplete="off"
              autoFocus
              enterKeyHint="done"
              inputMode={mode === 'set' && /^\d*$/.test(typed) ? 'numeric' : 'text'}
              onInput={(e) => setTyped(e.currentTarget.value)}
            />
          </Field>
          <NumberInput label="Qty" value={qty} min={1} onChange={(v) => setQty(Math.max(1, v ?? 1))} />
          <button type="submit" class="primary" disabled={!canSave}>Save</button>
        </form>

        {nameMatches.length > 0 && (
          <ul class="picklist">
            {nameMatches.map((c) => (
              <li key={c.i}>
                <strong>{c.n}</strong>
                <div class="chips">
                  {c.ps.slice(0, 40).map(([code, r, setName]) => (
                    <button
                      class="chip"
                      key={code + r}
                      title={setName}
                      onClick={() => {
                        setTyped(code);
                        setPicked({ code: normalizeNumber(code), rarity: r, setName, card: c });
                      }}
                    >
                      {code} · {r}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}

        {cardNumber && looksLikeNumber && (
          <div class="preview">
            <div>
              <span class="code">{cardNumber}</span>{' '}
              {characteristics ? <strong>{characteristics.name}</strong> : <span class="warn">Not in card data — enter details below</span>}
            </div>
            {characteristics && <div class="muted small">{describe(characteristics)}</div>}
            {recordSetCode && !setMap.has(recordSetCode) && <div class="warn small">Set {recordSetCode} isn't in your catalog. It will save and be flagged; add the set on the Sets tab.</div>}
            {printing && suggestOverride(printing, setMap) && <div class="muted small">Tracked as {suggestOverride(printing, setMap)} ({printing.setName})</div>}
            {rarities.length > 0 && (
              <div class="chips" aria-label="Rarity">
                {rarities.map((r) => (
                  <button class="chip" aria-pressed={rarity === r} key={r} onClick={() => setRarity(rarity === r ? undefined : r)}>
                    {r}
                  </button>
                ))}
              </div>
            )}
            {!characteristics && (
              <>
                {rarities.length === 0 && (
                  <OwnershipEditor rec={{ rarity }} patch={(p) => 'rarity' in p && setRarity(p.rarity)} enums={enums} />
                )}
                <CharacteristicsEditor rec={manual} patch={(p) => setManual({ ...manual, ...p })} enums={enums} />
              </>
            )}
          </div>
        )}

        <button class="link" onClick={() => setShowExtra(!showExtra)}>{showExtra ? 'Hide' : 'More details'} (deck, graded, notes)</button>
        {showExtra && <ExtraEditor rec={extra} patch={(p) => setExtra({ ...extra, ...p })} enums={enums} />}
      </div>

      <div class="card">
        <button class="link defaults-toggle" onClick={() => setShowDefaults(!showDefaults)}>
          <span>Kept between entries:</span> {[defaults.edition, defaults.language ?? 'Language from card number', defaults.condition, defaults.storage === 'Binder' ? `Binder p${defaults.binderPage ?? '?'}/s${defaults.binderSlot ?? '?'}` : defaults.storage].filter(Boolean).join(' · ')} {showDefaults ? '▲' : '▼'}
        </button>
        {showDefaults && (
          <>
            <OwnershipEditor
              rec={defaults}
              patch={(p) => {
                const { rarity: _r, ...rest } = p;
                setDefaults({ ...defaults, ...rest });
              }}
              enums={enums}
            />
            {defaults.storage === 'Binder' && (
              <div class="grid">
                <Check label="Move to the next slot after each new card" value={defaults.autoAdvance} onChange={(v) => setDefaults({ ...defaults, autoAdvance: v })} />
                <NumberInput label="Slots per page" value={defaults.slotsPerPage ?? 9} min={1} onChange={(v) => setDefaults({ ...defaults, slotsPerPage: v })} />
              </div>
            )}
          </>
        )}
      </div>

      {message && (
        <div class="toast" role="status">
          <span>{message}</span>
          {recent.length > 0 && <button onClick={undoLast}>Undo</button>}
        </div>
      )}

      {recent.length > 0 && (
        <div class="card">
          <h3>This session</h3>
          <ul class="recent">
            {recent.map((r, i) => (
              <li key={i}>
                <span class="code">{r.record.cardNumber}</span> {r.record.name}
                <span class="muted"> {r.record.rarity ?? ''} ×{r.record.quantity}{r.kind === 'bumped' ? ' (bumped)' : ''}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {cards.status === 'missing' && <p class="warn small">Card data isn't available ({cards.error}). You can still enter cards by hand.</p>}
    </section>
  );
}

function SetPicker({ sets, value, onPick }: { sets: SetEntry[]; value: string; onPick: (v: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <Field label="Set" wide>
      <input
        list="set-options"
        value={text}
        placeholder="DCR or Dark Crisis"
        autocapitalize="characters"
        autocomplete="off"
        onInput={(e) => {
          setText(e.currentTarget.value);
          onPick(e.currentTarget.value);
        }}
        onFocus={(e) => e.currentTarget.select()}
      />
      <datalist id="set-options">
        {sets.map((s) => (
          <option value={`${s.code} — ${s.name}`} key={s.code} />
        ))}
      </datalist>
    </Field>
  );
}

export function describe(c: Partial<CardRecord>): string {
  if (c.category === 'Monster') {
    const frame = [c.pendulum ? 'Pendulum' : '', c.frame, ...(c.abilities ?? [])].filter(Boolean).join(' ');
    const lvl = c.frame === 'Link' ? `Link-${c.level}` : c.frame === 'Xyz' ? `Rank ${c.level}` : c.level != null ? `Level ${c.level}` : '';
    const stats = c.frame === 'Link' ? `ATK ${c.atk ?? '?'}` : `${c.atk ?? '?'} / ${c.def ?? '?'}`;
    return [frame, c.attribute, c.monsterType, lvl, stats].filter(Boolean).join(' · ');
  }
  if (c.category === 'Spell' || c.category === 'Trap') return [c.property, c.category, c.wording === 'Magic Card' ? '(Magic wording)' : ''].filter(Boolean).join(' ');
  return c.category ?? '';
}

export type { CardIndex };
