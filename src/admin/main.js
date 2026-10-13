import { h, mount } from '../shared/lib/dom.js';
import { loadData } from '../shared/lib/data.js';
import { KEYS, load, save, remove, onChange } from '../shared/lib/storage.js';
import { ADMIN_PIN } from './config.js';
import { menuAdminPage } from './pages/menu.js';
import { halfHalfAdminPage } from './pages/half-half.js';
import { optionsAdminPage } from './pages/options.js';
import { dataAdminPage } from './pages/data.js';

const PAGES = [
  ['menu', '메뉴', menuAdminPage],
  ['half-half', '반반', halfHalfAdminPage],
  ['options', '옵션', optionsAdminPage],
  ['data', '데이터', dataAdminPage],
];

function login(root, done) {
  const input = h('input', { class: 'input', type: 'password', inputmode: 'numeric', placeholder: 'PIN', autocomplete: 'off' });
  const msg = h('p', { class: 'warn' });
  const submit = () => {
    if (input.value === ADMIN_PIN) { save(KEYS.adminAuth, true); done(); }
    else { msg.textContent = 'PIN이 맞지 않아요'; input.value = ''; }
  };
  input.addEventListener('keydown', (e) => e.key === 'Enter' && submit());
  mount(root, h('div', { class: 'page' }, h('h1', null, '투맨피자 관리자'), input, msg,
    h('button', { type: 'button', class: 'btn primary block', onclick: submit }, '들어가기'),
    h('p', { class: 'hint' }, '모의 사이트용 간이 잠금이며 보안 기능이 아닙니다.')));
}

export async function start(root, { dataBase = '../data/' } = {}) {
  if (!load(KEYS.adminAuth, false)) return login(root, () => start(root, { dataBase }));
  mount(root, h('p', { class: 'loading' }, '불러오는 중…'));
  let data;
  try { data = await loadData(dataBase); }
  catch (e) { mount(root, h('div', { class: 'empty' }, `데이터를 불러오지 못했어요. (${e.message})`)); return; }

  const view = h('main', { class: 'page' });
  const nav = h('nav', { class: 'adminnav' });
  const toastEl = h('div', { class: 'toast', role: 'status' });
  let disposers = [];
  let timer;
  const ctx = {
    data,
    toast: (m) => { toastEl.textContent = m; toastEl.classList.add('show'); clearTimeout(timer); timer = setTimeout(() => toastEl.classList.remove('show'), 2000); },
    onDispose: (f) => disposers.push(f),
    reload: async () => { ctx.data = await loadData(dataBase); data = ctx.data; ctx.skipScroll = true; route(); },
  };

  const drawNav = (activeId) => {
    nav.replaceChildren(...PAGES.map(([pid, label]) => {
      return h('a', { class: pid === activeId ? 'is-active' : '', href: `#/${pid}` }, label);
    }));
  };
  const current = () => (location.hash.replace(/^#\//, '') || 'menu');
  const route = () => {
    disposers.forEach((d) => d()); disposers = [];
    const id = current();
    const page = PAGES.find((p) => p[0] === id) || PAGES[0];
    const y = window.scrollY;
    mount(view, page[2](ctx));
    drawNav(page[0]);
    if (ctx.skipScroll) { window.scrollTo(0, y); ctx.skipScroll = false; } else window.scrollTo(0, 0);
  };

  const top = h('header', { class: 'topbar' }, h('strong', null, '관리자'),
    h('span', null, h('a', { class: 'link', href: '../index.html' }, '고객 화면'), ' ',
      h('button', { type: 'button', class: 'link', onclick: () => { remove(KEYS.adminAuth); start(root, { dataBase }); } }, '잠금')));
  mount(root, top, view, nav, toastEl);
  window.addEventListener('hashchange', route);
  onChange(() => drawNav((PAGES.find((p) => p[0] === current()) || PAGES[0])[0]));
  route();
}
