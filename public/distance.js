export function distanceKm(a, b) {
  const rad = n => n * Math.PI / 180;
  const value = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, value))));
}
export function mapUrl(a, b) {
  const url = new URL('https://www.openstreetmap.org/directions');
  url.searchParams.set('from', `${a.lat},${a.lon}`);
  url.searchParams.set('to', `${b.lat},${b.lon}`);
  return url.href;
}
