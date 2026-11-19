import { $, $$, browser, expect } from '@wdio/globals';

import {
  acquireState,
  analyzerAtLaunch,
  byTestId,
  captureMode,
  chooseMode,
  closeSourceMenu,
  ensureDisconnected,
  frameSeq,
  livenessKind,
  livenessText,
  runSimulator,
  selectSource,
  sessionState,
  settledFrameSeq,
  setInput,
  sourceButtonText,
  statusBarText,
  textOf,
  waitForGone,
  waitForLaunchSettled,
  waitForState,
} from './helpers';

describe('Simulator acquisition workflow', () => {
  // A failed test can leave the source menu open, and then every later click is intercepted.
  afterEach(async () => {
    await closeSourceMenu();
  });

  it('starts with the simulator selected and connected, not acquiring', async function () {
    // No analyzer at launch: the app connects the simulator by itself and selects it (ADR 0017).
    // With an analyzer attached the launch connects that instead; this state cannot be produced
    // then (unplug it, or see docs/testing.md), so the test is pending rather than failing.
    if (await analyzerAtLaunch()) this.skip();
    expect(await sourceButtonText()).toBe('Source: Signal simulator, Connected');
    expect(await sessionState()).toBe('Connected');
    expect(await acquireState()).toBe('idle');
    expect(await livenessKind()).toBe('stopped');
    expect(await textOf(byTestId('plot-hint'))).toBe(
      'No trace yet. Press Continuous to start acquisition.',
    );
    await expect(await byTestId('acquire-button')).toBeEnabled();
    await expect(await byTestId('capture-mode-button')).toBeEnabled();
    await expect(await byTestId('connect-button')).not.toBeExisting();
    // The simulator is labelled by its source name, not by a badge.
    await expect(await byTestId('simulated-badge')).not.toBeExisting();
  });

  it('keeps FFT size and Window disabled with their reason once disconnected, as Center and Span are', async () => {
    // This test opens the simulator first, so its kind is known: its rows stay, disabled, while
    // nothing is connected (DESIGN.md 3.6). A source never opened in this run shows no FFT rows.
    await runSimulator();
    await ensureDisconnected();
    // The reason is in the tooltip and in the accessible description (DESIGN.md 5.4); the plot hint
    // also shows it on screen while nothing is connected.
    const state = () =>
      browser.execute(() =>
        ['fft-size', 'window'].map((id) => {
          const el = document.getElementById(id) as HTMLSelectElement | null;
          const described = (el?.getAttribute('aria-describedby') ?? '')
            .split(' ')
            .map((d) => document.getElementById(d)?.textContent ?? '')
            .join('|');
          return { id, disabled: el?.disabled ?? null, title: el?.title ?? '', described };
        }),
      );
    await browser.waitUntil(async () => (await state()).every((s) => s.disabled !== null), {
      timeoutMsg: 'FFT size and Window are not in the panel',
    });
    for (const s of await state()) {
      expect(s.disabled).toBe(true);
      expect(s.title).toBe('Connect a source first');
      expect(s.described).toBe('Connect a source first');
    }
    // The last trace stays on screen, but nothing is connected: the tag says so (S13), and the
    // selection is kept.
    expect(await livenessKind()).toBe('noSource');
    expect(await livenessText()).toBe('No source connected');
  });

  it('connects to the simulator and shows a live, labelled spectrum', async () => {
    await runSimulator();
    expect(await captureMode()).toBe('continuous');
    await browser.waitUntil(async () => (await statusBarText()).includes('FFT 4096'));
    const status = await statusBarText();
    expect(status).toContain('dBFS');
    expect(status).toContain('Uncalibrated');
    expect(status).toContain('Center 100.0000');
  });

  it('detects the strongest simulated tone as the first peak', async () => {
    await browser.waitUntil(
      async () => (await $$('[data-testid="peak-table"] tbody tr')).length > 1,
    );
    const first = (await $$('[data-testid="peak-table"] tbody tr'))[0]!;
    const text = await first.getText();
    expect(text).toMatch(/P1\s*100\.25\d* MHz\s*-20\.\d dBFS/);
  });

  it('puts the source button first and the capture control last in the side panel Measurement group, and only the brand in the toolbar', async () => {
    const layout = await browser.execute(() => {
      const measurement = Array.from(document.querySelectorAll('.side-panel details')).find(
        (d) => d.querySelector('summary')?.textContent?.trim() === 'Measurement',
      );
      const body = measurement?.querySelector('.ui-section-body');
      // The rows are wrapped in `.measurement-rows` (014 T3); the capture control is its last item.
      const rows = body?.querySelector('.measurement-rows') ?? body;
      const labels = Array.from(measurement?.querySelectorAll('.ui-field__label') ?? []).map((l) =>
        l.textContent?.trim(),
      );
      const toolbar = document.querySelector('.toolbar');
      const capture = rows
        ?.querySelector('[data-testid="acquire-button"]')
        ?.closest('[role="group"]');
      return {
        labels,
        first: rows?.firstElementChild?.querySelector('[data-testid="source-button"]')
          ? 'source'
          : '',
        last: capture && rows?.lastElementChild === capture ? 'capture' : '',
        captureName: capture?.getAttribute('aria-label') ?? '',
        inToolbar: toolbar?.querySelectorAll(
          '[data-testid="center-frequency"], [data-testid="span-select"], [data-testid="source-button"], [data-testid="acquire-button"]',
        ).length,
      };
    });
    // A connected IQ source: its own rows only, no Frequency step or Reference level (DESIGN.md 3.6).
    expect(layout.labels).toEqual(['Center', 'Span', 'FFT size', 'Window', 'Averaging']);
    expect(layout.first).toBe('source');
    expect(layout.last).toBe('capture');
    expect(layout.captureName).toBe('Capture');
    expect(layout.inToolbar).toBe(0);
  });

  it('opens the source popover and the capture menu inside the window and the panel, and Escape returns focus to the trigger', async () => {
    const focusedTestId = () =>
      browser.execute(() => document.activeElement?.getAttribute('data-testid') ?? null);
    // Fully visible: inside the window (not clipped by its edge) and inside the side panel's column,
    // which is a scroll box that would clip a wider popover on its left or right.
    const placement = (testId: string) =>
      browser.execute((id) => {
        const b = document
          .querySelector<HTMLElement>(`[data-testid="${id}"]`)!
          .getBoundingClientRect();
        const panel = document.querySelector('.side-panel')!.getBoundingClientRect();
        return {
          inWindow:
            b.left >= 0 &&
            b.top >= 0 &&
            b.right <= window.innerWidth &&
            b.bottom <= window.innerHeight,
          inPanel: b.left >= panel.left && b.right <= panel.right,
        };
      }, testId);

    // The earlier tests left the simulator acquiring, and the capture chevron is locked while it does.
    // Pause for this check and resume afterwards, so the tests that follow see the same state.
    const wasAcquiring = (await acquireState()) === 'acquiring';
    if (wasAcquiring) {
      await (await byTestId('acquire-button')).click();
      await waitForState('Connected');
    }

    await browser.execute(() =>
      (document.querySelector('[data-testid="source-button"]') as HTMLElement).focus(),
    );
    await browser.keys(['ArrowDown']);
    await byTestId('source-menu').waitForDisplayed();
    expect(await placement('source-menu')).toEqual({ inWindow: true, inPanel: true });
    await browser.keys(['Escape']);
    await waitForGone('source-menu');
    expect(await focusedTestId()).toBe('source-button');

    await browser.execute(() =>
      (document.querySelector('[data-testid="capture-mode-button"]') as HTMLElement).focus(),
    );
    await browser.keys(['ArrowDown']);
    await byTestId('capture-mode-menu').waitForDisplayed();
    expect(await placement('capture-mode-menu')).toEqual({ inWindow: true, inPanel: true });
    await browser.keys(['Escape']);
    await waitForGone('capture-mode-menu');
    expect(await focusedTestId()).toBe('capture-mode-button');
    if (wasAcquiring) {
      await (await byTestId('acquire-button')).click();
      await waitForState('Acquiring');
    }
  });

  it('flips the capture menu above its chevron at 200% zoom, so it stays inside the window', async () => {
    const focusedTestId = () =>
      browser.execute(() => document.activeElement?.getAttribute('data-testid') ?? null);
    const placement = () =>
      browser.execute(() => {
        const menu = document.querySelector<HTMLElement>('[data-testid="capture-mode-menu"]')!;
        const b = menu.getBoundingClientRect();
        const panel = document.querySelector('.side-panel')!.getBoundingClientRect();
        return {
          top: b.top,
          bottom: b.bottom,
          windowHeight: window.innerHeight,
          // The side panel is a scroll box: a menu past its bottom edge is clipped, not just off-window.
          inPanel: b.left >= panel.left && b.right <= panel.right && b.bottom <= panel.bottom,
          flipped: menu.classList.contains('popover-up'),
        };
      });

    // The capture chevron is locked while acquiring: pause for this check and resume afterwards.
    const wasAcquiring = (await acquireState()) === 'acquiring';
    if (wasAcquiring) {
      await (await byTestId('acquire-button')).click();
      await waitForState('Connected');
    }
    // A short window at 200%: the menu would open below the chevron and run past the window bottom.
    // The webview's zoom key does nothing in this build, so the zoom is set on the root (QA note).
    await browser.setWindowSize(1024, 820);
    await browser.pause(300);
    try {
      await browser.execute(() => {
        document.documentElement.style.zoom = '2';
      });
      await browser.execute(() =>
        (document.querySelector('[data-testid="capture-mode-button"]') as HTMLElement).focus(),
      );
      await browser.keys(['ArrowDown']);
      await byTestId('capture-mode-menu').waitForDisplayed();
      const menu = await placement();
      expect(menu.flipped).toBe(true);
      expect(menu.top).toBeGreaterThanOrEqual(0);
      expect(menu.bottom).toBeLessThanOrEqual(menu.windowHeight);
      expect(menu.inPanel).toBe(true);
      // Flipping moves the menu, not focus: Escape still returns focus to the chevron.
      await browser.keys(['Escape']);
      await waitForGone('capture-mode-menu');
      expect(await focusedTestId()).toBe('capture-mode-button');
    } finally {
      await browser.execute(() => {
        document.documentElement.style.zoom = '';
      });
      await browser.setWindowSize(1440, 900);
      await browser.pause(300);
      if (wasAcquiring) {
        await (await byTestId('acquire-button')).click();
        await waitForState('Acquiring');
      }
    }
  });

  it('applies a picked span and keeps keyboard focus on Span (DESIGN.md 9.8, O1)', async () => {
    const focusedLabel = () =>
      browser.execute(() => document.activeElement?.getAttribute('aria-label') ?? null);
    const span = $('#span');
    await span.click();
    await span.selectByAttribute('value', '1024000');
    // The pick sets busy = 'applying'; the backend's new span shows in the select once it lands.
    await browser.waitUntil(async () => (await span.getValue()) === '1024000', {
      timeoutMsg: 'the picked span did not reach the source',
    });
    // A native disabled select drops focus in WebKit; Span is read-only while applying instead.
    expect(await focusedLabel()).toBe('Span');
    await expect(span).not.toBeDisabled();
    await span.selectByAttribute('value', '2048000');
    await browser.waitUntil(async () => (await span.getValue()) === '2048000');
    expect(await focusedLabel()).toBe('Span');
  });

  it('applies a Source settings frequency and keeps keyboard focus in it (DESIGN.md 9.8, O1)', async () => {
    const summary = await $('summary=Source settings');
    await browser.waitUntil(async () => {
      const open = await browser.execute(
        (el) => (el.parentElement as HTMLDetailsElement).open,
        summary,
      );
      if (open) return true;
      await summary.click();
      return false;
    });
    const tone = '#source-tone1Hz';
    await setInput(tone, '100.3M');
    // The commit sets busy = 'applying'; a read-only field keeps focus while it applies.
    await browser.waitUntil(
      async () => {
        const first = (await $$('[data-testid="peak-table"] tbody tr'))[0];
        return first !== undefined && (await first.getText()).includes('100.30');
      },
      { timeoutMsg: 'the Tone 1 frequency did not reach the source' },
    );
    const focusedId = await browser.execute(() => document.activeElement?.id ?? null);
    expect(focusedId).toBe('source-tone1Hz');
    await expect($(tone)).not.toBeDisabled();
    // Restore the simulator's default tone for the specs that follow.
    await setInput(tone, '100.25M');
    await browser.waitUntil(async () => (await (await $(tone)).getValue()) === '100.250000 MHz');
    await summary.click();
  });

  it('applies processing settings and reflects them in the frame metadata', async () => {
    await $('#fft-size').selectByAttribute('value', '1024');
    await browser.waitUntil(async () => (await statusBarText()).includes('FFT 1024'), {
      timeoutMsg: 'status bar did not show the new FFT size',
    });
    await $('#window').selectByAttribute('value', 'flatTop');
    await browser.waitUntil(async () => (await statusBarText()).includes('Flat top'));
  });

  it('retunes the centre frequency and rejects out-of-range input', async () => {
    await setInput('input[aria-label="Center frequency"]', '433.92M');
    await browser.waitUntil(async () => (await statusBarText()).includes('Center 433.92'), {
      timeoutMsg: 'status bar did not show the new centre frequency',
    });
    // Enter commits and keeps focus in the field (DESIGN.md 9.8, O1).
    const focused = await browser.execute(
      () => document.activeElement?.getAttribute('aria-label') ?? null,
    );
    if (focused !== 'Center frequency') throw new Error(`focus after Enter is on ${focused}`);
    await setInput('input[aria-label="Center frequency"]', '7G');
    await expect($('input[aria-label="Center frequency"]')).toHaveAttribute('aria-invalid', 'true');
    await browser.keys(['Escape']);
    expect(await statusBarText()).toContain('Center 433.92');
  });

  it('places a marker with peak search', async () => {
    await setInput('input[aria-label="Center frequency"]', '100M');
    await browser.waitUntil(async () => (await statusBarText()).includes('Center 100.0000'));
    const peakSearch = await byTestId('peak-search');
    await peakSearch.waitForEnabled(); // enabled once the readouts see the new frame's peaks
    await peakSearch.click();
    const row = (await $$('[data-testid="marker-table"] tbody tr'))[0]!;
    await expect(row).toHaveText(expect.stringContaining('M1'));
    await expect(row).toHaveText(expect.stringContaining('100.25'));
  });

  it('pauses: the last trace stays on screen, frozen and marked as held', async () => {
    await (await byTestId('acquire-button')).click();
    await waitForState('Connected');
    expect(await acquireState()).toBe('idle');
    expect(await byTestId('acquire-button').getAttribute('aria-label')).toBe(
      'Start continuous acquisition',
    );
    await browser.waitUntil(async () => (await livenessKind()) === 'stopped');
    expect(await livenessText()).toContain('HOLD');
  });

  it('plays again with the same settings', async () => {
    await (await byTestId('acquire-button')).click();
    await waitForState('Acquiring');
    await browser.waitUntil(async () => (await livenessKind()) === 'live');
    expect(await acquireState()).toBe('acquiring');
    expect(await byTestId('acquire-button').getAttribute('aria-label')).toBe(
      'Pause continuous acquisition',
    );
    expect(await statusBarText()).toContain('Center 100.0000');
    await (await byTestId('acquire-button')).click();
    await waitForState('Connected');
  });

  it('keeps keyboard focus on the capture button across Space and Enter presses', async () => {
    const focusedTestId = () =>
      browser.execute(() => document.activeElement?.getAttribute('data-testid') ?? null);
    await browser.execute(() =>
      (document.querySelector('[data-testid="acquire-button"]') as HTMLElement).focus(),
    );
    await browser.keys([' ']);
    await waitForState('Acquiring');
    expect(await focusedTestId()).toBe('acquire-button');
    await browser.keys(['Enter']);
    await waitForState('Connected');
    expect(await focusedTestId()).toBe('acquire-button');
    await browser.keys([' ']);
    await waitForState('Acquiring');
    expect(await focusedTestId()).toBe('acquire-button');
    await browser.keys(['Enter']);
    await waitForState('Connected');
    expect(await focusedTestId()).toBe('acquire-button');
  });

  it('offers Continuous and Single in the capture menu; Escape keeps the mode', async () => {
    // Keyboard only: the chevron opens the menu on the checked item, arrows move, Escape closes.
    await browser.execute(() =>
      (document.querySelector('[data-testid="capture-mode-button"]') as HTMLElement).focus(),
    );
    await browser.keys(['ArrowDown']);
    await byTestId('capture-mode-menu').waitForDisplayed();
    expect(await byTestId('capture-mode-continuous').getAttribute('aria-checked')).toBe('true');
    expect(await byTestId('capture-mode-single').getAttribute('aria-checked')).toBe('false');
    await browser.keys(['ArrowDown']);
    await browser.keys(['Escape']);
    await waitForGone('capture-mode-menu');
    expect(await captureMode()).toBe('continuous');
    // Escape returns focus to the chevron, so the keyboard user keeps their place.
    expect(
      await browser.execute(() => document.activeElement?.getAttribute('data-testid') ?? null),
    ).toBe('capture-mode-button');
    expect(await sessionState()).toBe('Connected');
  });

  it('switches to Single from the menu without starting a capture', async () => {
    await chooseMode('single');
    expect(await sessionState()).toBe('Connected');
    expect(await acquireState()).toBe('idle');
    expect(await byTestId('acquire-button').getAttribute('aria-label')).toBe(
      'Start single capture',
    );
    expect(await livenessKind()).toBe('stopped');
  });

  it('a single capture takes exactly one sweep and stops by itself', async () => {
    // The baseline must be the newest frame: the status bar may still show one from the stream
    // that just stopped (see settledFrameSeq).
    const before = await settledFrameSeq();
    await (await byTestId('acquire-button')).click();
    // The simulator sweep is near-instant: the end is the backend returning to Connected with
    // one new frame, without any Stop press.
    await browser.waitUntil(
      async () => (await sessionState()) === 'Connected' && (await frameSeq()) === before! + 1,
      { timeoutMsg: 'the single capture did not deliver exactly one frame and stop' },
    );
    expect(await acquireState()).toBe('idle');
    // Nothing else arrives afterwards: the capture really stopped.
    await browser.pause(1500);
    expect(await frameSeq()).toBe(before! + 1);
    expect(await sessionState()).toBe('Connected');
    expect(await livenessText()).toContain('HOLD');
  });

  it('a second press takes a new single capture', async () => {
    const before = await settledFrameSeq();
    await (await byTestId('acquire-button')).click();
    await browser.waitUntil(
      async () => (await sessionState()) === 'Connected' && (await frameSeq()) === before! + 1,
      { timeoutMsg: 'the second single capture did not deliver a new frame' },
    );
    expect(await acquireState()).toBe('idle');
  });

  it('cannot change the mode while acquiring; the chevron is locked', async () => {
    await chooseMode('continuous');
    await (await byTestId('acquire-button')).click();
    await waitForState('Acquiring');
    await browser.waitUntil(async () => (await livenessKind()) === 'live');
    expect(await byTestId('capture-mode-button').getAttribute('aria-disabled')).toBe('true');
    await (await byTestId('capture-mode-button')).click();
    await expect(await byTestId('capture-mode-menu')).not.toBeExisting();
    expect(await captureMode()).toBe('continuous');
    await (await byTestId('acquire-button')).click();
    await waitForState('Connected');
  });

  it('disconnect keeps the selection: the name stays, nothing is connected, capture needs a source', async () => {
    await runSimulator();
    await ensureDisconnected();
    await expect(await byTestId('simulated-badge')).not.toBeExisting();
    // Disconnect releases the source but keeps it selected (ADR 0017): the name stays with the idle state.
    expect(await sourceButtonText()).toBe('Source: Signal simulator, Disconnected');
    expect(await sessionState()).toBe('Disconnected');
    // The capture button needs a connected source: it is disabled and says why.
    await expect(await byTestId('acquire-button')).toBeDisabled();
    await expect(await byTestId('capture-mode-button')).toBeDisabled();
    expect(await byTestId('acquire-button').getAttribute('title')).toBe('Connect a source first');

    // The plot hint is for a selection with no trace: connecting clears the trace, and a disconnect
    // without a capture leaves the hint (a trace on screen shows the tag instead, and no hint).
    await selectSource('source-simulator');
    await waitForState('Connected');
    await ensureDisconnected();
    expect(await sourceButtonText()).toBe('Source: Signal simulator, Disconnected');
    expect(await textOf(byTestId('plot-hint'))).toBe(
      'Not connected. Use the source button to connect.',
    );
  });
});
