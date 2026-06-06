import { create } from 'zustand';

interface TimelineState {
  jumpToIndex: number | null;
  jumpTo: (index: number) => void;
  clearJump: () => void;
}

export const useTimelineStore = create<TimelineState>((set) => ({
  jumpToIndex: null,
  jumpTo: (index) => set({ jumpToIndex: index }),
  clearJump: () => set({ jumpToIndex: null }),
}));
