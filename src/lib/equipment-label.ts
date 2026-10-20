export function equipmentLabel(equipment: { name: string; modelNumber?: string | null; serialNumber?: string | null }) {
  return [equipment.name, equipment.modelNumber, equipment.serialNumber].filter(value => value?.trim()).join(" - ");
}
