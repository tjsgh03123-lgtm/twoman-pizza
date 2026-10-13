// 아주 작은 DOM 빌더. innerHTML을 쓰지 않아 입력값(요청사항 등)이 그대로 텍스트로만 표시된다.

const PROPS = new Set(['value', 'checked', 'disabled', 'selected', 'hidden', 'open']);

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs || {})) {
    if (val == null || val === false) continue;
    if (key === 'class') el.className = val;
    else if (key === 'style' && typeof val === 'object') Object.assign(el.style, val);
    else if (key.startsWith('on') && typeof val === 'function') el.addEventListener(key.slice(2).toLowerCase(), val);
    else if (PROPS.has(key)) el[key] = val;
    else el.setAttribute(key, val === true ? '' : String(val));
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function mount(root, ...nodes) {
  root.replaceChildren(...nodes.flat(Infinity).filter((n) => n != null && n !== false));
}

export function clear(el) {
  el.replaceChildren();
}
