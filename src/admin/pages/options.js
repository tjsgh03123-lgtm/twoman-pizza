import { h } from '../../shared/lib/dom.js';
import { patchChoice } from '../overrides.js';
import { priceField, check } from './menu.js';

export function optionsAdminPage(ctx) {
  const { data } = ctx;
  return h('div', null, h('h1', null, '옵션 관리'),
    data.options.optionGroups.map((g) => h('section', { class: 'section' }, h('h2', { class: 'section-title' }, g.name),
      g.choices.map((c) => h('div', { class: 'admin-item' },
        priceField(c.unit ? `${c.name} ${c.unit}` : c.name, c.price, (v) => { patchChoice(c.id, { price: v }); ctx.reload(); }),
        check('품절', !!c.soldOut, (v) => { patchChoice(c.id, { soldOut: v }); ctx.reload(); }))))));
}
