import { useEffect, useState } from 'preact/hooks';
import { useRegisterSW } from 'virtual:pwa-register/preact';
import { Entry } from './views/Entry';
import { Collection } from './views/Collection';
import { Sets } from './views/Sets';
import { Backup, BackupNudge } from './views/Backup';
import { useCardData } from './state';

const TABS = ['enter', 'cards', 'sets', 'backup'] as const;
type Tab = (typeof TABS)[number];
const LABELS: Record<Tab, string> = { enter: 'Enter', cards: 'Collection', sets: 'Sets', backup: 'Backup' };

function tabFromHash(): Tab {
  const h = location.hash.replace('#', '') as Tab;
  return TABS.includes(h) ? h : 'enter';
}

export function App() {
  const [tab, setTab] = useState<Tab>(tabFromHash);
  const cards = useCardData();
  const [online, setOnline] = useState(navigator.onLine);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    addEventListener('hashchange', onHash);
    addEventListener('online', on);
    addEventListener('offline', off);
    // Ask the browser not to clear this site's storage under pressure.
    navigator.storage?.persist?.().catch(() => {});
    return () => {
      removeEventListener('hashchange', onHash);
      removeEventListener('online', on);
      removeEventListener('offline', off);
    };
  }, []);

  const go = (t: Tab) => {
    location.hash = t;
    setTab(t);
  };

  return (
    <>
      <header class="top">
        <h1>YGO Collection</h1>
        {!online && <span class="pill">Offline</span>}
        {cards.status === 'loading' && <span class="pill">Loading card data…</span>}
      </header>
      {needRefresh && (
        <div class="banner">
          A new version is ready. <button onClick={() => updateServiceWorker(true)}>Reload</button>
        </div>
      )}
      <BackupNudge go={() => go('backup')} />
      <main>
        {tab === 'enter' && <Entry cards={cards} />}
        {tab === 'cards' && <Collection />}
        {tab === 'sets' && <Sets cards={cards} />}
        {tab === 'backup' && <Backup cards={cards} />}
      </main>
      <nav class="tabs" aria-label="Sections">
        {TABS.map((t) => (
          <a href={`#${t}`} aria-current={tab === t ? 'page' : undefined} key={t} onClick={(e) => { e.preventDefault(); go(t); }}>
            {LABELS[t]}
          </a>
        ))}
      </nav>
    </>
  );
}
