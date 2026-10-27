// 가격 계산·주문·데이터 무결성 테스트:  node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { applyOverrides } from '../src/shared/lib/data.js';
import { priceLine, cartTotals, lineIssues, describeLine, isPriced } from '../src/shared/lib/price.js';
import { addLine, getCart, setLineQty, setSauce, clearCart, lineSignature } from '../src/shared/lib/cart.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const read = (n) => JSON.parse(readFileSync(join(root, `${n}.json`), 'utf8'));
const raw = () => ({
  menu: read('menu'),
  options: read('options'),
  halfHalf: read('half-half-rules'),
  pricing: read('pricing-rules'),
});
const fresh = (ov = {}) => applyOverrides(raw(), ov);

const ID = {
  waterfall: 'pizza-cheese-waterfall',
  pepperoni: 'pizza-pepperoni-bomb',
  bulgogi: 'pizza-bulgogi-bomb',
  diabulsae: 'pizza-diabulsae',
};

test('일반 피자: 크기별 가격과 할인 대상 금액', () => {
  const d = fresh();
  const l = priceLine(d, { itemId: ID.waterfall, size: 'L', qty: 1 });
  assert.equal(l.unit, 23900);
  assert.equal(l.eligibleDiscount, 3000);
  assert.equal(l.total, 23900); // 줄 단위에서는 할인하지 않음
  const m = priceLine(d, { itemId: ID.pepperoni, size: 'M', qty: 1 });
  assert.equal(m.unit, 20900);
  assert.equal(m.eligibleDiscount, 1500);
});

test('포장 할인은 한 주문에 1회만 (여러 판·여러 줄이어도)', () => {
  const d = fresh();
  const line = (id, itemId, size, qty) => ({ id, itemId, size, qty });
  // L 3판 -> 3,000원만
  let t = cartTotals(d, { lines: [line('a', ID.pepperoni, 'L', 3)], sauces: {} });
  assert.equal(t.gross, 24900 * 3);
  assert.equal(t.discount, 3000);
  assert.equal(t.total, 24900 * 3 - 3000);
  // M 2판 -> 1,500원만
  t = cartTotals(d, { lines: [line('a', ID.pepperoni, 'M', 2)], sauces: {} });
  assert.equal(t.discount, 1500);
  // M + L 섞이면 가장 큰 3,000원 1회
  t = cartTotals(d, { lines: [line('a', ID.pepperoni, 'M', 1), line('b', ID.waterfall, 'L', 1)], sauces: {} });
  assert.equal(t.discount, 3000);
  // 피자가 없으면 할인 없음
  t = cartTotals(d, { lines: [line('a', 'drink-cola', '500ml', 2)], sauces: {} });
  assert.equal(t.discount, 0);
});

test('반반피자: 두 맛 추가금 합산 (L)', () => {
  const r = priceLine(fresh(), { itemId: 'half-half', size: 'L', halfFlavors: [ID.bulgogi, ID.diabulsae], qty: 1 });
  assert.equal(r.base, 24900);
  assert.equal(r.extra, 6000); // 불고기 2,000 + 디아불새 4,000
  assert.equal(r.unit, 30900);
  assert.equal(r.total, 30900);
});

test('반반피자: 폭포수 치즈는 추가금 0원 (M)', () => {
  const r = priceLine(fresh(), { itemId: 'half-half', size: 'M', halfFlavors: [ID.waterfall, ID.pepperoni], qty: 1 });
  assert.equal(r.extra, 1000);
  assert.equal(r.unit, 21900);
  assert.equal(r.total, 21900);
});

test('반반피자: 합산 방식 max 로 바꾸면 큰 값만', () => {
  const d = fresh({ halfHalf: { combine: 'max' } });
  const r = priceLine(d, { itemId: 'half-half', size: 'L', halfFlavors: [ID.bulgogi, ID.diabulsae], qty: 1 });
  assert.equal(r.extra, 4000);
});

test('반반피자: 같은 맛 두 번 / 맛 1개는 거부', () => {
  const d = fresh();
  assert.equal(priceLine(d, { itemId: 'half-half', size: 'L', halfFlavors: [ID.bulgogi, ID.bulgogi], qty: 1 }).ok, false);
  assert.equal(priceLine(d, { itemId: 'half-half', size: 'L', halfFlavors: [ID.bulgogi], qty: 1 }).ok, false);
});

test('시그니처는 L 전용, 포장 할인 3,000원', () => {
  const d = fresh();
  const r = priceLine(d, { itemId: 'signature-topping-bomb', size: 'L', qty: 1 });
  assert.equal(r.unit, 30900);
  assert.equal(r.total, 30900);
  assert.equal(priceLine(d, { itemId: 'signature-topping-bomb', size: 'M', qty: 1 }).ok, false);
});

test('크러스트 + 토핑은 1판당 더해진다', () => {
  const r = priceLine(fresh(), {
    itemId: ID.pepperoni,
    size: 'L',
    qty: 2,
    options: { crust: 'crust-cheese', toppings: { 'topping-cheese-100': 2, 'topping-corn': 1 } },
  });
  // 24,900 + 3,000 + 2,000x2 + 2,000 = 33,900 x2
  assert.equal(r.unit, 33900);
  assert.equal(r.total, 67800);
});

test('사이드·음료는 포장 할인 없음, 옵션 불가', () => {
  const d = fresh();
  const side = priceLine(d, { itemId: 'side-combi-cheese-oven-spaghetti', size: 'DEFAULT', qty: 1 });
  assert.equal(side.total, 6900);
  assert.equal(side.eligibleDiscount, 0);
  const drink = priceLine(d, { itemId: 'drink-cola', size: '500ml', qty: 2 });
  assert.equal(drink.total, 4000);
  const bad = priceLine(d, { itemId: 'side-french-fries', size: 'DEFAULT', qty: 1, options: { crust: 'crust-cheese' } });
  assert.equal(bad.ok, false);
});

test('장바구니 합계: 소스는 할인 제외', () => {
  const d = fresh();
  const cart = {
    lines: [{ id: 'a', itemId: ID.bulgogi, size: 'L', qty: 1 }],
    sauces: { 'sauce-ranch': 2, 'sauce-hot': 1 },
  };
  const t = cartTotals(d, cart);
  assert.equal(t.gross, 25900);
  assert.equal(t.discount, 3000);
  assert.equal(t.sauceTotal, 800 * 2 + 100);
  assert.equal(t.total, 25900 - 3000 + 1700);
  assert.equal(t.canOrder, true);
});

test('품절·숨김·품절 옵션이면 주문 불가', () => {
  const d = fresh({
    items: { [ID.pepperoni]: { soldOut: true }, [ID.bulgogi]: { visible: false } },
    choices: { 'crust-golden': { soldOut: true } },
  });
  assert.ok(lineIssues(d, { itemId: ID.pepperoni, size: 'L', qty: 1 }).length > 0);
  assert.ok(lineIssues(d, { itemId: ID.bulgogi, size: 'L', qty: 1 }).length > 0);
  assert.ok(lineIssues(d, { itemId: ID.waterfall, size: 'L', qty: 1, options: { crust: 'crust-golden' } }).length > 0);
  // 반반에 품절 맛이 들어가도 막힌다
  assert.ok(lineIssues(d, { itemId: 'half-half', size: 'L', halfFlavors: [ID.pepperoni, ID.waterfall], qty: 1 }).length > 0);
  assert.equal(cartTotals(d, { lines: [{ id: 'x', itemId: ID.pepperoni, size: 'L', qty: 1 }], sauces: {} }).canOrder, false);
});

test('관리자 수정값(overrides): 가격·추가금·옵션 가격 반영', () => {
  const d = fresh({
    items: { [ID.waterfall]: { prices: { L: 25000 } } },
    halfHalf: { base: { L: 25000 }, surcharge: { [ID.diabulsae]: 5000 } },
    choices: { 'sauce-ranch': { price: 1000 } },
  });
  assert.equal(priceLine(d, { itemId: ID.waterfall, size: 'L', qty: 1 }).unit, 25000);
  const hh = priceLine(d, { itemId: 'half-half', size: 'L', halfFlavors: [ID.waterfall, ID.diabulsae], qty: 1 });
  assert.equal(hh.base, 25000);
  assert.equal(hh.extra, 5000); // 폭포수 0 + 디아불새 5,000
  assert.equal(cartTotals(d, { lines: [], sauces: { 'sauce-ranch': 1 } }).sauceTotal, 1000);
});

test('가격 미확정(확인 필요) 값은 판매하지 않는다', () => {
  const d = fresh();
  assert.equal(isPriced({ price: null, status: 'needs_check' }), false);
  assert.equal(isPriced({ price: 1000, status: 'reference' }), false);
  assert.equal(isPriced({ price: 1000, status: 'conflict' }), false);
  assert.equal(isPriced({ price: 1000, status: 'user_confirmed' }), true);
  d.index.items[ID.pepperoni].sizes[1].status = 'needs_check';
  assert.equal(priceLine(d, { itemId: ID.pepperoni, size: 'L', qty: 1 }).ok, false);
});

test('장바구니: 같은 구성은 합치고, 수량 0이면 삭제', () => {
  clearCart();
  const line = { itemId: ID.pepperoni, size: 'L', qty: 1, options: { crust: null, toppings: { 'topping-corn': 1 } } };
  addLine(line);
  addLine({ ...line, qty: 2 });
  addLine({ ...line, options: { crust: null, toppings: {} } });
  let cart = getCart();
  assert.equal(cart.lines.length, 2);
  assert.equal(cart.lines[0].qty, 3);
  setSauce('sauce-pickle', 2);
  assert.equal(getCart().sauces['sauce-pickle'], 2);
  setSauce('sauce-pickle', 0);
  assert.equal('sauce-pickle' in getCart().sauces, false);
  setLineQty(cart.lines[0].id, 0);
  assert.equal(getCart().lines.length, 1);
  assert.equal(
    lineSignature({ itemId: 'half-half', size: 'L', halfFlavors: ['b', 'a'] }),
    lineSignature({ itemId: 'half-half', size: 'L', halfFlavors: ['a', 'b'] }),
    '반반 맛 순서가 달라도 같은 구성',
  );
  clearCart();
});

test('장바구니 합계·직원 확인용 설명', () => {
  const d = fresh();
  const cart = {
    lines: [
      { id: '1', itemId: 'half-half', size: 'M', halfFlavors: [ID.bulgogi, ID.diabulsae], qty: 1, options: { crust: 'crust-sweet-potato' } },
    ],
    sauces: { 'sauce-parmesan': 1 },
  };
  const t = cartTotals(d, cart);
  // M 반반: 20,900 + 6,000 + 고구마 크러스트 3,000 = 29,900 - 1,500 = 28,400, 소스 300
  assert.equal(t.total, 28400 + 300);
  assert.equal(t.canOrder, true);
  assert.equal(describeLine(d, cart.lines[0]).title, '반반피자 (불향가득 리얼 불고기 폭탄 + 디아불새)');
  const sold = fresh({ items: { [ID.bulgogi]: { soldOut: true } } });
  const ts = cartTotals(sold, cart);
  assert.equal(ts.canOrder, false);
  assert.match(ts.problems[0], /품절/);
  assert.equal(cartTotals(d, { lines: [], sauces: {} }).canOrder, false);
});

test('설명 문구', () => {
  const d = fresh();
  const x = describeLine(d, {
    itemId: ID.pepperoni,
    size: 'L',
    qty: 1,
    options: { crust: 'crust-cheese', toppings: { 'topping-cheese-100': 2 } },
  });
  assert.equal(x.title, '페퍼로니 폭탄');
  assert.deepEqual(x.sub, ['라지(L)', '크러스트: 치즈 크러스트 (+3,000원)', '토핑: 치즈 추가 100g x2 (+4,000원)']);
});

test('데이터 무결성', () => {
  const d = fresh();
  const ids = d.menu.items.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length, '메뉴 ID 중복');
  assert.equal(d.menu.items.length, 28);
  // 판매 가격은 모두 확정 상태
  for (const it of d.menu.items) {
    for (const s of it.sizes) {
      if (s.price != null) assert.ok(isPriced(s), `${it.id}/${s.id} 가격 상태 ${s.status}`);
    }
  }
  // 옵션 그룹 참조
  for (const it of d.menu.items) for (const g of it.optionGroupIds) assert.ok(d.index.groups[g], `${it.id} -> ${g}`);
  // 반반 맛은 실제 메뉴를 가리키고 추가금이 모두 숫자
  for (const f of d.halfHalf.flavors) {
    assert.ok(d.index.items[f.itemId], f.itemId);
    assert.ok(Number.isFinite(f.surcharge.M) && f.surcharge.M === f.surcharge.L, `${f.itemId} 추가금`);
  }
  // 포장 전용 / 매장 정보 없음
  assert.equal(d.pricing.orderType, 'takeout-only');
  assert.equal(JSON.stringify(d).includes('naver.me'), false);
  assert.equal(JSON.stringify(d).includes('중부대로'), false);
  // 세트·옛날 떡볶이는 없다
  assert.equal(ids.some((i) => i.startsWith('set-') || i.includes('tteokbokki')), false);
});
