import { h } from '../../shared/lib/dom.js';
import { t, tx, money, sizeText } from '../../shared/lib/i18n.js';
import { halfHalfFlavors, flavorSurcharge, isOrderable, priceLine, lineIssues } from '../../shared/lib/price.js';
import { addLine } from '../../shared/lib/cart.js';
import { stepper } from '../components/stepper.js';
import { dietAllows } from '../../shared/lib/diet.js';
import { thumb } from '../components/thumb.js';
import { optionPicker } from '../components/options.js';
import { breakdownTable } from '../components/breakdown.js';

export function halfHalfPage(ctx) {
  const { data } = ctx;
  const item = data.index.items['half-half'];
  if (!item || item.visible === false) return h('div', { class: 'page empty' }, t('hh.unavailable'), h('a', { href: '#/' }, t('app.toMenu')));
  const sizes = ['M', 'L'].filter((s) => Number.isFinite(data.halfHalf.basePrice?.[s]));
  const sel = { size: sizes[0], qty: 1, flavors: [], options: { crust: null, toppings: {} } };
  const flavors = halfHalfFlavors(data).filter(({ item: fi }) => dietAllows(data, fi));

  const sizeBox = h('div', { class: 'seg' });
  const flavorBox = h('div', { class: 'flavors' });
  const priceBox = h('div');
  const addBtn = h('button', { type: 'button', class: 'btn primary block' });
  const guide = h('p', { class: 'hint' });

  const refresh = () => {
    sizeBox.replaceChildren(...sizes.map((s) => h('button', {
      type: 'button', class: `seg-btn${s === sel.size ? ' is-active' : ''}`,
      onclick: () => { sel.size = s; refresh(); },
    }, sizeText(s), h('small', null, `${money(data.halfHalf.basePrice[s])}~`))));

    flavorBox.replaceChildren(...flavors.map(({ item: fi }) => {
      const on = sel.flavors.includes(fi.id);
      const sold = !isOrderable(fi);
      const sur = flavorSurcharge(data, fi.id, sel.size);
      return h('label', { class: `opt-row${sold ? ' is-soldout' : ''}` },
        h('input', {
          type: 'checkbox', checked: on, disabled: sold || (!on && sel.flavors.length >= 2),
          onchange: (e) => {
            sel.flavors = e.target.checked ? [...sel.flavors, fi.id] : sel.flavors.filter((x) => x !== fi.id);
            refresh();
          },
        }),
        h('span', { class: 'opt-name' }, tx(fi.name)),
        h('span', { class: 'opt-price' }, sold ? t('menu.soldout') : sur ? `+${money(sur)}` : t('hh.noExtra')));
    }));

    guide.textContent = sel.flavors.length === 2 ? '' : t('hh.more', { n: 2 - sel.flavors.length });
    const line = { itemId: item.id, size: sel.size, qty: sel.qty, halfFlavors: sel.flavors, options: sel.options };
    const p = priceLine(data, line);
    const ok = p.ok && !lineIssues(data, line).length && isOrderable(item);
    priceBox.replaceChildren(p.ok ? breakdownTable(data, p) : '');
    addBtn.disabled = !ok;
    addBtn.textContent = ok ? t('add.btn', { price: money(p.total) }) : t('hh.pickBtn');
  };

  addBtn.addEventListener('click', () => {
    addLine({ itemId: item.id, size: sel.size, qty: sel.qty, halfFlavors: [...sel.flavors], options: sel.options });
    ctx.toast(t('add.toast'));
    ctx.go('/');
  });

  const node = h('div', { class: 'page detail' },
    h('a', { class: 'back', href: '#/' }, t('back.menu')),
    thumb(item, 'thumb hero'),
    h('h1', null, tx(item.name)),
    item.description ? h('p', { class: 'menu-desc' }, tx(item.description)) : null,
    h('section', { class: 'section' }, h('h2', { class: 'section-title' }, t('size')), sizeBox),
    h('section', { class: 'section' }, h('h2', { class: 'section-title' }, t('hh.pick'), h('small', null, ` ${t('hh.two')}`)), flavorBox, guide),
    optionPicker(data, item, sel, refresh),
    h('section', { class: 'section row' }, h('h2', { class: 'section-title' }, t('qty')),
      stepper({ value: 1, min: 1, max: 20, onChange: (v) => { sel.qty = v; refresh(); } })),
    h('section', { class: 'section' }, priceBox),
    h('div', { class: 'action' }, addBtn),
  );
  refresh();
  return node;
}
