import { createHash, randomUUID } from 'node:crypto';

const memory = new Map();
let localNext = 0;
async function redis(command) {
  const response = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command), signal: AbortSignal.timeout(4000)
  });
  if (!response.ok) throw new Error('Redis unavailable');
  const data = await response.json();
  if (data.error) throw new Error('Redis command failed');
  return data.result;
}
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'GET 요청만 지원합니다.' }); }
  const raw = req.query?.q;
  if (typeof raw !== 'string' || raw.trim().length < 2 || raw.length > 150) return res.status(400).json({ error: '장소 이름을 2~150글자로 입력해 주세요.' });
  const query = raw.trim().normalize('NFC');
  const shared = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  const endpoint = process.env.NOMINATIM_SEARCH_URL || 'https://nominatim.openstreetmap.org/search';
  const hash = createHash('sha256').update(`${endpoint}:ko:${query.toLowerCase()}`).digest('hex');
  const cacheKey = `sai:search:v1:${hash}`;
  const lockKey = 'sai:nominatim:global-lock';
  let token;
  let localAcquired = false;
  try {
    const cached = shared ? await redis(['GET', cacheKey]) : memory.get(cacheKey);
    if (cached && (shared || cached.expires > Date.now())) return res.status(200).json(shared ? JSON.parse(cached) : cached.data);
    if (shared) {
      token = randomUUID();
      if (await redis(['SET', lockKey, token, 'NX', 'PX', 15000]) !== 'OK') {
        token = null; res.setHeader('Retry-After', '2');
        return res.status(429).json({ error: '다른 장소를 검색 중이에요. 잠시 후 검색 버튼을 다시 눌러 주세요.' });
      }
    } else {
      if (Date.now() < localNext) { res.setHeader('Retry-After', '2'); return res.status(429).json({ error: '잠시 후 다시 검색해 주세요.' }); }
      localNext = Date.now() + 15000;
      localAcquired = true;
    }
    const url = new URL(endpoint);
    url.search = new URLSearchParams({ q: query, format: 'jsonv2', limit: '5', addressdetails: '1', 'accept-language': 'ko' }).toString();
    const response = await fetch(url, {
      headers: { 'User-Agent': process.env.NOMINATIM_USER_AGENT || `SaiDistance/1.0 (https://${process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || 'apimap-eight.vercel.app'})`, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) return res.status(502).json({ error: '장소 검색 서비스가 응답하지 않아요. 잠시 후 다시 시도해 주세요.' });
    const rawPlaces = await response.json();
    if (!Array.isArray(rawPlaces)) throw new Error('Invalid upstream response');
    const places = rawPlaces.filter(p => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lon)) && Math.abs(Number(p.lat)) <= 90 && Math.abs(Number(p.lon)) <= 180 && typeof p.display_name === 'string').slice(0, 5).map(p => ({
      name: p.name || p.display_name.split(',')[0], label: p.display_name, lat: Number(p.lat), lon: Number(p.lon)
    }));
    if (shared) await redis(['SET', cacheKey, JSON.stringify(places), 'EX', 86400]);
    else { if (memory.size >= 200) memory.delete(memory.keys().next().value); memory.set(cacheKey, { data: places, expires: Date.now() + 86400000 }); }
    return res.status(200).json(places);
  } catch {
    return res.status(503).json({ error: '검색 서비스에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.' });
  } finally {
    if (token) {
      // Only the owning request can shorten its lock. Cooldown begins after upstream completes.
      try { await redis(['EVAL', "if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('PEXPIRE',KEYS[1],1100) else return 0 end", '1', lockKey, token]); } catch { /* Leave the original lock to expire safely. */ }
    } else if (localAcquired) localNext = Date.now() + 1100;
  }
}
