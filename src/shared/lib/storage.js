// localStorage 래퍼. 저장이 막힌 환경(사생활 보호 모드 등)에서는 메모리로 대체한다.
// 값이 바뀌면 같은 탭에서도 'twoman:change' 이벤트가 발생한다.
// (다른 탭 변경은 브라우저 'storage' 이벤트로 받는다.)

export const KEYS = {
  cart: 'twoman.cart',
  orders: 'twoman.orders',
  orderSeq: 'twoman.orderSeq',
  overrides: 'twoman.overrides',
  adminAuth: 'twoman.adminAuth',
};

const memory = new Map();

function store() {
  try {
    const s = globalThis.localStorage;
    if (!s) return null;
    const probe = '__twoman_probe';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export function load(key, fallback) {
  try {
    const s = store();
    const raw = s ? s.getItem(key) : memory.get(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function notify(key) {
  try {
    globalThis.dispatchEvent(new CustomEvent('twoman:change', { detail: key }));
  } catch {
    /* 이벤트를 쓸 수 없는 환경은 무시 */
  }
}

export function save(key, value) {
  const raw = JSON.stringify(value);
  const s = store();
  let done = false;
  if (s) {
    try {
      s.setItem(key, raw);
      done = true;
    } catch {
      /* 용량 초과 등 -> 메모리로 */
    }
  }
  if (!done) memory.set(key, raw);
  notify(key);
}

export function remove(key) {
  const s = store();
  try {
    if (s) s.removeItem(key);
  } catch {
    /* 무시 */
  }
  memory.delete(key);
  notify(key);
}

// 같은 탭 + 다른 탭 변경을 모두 받는다. 해제 함수를 돌려준다.
export function onChange(handler) {
  const local = (e) => handler(e.detail);
  const cross = (e) => handler(e.key);
  globalThis.addEventListener('twoman:change', local);
  globalThis.addEventListener('storage', cross);
  return () => {
    globalThis.removeEventListener('twoman:change', local);
    globalThis.removeEventListener('storage', cross);
  };
}
