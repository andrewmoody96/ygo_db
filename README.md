# ygo_db

A personal Yu-Gi-Oh! TCG collection database. It runs entirely in the browser as a static site on GitHub Pages: no accounts, no server, no cost. Your collection is stored on your device (IndexedDB), and the app works offline after the first visit.

**Live app:** https://andrewmoody96.github.io/ygo_db/

## What it does

- **Enter cards set by set.** Pick a set (e.g. `DCR`), then type just the number part (`56`, `57`, …). Name, type, attribute, stats and banlist status fill in automatically; you add rarity, edition, condition and where the card lives. Those choices stay set between entries.
- **Quantity, not duplicate rows.** Entering a printing you already own (same number, rarity, edition, language and condition) adds to its quantity. Quantity defaults to 1 and can be changed on entry or later.
- **Any card.** Type a full card number (`SYE-024`) or search by name and pick the printing.
- **Set tracker.** "X / Y collected" for all 280 tracked sets, by year and overall, with the cards still missing from each set. Sets with unverified totals show `X / ?` and are left out of percentages.
- **Backup.** Download everything as one JSON file and restore it on another device; export cards as CSV for Excel or Google Sheets. A snapshot is taken automatically before every restore.

## Card data

Card details come from the free [YGOPRODeck API](https://ygoprodeck.com/api-guide/). The app never calls the API from your browser. Instead, a GitHub Action (`.github/workflows/deploy.yml`) runs daily:

1. It asks YGOPRODeck for its database version (one request).
2. If the version matches the deployed copy, it stops: nothing is downloaded or redeployed.
3. Otherwise it downloads all cards and sets (two requests), trims them to the fields the app uses (`scripts/build-card-data.mjs`), and redeploys.

That follows YGOPRODeck's guidance to store data locally rather than calling repeatedly, and stays far below its 20 requests/second limit. The app keeps the data on your device and downloads it again only when a new version exists. No card images are used.

To pick up a brand-new set before the daily run, open **Actions → Build and deploy → Run workflow**.

## Counting rules

- A card's set is the code before the first dash (`LDK2-ENS04` → `LDK2`). A record's **set override** wins (the 25th Anniversary Ra prints as `LC01-…` but is tracked as `LC01-25`).
- X counts distinct cards owned in a set: two rarities of one card count once, and `LOB-001` / `LOB-EN001` count as the same card.
- Japanese, Korean and Chinese (OCG) cards are kept out of English set totals.
- Cards whose set isn't in the catalog still save, and are flagged on the Sets tab with a one-step **Add set**.

## Development

```bash
npm install
npm run card-data   # downloads card data into public/data (gitignored)
npm run dev
npm test
npm run build
```

## Credits

Card data courtesy of [YGOPRODeck](https://ygoprodeck.com/). Yu-Gi-Oh! card names and text are © Konami / 4K Media. This is a personal, unofficial project, not affiliated with or endorsed by Konami, 4K Media or YGOPRODeck.
