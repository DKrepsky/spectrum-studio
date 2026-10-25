import { create } from 'zustand';

import type { DisplayPreferences } from '../bindings/DisplayPreferences';
import type { Palette } from '../bindings/Palette';

export type { Palette };

export const MAX_MARKERS = 4;

export interface Marker {
  id: number;
  frequencyHz: number;
}

export interface FrequencyView {
  startHz: number;
  endHz: number;
}

export interface ViewStore {
  /** Top of the amplitude axis, in the frame's unit. */
  referenceLevel: number;
  /** Displayed amplitude range in dB. */
  rangeDb: number;
  /** Visible frequency window; `null` shows the full span of the frame. */
  zoom: FrequencyView | null;
  showWaterfall: boolean;
  palette: Palette;
  markers: Marker[];
  activeMarker: number | null;
  /** Frequency of the peak selected in the peak table, highlighted on the plot. */
  selectedPeakHz: number | null;

  /** Applies persisted display preferences. */
  hydrate: (display: DisplayPreferences) => void;
  setReferenceLevel: (value: number) => void;
  setRange: (value: number) => void;
  setZoom: (zoom: FrequencyView | null) => void;
  setShowWaterfall: (show: boolean) => void;
  setPalette: (palette: Palette) => void;
  /** Places the active marker at `frequencyHz`, creating one if none is active. */
  placeMarker: (frequencyHz: number) => void;
  addMarker: (frequencyHz: number) => void;
  removeMarker: (id: number) => void;
  setActiveMarker: (id: number | null) => void;
  clearMarkers: () => void;
  selectPeak: (frequencyHz: number | null) => void;
}

export const RANGE_LIMITS = { min: 10, max: 200 } as const;
export const REFERENCE_LIMITS = { min: -200, max: 100 } as const;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export const useView = create<ViewStore>()((set, get) => ({
  referenceLevel: 0,
  rangeDb: 120,
  zoom: null,
  showWaterfall: true,
  palette: 'classic',
  markers: [],
  activeMarker: null,
  selectedPeakHz: null,

  hydrate: (d) =>
    set({
      referenceLevel: clamp(d.referenceLevel, REFERENCE_LIMITS.min, REFERENCE_LIMITS.max),
      rangeDb: clamp(d.rangeDb, RANGE_LIMITS.min, RANGE_LIMITS.max),
      showWaterfall: d.showWaterfall,
      palette: d.palette,
    }),
  setReferenceLevel: (value) =>
    set({ referenceLevel: clamp(value, REFERENCE_LIMITS.min, REFERENCE_LIMITS.max) }),
  setRange: (value) => set({ rangeDb: clamp(value, RANGE_LIMITS.min, RANGE_LIMITS.max) }),
  setZoom: (zoom) => set({ zoom }),
  setShowWaterfall: (showWaterfall) => set({ showWaterfall }),
  setPalette: (palette) => set({ palette }),

  placeMarker: (frequencyHz) => {
    const { activeMarker, markers } = get();
    if (activeMarker !== null && markers.some((m) => m.id === activeMarker)) {
      set({
        markers: markers.map((m) => (m.id === activeMarker ? { ...m, frequencyHz } : m)),
      });
    } else {
      get().addMarker(frequencyHz);
    }
  },

  addMarker: (frequencyHz) => {
    const { markers } = get();
    const used = new Set(markers.map((m) => m.id));
    const id = [1, 2, 3, 4].find((n) => !used.has(n));
    if (id === undefined || markers.length >= MAX_MARKERS) return;
    set({
      markers: [...markers, { id, frequencyHz }].sort((a, b) => a.id - b.id),
      activeMarker: id,
    });
  },

  removeMarker: (id) => {
    const markers = get().markers.filter((m) => m.id !== id);
    set({
      markers,
      activeMarker: get().activeMarker === id ? (markers[0]?.id ?? null) : get().activeMarker,
    });
  },

  setActiveMarker: (activeMarker) => set({ activeMarker }),
  clearMarkers: () => set({ markers: [], activeMarker: null }),
  selectPeak: (selectedPeakHz) => set({ selectedPeakHz }),
}));

export function displayPreferences(s: ViewStore): DisplayPreferences {
  return {
    referenceLevel: s.referenceLevel,
    rangeDb: s.rangeDb,
    showWaterfall: s.showWaterfall,
    palette: s.palette,
  };
}

/**
 * Saves display preferences whenever they change, debounced so continuous adjustments (mouse
 * wheel) do not write the file on every step. Returns an unsubscribe function.
 */
export function persistDisplayPreferences(
  save: (display: DisplayPreferences) => Promise<unknown>,
  onError: (error: unknown) => void,
  delayMs = 600,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let last = JSON.stringify(displayPreferences(useView.getState()));
  const unsubscribe = useView.subscribe((state) => {
    const next = displayPreferences(state);
    const key = JSON.stringify(next);
    if (key === last) return;
    last = key;
    clearTimeout(timer);
    timer = setTimeout(() => {
      save(next).catch(onError);
    }, delayMs);
  });
  return () => {
    clearTimeout(timer);
    unsubscribe();
  };
}
