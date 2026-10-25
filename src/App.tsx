import { useEffect, useState } from 'react';

import { NoticeBanner } from './components/NoticeBanner';
import { SidePanel } from './components/SidePanel';
import { SourceManager, type Selection } from './components/sources/SourceManager';
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
  // `undefined` = closed; otherwise the selection the dialog opens with (`null` = default).
  const [sources, setSources] = useState<Selection | null | undefined>(undefined);
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

  const openSources = (initial?: Selection) => setSources(initial ?? null);

  return (
    <div className="app">
      <Toolbar
        onOpenSources={openSources}
        onExport={() => void useSession.getState().exportCsv()}
      />
      <div className="notices">
        <NoticeBanner onOpenSources={openSources} />
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
      {sources !== undefined && (
        <SourceManager initial={sources ?? undefined} onClose={() => setSources(undefined)} />
      )}
    </div>
  );
}
