import { useEffect } from 'react';
import { useLayoutStore } from '../store/useLayoutStore';

const NUDGE_FT = 8;

/**
 * Editing shortcuts. Arrow keys nudge on the 8-foot module, which is the
 * container width and therefore the only across-grid step that means anything.
 */
export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      // Never steal a keystroke from a text field.
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      const store = useLayoutStore.getState();
      // WASD and the arrows belong to the walkthrough while it is running.
      if (store.mode === 'walk') return;
      const meta = e.metaKey || e.ctrlKey;

      if (meta && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) store.redo();
        else store.undo();
        return;
      }
      if (meta && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        store.duplicateSelected();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (store.selectedIds.length === 0) return;
        e.preventDefault();
        store.removeSelected();
        return;
      }
      if (e.key.toLowerCase() === 'r') {
        store.rotateSelected();
        return;
      }
      if (e.key === 'Escape') {
        store.select(null);
        return;
      }

      const step = e.shiftKey ? NUDGE_FT * 5 : NUDGE_FT;
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          store.nudgeSelected(-step, 0);
          break;
        case 'ArrowRight':
          e.preventDefault();
          store.nudgeSelected(step, 0);
          break;
        case 'ArrowUp':
          e.preventDefault();
          store.nudgeSelected(0, -step);
          break;
        case 'ArrowDown':
          e.preventDefault();
          store.nudgeSelected(0, step);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
