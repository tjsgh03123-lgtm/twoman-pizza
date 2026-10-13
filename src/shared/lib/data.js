// 데이터 로더. 화면은 이 파일만 거쳐 데이터를 읽는다 (나중에 API로 바꿀 때 이 파일만 교체).
//
//   data/*.json (원본)  +  관리자 수정값(localStorage, overrides)  =  화면이 쓰는 data
//
// overrides 구조
// {
//   items:    { [itemId]:   { visible?, soldOut?, prices?: { [sizeId]: number } } },
//   choices:  { [choiceId]: { price?, soldOut? } },
//   halfHalf: { base?: { M?, L? }, surcharge?: { [itemId]: number }, combine?: 'sum' | 'max' }
// }

import { KEYS, load } from './storage.js';

const FILES = ['menu', 'options', 'half-half-rules', 'pricing-rules', 'diet-rules'];

const clone = (v) => JSON.parse(JSON.stringify(v));

export async function loadRaw(base) {
  const parts = await Promise.all(
    FILES.map(async (name) => {
      const res = await fetch(`${base}${name}.json`);
      if (!res.ok) throw new Error(`${name}.json 을(를) 불러오지 못했습니다 (${res.status})`);
      return res.json();
    }),
  );
  return { menu: parts[0], options: parts[1], halfHalf: parts[2], pricing: parts[3], diet: parts[4] };
}

export function buildIndex(data) {
  const items = {};
  for (const it of data.menu.items) items[it.id] = it;
  const groups = {};
  const choices = {};
  for (const g of data.options.optionGroups) {
    groups[g.id] = g;
    for (const c of g.choices) choices[c.id] = { ...c, groupId: g.id };
  }
  return { items, groups, choices };
}

export function applyOverrides(raw, overrides) {
  const data = clone(raw);
  const ov = overrides || {};

  for (const [id, o] of Object.entries(ov.items || {})) {
    const item = data.menu.items.find((i) => i.id === id);
    if (!item) continue;
    if (typeof o.visible === 'boolean') item.visible = o.visible;
    if (typeof o.soldOut === 'boolean') item.soldOut = o.soldOut;
    for (const [sizeId, price] of Object.entries(o.prices || {})) {
      const size = item.sizes.find((s) => s.id === sizeId);
      if (size && Number.isFinite(price)) {
        size.price = price;
        size.status = 'user_confirmed';
      }
    }
  }

  for (const g of data.options.optionGroups) {
    for (const c of g.choices) {
      const o = (ov.choices || {})[c.id];
      if (!o) continue;
      if (Number.isFinite(o.price)) c.price = o.price;
      if (typeof o.soldOut === 'boolean') c.soldOut = o.soldOut;
    }
  }

  const hh = ov.halfHalf || {};
  for (const size of ['M', 'L']) {
    const v = hh.base?.[size];
    if (Number.isFinite(v)) data.halfHalf.basePrice[size] = v;
  }
  for (const f of data.halfHalf.flavors) {
    const v = (hh.surcharge || {})[f.itemId];
    if (Number.isFinite(v)) {
      f.surcharge = { M: v, L: v };
      f.status = 'user_confirmed';
    }
  }
  if (hh.combine === 'sum' || hh.combine === 'max') data.halfHalf.calculation.combine = hh.combine;

  data.index = buildIndex(data);
  return data;
}

export async function loadData(base) {
  const raw = await loadRaw(base);
  return applyOverrides(raw, load(KEYS.overrides, {}));
}
