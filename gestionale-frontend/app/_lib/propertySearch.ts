export type SearchProperty = {
  id: string;
  code?: string;
  name?: string;
  type?: string;
  apartmentId?: string;
};

// apartmentId stores the apartment code; accept its document ID for older data too.
export function buildPropertySearch(properties: SearchProperty[], selectedId: string) {
  const apartments = properties.filter(p => p.type === 'APARTMENT');
  const byCode = new Map(apartments.filter(p => p.code?.trim()).map(p => [p.code!.trim(), p]));
  const byId = new Map(apartments.map(p => [p.id, p]));
  const selected = properties.find(p => p.id === selectedId);
  const ids = new Set<string>(selectedId ? [selectedId] : []);
  const apartmentText = new Map<string, string>();

  for (const property of properties) {
    const reference = property.apartmentId?.trim() ?? '';
    const apartment = property.type === 'APARTMENT' ? property : byCode.get(reference) ?? byId.get(reference);
    apartmentText.set(property.id, [reference, apartment?.id, apartment?.code, apartment?.name].filter(Boolean).join(' '));
    if (selected?.type === 'APARTMENT' && apartment?.id === selected.id) ids.add(property.id);
  }
  return { ids, apartmentText };
}
