#!/usr/bin/env node
// Builds public/data/cards.json (trimmed card data) and public/data/meta.json.
//
// YGOPRODeck asks clients to download and store data locally instead of calling
// the API repeatedly (https://ygoprodeck.com/api-guide/). So this script:
//   1. asks checkDBVer.php for the current database version (1 request);
//   2. if the deployed site already has that version, reuses the deployed files
//      and makes no further API calls;
//   3. otherwise downloads cardinfo.php (every card, 1 request) and
//      cardsets.php (every set, 1 request) and trims them.
// It never makes more than 3 requests, far under the 20 requests/second limit.
//
// Env:
//   DEPLOYED_DATA_URL  base URL of the live site's data folder, e.g.
//                      https://user.github.io/ygo_db/data  (optional)
//   FORCE_REFRESH=1    always download from the API
//   GITHUB_OUTPUT      when set, writes `changed=true|false`

import { mkdir, writeFile, appendFile } from 'node:fs/promises';

const API = 'https://db.ygoprodeck.com/api/v7';
const OUT_DIR = new URL('../public/data/', import.meta.url);
const UA = { 'User-Agent': 'ygo_db-collection-app (static GitHub Pages site; daily snapshot)' };

async function getJson(url) {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

async function tryGetJson(url) {
  try {
    return await getJson(url);
  } catch {
    return null;
  }
}

async function setOutput(changed) {
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
}

const FRAMES = new Set(['normal', 'effect', 'ritual', 'fusion', 'synchro', 'xyz', 'link', 'token', 'spell', 'trap', 'skill']);

// One compact object per card. Short keys keep the file small.
export function trimCard(c) {
  const frameType = String(c.frameType || '');
  const pendulum = frameType.endsWith('_pendulum');
  const base = pendulum ? frameType.replace('_pendulum', '') : frameType;
  const out = {
    i: c.id,
    n: c.name,
    t: c.type, // e.g. "Synchro Tuner Monster", "Spell Card"
    f: FRAMES.has(base) ? base : base || undefined,
    r: c.race, // monster type, or spell/trap property
  };
  if (pendulum) out.p = 1;
  if (c.attribute) out.a = c.attribute;
  if (c.level != null) out.l = c.level;
  if (c.linkval != null) out.lv = c.linkval;
  if (c.atk != null) out.k = c.atk; // -1 = "?"
  if (c.def != null) out.d = c.def;
  if (c.scale != null) out.s = c.scale;
  if (c.linkmarkers?.length) out.m = c.linkmarkers;
  const misc = c.misc_info?.[0];
  if (misc && misc.has_effect != null) out.e = misc.has_effect ? 1 : 0;
  const ban = c.banlist_info?.ban_tcg;
  if (ban) out.b = ban; // Forbidden | Limited | Semi-Limited
  out.ps = (c.card_sets || []).map((s) => [s.set_code, s.set_rarity, s.set_name]);
  return out;
}

async function main() {
  const [ver] = await getJson(`${API}/checkDBVer.php`);
  const dbVersion = String(ver.database_version);
  console.log(`YGOPRODeck database version ${dbVersion} (updated ${ver.last_update})`);

  await mkdir(OUT_DIR, { recursive: true });
  const deployed = process.env.DEPLOYED_DATA_URL?.replace(/\/$/, '');

  if (deployed && !process.env.FORCE_REFRESH) {
    const meta = await tryGetJson(`${deployed}/meta.json`);
    if (meta && meta.dbVersion === dbVersion) {
      const res = await fetch(`${deployed}/cards.json`);
      if (res.ok) {
        await writeFile(new URL('cards.json', OUT_DIR), Buffer.from(await res.arrayBuffer()));
        await writeFile(new URL('meta.json', OUT_DIR), JSON.stringify(meta));
        console.log('Deployed data is current; reused it with no further API calls.');
        await setOutput(false);
        return;
      }
    }
  }

  const info = await getJson(`${API}/cardinfo.php?misc=yes`);
  const sets = await getJson(`${API}/cardsets.php`);
  const cards = info.data.map(trimCard);
  const setList = sets.map((s) => ({ code: s.set_code, name: s.set_name, count: s.num_of_cards, date: s.tcg_date || null }));
  const meta = { dbVersion, lastUpdate: ver.last_update, builtAt: new Date().toISOString(), cardCount: cards.length };

  await writeFile(new URL('cards.json', OUT_DIR), JSON.stringify({ ...meta, cards, sets: setList }));
  await writeFile(new URL('meta.json', OUT_DIR), JSON.stringify(meta));
  console.log(`Wrote ${cards.length} cards and ${setList.length} sets.`);
  await setOutput(true);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
