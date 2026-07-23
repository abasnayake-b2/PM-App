import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRouter } from '@/router';
import { useUIStore } from '@/store/useUIStore';
import './index.css';

const queryClient = new QueryClient();

function ThemeInitializer() {
  const theme = useUIStore((s) => s.theme);
  const glassEnabled = useUIStore((s) => s.glassEnabled);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  useEffect(() => {
    document.documentElement.setAttribute('data-glass', glassEnabled ? 'on' : 'off');
  }, [glassEnabled]);
  return null;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeInitializer />
      <AppRouter />
    </QueryClientProvider>
  </StrictMode>,
);
