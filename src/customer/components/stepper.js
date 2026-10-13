import { h } from '../../shared/lib/dom.js';
import { t } from '../../shared/lib/i18n.js';

// [-] 수량 [+]  — onChange(newValue) 호출. update(v)로 바깥에서 값을 바꿀 수 있다.
export function stepper({ value = 1, min = 0, max = 99, label = t('qty'), onChange }) {
  let v = value;
  const out = h('output', { class: 'stepper-val', 'aria-live': 'polite' }, String(v));
  const minus = h('button', { type: 'button', class: 'stepper-btn', 'aria-label': `${label} −` }, '−');
  const plus = h('button', { type: 'button', class: 'stepper-btn', 'aria-label': `${label} +` }, '+');

  const sync = () => {
    out.textContent = String(v);
    minus.disabled = v <= min;
    plus.disabled = v >= max;
  };
  const set = (next) => {
    v = Math.max(min, Math.min(max, next));
    sync();
    onChange?.(v);
  };
  minus.addEventListener('click', () => set(v - 1));
  plus.addEventListener('click', () => set(v + 1));
  sync();

  const el = h('div', { class: 'stepper', role: 'group', 'aria-label': label }, minus, out, plus);
  el.update = (next) => {
    v = next;
    sync();
  };
  return el;
}
