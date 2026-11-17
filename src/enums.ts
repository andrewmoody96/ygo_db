// Default choice lists. Users can add values in the app (stored in settings),
// so these are starting points, not fixed lists.

export const DEFAULT_ENUMS = {
  category: ['Monster', 'Spell', 'Trap', 'Token', 'Skill Card', 'Other'],
  frame: ['Normal', 'Effect', 'Ritual', 'Fusion', 'Synchro', 'Xyz', 'Link', 'Token'],
  ability: ['Tuner', 'Flip', 'Gemini', 'Spirit', 'Toon', 'Union'],
  property: ['Normal', 'Continuous', 'Field', 'Equip', 'Quick-Play', 'Ritual', 'Counter'],
  wording: ['Magic Card', 'Spell Card', 'N/A'],
  attribute: ['DARK', 'LIGHT', 'EARTH', 'WATER', 'FIRE', 'WIND', 'DIVINE'],
  monsterType: [
    'Aqua', 'Beast', 'Beast-Warrior', 'Creator-God', 'Cyberse', 'Dinosaur', 'Divine-Beast', 'Dragon',
    'Fairy', 'Fiend', 'Fish', 'Illusion', 'Insect', 'Machine', 'Plant', 'Psychic', 'Pyro', 'Reptile',
    'Rock', 'Sea Serpent', 'Spellcaster', 'Thunder', 'Warrior', 'Winged Beast', 'Wyrm', 'Zombie',
  ],
  linkArrow: ['Top-Left', 'Top', 'Top-Right', 'Left', 'Right', 'Bottom-Left', 'Bottom', 'Bottom-Right'],
  rarity: [
    'Common', 'Short Print', 'Super Short Print', 'Rare', 'Super Rare', 'Ultra Rare',
    "Ultra Rare (Pharaoh's Rare)", 'Secret Rare', 'Ultimate Rare', 'Ghost Rare', 'Gold Rare',
    'Gold Secret Rare', 'Ghost/Gold Rare', 'Premium Gold Rare', 'Platinum Rare', 'Platinum Secret Rare',
    'Prismatic Secret Rare', 'Starlight Rare', "Collector's Rare", 'Mosaic Rare', 'Shatterfoil Rare',
    'Starfoil Rare', 'Quarter Century Secret Rare', 'Extra Secret Rare', 'Ultra Secret Rare',
    'Normal Parallel Rare', 'Super Parallel Rare', 'Ultra Parallel Rare',
    'Duel Terminal Normal Parallel Rare', 'Duel Terminal Rare Parallel Rare',
    'Duel Terminal Super Parallel Rare', 'Duel Terminal Ultra Parallel Rare', '10000 Secret Rare',
  ],
  edition: ['1st Edition', 'Unlimited', 'Limited Edition', 'Duel Terminal'],
  language: [
    'English (NA)', 'English (EU)', 'English (Worldwide -EN)', 'English (Oceanic)', 'Asian-English',
    'French', 'German', 'Italian', 'Spanish', 'Portuguese', 'Japanese (OCG)', 'Korean (OCG)', 'Chinese (OCG)',
  ],
  condition: ['Mint', 'Near Mint', 'Lightly Played', 'Moderately Played', 'Heavily Played', 'Damaged'],
  banlist: ['Unlimited', 'Semi-Limited', 'Limited', 'Forbidden', 'Not Tournament Legal'],
  storage: ['Binder', 'Good Pulls', 'Token Pile', 'Deck Box', 'Graded Slab', 'Loose / Unsorted'],
  gradingCompany: ['PSA', 'BGS', 'CGC', 'SGC', 'Other'],
};

export type EnumKey = keyof typeof DEFAULT_ENUMS;
