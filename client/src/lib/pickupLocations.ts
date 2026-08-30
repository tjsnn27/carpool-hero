export const PICKUP_LOCATIONS = [
  { id: 1, label: 'Lane 1' },
  { id: 2, label: 'Lane 2' },
  { id: 3, label: 'Walker - Front' },
  { id: 4, label: 'Walker - Back' },
] as const;

export type PickupLocationId = (typeof PICKUP_LOCATIONS)[number]['id'];

export function pickupLocationLabel(laneNumber: number): string {
  return PICKUP_LOCATIONS.find((loc) => loc.id === laneNumber)?.label ?? `Location ${laneNumber}`;
}
