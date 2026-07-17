import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import type { SlideOverEntry, SlideOverGroup } from '@/utils/breakdownProjects';

export type { SlideOverEntry, SlideOverGroup };

interface SlideOverListPanelProps {
  title: string;
  subtitle?: string;
  items?: SlideOverEntry[];
  groups?: SlideOverGroup[];
  emptyMessage?: string;
  /** When true, grouped sections start expanded. Default: collapsed. */
  defaultExpanded?: boolean;
  onClose: () => void;
}

function entryKey(item: SlideOverEntry, index: number) {
  if (typeof item === 'string') {
    return `${item}-${index}`;
  }
  return `${item.label}-${item.meta ?? ''}-${index}`;
}

function countEntries(items: SlideOverEntry[] = [], groups: SlideOverGroup[] = []) {
  if (groups.length > 0) {
    return groups.reduce((total, group) => total + group.items.length, 0);
  }
  return items.length;
}

function CollapsibleGroup({
  group,
  collapsed,
  onToggle,
}: {
  group: SlideOverGroup;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-bg3">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        className="flex w-full items-center justify-between gap-3 border-b border-border bg-bg2 px-4 py-2.5 text-left hover:bg-bg3/80"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-text2">
            {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </span>
          <span className="truncate text-xs font-semibold uppercase tracking-wide text-text2">
            {group.title}
          </span>
        </span>
        <span className="shrink-0 text-xs tabular-nums text-text2">{group.items.length}</span>
      </button>
      {!collapsed && (
        <ul className="divide-y divide-border">
          {group.items.map((item, index) => (
            <li key={entryKey(item, index)} className="px-4 py-3 text-sm">
              {typeof item === 'string' ? (
                item
              ) : (
                <div>
                  <p className="font-medium">{item.label}</p>
                  {item.meta && <p className="mt-0.5 text-xs text-text2">{item.meta}</p>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function SlideOverListPanel({
  title,
  subtitle,
  items = [],
  groups = [],
  emptyMessage = 'No items to show.',
  defaultExpanded = false,
  onClose,
}: SlideOverListPanelProps) {
  const groupTitles = useMemo(() => groups.map((group) => group.title), [groups]);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    () => (defaultExpanded ? new Set() : new Set(groupTitles)),
  );

  useEffect(() => {
    setCollapsedGroups(defaultExpanded ? new Set() : new Set(groupTitles));
  }, [title, subtitle, defaultExpanded, groupTitles.join('|')]);

  const totalItems = countEntries(items, groups);
  const hasContent = groups.length > 0 || items.length > 0;
  const allCollapsed = groups.length > 0 && collapsedGroups.size === groups.length;
  const allExpanded = collapsedGroups.size === 0;

  const toggleGroup = (groupTitle: string) => {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupTitle)) {
        next.delete(groupTitle);
      } else {
        next.add(groupTitle);
      }
      return next;
    });
  };

  const expandAll = () => setCollapsedGroups(new Set());
  const collapseAll = () => setCollapsedGroups(new Set(groupTitles));

  return (
    <>
      <button
        type="button"
        aria-label="Close panel"
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
      />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-bg2 shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div className="min-w-0">
            <h2 className="text-lg font-bold">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-text2">{subtitle}</p>}
            <p className="mt-2 text-xs text-text2">
              {totalItems} item{totalItems !== 1 ? 's' : ''}
              {groups.length > 0 ? ` · ${groups.length} group${groups.length !== 1 ? 's' : ''}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-text2 hover:bg-bg3 hover:text-text"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {!hasContent ? (
            <p className="text-sm text-text2">{emptyMessage}</p>
          ) : groups.length > 0 ? (
            <div className="space-y-4">
              {groups.length > 1 && (
                <div className="flex justify-end gap-3 text-xs">
                  <button
                    type="button"
                    onClick={expandAll}
                    disabled={allExpanded}
                    className="text-accent hover:underline disabled:cursor-not-allowed disabled:text-text2 disabled:no-underline"
                  >
                    Expand all
                  </button>
                  <button
                    type="button"
                    onClick={collapseAll}
                    disabled={allCollapsed}
                    className="text-accent hover:underline disabled:cursor-not-allowed disabled:text-text2 disabled:no-underline"
                  >
                    Collapse all
                  </button>
                </div>
              )}
              {groups.map((group) => (
                <CollapsibleGroup
                  key={group.title}
                  group={group}
                  collapsed={collapsedGroups.has(group.title)}
                  onToggle={() => toggleGroup(group.title)}
                />
              ))}
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-bg3">
              {items.map((item, index) => (
                <li key={entryKey(item, index)} className="px-4 py-3 text-sm">
                  {typeof item === 'string' ? (
                    item
                  ) : (
                    <div>
                      <p className="font-medium">{item.label}</p>
                      {item.meta && <p className="mt-0.5 text-xs text-text2">{item.meta}</p>}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}
