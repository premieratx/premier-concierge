import { useState } from 'react';
import { Scene } from './scene/Scene';
import { CapacityPanel } from './ui/CapacityPanel';
import { CostPanel } from './ui/CostPanel';
import { Inspector } from './ui/Inspector';
import { LayersPanel } from './ui/LayersPanel';
import { RevenuePanel } from './ui/RevenuePanel';
import { Toolbar } from './ui/Toolbar';
import { WarningsPanel } from './ui/WarningsPanel';
import { useKeyboardShortcuts } from './ui/useKeyboardShortcuts';
import { runAllChecks } from './rules';
import { useLayoutStore } from './store/useLayoutStore';

const TABS = ['Cost', 'Checks', 'Capacity', 'Marina', 'View', 'Inspect'] as const;
type Tab = (typeof TABS)[number];

export function App() {
  const [tab, setTab] = useState<Tab>('Cost');
  useKeyboardShortcuts();

  const layout = useLayoutStore((s) => s.layout);
  const errorCount = runAllChecks(layout).errors.length;

  return (
    <div className="flex h-full w-full flex-col bg-slate-950">
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[22rem] shrink-0 flex-col border-r border-slate-800 bg-slate-950">
          <nav className="flex shrink-0 gap-1 border-b border-slate-800 px-2 py-2">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`relative rounded px-2.5 py-1.5 text-xs font-medium transition ${
                  tab === t
                    ? 'bg-slate-800 text-slate-50'
                    : 'text-slate-500 hover:text-slate-200'
                }`}
              >
                {t}
                {t === 'Checks' && errorCount > 0 && (
                  <span className="ml-1.5 rounded bg-rose-500 px-1 text-[10px] font-bold text-slate-950">
                    {errorCount}
                  </span>
                )}
              </button>
            ))}
          </nav>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {tab === 'Cost' && <CostPanel />}
            {tab === 'Checks' && <WarningsPanel />}
            {tab === 'Capacity' && <CapacityPanel />}
            {tab === 'Marina' && <RevenuePanel />}
            {tab === 'View' && <LayersPanel />}
            {tab === 'Inspect' && <Inspector />}
          </div>
        </aside>
        <main className="relative min-w-0 flex-1">
          <Scene />
        </main>
      </div>
    </div>
  );
}
