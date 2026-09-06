import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Lang = "am" | "en";

interface SettingsState {
  lang: Lang;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  setLang: (l: Lang) => void;
  toggleSound: () => void;
  toggleHaptics: () => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      lang: "am",
      soundEnabled: true,
      hapticsEnabled: true,
      setLang: (lang) => set({ lang }),
      toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
      toggleHaptics: () => set((s) => ({ hapticsEnabled: !s.hapticsEnabled })),
    }),
    { name: "habesha_settings" },
  ),
);
