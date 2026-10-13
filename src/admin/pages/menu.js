import { h } from '../../shared/lib/dom.js';
import { won, sizeLabel } from '../../shared/lib/format.js';
import { patchItem, setItemPrice } from '../overrides.js';

export function menuAdminPage(ctx) {
  const { data } = ctx;
  const cats = [...data.menu.categories].sort((a, b) => a.order - b.order);
  return h('div', null, h('h1', null, '메뉴 관리'),
    h('p', { class: 'hint' }, '노출/품절 전환과 가격 수정은 바로 고객 화면에 반영됩니다. (이 브라우저 기준)'),
    cats.map((c) => h('section', { class: 'section' }, h('h2', { class: 'section-title' }, c.name),
      data.menu.items.filter((i) => i.category === c.id).sort((a, b) => a.order - b.order).map((item) =>
        h('div', { class: 'admin-item' },
          h('strong', null, item.name),
          h('div', { class: 'admin-flags' },
            check('노출', item.visible !== false, (v) => { patchItem(item.id, { visible: v }); ctx.reload(); }),
            check('품절', !!item.soldOut, (v) => { patchItem(item.id, { soldOut: v }); ctx.reload(); })),
          item.type === 'half-half'
            ? h('p', { class: 'sub' }, '가격은 「반반피자」 메뉴에서 수정')
            : item.sizes.map((s) => priceField(`${sizeLabel(s.id) || '기본'}`, s.price, (v) => { setItemPrice(item.id, s.id, v); ctx.reload(); }, s.status)))))));
}

export function check(label, on, onChange) {
  return h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: on, onchange: (e) => onChange(e.target.checked) }), label);
}

export function priceField(label, value, onSave, status) {
  const input = h('input', { class: 'input num', type: 'number', inputmode: 'numeric', min: '0', step: '100', value: value ?? '', placeholder: '미정' });
  input.addEventListener('change', () => {
    const v = Number(input.value);
    if (input.value === '' || !Number.isInteger(v) || v < 0) { input.value = value ?? ''; return; }
    onSave(v);
  });
  return h('label', { class: 'price-field' }, h('span', null, label, status && status !== 'hq_listed' && status !== 'user_confirmed' ? h('em', null, ' (확인필요)') : null), input, h('span', null, '원'));
}
void won;
