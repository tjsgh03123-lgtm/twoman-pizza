import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applySheet, parseCsv } from '../src/shared/lib/sheet.js';
import { applyOverrides } from '../src/shared/lib/data.js';
import { cartTotals } from '../src/shared/lib/price.js';

const J = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const raw = () => applyOverrides({
  menu: J('../data/menu.json'), options: J('../data/options.json'), halfHalf: J('../data/half-half-rules.json'),
  pricing: J('../data/pricing-rules.json'), diet: J('../data/diet-rules.json'),
}, {});
const a = J('./fixtures/sheet_a.json');
const b = J('./fixtures/sheet_b.json');
const tabs = () => ({ menu: a.menu.map((r) => [...r]), dict: a.dict, options: b.opt.map((r) => [...r]), half: b.half.map((r) => [...r]), settings: b.set });

test('CSV 파서: 따옴표·쉼표·줄바꿈', () => {
  assert.deepEqual(parseCsv('a,"b,c","d ""x"""\n1,2,3\n'), [['a', 'b,c', 'd "x"'], ['1', '2', '3']]);
});

test('시트 값이 기본 데이터와 같으면 가격이 그대로', () => {
  const base = raw();
  const { data } = applySheet(base, tabs());
  for (const it of base.menu.items.filter((i) => i.visible)) {
    const n = data.menu.items.find((i) => i.id === it.id);
    assert.ok(n.visible, it.id);
    for (const sz of it.sizes) assert.equal(n.sizes.find((z) => z.id === sz.id)?.price, sz.price, `${it.id} ${sz.id}`);
  }
  assert.equal(data.halfHalf.basePrice.L, 24900);
  assert.equal(data.halfHalf.flavors.find((f) => f.itemId === 'pizza-diabulsae').surcharge.L, 4000);
  assert.equal(data.options.optionGroups.find((g) => g.id === 'crust').choices.length, 5);
});

test('시트에서 가격 수정·판매 FALSE·새 메뉴 추가가 반영', () => {
  const t = tabs();
  t.menu[2][5] = '21900'; t.menu[2][6] = '25900'; // 폭포수 치즈
  t.menu[3][10] = 'FALSE'; // 페퍼로니 폭탄 숨김
  t.menu.push(['side-new', '사이드', '마늘빵', '따뜻한 빵', '', '', '', '4900', '', '', 'TRUE', 'FALSE', '30', '', '', '', '', '', '', '', '', '', '', '', '']);
  t.settings[5][1] = '3500'; // 포장할인 라지
  const { data } = applySheet(raw(), t);
  const get = (id) => data.menu.items.find((i) => i.id === id);
  assert.equal(get('pizza-cheese-waterfall').sizes.find((z) => z.id === 'L').price, 25900);
  assert.equal(get('pizza-pepperoni-bomb').visible, false);
  assert.equal(get('side-new').name, '마늘빵');
  assert.equal(get('side-new').sizes[0].price, 4900);
  assert.equal(data.pricing.takeoutDiscount.amount.L, 3500);
});

test('번역 열이 content 로 연결', () => {
  const t = tabs();
  t.menu[2][13] = 'Waterfall Cheese';
  t.menu[1][21] = 'Mozzarella cheese, Pepperoni, Bacon, Cheddar cheese, Mayonnaise, Potato, Ranch sauce, Real bulgogi, Mushroom, Bulgogi sauce';
  const { content } = applySheet(raw(), t);
  assert.equal(content['폭포수 치즈'].en, 'Waterfall Cheese');
  assert.equal(content['베이컨'].en, 'Bacon');
});
