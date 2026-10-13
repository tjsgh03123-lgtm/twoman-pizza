import { h } from '../../shared/lib/dom.js';
import { t, tx, money } from '../../shared/lib/i18n.js';

// 가격 내역 표. priceLine() 결과를 받아 줄을 만든다.
export function breakdownRows(data, price, { halfLabel } = {}) {
  const rows = [];
  rows.push([t('bd.base'), price.base]);
  for (const p of price.extraParts || []) {
    rows.push([t('bd.extra', { name: tx(data.index.items[p.itemId]?.name ?? p.itemId) }), p.amount]);
  }
  if (price.optionsPrice) rows.push([t('bd.options'), price.optionsPrice]);
  if (price.qty > 1) rows.push([t('bd.qty', { n: price.qty }), null]);
  void halfLabel;
  return rows;
}

export function breakdownTable(data, price) {
  const rows = breakdownRows(data, price);
  return h(
    'dl',
    { class: 'breakdown' },
    rows.map(([label, amount, kind]) => [
      h('dt', null, label),
      h('dd', { class: kind || '' }, amount == null ? '' : money(amount)),
    ]),
  );
}
