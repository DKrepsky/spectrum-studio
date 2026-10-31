import { create } from 'zustand';

/** Open state of the source menu, shared so `Ctrl+K` (in `App`) can open it. */
export const useSourceMenu = create<{ open: boolean; setOpen: (open: boolean) => void }>()(
  (set) => ({ open: false, setOpen: (open) => set({ open }) }),
);
