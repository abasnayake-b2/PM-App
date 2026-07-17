import { Link } from 'react-router-dom';
import { useRegions, useCountries, useClients } from '@/hooks/useOrganisation';

const selectClass =
  'mt-1 w-full rounded-lg border border-border bg-bg3 px-3 py-2 text-sm outline-none focus:border-accent';

export interface ClientHierarchyValue {
  regionId: string;
  countryId: string;
  clientId: string;
}

interface ClientHierarchySelectProps {
  value: ClientHierarchyValue;
  onChange: (value: ClientHierarchyValue) => void;
  showCreateLinks?: boolean;
  required?: boolean;
}

export function ClientHierarchySelect({
  value,
  onChange,
  showCreateLinks = false,
  required = true,
}: ClientHierarchySelectProps) {
  const { data: regions, isLoading: regionsLoading } = useRegions();
  const { data: countries, isLoading: countriesLoading } = useCountries(
    value.regionId || undefined,
    !!value.regionId,
  );
  const { data: clients, isLoading: clientsLoading } = useClients(
    value.countryId || undefined,
    !!value.countryId,
  );

  const orgLink = (params: Record<string, string>) => {
    const qs = new URLSearchParams(params).toString();
    return `/organisation?${qs}`;
  };

  return (
    <div className="space-y-4">
      <label className="block text-sm">
        <span className="text-text2">Region</span>
        <select
          value={value.regionId}
          onChange={(e) =>
            onChange({ regionId: e.target.value, countryId: '', clientId: '' })
          }
          required={required}
          className={selectClass}
        >
          <option value="">{regionsLoading ? 'Loading…' : 'Select region…'}</option>
          {regions?.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.code})
            </option>
          ))}
        </select>
        {showCreateLinks && (
          <Link to="/organisation" className="mt-1 inline-block text-xs text-accent hover:underline">
            Manage regions
          </Link>
        )}
      </label>

      <label className="block text-sm">
        <span className="text-text2">Country</span>
        <select
          value={value.countryId}
          onChange={(e) => onChange({ ...value, countryId: e.target.value, clientId: '' })}
          required={required}
          disabled={!value.regionId}
          className={selectClass}
        >
          <option value="">
            {!value.regionId
              ? 'Select a region first'
              : countriesLoading
                ? 'Loading…'
                : 'Select country…'}
          </option>
          {countries?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.code})
            </option>
          ))}
        </select>
        {showCreateLinks && value.regionId && (
          <Link
            to={orgLink({ regionId: value.regionId })}
            className="mt-1 inline-block text-xs text-accent hover:underline"
          >
            Add country in this region
          </Link>
        )}
      </label>

      <label className="block text-sm">
        <span className="text-text2">Client</span>
        <select
          name="clientId"
          value={value.clientId}
          onChange={(e) => onChange({ ...value, clientId: e.target.value })}
          required={required}
          disabled={!value.countryId}
          className={selectClass}
        >
          <option value="">
            {!value.countryId
              ? 'Select a country first'
              : clientsLoading
                ? 'Loading…'
                : 'Select client…'}
          </option>
          {clients?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {showCreateLinks && value.regionId && value.countryId && (
          <Link
            to={orgLink({ regionId: value.regionId, countryId: value.countryId })}
            className="mt-1 inline-block text-xs text-accent hover:underline"
          >
            Add client in this country
          </Link>
        )}
      </label>
    </div>
  );
}
