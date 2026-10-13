import { h } from '../../shared/lib/dom.js';
import { t, tx, money, sizeText, tReason } from '../../shared/lib/i18n.js';
import { isPriced, isOrderable, priceLine, lineIssues, allowedGroups } from '../../shared/lib/price.js';
import { addLine } from '../../shared/lib/cart.js';
import { stepper } from '../components/stepper.js';
import { dietAllows } from '../../shared/lib/diet.js';
import { thumb } from '../components/thumb.js';
import { optionPicker } from '../components/options.js';
import { breakdownTable } from '../components/breakdown.js';

export function itemPage(ctx, { id }) {
  const { data } = ctx;
  const item = data.index.items[id];
  if (!item || item.visible === false || item.type === 'half-half' || !dietAllows(data, item)) {
    return h('div', { class: 'page empty' }, t('item.none'), h('a', { href: '#/' }, t('item.back')));
  }
  const sizes = item.sizes.filter(isPriced);
  const sel = { size: sizes[0]?.id, qty: 1, options: { crust: null, toppings: {} } };
  const hasOptions = allowedGroups(data, item).some((g) => g.scope !== 'order');

  const sizeBox = h('div', { class: 'seg' });
  const optBox = h('div');
  const priceBox = h('div');
  const addBtn = h('button', { type: 'button', class: 'btn primary block' });

  const refresh = () => {
    const line = { itemId: item.id, size: sel.size, qty: sel.qty, options: sel.options };
    const p = priceLine(data, line);
    const issues = lineIssues(data, line);
    const ok = p.ok && !issues.length && isOrderable(item);
    priceBox.replaceChildren(p.ok ? breakdownTable(data, p) : h('p', { class: 'hint' }, p.reason ? tReason(p.reason) : ''));
    addBtn.disabled = !ok;
    addBtn.textContent = ok ? t('add.btn', { price: money(p.total) }) : t('add.cant');
    sizeBox.replaceChildren(
      ...sizes.map((s) =>
        h('button', {
          type: 'button', class: `seg-btn${s.id === sel.size ? ' is-active' : ''}`,
          onclick: () => { sel.size = s.id; refresh(); },
        }, sizeText(s.id) || t('basic'), h('small', null, money(s.price))),
      ),
    );
  };

  addBtn.addEventListener('click', () => {
    addLine({ itemId: item.id, size: sel.size, qty: sel.qty, options: sel.options });
    ctx.toast(t('add.toast'));
    ctx.go('/');
  });

  if (hasOptions) optBox.append(optionPicker(data, item, sel, refresh));
  const showSizes = sizes.length > 1 || (sizes[0] && sizes[0].id !== 'DEFAULT');

  const node = h('div', { class: 'page detail' },
    h('a', { class: 'back', href: '#/' }, t('back.menu')),
    thumb(item, 'thumb hero'),
    h('h1', null, tx(item.name)),
    item.description && item.descriptionStatus !== 'needs_check' ? h('p', { class: 'menu-desc' }, tx(item.description)) : null,
    item.ingredients?.length ? h('p', { class: 'menu-ing' }, t('menu.ingredients', { list: item.ingredients.map(tx).join(', ') })) : null,
    showSizes ? h('section', { class: 'section' }, h('h2', { class: 'section-title' }, t('size')), sizeBox) : null,
    optBox,
    h('section', { class: 'section row' }, h('h2', { class: 'section-title' }, t('qty')),
      stepper({ value: 1, min: 1, max: 20, onChange: (v) => { sel.qty = v; refresh(); } })),
    h('section', { class: 'section' }, priceBox),
    h('div', { class: 'action' }, addBtn),
  );
  refresh();
  return node;
}
