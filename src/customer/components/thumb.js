import { h } from '../../shared/lib/dom.js';
import { tx } from '../../shared/lib/i18n.js';

const EMOJI = { signature: '🍕', 'half-half': '🍕', pizza: '🍕', side: '🍟', drink: '🥤' };

// 메뉴 이미지. 이미지가 없거나 불러오지 못하면 이모지 자리표시자를 보여 준다.
export function thumb(item, cls = 'thumb') {
  const box = h('div', { class: cls });
  const placeholder = () => box.append(h('span', { class: 'ph', 'aria-hidden': 'true' }, EMOJI[item.category] || '🍕'));
  const url = item.image?.sourceUrl;
  if (!url) {
    placeholder();
    return box;
  }
  const img = h('img', { src: url, alt: tx(item.name), loading: 'lazy', referrerpolicy: 'no-referrer' });
  img.addEventListener('error', () => {
    img.remove();
    placeholder();
  });
  box.append(img);
  return box;
}
