export const PICKUP_LOCATION_IDS = [1, 2, 3, 4] as const;

export type PickupLocationId = (typeof PICKUP_LOCATION_IDS)[number];

export function normalizePickupLocation(laneNumber: number): PickupLocationId {
  const lane = Math.trunc(laneNumber);
  if (!PICKUP_LOCATION_IDS.includes(lane as PickupLocationId)) {
    throw new Error('Pickup location must be Lane 1, Lane 2, Walker - Front, or Walker - Back');
  }
  return lane as PickupLocationId;
}
