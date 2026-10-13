import { h } from '../../shared/lib/dom.js';
import { t, tx, money } from '../../shared/lib/i18n.js';
import { allowedGroups } from '../../shared/lib/price.js';
import { dietAllowsChoice } from '../../shared/lib/diet.js';
import { stepper } from './stepper.js';

// 크러스트(하나 선택) + 토핑(수량) 선택 UI.
// sel.options = { crust, toppings } 를 직접 고치고 onChange()를 부른다.
export function optionPicker(data, item, sel, onChange) {
  sel.options = sel.options || { crust: null, toppings: {} };
  const groups = allowedGroups(data, item).filter((g) => g.scope !== 'order');
  const nodes = groups.map((g) => (g.type === 'single' ? crustGroup(g, sel, onChange) : toppingGroup(data, g, sel, onChange)));
  return h('div', { class: 'options' }, nodes);
}

function crustGroup(group, sel, onChange) {
  const name = `opt-${group.id}`;
  const row = (id, label, price, soldOut, desc) =>
    h(
      'label',
      { class: `opt-row${soldOut ? ' is-soldout' : ''}` },
      h('input', {
        type: 'radio',
        name,
        value: id ?? '',
        checked: (sel.options.crust ?? '') === (id ?? ''),
        disabled: soldOut,
        onchange: () => {
          sel.options.crust = id;
          onChange();
        },
      }),
      h('span', { class: 'opt-name' }, label, desc ? h('small', { class: 'opt-desc' }, desc) : null),
      h('span', { class: 'opt-price' }, soldOut ? t('menu.soldout') : price ? `+${money(price)}` : ''),
    );
  return h(
    'section',
    { class: 'section' },
    h('h2', { class: 'section-title' }, tx(group.name), h('small', null, ` ${t('opt.pick')}`)),
    row(null, t('opt.none'), 0, false),
    group.choices.map((c) => row(c.id, tx(c.name), c.price, c.soldOut, c.description && tx(c.description))),
  );
}

function toppingGroup(data, group, sel, onChange) {
  return h(
    'section',
    { class: 'section' },
    h('h2', { class: 'section-title' }, tx(group.name), h('small', null, ` ${t('opt.perPizza')}`)),
    group.choices.filter((c) => dietAllowsChoice(data, c)).map((c) => {
      const label = c.unit ? `${tx(c.name)} ${tx(c.unit)}` : tx(c.name);
      const st = stepper({
        value: sel.options.toppings[c.id] || 0,
        min: 0,
        max: 9,
        label,
        onChange: (v) => {
          if (v > 0) sel.options.toppings[c.id] = v;
          else delete sel.options.toppings[c.id];
          onChange();
        },
      });
      if (c.soldOut) st.querySelectorAll('button').forEach((b) => (b.disabled = true));
      return h(
        'div',
        { class: `opt-row${c.soldOut ? ' is-soldout' : ''}` },
        h('span', { class: 'opt-name' }, label),
        h('span', { class: 'opt-price' }, c.soldOut ? t('menu.soldout') : `+${money(c.price)}`),
        st,
      );
    }),
  );
}
