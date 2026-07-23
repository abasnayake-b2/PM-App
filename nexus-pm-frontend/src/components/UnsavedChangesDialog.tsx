interface UnsavedChangesDialogProps {
  open: boolean;
  saving?: boolean;
  onSave: () => void;
  onKeepChanging: () => void;
  onCancel: () => void;
}

/** Modal shown when closing a slide-over with unsaved edits. */
export function UnsavedChangesDialog({
  open,
  saving = false,
  onSave,
  onKeepChanging,
  onCancel,
}: UnsavedChangesDialogProps) {
  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/50" aria-hidden />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unsaved-title"
        aria-describedby="unsaved-desc"
        className="fixed left-1/2 top-1/2 z-[70] w-[min(100%-2rem,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border glass-strong p-5"
      >
        <h3 id="unsaved-title" className="text-base font-semibold text-text">
          Unsaved changes
        </h3>
        <p id="unsaved-desc" className="mt-2 text-sm text-text2">
          You have made changes. Do you want to save them before closing?
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg border border-border px-3 py-2 text-sm text-text2 hover:bg-bg3 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onKeepChanging}
            disabled={saving}
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-text hover:bg-bg3 disabled:opacity-50"
          >
            Keep changing
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded-lg bg-accent px-3 py-2 text-sm font-medium disabled:opacity-50"
            style={{ color: 'var(--accent-fg)' }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </>
  );
}
