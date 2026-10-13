import { h } from '../../shared/lib/dom.js';
import { getOverrides, resetOverrides } from '../overrides.js';

export function dataAdminPage(ctx) {
  const n = Object.values(getOverrides()).reduce((s, g) => s + Object.keys(g).length, 0);
  return h('div', null, h('h1', null, '데이터'),
    h('p', { class: 'hint' }, `관리자가 바꾼 항목: ${n}개. 원본은 data/*.json 이며, 아래 버튼은 바꾼 값만 지웁니다.`),
    h('textarea', { class: 'input', rows: '8', readonly: true, 'aria-label': '수정값 JSON' }, JSON.stringify(getOverrides(), null, 2)),
    h('p'),
    h('button', { type: 'button', class: 'btn', onclick: (e) => {
      if (e.target.dataset.armed) { resetOverrides(); ctx.reload(); ctx.toast('원래대로 되돌렸어요'); }
      else { e.target.dataset.armed = '1'; e.target.textContent = '한 번 더 누르면 초기화돼요'; }
    } }, '수정값 모두 초기화'));
}
