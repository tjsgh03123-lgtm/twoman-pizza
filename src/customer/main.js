import { h, mount } from '../shared/lib/dom.js';
import { loadData } from '../shared/lib/data.js';
import { getCart, cartCount, removeLine } from '../shared/lib/cart.js';
import { cartTotals } from '../shared/lib/price.js';
import { onChange } from '../shared/lib/storage.js';
import { clearDiet, getDiet, setDiet, porkLineIds } from '../shared/lib/diet.js';
import { t, languages, getLang, setLang, clearLang, loadI18n, money } from '../shared/lib/i18n.js';
import { menuPage } from './pages/menu.js';
import { itemPage } from './pages/item.js';
import { halfHalfPage } from './pages/half-half.js';
import { cartPage } from './pages/cart.js';
import { showPage } from './pages/show.js';

const ROUTES = [
  [/^\/$/, menuPage],
  [/^\/item\/([^/]+)$/, itemPage, ['id']],
  [/^\/half-half$/, halfHalfPage],
  [/^\/cart$/, cartPage],
  [/^\/show$/, showPage],
];

export async function start(root, { dataBase = './data/' } = {}) {
  mount(root, h('p', { class: 'loading' }, '…'));
  let data;
  try {
    await loadI18n(dataBase);
    data = await loadData(dataBase);
  } catch (e) {
    mount(root, h('div', { class: 'empty' }, `메뉴를 불러오지 못했어요. / Could not load the menu. (${e.message})`, h('p', { class: 'hint' }, 'file:// 로 열면 안 되고 웹 주소로 열어야 해요. / Open via a web address, not file://')));
    return;
  }

  const view = h('main', { class: 'view' });
  const toastEl = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
  const cartBar = h('a', { class: 'cartbar', href: '#/cart' });
  const chrome = h('div'); // 상단 바 + 할인 안내 (언어가 바뀌면 다시 그린다)
  const drawChrome = () => {
    if (!getLang()) return chrome.replaceChildren();
    const d = data.pricing.takeoutDiscount;
    const cur = languages().find((l) => l.id === getLang());
    mount(chrome,
      h('header', { class: 'topbar' },
        h('a', { class: 'brand', href: '#/' }, t('app.title')),
        h('span', { class: 'topbar-right' },
          h('button', { type: 'button', class: 'langbtn', onclick: () => { clearLang(); route(); } }, cur?.label || ''))),
      d ? h('p', { class: 'banner' }, t('app.banner', { m: money(d.amount.M), l: money(d.amount.L) })) : null);
  };

  mount(root, chrome, view, cartBar, toastEl);

  let timer;
  const ctx = {
    data,
    changeDiet: () => { clearDiet(); route(); },
    go: (path) => { location.hash = `#${path}`; },
    toast: (msg) => {
      toastEl.textContent = msg;
      toastEl.classList.add('show');
      clearTimeout(timer);
      timer = setTimeout(() => toastEl.classList.remove('show'), 2000);
    },
    onDispose: (fn) => disposers.push(fn),
  };
  let disposers = [];

  const refreshBar = () => {
    const cart = getCart();
    const n = cartCount(cart);
    // 하단 고정 버튼이 있는 화면에서는 장바구니 바를 숨긴다
    const onCart = /^#\/(cart|show|item|half-half)/.test(location.hash);
    cartBar.hidden = n === 0 || onCart;
    cartBar.textContent = t('cartbar', { n, price: money(cartTotals(data, cart).total) });
  };

  const langGate = () => h('div', { class: 'page gate' },
    h('h1', { class: 'gate-multi' }, ['언어를 선택해 주세요', 'Select your language', '言語を選択してください', 'اختر لغتك', 'Chọn ngôn ngữ của bạn'].map((x, i) => h('span', { dir: i === 3 ? 'rtl' : 'ltr' }, x))),
    languages().map((l) => h('button', { type: 'button', class: 'btn primary', lang: l.id, dir: l.dir || 'ltr', onclick: () => { setLang(l.id); route(); } }, l.label)));

  const gate = () => h('div', { class: 'page gate' },
    h('h1', null, t('gate.diet.title')),
    h('p', { class: 'gate-notice' }, t('gate.diet.notice')),
    h('button', { type: 'button', class: 'btn primary', onclick: () => {
      setDiet('nopork');
      porkLineIds(data, getCart()).forEach((id) => removeLine(id));
      route();
    } }, t('gate.diet.no')),
    h('button', { type: 'button', class: 'btn', onclick: () => { setDiet('any'); route(); } }, t('gate.diet.any')),
    h('p', { class: 'hint' }, t('gate.diet.hint')));

  const route = () => {
    disposers.forEach((d) => d());
    disposers = [];
    drawChrome();
    if (!getLang()) {
      mount(view, langGate());
      cartBar.hidden = true;
      return;
    }
    if (!getDiet()) {
      mount(view, gate());
      cartBar.hidden = true;
      return;
    }
    const path = location.hash.replace(/^#/, '') || '/';
    for (const [re, page, keys = []] of ROUTES) {
      const m = path.match(re);
      if (!m) continue;
      const params = Object.fromEntries(keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      mount(view, page(ctx, params));
      window.scrollTo(0, 0);
      refreshBar();
      return;
    }
    mount(view, h('div', { class: 'empty' }, t('app.notFound'), h('a', { class: 'btn', href: '#/' }, t('app.toMenu'))));
    refreshBar();
  };

  window.addEventListener('hashchange', route);
  onChange(refreshBar);
  route();
}
