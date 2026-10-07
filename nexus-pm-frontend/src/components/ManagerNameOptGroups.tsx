import type { GroupedManagerNames } from '@/utils/managementRoles';

export function ManagerNameOptGroups({ groups }: { groups: GroupedManagerNames }) {
  return (
    <>
      {groups.engineering.length > 0 && (
        <optgroup label="Engineering Managers">
          {groups.engineering.map((name) => (
            <option key={`em:${name}`} value={name}>
              {name}
            </option>
          ))}
        </optgroup>
      )}
      {groups.delivery.length > 0 && (
        <optgroup label="Delivery Managers">
          {groups.delivery.map((name) => (
            <option key={`dm:${name}`} value={name}>
              {name}
            </option>
          ))}
        </optgroup>
      )}
      {groups.coe.length > 0 && (
        <optgroup label="COE Managers">
          {groups.coe.map((name) => (
            <option key={`coe:${name}`} value={name}>
              {name}
            </option>
          ))}
        </optgroup>
      )}
      {groups.other.length > 0 && (
        <optgroup label="Other">
          {groups.other.map((name) => (
            <option key={`other:${name}`} value={name}>
              {name}
            </option>
          ))}
        </optgroup>
      )}
    </>
  );
}
