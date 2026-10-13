import { h } from '../../shared/lib/dom.js';
import { won } from '../../shared/lib/format.js';
import { getCart } from '../../shared/lib/cart.js';
import { cartTotals, describeLine } from '../../shared/lib/price.js';
import { t, tx, money, lineTr, getLang, languages } from '../../shared/lib/i18n.js';
import { form } from '../form.js';

// 직원에게 보여주는 확인 화면.
// 직원은 한국어를 읽으므로 한국어를 크게, 손님이 고른 언어를 아래에 작게 함께 보여 준다.
export function showPage(ctx) {
  const { data } = ctx;
  const cart = getCart();
  const tot = cartTotals(data, cart);
  if (!cart.lines.length || !tot.canOrder) {
    return h('div', { class: 'page empty' }, t('cart.empty'), h('a', { class: 'btn', href: '#/cart' }, t('show.back')));
  }
  const dir = languages().find((l) => l.id === getLang())?.dir || 'ltr';
  const foreign = getLang() && getLang() !== 'ko';
  const now = new Date();
  const time = `${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const lines = tot.lines.map(({ line, price }) => {
    const ko = describeLine(data, line);
    const my = foreign ? describeLine(data, line, lineTr()) : null;
    return h('li', { class: 'show-line' },
      h('div', { class: 'show-qty' }, `${line.qty}`),
      h('div', { class: 'show-main' },
        h('strong', { class: 'show-ko' }, ko.title),
        ko.sub.map((s) => h('p', { class: 'show-sub', lang: 'ko' }, s)),
        my ? h('div', { class: 'show-my', dir, lang: getLang() }, h('p', null, my.title), my.sub.map((s) => h('p', null, s))) : null),
      h('div', { class: 'show-price' }, won(price.total)));
  });

  const sauces = tot.sauces.map((s) => h('li', { class: 'show-line' },
    h('div', { class: 'show-qty' }, `${s.qty}`),
    h('div', { class: 'show-main' }, h('strong', { class: 'show-ko' }, s.choice.name + (s.choice.unit ? ` ${s.choice.unit}` : '')),
      foreign ? h('div', { class: 'show-my', dir, lang: getLang() }, h('p', null, tx(s.choice.name))) : null),
    h('div', { class: 'show-price' }, won(s.total))));

  return h('div', { class: 'page show' },
    h('a', { class: 'back', href: '#/cart' }, t('show.back')),
    h('section', { class: 'show-head' },
      h('p', { class: 'show-badge' }, '포장 주문'),
      h('h1', { lang: 'ko' }, '이 화면을 직원에게 보여주세요'),
      foreign ? h('p', { class: 'show-guide' }, t('show.title')) : null,
      h('p', { class: 'hint' }, t('show.sub')),
      h('p', { class: 'show-time' }, time, form.name ? ` · ${form.name}` : '')),
    h('ul', { class: 'show-list', dir: 'ltr' }, lines, sauces),
    form.note ? h('p', { class: 'show-note' }, h('strong', null, '요청사항 '), form.note) : null,
    h('dl', { class: 'breakdown show-total' },
      h('dt', null, '상품 금액'), h('dd', null, won(tot.gross)),
      tot.discount ? [h('dt', null, '포장 할인'), h('dd', { class: 'discount' }, `-${won(tot.discount)}`)] : null,
      tot.sauceTotal ? [h('dt', null, '소스·피클'), h('dd', null, won(tot.sauceTotal))] : null,
      h('dt', { class: 'total' }, '합계'), h('dd', { class: 'total' }, won(tot.total))),
    foreign ? h('p', { class: 'hint center' }, `${t('cart.total')}: ${money(tot.total)}`) : null,
    h('section', { class: 'show-confirm' },
      h('strong', { lang: 'ko' }, '주문 내용이 맞는지 확인해 주세요'),
      foreign ? h('p', { dir, lang: getLang() }, t('show.confirm')) : null));
}
