import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { X } from 'lucide-react';
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog';

interface SlideOverUnsavedContextValue {
  setDirty: (dirty: boolean) => void;
  registerSave: (handler: (() => void | Promise<void>) | null) => void;
}

const SlideOverUnsavedContext = createContext<SlideOverUnsavedContextValue | null>(null);

/** Register dirty state / save handler from a form inside a SlideOverPanel. */
export function useSlideOverUnsaved(
  isDirty: boolean,
  onSave?: () => void | Promise<void>,
) {
  const ctx = useContext(SlideOverUnsavedContext);
  useEffect(() => {
    if (!ctx) return;
    ctx.setDirty(isDirty);
    return () => ctx.setDirty(false);
  }, [ctx, isDirty]);

  useEffect(() => {
    if (!ctx) return;
    ctx.registerSave(onSave ?? null);
    return () => ctx.registerSave(null);
  }, [ctx, onSave]);
}

interface SlideOverPanelProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  /** Wider panel for denser forms. Default max-w-md. */
  wide?: boolean;
  /** Panel width. `third` ≈ 33vw; overrides `wide` when set. */
  size?: 'default' | 'wide' | 'half' | 'third';
  /** Soft accent header strip (RD panels). */
  accent?: boolean;
  /**
   * When true (default), closing with unsaved edits shows Save / Keep changing / Cancel.
   * Set false for read-only panels (lists, detail views without forms).
   */
  protectUnsaved?: boolean;
}

/**
 * Right-side sliding edit/create panel (matches detail panel pattern).
 * Backdrop / X close asks before discarding unsaved form changes.
 */
export function SlideOverPanel({
  title,
  subtitle,
  onClose,
  children,
  wide,
  size,
  accent,
  protectUnsaved = true,
}: SlideOverPanelProps) {
  const resolvedSize = size ?? (wide ? 'wide' : 'default');
  const widthClass =
    resolvedSize === 'third'
      ? 'w-full sm:w-1/3 sm:max-w-none'
      : resolvedSize === 'half'
        ? 'w-full sm:w-1/2 sm:max-w-none'
        : resolvedSize === 'wide'
          ? 'max-w-xl'
          : 'max-w-md';

  const compactChrome = resolvedSize === 'half' || resolvedSize === 'third';
  const contentRef = useRef<HTMLDivElement>(null);
  const saveHandlerRef = useRef<(() => void | Promise<void>) | null>(null);
  const [dirty, setDirty] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const setDirtyStable = useCallback((value: boolean) => {
    setDirty(value);
  }, []);

  const registerSave = useCallback((handler: (() => void | Promise<void>) | null) => {
    saveHandlerRef.current = handler;
  }, []);

  const ctxValue: SlideOverUnsavedContextValue = {
    setDirty: setDirtyStable,
    registerSave,
  };

  const markDirtyIfProtected = useCallback(() => {
    if (protectUnsaved) setDirty(true);
  }, [protectUnsaved]);

  const requestClose = useCallback(() => {
    if (protectUnsaved && dirty) {
      setConfirmOpen(true);
      return;
    }
    onClose();
  }, [protectUnsaved, dirty, onClose]);

  const handleKeepChanging = useCallback(() => {
    setConfirmOpen(false);
  }, []);

  const handleCancel = useCallback(() => {
    setConfirmOpen(false);
    setDirty(false);
    onClose();
  }, [onClose]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      if (saveHandlerRef.current) {
        await saveHandlerRef.current();
        setDirty(false);
        setConfirmOpen(false);
        onClose();
        return;
      }
      const form = contentRef.current?.querySelector('form');
      if (form instanceof HTMLFormElement) {
        if (typeof form.requestSubmit === 'function') {
          form.requestSubmit();
        } else {
          form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
      }
      setConfirmOpen(false);
    } catch {
      setConfirmOpen(false);
    } finally {
      setSaving(false);
    }
  }, [onClose]);

  // If the form is removed (e.g. Cancel edit / successful save), clear dirty.
  useEffect(() => {
    if (!protectUnsaved) return;
    const root = contentRef.current;
    if (!root) return;
    const syncDirtyFromDom = () => {
      if (!root.querySelector('form')) {
        setDirty(false);
      }
    };
    const observer = new MutationObserver(syncDirtyFromDom);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [protectUnsaved]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (confirmOpen) {
        setConfirmOpen(false);
        return;
      }
      requestClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmOpen, requestClose]);

  return (
    <SlideOverUnsavedContext.Provider value={ctxValue}>
      <button
        type="button"
        aria-label="Close panel"
        className="fixed inset-0 z-40 bg-black/35 backdrop-blur-sm"
        onClick={requestClose}
      />
      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l glass-panel ${widthClass}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="slide-over-title"
      >
        {accent && (
          <div
            className="h-1 w-full shrink-0 bg-gradient-to-r from-accent via-[color:var(--accent-hover)] to-[color:var(--accent-muted)]"
            aria-hidden
          />
        )}
        <div
          className={`flex items-start justify-between gap-3 border-b border-border/60 ${
            accent
              ? 'bg-gradient-to-r from-[color:var(--accent-muted)]/35 to-transparent'
              : 'bg-transparent'
          } ${compactChrome ? 'px-3 py-2.5' : 'p-5'}`}
        >
          <div className="min-w-0">
            <h2
              id="slide-over-title"
              className={`truncate font-bold text-text ${compactChrome ? 'text-base' : 'text-lg'}`}
            >
              {title}
            </h2>
            {subtitle ? (
              <p className={`mt-0.5 truncate text-text2 ${compactChrome ? 'text-xs' : 'text-sm'}`}>
                {subtitle}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="shrink-0 rounded-lg p-1.5 text-text2 transition hover:bg-bg3/60 hover:text-text"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <div
          ref={contentRef}
          className={`flex-1 overflow-y-auto bg-transparent ${compactChrome ? 'p-3' : 'p-5'}`}
          onInputCapture={markDirtyIfProtected}
          onChangeCapture={markDirtyIfProtected}
        >
          {children}
        </div>
      </aside>

      <UnsavedChangesDialog
        open={confirmOpen}
        saving={saving}
        onSave={() => void handleSave()}
        onKeepChanging={handleKeepChanging}
        onCancel={handleCancel}
      />
    </SlideOverUnsavedContext.Provider>
  );
}
