import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Guards closing a slide-over when the user has unsaved form edits.
 * Use with UnsavedChangesDialog + contentRef on the scrollable body.
 */
export function useUnsavedCloseGuard(enabled = true) {
  const contentRef = useRef<HTMLDivElement>(null);
  const saveHandlerRef = useRef<(() => void | Promise<void>) | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const [dirty, setDirtyState] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const closeActionRef = useRef<(() => void) | null>(null);

  const setDirty = useCallback((value: boolean) => {
    setDirtyState(value);
  }, []);

  const registerSave = useCallback((handler: (() => void | Promise<void>) | null) => {
    saveHandlerRef.current = handler;
  }, []);

  const markDirtyFromEvent = useCallback(() => {
    if (enabledRef.current) setDirtyState(true);
  }, []);

  const requestClose = useCallback((onClose: () => void) => {
    if (enabledRef.current && dirty) {
      closeActionRef.current = onClose;
      setConfirmOpen(true);
      return;
    }
    onClose();
  }, [dirty]);

  const keepEditing = useCallback(() => {
    setConfirmOpen(false);
    closeActionRef.current = null;
  }, []);

  const discard = useCallback(() => {
    setConfirmOpen(false);
    setDirtyState(false);
    const close = closeActionRef.current;
    closeActionRef.current = null;
    close?.();
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      if (saveHandlerRef.current) {
        await saveHandlerRef.current();
        setDirtyState(false);
        setConfirmOpen(false);
        const close = closeActionRef.current;
        closeActionRef.current = null;
        close?.();
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
  }, []);

  // Clear dirty when the form leaves the DOM (cancel edit / successful save).
  useEffect(() => {
    if (!enabled) return;
    const root = contentRef.current;
    if (!root) return;
    const sync = () => {
      if (!root.querySelector('form')) {
        setDirtyState(false);
      }
    };
    const observer = new MutationObserver(sync);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [enabled]);

  return {
    contentRef,
    dirty,
    confirmOpen,
    saving,
    setDirty,
    registerSave,
    markDirtyFromEvent,
    requestClose,
    keepEditing,
    discard,
    save,
  };
}
