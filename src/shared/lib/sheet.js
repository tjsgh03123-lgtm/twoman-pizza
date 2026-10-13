// 구글 시트(사장님이 수정) → 사이트 데이터로 합치는 모듈.
//   fetchSheet(cfg)        시트 각 탭을 CSV로 읽는다 (실패하면 마지막 성공본, 그것도 없으면 null)
//   applySheet(raw, tabs)  기본 JSON 위에 시트 값을 덮어쓰고 { data, content } 를 돌려준다
// 시트에서 지우거나 판매 FALSE 로 하면 사이트에서 숨겨진다. 새 행을 추가하면 새 메뉴가 생긴다.

import { buildIndex } from './data.js';

const CACHE_KEY = 'twoman.sheetcache';
const LANGS = ['en', 'ja', 'ar', 'vi'];

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else q = false;
      } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const s = (v) => (v == null ? '' : String(v).trim());
const num = (v) => {
  const t = s(v).replace(/[,원₩\s]/g, '');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};
const bool = (v, dflt) => {
  const t = s(v).toUpperCase();
  if (t === 'TRUE' || t === 'Y' || t === 'O') return true;
  if (t === 'FALSE' || t === 'N' || t === 'X') return false;
  return dflt;
};
const list = (v) => s(v).split(',').map((x) => x.trim()).filter(Boolean);

function safeStore() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

export async function fetchSheet(cfg, fetchImpl = globalThis.fetch) {
  const st = safeStore();
  try {
    const tabs = {};
    await Promise.all(Object.entries(cfg.tabs).map(async ([key, name]) => {
      const url = `https://docs.google.com/spreadsheets/d/${cfg.spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(name)}`;
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), cfg.timeoutMs || 6000) : null;
      try {
        const res = await fetchImpl(url, ctrl ? { signal: ctrl.signal } : undefined);
        if (!res.ok) throw new Error(`${name} ${res.status}`);
        const text = await res.text();
        if (/^\s*<(!doctype|html)/i.test(text)) throw new Error(`${name}: 공개 설정 필요`);
        tabs[key] = parseCsv(text);
      } finally { if (timer) clearTimeout(timer); }
    }));
    if (!tabs.menu || tabs.menu.length < 2) throw new Error('메뉴 탭이 비어 있음');
    try { st?.setItem(CACHE_KEY, JSON.stringify(tabs)); } catch { /* 무시 */ }
    return tabs;
  } catch {
    try {
      const c = st?.getItem(CACHE_KEY);
      if (c) return JSON.parse(c);
    } catch { /* 무시 */ }
    return null;
  }
}

const TYPE_BY_CAT = { 피자: 'pizza', 반반피자: 'half-half', 사이드: 'side', 음료: 'drink' };
const SIZE_COLS = [['M', 5], ['L', 6], ['DEFAULT', 7], ['500ml', 8], ['1.25L', 9]];

function table(rows) {
  return (rows || []).slice(1).filter((r) => r.some((c) => s(c) !== ''));
}

export function applySheet(raw, tabs) {
  const data = JSON.parse(JSON.stringify(raw));
  const content = {};
  const addTr = (ko, cells) => {
    const k = s(ko);
    if (!k) return;
    const tr = {};
    LANGS.forEach((l, i) => { if (s(cells[i])) tr[l] = s(cells[i]); });
    if (Object.keys(tr).length) content[k] = { ...(content[k] || {}), ...tr };
  };

  // --- 설정 ---
  const set = {};
  for (const r of table(tabs.settings)) set[s(r[0])] = r[1];
  if (num(set['반반 기준가 미디엄']) != null) data.halfHalf.basePrice.M = num(set['반반 기준가 미디엄']);
  if (num(set['반반 기준가 라지']) != null) data.halfHalf.basePrice.L = num(set['반반 기준가 라지']);
  const comb = s(set['반반 추가금 계산']);
  if (comb === '합산') data.halfHalf.calculation.combine = 'sum';
  if (comb === '큰값') data.halfHalf.calculation.combine = 'max';
  const td = data.pricing.takeoutDiscount;
  if (td) {
    if (num(set['포장할인 미디엄']) != null) td.amount.M = num(set['포장할인 미디엄']);
    if (num(set['포장할인 라지']) != null) td.amount.L = num(set['포장할인 라지']);
  }
  if (s(set['돼지고기 키워드'])) data.diet.pork.keywords = list(set['돼지고기 키워드']);

  // --- 메뉴 ---
  const cats = data.menu.categories;
  const catIdByName = (name) => {
    let c = cats.find((x) => x.name === name);
    if (!c) { c = { id: `cat-${cats.length + 1}`, name, order: cats.length + 1 }; cats.push(c); }
    return c.id;
  };
  const seen = new Set();
  for (const r of table(tabs.menu)) {
    const id = s(r[0]);
    const name = s(r[2]);
    if (!id || !name) continue;
    seen.add(id);
    let item = data.menu.items.find((i) => i.id === id);
    const catName = s(r[1]);
    if (!item) {
      const type = TYPE_BY_CAT[catName] || 'side';
      item = {
        id, category: catIdByName(catName), type, name, aliases: [], image: { sourceUrl: null },
        sizes: [], optionGroupIds: type === 'pizza' ? ['crust', 'topping-add'] : [], notes: [],
        visible: true, soldOut: false,
      };
      data.menu.items.push(item);
    } else if (catName) {
      item.category = catIdByName(catName);
    }
    item.name = name;
    item.description = s(r[3]) || null;
    const ing = list(r[4]);
    if (ing.length) item.ingredients = ing; else if (item.ingredientsStatus !== 'derived') delete item.ingredients;
    for (const [sid, col] of SIZE_COLS) {
      const p = num(r[col]);
      const ex = item.sizes.find((z) => z.id === sid);
      if (p == null) { if (ex) item.sizes = item.sizes.filter((z) => z.id !== sid); continue; }
      if (ex) { ex.price = p; ex.status = 'user_confirmed'; } else item.sizes.push({ id: sid, price: p, status: 'user_confirmed' });
    }
    item.visible = bool(r[10], true);
    item.soldOut = bool(r[11], false);
    if (num(r[12]) != null) item.order = num(r[12]);
    addTr(name, r.slice(13, 17));
    addTr(item.description, r.slice(17, 21));
    // 재료: 문자열 전체 번역을 재료 개수가 맞으면 하나씩 나눠서 연결
    if (ing.length) {
      const parts = LANGS.map((_, i) => s(r[21 + i]).split(',').map((x) => x.trim()));
      ing.forEach((k, j) => addTr(k, LANGS.map((_, i) => (parts[i].length === ing.length ? parts[i][j] : ''))));
    }
  }
  for (const it of data.menu.items) if (!seen.has(it.id)) it.visible = false;
  data.menu.items.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  cats.sort((a, b) => a.order - b.order);

  // --- 반반 ---
  const nameOf = (id) => data.menu.items.find((i) => i.id === id)?.name || id;
  const flav = data.halfHalf.flavors;
  const seenF = new Set();
  for (const r of table(tabs.half)) {
    const id = s(r[0]);
    if (!id || !data.menu.items.some((i) => i.id === id)) continue;
    seenF.add(id);
    const sur = num(r[3]) ?? 0;
    let f = flav.find((x) => x.itemId === id);
    if (!f) { f = { itemId: id, name: nameOf(id), eligible: true, surcharge: { M: 0, L: 0 } }; flav.push(f); }
    f.name = nameOf(id);
    f.eligible = bool(r[2], true);
    f.surcharge = { M: sur, L: sur };
    f.status = 'user_confirmed';
  }
  for (const f of flav) if (!seenF.has(f.itemId)) f.eligible = false;

  // --- 옵션 ---
  const groups = data.options.optionGroups;
  const optRows = table(tabs.options);
  if (optRows.length) {
    const keep = new Set();
    for (const r of optRows) {
      const id = s(r[0]);
      if (!id || !s(r[2])) continue;
      keep.add(id);
      const gname = s(r[1]);
      let g = groups.find((x) => x.name === gname);
      if (!g) { g = { id: `grp-${groups.length + 1}`, name: gname, type: 'multi-quantity', required: false, choices: [] }; groups.push(g); }
      let c = groups.flatMap((x) => x.choices).find((x) => x.id === id);
      if (!c) { c = { id }; g.choices.push(c); }
      c.name = s(r[2]);
      c.unit = s(r[3]) || undefined;
      c.description = s(r[4]) || undefined;
      c.price = num(r[5]) ?? 0;
      c.soldOut = bool(r[6], false);
      c.order = num(r[7]) ?? 999;
      c.status = 'user_confirmed';
      addTr(c.name, r.slice(8, 12));
      addTr(c.unit, r.slice(12, 16));
      addTr(c.description, r.slice(16, 20));
    }
    for (const g of groups) {
      g.choices = g.choices.filter((c) => keep.has(c.id));
      g.choices.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    }
    data.options.optionGroups = groups.filter((g) => g.choices.length);
  }

  // --- 번역사전 (분류명 등 시트에 직접 안 쓰이는 문구) ---
  for (const r of table(tabs.dict)) addTr(r[0], r.slice(1, 5));

  data.index = buildIndex(data);
  return { data, content };
}
