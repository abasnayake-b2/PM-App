import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'blue' | 'coffee' | 'espresso';

const THEMES: Theme[] = ['light', 'dark', 'blue', 'coffee', 'espresso'];

function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && THEMES.includes(value as Theme);
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

function applyGlass(enabled: boolean) {
  document.documentElement.setAttribute('data-glass', enabled ? 'on' : 'off');
}

interface UIState {
  theme: Theme;
  /** Frosted glass surfaces. Default off (solid). */
  glassEnabled: boolean;
  sidebarCollapsed: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  setGlassEnabled: (enabled: boolean) => void;
  toggleGlass: () => void;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      glassEnabled: false,
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
      setGlassEnabled: (enabled) => {
        applyGlass(enabled);
        set({ glassEnabled: enabled });
      },
      toggleGlass: () => {
        const next = !get().glassEnabled;
        applyGlass(next);
        set({ glassEnabled: next });
      },
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    {
      name: 'dfnpm-ui',
      version: 4,
      migrate: (persisted) => {
        const state = persisted as Partial<UIState>;
        return {
          ...state,
          theme: isTheme(state.theme) ? state.theme : ('dark' as Theme),
          glassEnabled: state.glassEnabled === true,
        } as UIState;
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (isTheme(state.theme)) applyTheme(state.theme);
        applyGlass(state.glassEnabled === true);
      },
    },
  ),
);
