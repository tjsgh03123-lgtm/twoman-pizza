import { h, mount } from '../../shared/lib/dom.js';
import { t as tr, tx, money, tReason, lineTr } from '../../shared/lib/i18n.js';
import { getCart, setLineQty, removeLine, setSauce, clearCart } from '../../shared/lib/cart.js';
import { cartTotals, describeLine } from '../../shared/lib/price.js';
import { form } from '../form.js';
import { stepper } from '../components/stepper.js';

export function cartPage(ctx) {
  const { data } = ctx;
  const root = h('div', { class: 'page' });
  const sauceGroups = (data.menu.orderOptionGroupIds || []).map((id) => data.index.groups[id]).filter(Boolean);

  const render = () => {
    const cart = getCart();
    const t = cartTotals(data, cart);
    if (!cart.lines.length) {
      mount(root, h('h1', null, tr('cart.title')), h('div', { class: 'empty' }, tr('cart.empty'), h('a', { class: 'btn', href: '#/' }, tr('cart.goMenu'))));
      return;
    }
    const lines = t.lines.map(({ line, price, issues }) => {
      const d = describeLine(data, line, lineTr());
      return h('li', { class: 'cart-line' },
        h('div', { class: 'cart-main' },
          h('strong', null, d.title),
          d.sub.map((s) => h('p', { class: 'sub' }, s)),
          [...(price.ok ? [] : [price.reason]), ...issues].map((m) => h('p', { class: 'warn' }, tReason(m))),
        ),
        h('div', { class: 'cart-side' },
          h('span', { class: 'cart-price' }, price.ok ? money(price.total) : '-'),
          stepper({ value: line.qty, min: 1, max: 20, label: d.title, onChange: (v) => { setLineQty(line.id, v); render(); } }),
          h('button', { type: 'button', class: 'link', onclick: () => { removeLine(line.id); render(); } }, tr('cart.remove')),
        ));
    });

    const sauces = sauceGroups.map((g) => h('section', { class: 'section' },
      h('h2', { class: 'section-title' }, tx(g.name), h('small', null, ` ${tr('cart.orderScope')}`)),
      g.choices.map((c) => {
        const st = stepper({ value: cart.sauces[c.id] || 0, min: 0, max: 20, label: tx(c.name), onChange: (v) => { setSauce(c.id, v); render(); } });
        if (c.soldOut) st.querySelectorAll('button').forEach((b) => (b.disabled = true));
        return h('div', { class: `opt-row${c.soldOut ? ' is-soldout' : ''}` },
          h('span', { class: 'opt-name' }, c.unit ? `${tx(c.name)} ${tx(c.unit)}` : tx(c.name)),
          h('span', { class: 'opt-price' }, c.soldOut ? tr('menu.soldout') : `+${money(c.price)}`), st);
      })));

    const orderBtn = h('button', { type: 'button', class: 'btn primary block', disabled: !t.canOrder }, t.canOrder ? tr('cart.show', { price: money(t.total) }) : tr('cart.cantOrder'));
    orderBtn.addEventListener('click', () => ctx.go('/show'));

    mount(root, 
      h('h1', null, tr('cart.title')),
      h('ul', { class: 'cart-list' }, lines),
      sauces,
      h('section', { class: 'section' },
        h('h2', { class: 'section-title' }, tr('cart.info'), h('small', null, ` ${tr('cart.optional')}`)),
        h('input', { class: 'input', type: 'text', maxlength: '20', placeholder: tr('cart.name'), value: form.name, oninput: (e) => (form.name = e.target.value) }),
        h('textarea', { class: 'input', maxlength: '200', rows: '2', placeholder: tr('cart.note'), oninput: (e) => (form.note = e.target.value) }, form.note)),
      h('section', { class: 'section' },
        h('dl', { class: 'breakdown' },
          h('dt', null, tr('cart.gross')), h('dd', null, money(t.gross)),
          t.discount ? [h('dt', null, tr('bd.discount')), h('dd', { class: 'discount' }, money(-t.discount))] : null,
          t.sauceTotal ? [h('dt', null, tr('cart.sauce')), h('dd', null, money(t.sauceTotal))] : null,
          h('dt', { class: 'total' }, tr('cart.total')), h('dd', { class: 'total' }, money(t.total)))),
      t.problems.length ? h('p', { class: 'warn' }, t.problems.map(tReason).join(' / ')) : null,
      h('div', { class: 'action' }, orderBtn),
    );
  };
  render();
  return root;
}
