import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  FolderKanban,
  Globe,
  MapPin,
} from 'lucide-react';
import { useRegions, useCountries, useClients } from '@/hooks/useOrganisation';
import { useProjects } from '@/hooks/useProjects';
import type { Client, Country, Project, Region } from '@/types';

interface OrganisationTreeProps {
  onNavigate?: (params: { regionId?: string; countryId?: string; clientId?: string }) => void;
  selection?: { regionId?: string; countryId?: string; clientId?: string };
  compact?: boolean;
}

type TreeKind = 'region' | 'country' | 'client' | 'project';

function nodeKey(kind: TreeKind, id: string) {
  return `${kind}:${id}`;
}

function TreeRow({
  depth,
  expanded,
  hasChildren,
  onToggle,
  icon,
  label,
  meta,
  href,
  onLabelClick,
  selected,
  compact,
}: {
  depth: number;
  expanded: boolean;
  hasChildren: boolean;
  onToggle: () => void;
  icon: ReactNode;
  label: string;
  meta?: string;
  href?: string;
  onLabelClick?: () => void;
  selected?: boolean;
  compact?: boolean;
}) {
  const labelContent = href ? (
    <Link to={href} className="font-medium text-accent hover:underline">
      {label}
    </Link>
  ) : onLabelClick ? (
    <button type="button" onClick={onLabelClick} className="font-medium text-left hover:text-accent">
      {label}
    </button>
  ) : (
    <span className="font-medium">{label}</span>
  );

  return (
    <div
      className={`flex items-center gap-2 border-t border-border py-2 pr-3 hover:bg-bg2/50 ${
        selected ? 'bg-accent/10' : ''
      }`}
      style={{ paddingLeft: `${8 + depth * (compact ? 14 : 20)}px` }}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={!hasChildren}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-text2 hover:bg-bg3 disabled:invisible"
        aria-label={expanded ? 'Collapse' : 'Expand'}
      >
        {hasChildren ? (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}
      </button>
      <span className="shrink-0 text-accent">{icon}</span>
      <div className="min-w-0 flex-1">
        {labelContent}
        {meta && <span className="ml-2 text-sm text-text2">{meta}</span>}
      </div>
    </div>
  );
}

export function OrganisationTree({ onNavigate, selection, compact = false }: OrganisationTreeProps) {
  const { data: regions, isLoading: regionsLoading } = useRegions();
  const { data: countries, isLoading: countriesLoading } = useCountries(undefined, true);
  const { data: clients, isLoading: clientsLoading } = useClients(undefined, true);
  const { data: projectsData, isLoading: projectsLoading } = useProjects({ includeArchived: false });

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const countriesByRegion = useMemo(() => {
    const map = new Map<string, Country[]>();
    for (const country of countries ?? []) {
      const list = map.get(country.regionId) ?? [];
      list.push(country);
      map.set(country.regionId, list);
    }
    return map;
  }, [countries]);

  const clientsByCountry = useMemo(() => {
    const map = new Map<string, Client[]>();
    for (const client of clients ?? []) {
      if (!client.countryId) continue;
      const list = map.get(client.countryId) ?? [];
      list.push(client);
      map.set(client.countryId, list);
    }
    return map;
  }, [clients]);

  const projectsByClient = useMemo(() => {
    const map = new Map<string, Project[]>();
    for (const project of projectsData?.content ?? []) {
      const list = map.get(project.clientId) ?? [];
      list.push(project);
      map.set(project.clientId, list);
    }
    return map;
  }, [projectsData]);

  const isLoading = regionsLoading || countriesLoading || clientsLoading || projectsLoading;

  const toggle = (key: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAll = () => {
    const keys = new Set<string>();
    for (const region of regions ?? []) {
      keys.add(nodeKey('region', region.id));
      for (const country of countriesByRegion.get(region.id) ?? []) {
        keys.add(nodeKey('country', country.id));
        for (const client of clientsByCountry.get(country.id) ?? []) {
          keys.add(nodeKey('client', client.id));
        }
      }
    }
    setExpanded(keys);
  };

  const collapseAll = () => setExpanded(new Set());

  useEffect(() => {
    if (!selection) return;
    const keys = new Set<string>();
    if (selection.regionId) keys.add(nodeKey('region', selection.regionId));
    if (selection.countryId) keys.add(nodeKey('country', selection.countryId));
    if (selection.clientId) keys.add(nodeKey('client', selection.clientId));
    if (keys.size === 0) return;
    setExpanded((current) => new Set([...current, ...keys]));
  }, [selection?.regionId, selection?.countryId, selection?.clientId]);

  const renderRegion = (region: Region, depth: number) => {
    const regionCountries = countriesByRegion.get(region.id) ?? [];
    const key = nodeKey('region', region.id);
    const isExpanded = expanded.has(key);

    return (
      <div key={region.id}>
        <TreeRow
          depth={depth}
          expanded={isExpanded}
          hasChildren={regionCountries.length > 0}
          onToggle={() => toggle(key)}
          icon={<Globe size={compact ? 14 : 16} />}
          label={region.name}
          meta={compact ? undefined : region.code}
          selected={selection?.regionId === region.id && !selection?.countryId && !selection?.clientId}
          compact={compact}
          onLabelClick={() => onNavigate?.({ regionId: region.id })}
        />
        {isExpanded &&
          regionCountries.map((country) => renderCountry(country, region.id, depth + 1))}
      </div>
    );
  };

  const renderCountry = (country: Country, regionId: string, depth: number) => {
    const countryClients = clientsByCountry.get(country.id) ?? [];
    const key = nodeKey('country', country.id);
    const isExpanded = expanded.has(key);

    return (
      <div key={country.id}>
        <TreeRow
          depth={depth}
          expanded={isExpanded}
          hasChildren={countryClients.length > 0}
          onToggle={() => toggle(key)}
          icon={<MapPin size={compact ? 14 : 16} />}
          label={country.name}
          meta={compact ? undefined : country.code}
          selected={selection?.countryId === country.id && !selection?.clientId}
          compact={compact}
          onLabelClick={() => onNavigate?.({ regionId, countryId: country.id })}
        />
        {isExpanded &&
          countryClients.map((client) => renderClient(client, regionId, country.id, depth + 1))}
      </div>
    );
  };

  const renderClient = (client: Client, regionId: string, countryId: string, depth: number) => {
    const clientProjects = projectsByClient.get(client.id) ?? [];
    const key = nodeKey('client', client.id);
    const isExpanded = expanded.has(key);

    return (
      <div key={client.id}>
        <TreeRow
          depth={depth}
          expanded={isExpanded}
          hasChildren={clientProjects.length > 0}
          onToggle={() => toggle(key)}
          icon={<Building2 size={compact ? 14 : 16} />}
          label={client.name}
          meta={compact ? undefined : client.status}
          selected={selection?.clientId === client.id}
          compact={compact}
          onLabelClick={() => onNavigate?.({ regionId, countryId, clientId: client.id })}
        />
        {isExpanded &&
          clientProjects.map((project) => renderProject(project, depth + 1))}
      </div>
    );
  };

  const renderProject = (project: Project, depth: number) => (
    <TreeRow
      key={project.id}
      depth={depth}
      expanded={false}
      hasChildren={false}
      onToggle={() => {}}
      icon={<FolderKanban size={compact ? 14 : 16} />}
      label={project.name}
      meta={compact ? undefined : project.ragStatus}
      href={`/projects/${project.id}`}
      compact={compact}
    />
  );

  if (isLoading) {
    return <p className="text-text2">Loading organisation tree…</p>;
  }

  if ((regions?.length ?? 0) === 0) {
    return <p className="text-text2">No regions yet. Switch to Grid view to add organisation data.</p>;
  }

  return (
    <div className={compact ? 'flex h-full min-h-0 flex-col' : undefined}>
      <div className={`flex flex-wrap gap-2 text-sm ${compact ? 'mb-2 shrink-0 px-1' : 'mb-3'}`}>
        <button type="button" onClick={expandAll} className="text-accent hover:underline">
          Expand all
        </button>
        <span className="text-text2">·</span>
        <button type="button" onClick={collapseAll} className="text-accent hover:underline">
          Collapse all
        </button>
      </div>
      <div
        className={`overflow-hidden border-border bg-bg2/30 ${
          compact
            ? 'min-h-0 flex-1 overflow-y-auto rounded-lg border'
            : 'rounded-xl border'
        }`}
      >
        {(regions ?? []).map((region) => renderRegion(region, 0))}
      </div>
    </div>
  );
}
