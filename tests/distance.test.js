import test from 'node:test';
import assert from 'node:assert/strict';
import { distanceKm, mapUrl } from '../public/distance.js';
test('same location and known Seoul–Busan distance', () => {
  const seoul = { lat: 37.5665, lon: 126.978 };
  const busan = { lat: 35.1796, lon: 129.0756 };
  assert.equal(distanceKm(seoul, seoul), 0);
  assert.ok(Math.abs(distanceKm(seoul, busan) - 325.1) < 1);
  assert.equal(distanceKm(seoul, busan), distanceKm(busan, seoul));
});
test('antipodes remain finite and map link contains both selected points', () => {
  assert.ok(Math.abs(distanceKm({ lat: 0, lon: 0 }, { lat: 0, lon: 180 }) - 20015.1) < 1);
  const url = new URL(mapUrl({ lat: 37, lon: 127 }, { lat: 35, lon: 129 }));
  assert.equal(url.origin, 'https://www.openstreetmap.org');
  assert.equal(url.searchParams.get('from'), '37,127');
  assert.equal(url.searchParams.get('to'), '35,129');
});
