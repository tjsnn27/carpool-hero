/** Haversine distance in meters — computed client-side only; never stored server-side. */
export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isInsideZone(
  lat: number,
  lon: number,
  zone: { latitude: number; longitude: number; radius_meters: number }
): boolean {
  return distanceMeters(lat, lon, zone.latitude, zone.longitude) <= zone.radius_meters;
}
