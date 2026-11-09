import { useEffect } from 'react';

import { NoticeBanner } from './components/NoticeBanner';
import { SidePanel } from './components/SidePanel';
import { useSourceMenu } from './components/source/menuState';
import { SpectrumView } from './components/SpectrumView';
import { StatusBar } from './components/StatusBar';
import { Toolbar } from './components/Toolbar';
import { WaterfallView } from './components/WaterfallView';
import { api } from './ipc/commands';
import { startFramePump } from './state/framePump';
import { frameStore } from './state/frames';
import { useSession } from './state/session';
import { useView } from './state/view';

export function App() {
  const showWaterfall = useView((s) => s.showWaterfall);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void useSession
      .getState()
      .init()
      .then((u) => {
        if (cancelled) u();
        else unlisten = u;
      });
    const stopPump = startFramePump({
      nextFrame: api.nextFrame,
      store: frameStore,
      onError: (message) => useSession.setState({ commandError: `Display error: ${message}` }),
    });
    return () => {
      cancelled = true;
      unlisten?.();
      stopPump();
    };
  }, []);

  // Ctrl+K opens the source menu.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        useSourceMenu.getState().setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app">
      <Toolbar />
      <div className="notices">
        <NoticeBanner />
      </div>
      <main className="workspace">
        <section
          className={`plots${showWaterfall ? ' with-waterfall' : ''}`}
          aria-label="Spectrum display"
        >
          <SpectrumView />
          {showWaterfall && <WaterfallView />}
        </section>
        <SidePanel />
      </main>
      <StatusBar />
    </div>
  );
}
