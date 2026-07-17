import { Pencil, RotateCcw, Trash2 } from 'lucide-react';

interface OrgCrudActionsProps {
  onEdit: () => void;
  onDelete: () => void;
  onRestore?: () => void;
  deleted?: boolean;
  deleteLabel?: string;
  disabled?: boolean;
}

export function OrgCrudActions({
  onEdit,
  onDelete,
  onRestore,
  deleted = false,
  deleteLabel = 'Delete',
  disabled,
}: OrgCrudActionsProps) {
  return (
    <div className="flex items-center justify-end gap-1">
      {!deleted && (
        <button
          type="button"
          onClick={onEdit}
          disabled={disabled}
          className="rounded-lg p-1.5 text-text2 hover:bg-bg3 hover:text-accent disabled:opacity-50"
          title="Edit"
        >
          <Pencil size={14} />
        </button>
      )}
      {deleted && onRestore ? (
        <button
          type="button"
          onClick={onRestore}
          disabled={disabled}
          className="rounded-lg p-1.5 text-text2 hover:bg-success/10 hover:text-success disabled:opacity-50"
          title="Restore (Super Admin)"
        >
          <RotateCcw size={14} />
        </button>
      ) : (
        <button
          type="button"
          onClick={onDelete}
          disabled={disabled}
          className="rounded-lg p-1.5 text-text2 hover:bg-danger/10 hover:text-danger disabled:opacity-50"
          title={deleteLabel}
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}
