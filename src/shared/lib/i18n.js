// 고객 화면 다국어 (한국어 / English / 日本語 / العربية)
//   t(key, vars)  화면 문구        tx(한국어원문)  메뉴·옵션 문구
//   money(n)      금액 표기        sizeText(id)    크기 표기
// 번역이 없으면 한국어 원문을 그대로 보여 준다. 관리자 화면은 한국어 전용.

import { won, sizeLabel } from './format.js';

const KEY = 'twoman.lang';
let dict = { languages: [{ id: 'ko', label: '한국어', dir: 'ltr' }], ui: {}, content: {} };
let current = null;

export async function loadI18n(base) {
  try {
    const res = await fetch(`${base}i18n.json`);
    if (res.ok) dict = await res.json();
  } catch { /* 번역 파일이 없으면 한국어만 */ }
  return dict;
}

export const languages = () => dict.languages;

export function getLang() {
  if (current) return current;
  try {
    const v = globalThis.sessionStorage?.getItem(KEY);
    if (v && dict.languages.some((l) => l.id === v)) current = v;
  } catch { /* 무시 */ }
  return current;
}

// html lang / dir 반영 (아랍어는 오른쪽에서 왼쪽)
function applyDocument() {
  const el = globalThis.document?.documentElement;
  if (!el) return;
  const l = dict.languages.find((x) => x.id === (current || 'ko')) || dict.languages[0];
  el.lang = l.id;
  el.dir = l.dir || 'ltr';
}

export function setLang(id) {
  current = id;
  try { globalThis.sessionStorage?.setItem(KEY, id); } catch { /* 무시 */ }
  applyDocument();
}

export function clearLang() {
  current = null;
  try { globalThis.sessionStorage?.removeItem(KEY); } catch { /* 무시 */ }
  applyDocument();
}

const lang = () => getLang() || 'ko';
const fill = (s, vars) => String(s).replace(/\{(\w+)\}/g, (_, k) => (vars && k in vars ? vars[k] : `{${k}}`));

export function t(key, vars) {
  const e = dict.ui[key];
  return fill(e?.[lang()] ?? e?.ko ?? key, vars);
}

export function tx(text) {
  if (text == null || lang() === 'ko') return text;
  return dict.content[text]?.[lang()] ?? text;
}

// price.js 등이 돌려주는 한국어 사유 문구를 현재 언어로
export function tReason(msg) {
  const s = String(msg);
  const exact = dict.ui[`reason.${s}`];
  if (exact) return t(`reason.${s}`);
  let m = s.match(/^(.+): 품절 또는 판매 중지$/);
  if (m) return t('problem.sold', { name: tx(m[1]) });
  m = s.match(/^(.+): 품절$/);
  if (m) return t('problem.soldChoice', { name: tx(m[1]) });
  return s;
}

const LRM = '‎';
export function money(n) {
  if (lang() === 'ko') return won(n);
  const v = Number(n);
  return `${LRM}${v < 0 ? '-' : ''}₩${Math.abs(v).toLocaleString('en-US')}`;
}

export function sizeText(id) {
  if (lang() === 'ko') return sizeLabel(id);
  if (id === 'DEFAULT') return t('basic');
  return dict.ui[`size.${id}`] ? t(`size.${id}`) : sizeLabel(id);
}

// describeLine()에 넘기는 표시 도구 (현재 언어)
export const lineTr = () => ({
  name: tx,
  size: (id) => (id === 'DEFAULT' ? '' : sizeText(id)),
  money,
  half: (names) => t('hh.label', { list: names.join(' + ') }),
  crust: (name, price) => t('line.crust', { name, price }),
  topping: (name, unit, qty, price) => t('line.topping', { name, unit, qty, price }),
});
