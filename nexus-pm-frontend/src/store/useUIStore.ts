import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'blue';

const THEMES: Theme[] = ['light', 'dark', 'blue'];

function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && THEMES.includes(value as Theme);
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

interface UIState {
  theme: Theme;
  sidebarCollapsed: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      sidebarCollapsed: false,
      toggleTheme: () => {
        const current = get().theme;
        const index = THEMES.indexOf(current);
        const next = THEMES[(index + 1) % THEMES.length];
        applyTheme(next);
        set({ theme: next });
      },
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    {
      name: 'dfnpm-ui',
      version: 1,
      migrate: (persisted) => {
        const state = persisted as Partial<UIState>;
        if (!isTheme(state.theme)) {
          return { ...state, theme: 'dark' as Theme };
        }
        return state as UIState;
      },
      onRehydrateStorage: () => (state) => {
        if (state && isTheme(state.theme)) {
          applyTheme(state.theme);
        }
      },
    },
  ),
);
