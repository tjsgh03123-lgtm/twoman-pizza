// 가격 계산 (순수 함수 - 화면·테스트가 같은 로직을 쓴다)
//
// 피자 1판 가격 = 기준가 + (반반이면 두 맛 추가금) + 크러스트 + 토핑
// 포장 할인    = 주문 전체에서 1회. 담긴 피자 중 가장 큰 크기 기준 L 3,000원 / M 1,500원 (pricing-rules.json)
// 한 줄 합계   = 1판 가격 x 수량 (할인은 줄이 아니라 주문 단위)
// 주문 합계    = 모든 줄 합계 - 포장 할인 + 소스·피클

import { sizeLabel, won } from './format.js';

const PRICED = new Set(['hq_listed', 'user_confirmed']);

// 가격이 확정된 크기인가 (확인 필요 값은 판매하지 않는다)
export const isPriced = (size) => !!size && Number.isFinite(size.price) && PRICED.has(size.status);

export const findSize = (item, sizeId) => item.sizes.find((s) => s.id === sizeId);

export const isOrderable = (item) => !!item && item.visible !== false && !item.soldOut;

// ---------------------------------------------------------------- 반반피자
export function halfHalfFlavors(data) {
  return data.halfHalf.flavors
    .map((f) => ({ flavor: f, item: data.index.items[f.itemId] }))
    .filter(({ flavor, item }) => flavor.eligible && item && item.visible !== false);
}

export function flavorSurcharge(data, itemId, size) {
  const f = data.halfHalf.flavors.find((x) => x.itemId === itemId);
  const v = f?.surcharge?.[size];
  return Number.isFinite(v) ? v : null;
}

export function combineSurcharges(rule, a, b) {
  return rule === 'max' ? Math.max(a, b) : a + b;
}

// ---------------------------------------------------------------- 옵션
export function allowedGroups(data, item) {
  return (item.optionGroupIds || []).map((id) => data.index.groups[id]).filter(Boolean);
}

// options: { crust: choiceId | null, toppings: { [choiceId]: qty } }
export function optionsPrice(data, item, options) {
  const opt = options || {};
  const allowed = new Set((item.optionGroupIds || []));
  let total = 0;
  if (opt.crust) {
    const c = data.index.choices[opt.crust];
    if (!c || c.groupId !== 'crust' || !allowed.has('crust')) throw new Error(`사용할 수 없는 크러스트: ${opt.crust}`);
    total += c.price;
  }
  for (const [id, qty] of Object.entries(opt.toppings || {})) {
    if (!qty) continue;
    const c = data.index.choices[id];
    if (!c || c.groupId !== 'topping-add' || !allowed.has('topping-add')) throw new Error(`사용할 수 없는 토핑: ${id}`);
    total += c.price * qty;
  }
  return total;
}

// ---------------------------------------------------------------- 포장 할인
export function takeoutDiscount(data, item, sizeId) {
  const d = data.pricing.takeoutDiscount;
  if (!d) return 0;
  const applies = d.appliesToTypes.includes(item.type) || d.appliesToItemIds.includes(item.id);
  return applies ? d.amount?.[sizeId] || 0 : 0;
}

// ---------------------------------------------------------------- 한 줄 계산
// line: { itemId, size, qty, halfFlavors?: [idA, idB], options? }
export function priceLine(data, line) {
  const item = data.index.items[line.itemId];
  if (!item) return { ok: false, reason: '메뉴를 찾을 수 없습니다' };
  const qty = Number.isInteger(line.qty) && line.qty > 0 ? line.qty : 0;
  if (!qty) return { ok: false, reason: '수량이 올바르지 않습니다' };

  let base;
  let extra = 0;
  let extraParts = [];

  if (item.type === 'half-half') {
    const [a, b] = line.halfFlavors || [];
    if (!a || !b || a === b) return { ok: false, reason: '서로 다른 맛 2가지를 골라 주세요' };
    base = data.halfHalf.basePrice?.[line.size];
    if (!Number.isFinite(base)) return { ok: false, reason: '선택할 수 없는 크기입니다' };
    const sa = flavorSurcharge(data, a, line.size);
    const sb = flavorSurcharge(data, b, line.size);
    if (sa == null || sb == null) return { ok: false, reason: '맛 추가금이 확인되지 않았습니다' };
    extra = combineSurcharges(data.halfHalf.calculation.combine, sa, sb);
    extraParts = [
      { itemId: a, amount: sa },
      { itemId: b, amount: sb },
    ];
  } else {
    const size = findSize(item, line.size);
    if (!isPriced(size)) return { ok: false, reason: '가격이 확인되지 않은 메뉴입니다' };
    base = size.price;
  }

  let optionTotal;
  try {
    optionTotal = optionsPrice(data, item, line.options);
  } catch (e) {
    return { ok: false, reason: e.message };
  }

  const unit = base + extra + optionTotal;
  // 할인은 주문 단위(cartTotals)에서 한 번만 적용한다. 여기서는 이 줄이 받을 수 있는 금액만 알려 준다.
  const eligible = Math.min(takeoutDiscount(data, item, line.size), unit);
  return {
    ok: true,
    base,
    extra,
    extraParts,
    optionsPrice: optionTotal,
    unit,
    eligibleDiscount: eligible,
    qty,
    gross: unit * qty,
    total: unit * qty,
  };
}

// 주문할 수 없는 사유 (품절·숨김 등). 비어 있으면 주문 가능.
export function lineIssues(data, line) {
  const issues = [];
  const item = data.index.items[line.itemId];
  if (!item) return ['판매하지 않는 메뉴입니다'];
  if (!isOrderable(item)) issues.push(`${item.name}: 품절 또는 판매 중지`);
  for (const id of line.halfFlavors || []) {
    const fi = data.index.items[id];
    if (!fi || !isOrderable(fi)) issues.push(`${fi ? fi.name : id}: 품절 또는 판매 중지`);
  }
  const chosen = [line.options?.crust, ...Object.keys(line.options?.toppings || {})].filter(Boolean);
  for (const id of chosen) {
    const c = data.index.choices[id];
    if (!c || c.soldOut) issues.push(`${c ? c.name : id}: 품절`);
  }
  return issues;
}

// ---------------------------------------------------------------- 표시용 설명
// tr: 표시 도구. 기본은 한국어(주문 기록·관리자용). 고객 화면은 i18n의 lineTr()를 넘긴다.
const KO = {
  name: (s) => s,
  size: sizeLabel,
  money: won,
  half: (names) => `반반피자 (${names.join(' + ')})`,
  crust: (name, price) => `크러스트: ${name} (+${price})`,
  topping: (name, unit, qty, price) => `토핑: ${name}${unit} x${qty} (+${price})`,
};

export function describeLine(data, line, tr = KO) {
  const item = data.index.items[line.itemId];
  const nameOf = (id) => tr.name(data.index.items[id]?.name ?? id);
  const title =
    item.type === 'half-half' ? tr.half((line.halfFlavors || []).map(nameOf)) : tr.name(item.name);
  const sub = [];
  const label = tr.size(line.size);
  if (label) sub.push(label);
  if (line.options?.crust) {
    const c = data.index.choices[line.options.crust];
    sub.push(tr.crust(tr.name(c.name), tr.money(c.price)));
  }
  for (const [id, qty] of Object.entries(line.options?.toppings || {})) {
    if (!qty) continue;
    const c = data.index.choices[id];
    const unit = c.unit ? ` ${tr.name(c.unit)}` : '';
    sub.push(tr.topping(tr.name(c.name), unit, qty, tr.money(c.price * qty)));
  }
  return { title, sub };
}

// ---------------------------------------------------------------- 장바구니 합계
// cart: { lines: [...], sauces: { [choiceId]: qty } }
export function cartTotals(data, cart) {
  const lines = cart.lines.map((line) => ({
    line,
    price: priceLine(data, line),
    issues: lineIssues(data, line),
  }));
  const sauces = Object.entries(cart.sauces || {})
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => {
      const choice = data.index.choices[id];
      return {
        id,
        qty,
        choice,
        total: choice ? choice.price * qty : 0,
        issue: !choice || choice.soldOut ? `${choice ? choice.name : id}: 품절` : null,
      };
    });

  const okLines = lines.filter((l) => l.price.ok);
  const gross = okLines.reduce((s, l) => s + l.price.gross, 0);
  // 포장 할인: 한 주문에 1회, 할인 대상 피자 중 가장 큰 금액
  const discount = Math.min(gross, Math.max(0, ...okLines.map((l) => l.price.eligibleDiscount)));
  const sauceTotal = sauces.reduce((s, x) => s + x.total, 0);
  const problems = [
    ...lines.filter((l) => !l.price.ok).map((l) => l.price.reason),
    ...lines.flatMap((l) => l.issues),
    ...sauces.filter((x) => x.issue).map((x) => x.issue),
  ];
  return {
    lines,
    sauces,
    gross,
    discount,
    sauceTotal,
    total: gross - discount + sauceTotal,
    problems,
    canOrder: lines.length > 0 && problems.length === 0,
  };
}
