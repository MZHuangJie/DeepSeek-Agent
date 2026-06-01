// src/renderer/stores/groupChatStore.ts
import { create } from 'zustand';

interface GroupChatState {
  activeSpeaker: string | null;
  typingMap: Record<string, boolean>;
  isGroupActive: boolean;

  setActiveSpeaker: (speakerId: string | null) => void;
  setTyping: (speakerId: string, typing: boolean) => void;
  setGroupActive: (active: boolean) => void;
  reset: () => void;
}

export const useGroupChatStore = create<GroupChatState>((set) => ({
  activeSpeaker: null,
  typingMap: {},
  isGroupActive: false,

  setActiveSpeaker: (speakerId) => set({ activeSpeaker: speakerId }),

  setTyping: (speakerId, typing) =>
    set(s => ({
      typingMap: { ...s.typingMap, [speakerId]: typing },
    })),

  setGroupActive: (active) => set({ isGroupActive: active }),

  reset: () => set({
    activeSpeaker: null,
    typingMap: {},
    isGroupActive: false,
  }),
}));