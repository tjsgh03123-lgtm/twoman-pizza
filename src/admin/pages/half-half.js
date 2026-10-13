import { h } from '../../shared/lib/dom.js';
import { setHalfBase, setHalfSurcharge, setHalfCombine } from '../overrides.js';
import { priceField } from './menu.js';

export function halfHalfAdminPage(ctx) {
  const { data } = ctx;
  const hh = data.halfHalf;
  const combine = h('select', { class: 'input', onchange: (e) => { setHalfCombine(e.target.value); ctx.reload(); } },
    h('option', { value: 'sum', selected: hh.calculation.combine === 'sum' }, '두 맛 추가금 합산'),
    h('option', { value: 'max', selected: hh.calculation.combine === 'max' }, '두 맛 중 큰 추가금만'));
  return h('div', null, h('h1', null, '반반피자 규칙'),
    h('section', { class: 'section' }, h('h2', { class: 'section-title' }, '기준 가격'),
      ['M', 'L'].map((s) => priceField(s === 'M' ? '미디엄' : '라지', hh.basePrice[s], (v) => { setHalfBase(s, v); ctx.reload(); }))),
    h('section', { class: 'section' }, h('h2', { class: 'section-title' }, '추가금 계산'), combine),
    h('section', { class: 'section' }, h('h2', { class: 'section-title' }, '맛별 추가금', h('small', null, ' M/L 동일')),
      hh.flavors.filter((f) => f.eligible).map((f) =>
        priceField(data.index.items[f.itemId]?.name ?? f.itemId, f.surcharge.M, (v) => { setHalfSurcharge(f.itemId, v); ctx.reload(); }))));
}
