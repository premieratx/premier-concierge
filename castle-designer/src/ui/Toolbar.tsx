import { useRef } from 'react';
import { deserializeLayout, downloadLayout } from '../io/serialize';
import { captureScreenshot } from '../scene/Scene';
import { useLayoutStore, type TimeOfDay } from '../store/useLayoutStore';
import { Button } from './primitives';

const TIMES: TimeOfDay[] = ['day', 'dusk', 'night'];

export function Toolbar() {
  const layout = useLayoutStore((s) => s.layout);
  const timeOfDay = useLayoutStore((s) => s.timeOfDay);
  const setTimeOfDay = useLayoutStore((s) => s.setTimeOfDay);
  const setMarinaPhase = useLayoutStore((s) => s.setMarinaPhase);
  const replaceLayout = useLayoutStore((s) => s.replaceLayout);
  const undo = useLayoutStore((s) => s.undo);
  const redo = useLayoutStore((s) => s.redo);
  const past = useLayoutStore((s) => s.past.length);
  const future = useLayoutStore((s) => s.future.length);
  const fileInput = useRef<HTMLInputElement>(null);

  const phase = layout.site.marinaPhase;

  const onImport = async (file: File) => {
    try {
      replaceLayout(deserializeLayout(await file.text()));
    } catch (error) {
      // A bad file should say why, not fail silently.
      window.alert((error as Error).message);
    }
  };

  const onScreenshot = () => {
    const data = captureScreenshot();
    if (!data) return;
    const a = document.createElement('a');
    a.href = data;
    a.download = `${layout.id}-${timeOfDay}.png`;
    a.click();
  };

  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-slate-800 bg-slate-950 px-4 py-2.5">
      <div className="mr-auto">
        <h1 className="text-sm font-semibold tracking-tight text-slate-50">
          Hill Country Yacht Club — container castle
        </h1>
        <p className="text-[11px] text-slate-500">
          Parametric property model · 1 world unit = 1 foot
        </p>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-[11px] uppercase tracking-wider text-slate-600">Marina</span>
        <Button active={phase === 'existing'} onClick={() => setMarinaPhase('existing')}>
          Existing
        </Button>
        <Button active={phase === 'enhanced'} onClick={() => setMarinaPhase('enhanced')} tone="accent">
          Enhanced
        </Button>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-[11px] uppercase tracking-wider text-slate-600">Light</span>
        {TIMES.map((t) => (
          <Button key={t} active={timeOfDay === t} onClick={() => setTimeOfDay(t)}>
            {t}
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        <Button onClick={undo} disabled={past === 0} title="Ctrl+Z">
          Undo
        </Button>
        <Button onClick={redo} disabled={future === 0} title="Ctrl+Shift+Z">
          Redo
        </Button>
        <Button onClick={() => downloadLayout(layout)}>Export JSON</Button>
        <Button onClick={() => fileInput.current?.click()}>Import</Button>
        <Button onClick={onScreenshot}>Screenshot</Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onImport(file);
            e.target.value = '';
          }}
        />
      </div>
    </header>
  );
}
