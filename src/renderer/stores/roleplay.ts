import { create } from 'zustand';
import type { RoleplayCharacter, RoleplayTemplate, CharacterFormData, PortraitGenerateStage } from '../utils/roleplay';
import { getTemplateById } from '../utils/roleplay';

interface RoleplayState {
  templates: RoleplayTemplate[];
  characters: RoleplayCharacter[];
  activeCharacterId: string | null;
  draftParticipantIds: string[];
  loading: boolean;
  error: string;
  loadAll: () => Promise<void>;
  saveCharacter: (data: CharacterFormData) => Promise<RoleplayCharacter | null>;
  deleteCharacter: (id: string) => Promise<boolean>;
  createFromTemplate: (templateId: string) => Promise<RoleplayCharacter | null>;
  generateRandomTemplate: (keywords: string) => Promise<RoleplayTemplate | null>;
  generateRandomCharacter: (templateId: string) => Promise<RoleplayCharacter | null>;
  saveTemplate: (data: CharacterFormData & { id?: string }) => Promise<RoleplayTemplate | null>;
  deleteTemplate: (id: string) => Promise<boolean>;
  setActiveCharacter: (id: string | null) => Promise<void>;
  setSessionCast: (participantIds: string[]) => Promise<void>;
  toggleDraftParticipant: (id: string) => void;
  clearDraftCast: () => void;
  pickPortrait: (ownerId: string, copy?: boolean) => Promise<string | null>;
  generatePortrait: (
    ownerId: string,
    data: CharacterFormData,
    onProgress?: (stage: PortraitGenerateStage) => void,
  ) => Promise<{ portraitPath: string; dataUrl?: string } | null>;
  getActiveCharacter: () => RoleplayCharacter | null;
  getTemplateForCharacter: (character?: RoleplayCharacter | null) => RoleplayTemplate | null;
  getSessionCharacters: (participantIds: string[]) => RoleplayCharacter[];
}

export const useRoleplayStore = create<RoleplayState>((set, get) => ({
  templates: [],
  characters: [],
  activeCharacterId: null,
  draftParticipantIds: [],
  loading: false,
  error: '',

  loadAll: async () => {
    set({ loading: true, error: '' });
    try {
      const [tplRes, charRes] = await Promise.all([
        window.api.roleplay.listTemplates(),
        window.api.roleplay.listCharacters(),
      ]);
      if (!tplRes.success) throw new Error(tplRes.error);
      if (!charRes.success) throw new Error(charRes.error);
      set({
        templates: tplRes.templates,
        characters: charRes.characters,
        activeCharacterId: charRes.activeCharacterId,
      });
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ loading: false });
    }
  },

  saveCharacter: async (data) => {
    const res = await window.api.roleplay.saveCharacter(data);
    if (!res.success) {
      set({ error: res.error });
      return null;
    }
    set(s => ({
      characters: [res.character, ...s.characters.filter(c => c.id !== res.character.id)],
      error: '',
    }));
    return res.character;
  },

  deleteCharacter: async (id) => {
    const res = await window.api.roleplay.deleteCharacter(id);
    if (!res.success) {
      set({ error: res.error });
      return false;
    }
    set(s => ({
      characters: s.characters.filter(c => c.id !== id),
      activeCharacterId: s.activeCharacterId === id ? null : s.activeCharacterId,
    }));
    return true;
  },

  createFromTemplate: async (templateId) => {
    const res = await window.api.roleplay.createFromTemplate(templateId);
    if (!res.success) {
      set({ error: res.error });
      return null;
    }
    set(s => ({
      characters: [res.character, ...s.characters.filter(c => c.id !== res.character.id)],
      error: '',
    }));
    return res.character;
  },

  generateRandomTemplate: async (keywords) => {
    const res = await window.api.roleplay.generateRandomTemplate(keywords);
    if (!res.success) {
      set({ error: res.error });
      return null;
    }
    await get().loadAll();
    return res.template;
  },

  generateRandomCharacter: async (templateId) => {
    const res = await window.api.roleplay.generateRandomCharacter(templateId);
    if (!res.success) {
      set({ error: res.error });
      return null;
    }
    set(s => ({
      characters: [res.character, ...s.characters.filter(c => c.id !== res.character.id)],
      error: '',
    }));
    return res.character;
  },

  saveTemplate: async (data) => {
    const res = await window.api.roleplay.saveTemplate(data);
    if (!res.success) {
      set({ error: res.error });
      return null;
    }
    await get().loadAll();
    return res.template;
  },

  deleteTemplate: async (id) => {
    const res = await window.api.roleplay.deleteTemplate(id);
    if (!res.success) {
      set({ error: res.error });
      return false;
    }
    await get().loadAll();
    return true;
  },

  setActiveCharacter: async (id) => {
    const res = await window.api.roleplay.setActiveCharacter(id);
    if (!res.success) {
      set({ error: res.error });
      return;
    }
    set({
      activeCharacterId: id,
      draftParticipantIds: id ? [id] : [],
      error: '',
    });
  },

  setSessionCast: async (participantIds) => {
    const primaryId = participantIds[0] ?? null;
    const res = await window.api.roleplay.setActiveCharacter(primaryId);
    if (!res.success) {
      set({ error: res.error });
      return;
    }
    set({
      activeCharacterId: primaryId,
      draftParticipantIds: participantIds,
      error: '',
    });
  },

  toggleDraftParticipant: (id) => {
    set(state => {
      const exists = state.draftParticipantIds.includes(id);
      const draftParticipantIds = exists
        ? state.draftParticipantIds.filter(item => item !== id)
        : [...state.draftParticipantIds, id];
      return { draftParticipantIds };
    });
  },

  clearDraftCast: () => {
    set({ draftParticipantIds: [] });
  },

  pickPortrait: async (ownerId, copy = true) => {
    const res = await window.api.roleplay.pickPortrait(ownerId, copy);
    if (!res.success) {
      if (res.error !== '已取消') set({ error: res.error });
      return null;
    }
    return res.portraitPath;
  },

  generatePortrait: async (ownerId, data, onProgress) => {
    set({ error: '' });
    const res = await window.api.roleplay.generatePortrait(ownerId, data, onProgress);
    if (!res.success) {
      set({ error: res.error });
      return null;
    }
    return { portraitPath: res.portraitPath, dataUrl: res.dataUrl };
  },

  getActiveCharacter: () => {
    const { characters, activeCharacterId } = get();
    if (!activeCharacterId) return null;
    return characters.find(c => c.id === activeCharacterId) ?? null;
  },

  getTemplateForCharacter: (character) => {
    const c = character ?? get().getActiveCharacter();
    if (!c) return null;
    return getTemplateById(get().templates, c.templateId);
  },

  getSessionCharacters: (participantIds) => {
    const { characters } = get();
    return participantIds
      .map(id => characters.find(c => c.id === id))
      .filter((c): c is RoleplayCharacter => Boolean(c));
  },
}));
