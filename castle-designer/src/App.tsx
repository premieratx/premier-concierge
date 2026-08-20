import { Scene } from './scene/Scene';
import { StatusPanel } from './ui/StatusPanel';

export function App() {
  return (
    <div className="flex h-full w-full">
      <StatusPanel />
      <main className="relative min-w-0 flex-1">
        <Scene />
      </main>
    </div>
  );
}
