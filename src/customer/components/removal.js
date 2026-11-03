import { h } from '../../shared/lib/dom.js';
import { t, tx } from '../../shared/lib/i18n.js';
import { noPork, removableIngredients, porkIngredients } from '../../shared/lib/diet.js';

// "고기 빼기 요청" 체크 목록. sel.removals(재료 이름 배열)를 직접 고치고 onChange()를 부른다.
// getItems()가 돌려주는 메뉴들의 고기 재료만 보여 준다 (반반이면 고른 두 맛).
// 돼지고기 제외를 골랐으면 돼지고기 재료는 자동 선택 + 잠금.
export function removalSection(data, getItems, sel, onChange) {
  sel.removals = sel.removals || [];
  const box = h('section', { class: 'section removal' });

  const update = () => {
    const items = getItems();
    const names = [...new Set(items.flatMap((i) => removableIngredients(data, i)))];
    const pork = new Set(items.flatMap((i) => porkIngredients(data, i)));
    const lock = noPork();
    sel.removals = sel.removals.filter((n) => names.includes(n));
    if (lock) for (const n of pork) if (!sel.removals.includes(n)) sel.removals.push(n);
    box.hidden = names.length === 0;
    if (!names.length) { box.replaceChildren(); return; }
    box.replaceChildren(
      h('h2', { class: 'section-title' }, t('removal.title')),
      ...names.map((n) => {
        const locked = lock && pork.has(n);
        return h('label', { class: 'opt-row' },
          h('input', {
            type: 'checkbox', checked: sel.removals.includes(n), disabled: locked,
            onchange: (e) => {
              sel.removals = e.target.checked ? [...sel.removals, n] : sel.removals.filter((x) => x !== n);
              onChange();
            },
          }),
          h('span', { class: 'opt-name' }, t('removal.item', { name: tx(n) })));
      }),
      h('p', { class: 'hint' }, t('removal.hint'), lock ? ` ${t('removal.locked')}` : ''),
    );
  };

  update();
  return { node: box, update };
}
