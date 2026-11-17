import type { CardRecord } from '../types';
import type { EnumKey } from '../enums';
import { Check, ChoiceInput, NumberInput, Select, Text } from './fields';

type Patch = (p: Partial<CardRecord>) => void;
type Enums = Record<EnumKey, string[]>;

/** Card characteristics: autofilled from card data, editable by hand. */
export function CharacteristicsEditor({ rec, patch, enums }: { rec: Partial<CardRecord>; patch: Patch; enums: Enums }) {
  const monster = rec.category === 'Monster' || rec.category === 'Token';
  const spellTrap = rec.category === 'Spell' || rec.category === 'Trap';
  const link = rec.frame === 'Link';
  const levelLabel = link ? 'Link rating' : rec.frame === 'Xyz' ? 'Rank' : 'Level';
  return (
    <div class="grid">
      <Text label="Card name" value={rec.name} onChange={(v) => patch({ name: v ?? '' })} wide />
      <Select label="Category" value={rec.category} options={enums.category} onChange={(v) => patch({ category: v ?? '' })} />
      {monster && (
        <>
          <Select label="Monster frame" value={rec.frame} options={enums.frame} onChange={(v) => patch({ frame: v })} />
          <Select label="Attribute" value={rec.attribute} options={enums.attribute} onChange={(v) => patch({ attribute: v })} />
          <ChoiceInput label="Monster type" value={rec.monsterType} options={enums.monsterType} onChange={(v) => patch({ monsterType: v })} />
          <NumberInput label={levelLabel} value={rec.level} min={0} onChange={(v) => patch({ level: v })} />
          <Text label="ATK" value={rec.atk} onChange={(v) => patch({ atk: v })} />
          {!link && <Text label="DEF" value={rec.def} onChange={(v) => patch({ def: v })} />}
          {rec.pendulum && <NumberInput label="Pendulum scale" value={rec.scale} min={0} onChange={(v) => patch({ scale: v })} />}
          <div class="checks wide">
            <Check label="Has effect" value={rec.hasEffect} onChange={(v) => patch({ hasEffect: v })} />
            <Check label="Pendulum" value={rec.pendulum} onChange={(v) => patch({ pendulum: v })} />
            {enums.ability.map((a) => (
              <Check
                key={a}
                label={a}
                value={rec.abilities?.includes(a)}
                onChange={(on) => patch({ abilities: on ? [...(rec.abilities ?? []), a] : (rec.abilities ?? []).filter((x) => x !== a) })}
              />
            ))}
          </div>
          {link && (
            <div class="checks wide" aria-label="Link arrows">
              {enums.linkArrow.map((a) => (
                <Check
                  key={a}
                  label={a}
                  value={rec.linkArrows?.includes(a)}
                  onChange={(on) => patch({ linkArrows: on ? [...(rec.linkArrows ?? []), a] : (rec.linkArrows ?? []).filter((x) => x !== a) })}
                />
              ))}
            </div>
          )}
        </>
      )}
      {spellTrap && (
        <Select label="Spell/Trap property" value={rec.property} options={enums.property} onChange={(v) => patch({ property: v })} />
      )}
      {rec.category === 'Spell' && (
        <Select label="Printed wording" value={rec.wording} options={enums.wording} onChange={(v) => patch({ wording: v })} />
      )}
    </div>
  );
}

/** What you can see on the physical card: rarity, edition, condition, where it lives. */
export function OwnershipEditor({ rec, patch, enums, rarities }: { rec: Partial<CardRecord>; patch: Patch; enums: Enums; rarities?: string[] }) {
  return (
    <div class="grid">
      <ChoiceInput label="Rarity" value={rec.rarity} options={rarities?.length ? rarities : enums.rarity} onChange={(v) => patch({ rarity: v })} />
      <ChoiceInput label="Edition" value={rec.edition} options={enums.edition} onChange={(v) => patch({ edition: v })} />
      <ChoiceInput label="Language / region" value={rec.language} options={enums.language} onChange={(v) => patch({ language: v })} />
      <ChoiceInput label="Condition" value={rec.condition} options={enums.condition} onChange={(v) => patch({ condition: v })} />
      <ChoiceInput label="Storage" value={rec.storage} options={enums.storage} onChange={(v) => patch({ storage: v })} />
      <NumberInput label="Binder page" value={rec.binderPage} min={1} onChange={(v) => patch({ binderPage: v })} />
      <NumberInput label="Binder slot" value={rec.binderSlot} min={1} onChange={(v) => patch({ binderSlot: v })} />
    </div>
  );
}

/** Less common details: decks, grading, banlist, value, notes. */
export function ExtraEditor({ rec, patch, enums }: { rec: Partial<CardRecord>; patch: Patch; enums: Enums }) {
  return (
    <div class="grid">
      <Text label="Set override" value={rec.setOverride} onChange={(v) => patch({ setOverride: v?.toUpperCase() })} />
      <Select label="Banlist" value={rec.banlist} options={enums.banlist} onChange={(v) => patch({ banlist: v })} />
      <div class="checks wide">
        <Check label="In a deck" value={rec.inDeck} onChange={(v) => patch({ inDeck: v })} />
        <Check label="Graded" value={rec.graded} onChange={(v) => patch({ graded: v })} />
      </div>
      {rec.inDeck && (
        <>
          <Text label="Deck name" value={rec.deckName} onChange={(v) => patch({ deckName: v })} />
          <NumberInput label="Qty in deck" value={rec.deckQty} min={0} onChange={(v) => patch({ deckQty: v })} />
        </>
      )}
      {rec.graded && (
        <>
          <ChoiceInput label="Grading company" value={rec.gradingCompany} options={enums.gradingCompany} onChange={(v) => patch({ gradingCompany: v })} />
          <Text label="Grade" value={rec.grade} onChange={(v) => patch({ grade: v })} />
        </>
      )}
      <NumberInput label="Value per copy (USD)" value={rec.value} min={0} step={0.01} onChange={(v) => patch({ value: v })} />
      <Text label="Notes" value={rec.notes} onChange={(v) => patch({ notes: v })} wide />
    </div>
  );
}

export function enumValuesOf(rec: Partial<CardRecord>) {
  return {
    rarity: rec.rarity,
    edition: rec.edition,
    language: rec.language,
    condition: rec.condition,
    storage: rec.storage,
    monsterType: rec.monsterType,
    gradingCompany: rec.gradingCompany,
  };
}
