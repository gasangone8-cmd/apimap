import { distanceKm, mapUrl } from './distance.js';
const $ = id => document.getElementById(id);
const selected = { start: null, end: null };
const versions = { start: 0, end: 0 };
let busy = false;
function invalidate() { $('result').hidden = true; $('calculate').disabled = !selected.start || !selected.end; }
function status(key, message, error = false) { $(`${key}-status`).textContent = message; $(`${key}-status`).classList.toggle('error', error); }
function showSelection(key) {
  const node = $(`${key}-selected`);
  node.hidden = !selected[key];
  node.textContent = selected[key] ? `✓ ${selected[key].label}` : '';
}
for (const key of ['start', 'end']) {
  $(key).addEventListener('input', () => {
    versions[key]++; selected[key] = null; showSelection(key); invalidate();
    $(`${key}-results`).replaceChildren(); status(key, '');
  });
  $(`${key}-form`).addEventListener('submit', async event => {
    event.preventDefault();
    const query = $(key).value.trim();
    if (query.length < 2) { status(key, '장소 이름이나 주소를 2글자 이상 입력해 주세요.', true); return; }
    if (busy) { status(key, '진행 중인 검색이 끝난 뒤 다시 검색해 주세요.'); return; }
    const version = ++versions[key];
    busy = true;
    document.querySelectorAll('.search-form button').forEach(button => button.disabled = true);
    $(`${key}-results`).replaceChildren(); status(key, '장소를 찾고 있어요…');
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: AbortSignal.timeout(15000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '검색 서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.');
      if (version !== versions[key]) return;
      if (!Array.isArray(data)) throw new Error('검색 결과를 읽을 수 없어요.');
      status(key, data.length ? `${data.length}개의 장소를 찾았어요. 원하는 장소를 선택해 주세요.` : '검색 결과가 없어요. 지역명이나 상세 주소를 함께 입력해 보세요.');
      for (const place of data) {
        const li = document.createElement('li');
        const button = document.createElement('button'); button.type = 'button';
        const name = document.createElement('strong'); name.textContent = place.name;
        const address = document.createElement('small'); address.textContent = place.label;
        button.append(name, address);
        button.addEventListener('click', () => {
          selected[key] = place; $(key).value = place.name;
          $(`${key}-results`).replaceChildren(); status(key, ''); showSelection(key); invalidate();
        });
        li.append(button); $(`${key}-results`).append(li);
      }
    } catch (error) { if (version === versions[key]) status(key, error.name === 'TimeoutError' ? '검색 시간이 초과됐어요. 다시 시도해 주세요.' : error.message, true); }
    finally { busy = false; document.querySelectorAll('.search-form button').forEach(button => button.disabled = false); }
  });
}
$('swap').addEventListener('click', () => {
  [selected.start, selected.end] = [selected.end, selected.start];
  const text = $('start').value; $('start').value = $('end').value; $('end').value = text;
  for (const key of ['start', 'end']) { versions[key]++; $(`${key}-results`).replaceChildren(); status(key, ''); showSelection(key); }
  invalidate();
});
$('calculate').addEventListener('click', () => {
  if (!selected.start || !selected.end) return;
  const km = distanceKm(selected.start, selected.end);
  const metres = km < 1;
  $('distance').textContent = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: metres ? 0 : 2 }).format(metres ? km * 1000 : km);
  $('unit').textContent = metres ? 'm' : 'km';
  $('journey').textContent = `${selected.start.name} → ${selected.end.name}`;
  $('map-link').href = mapUrl(selected.start, selected.end);
  $('result').hidden = false;
});
