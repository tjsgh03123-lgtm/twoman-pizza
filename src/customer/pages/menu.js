import { h } from '../../shared/lib/dom.js';
import { t, tx, money, sizeText } from '../../shared/lib/i18n.js';
import { isPriced, isOrderable } from '../../shared/lib/price.js';
import { thumb } from '../components/thumb.js';
import { noPork, dietAllows } from '../../shared/lib/diet.js';

let activeCat = null; // 탭 선택 기억 (화면을 오가도 유지)

export function priceText(data, item) {
  if (item.type === 'half-half') {
    const b = data.halfHalf.basePrice;
    return ['M', 'L'].filter((s) => Number.isFinite(b?.[s])).map((s) => `${sizeText(s)} ${money(b[s])}~`).join(' · ');
  }
  const sizes = item.sizes.filter(isPriced);
  if (!sizes.length) return t('menu.pricing');
  if (sizes.length === 1 && sizes[0].id === 'DEFAULT') return money(sizes[0].price);
  return sizes.map((s) => `${sizeText(s.id)} ${money(s.price)}`).join(' · ');
}

export function menuPage(ctx) {
  const { data, go } = ctx;
  const cats = [...data.menu.categories].sort((a, b) => a.order - b.order);
  const visible = (c) => data.menu.items.filter((i) => i.category === c.id && i.visible !== false && dietAllows(data, i));
  const usable = cats.filter((c) => visible(c).length);
  if (!activeCat || !usable.some((c) => c.id === activeCat)) activeCat = usable[0]?.id;

  const list = h('ul', { class: 'menu-list' });
  const tabs = h('div', { class: 'tabs', role: 'tablist' });

  const render = () => {
    tabs.replaceChildren(
      ...usable.map((c) =>
        h('button', {
          type: 'button', role: 'tab', class: `tab${c.id === activeCat ? ' is-active' : ''}`,
          'aria-selected': c.id === activeCat ? 'true' : 'false',
          onclick: () => { activeCat = c.id; render(); },
        }, tx(c.name)),
      ),
    );
    const cat = usable.find((c) => c.id === activeCat);
    list.replaceChildren(
      ...visible(cat).sort((a, b) => a.order - b.order).map((item) => {
        const sold = !isOrderable(item);
        const unpriced = item.type !== 'half-half' && !item.sizes.some(isPriced);
        const disabled = sold || unpriced;
        const ing = item.ingredients?.length ? item.ingredients.map(tx).join(', ') : '';
        return h('li', null,
          h('a', {
            class: `menu-card${disabled ? ' is-disabled' : ''}`,
            href: item.type === 'half-half' ? '#/half-half' : `#/item/${item.id}`,
            onclick: (e) => {
              if (disabled) { e.preventDefault(); ctx.toast(sold ? t('menu.toastSold') : t('menu.toastPricing')); }
            },
          },
            thumb(item),
            h('div', { class: 'menu-body' },
              h('strong', { class: 'menu-name' }, tx(item.name), sold ? h('span', { class: 'badge' }, t('menu.soldout')) : null),
              item.description && item.descriptionStatus !== 'needs_check' ? h('p', { class: 'menu-desc' }, tx(item.description)) : null,
              ing ? h('p', { class: 'menu-ing' }, t('menu.ingredients', { list: ing })) : null,
              h('p', { class: 'menu-price' }, priceText(data, item)),
            ),
          ));
      }),
    );
  };
  render();
  void go;

  const chip = h('p', { class: 'diet-chip' }, noPork() ? t('diet.on') : t('diet.off'),
    h('button', { type: 'button', class: 'link', onclick: () => ctx.changeDiet() }, t('diet.change')));
  return h('div', { class: 'page' }, chip, tabs, list);
}
