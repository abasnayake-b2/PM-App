export function isNonProjectCategory(name?: string | null): boolean {
  if (!name?.trim()) return false;
  const normalized = name.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return normalized.includes('non project') || normalized.includes('nonproject');
}
