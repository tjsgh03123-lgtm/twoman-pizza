// 식단 선택(돼지고기 제외). 첫 화면에서 고르고, 이 탭을 닫을 때까지 유지한다.
//   'any'    상관없음
//   'nopork' 돼지고기 제외 -> 재료/이름에 키워드가 있는 메뉴·맛·토핑을 숨긴다

const KEY = 'twoman.diet';
let mem = null;

export function getDiet() {
  try {
    const v = globalThis.sessionStorage?.getItem(KEY);
    if (v) return v;
  } catch { /* 무시 */ }
  return mem;
}

export function setDiet(mode) {
  mem = mode;
  try { globalThis.sessionStorage?.setItem(KEY, mode); } catch { /* 무시 */ }
  globalThis.dispatchEvent?.(new CustomEvent('twoman:diet'));
}

export function clearDiet() {
  mem = null;
  try { globalThis.sessionStorage?.removeItem(KEY); } catch { /* 무시 */ }
  globalThis.dispatchEvent?.(new CustomEvent('twoman:diet'));
}

export const noPork = () => getDiet() === 'nopork';

const keywords = (data) => data.diet?.pork?.keywords ?? [];
const hit = (data, text) => keywords(data).some((k) => String(text).includes(k));

// 재료 목록이 있으면 재료로, 없으면(사이드 등) 메뉴 이름으로 판단
export function itemHasPork(data, item) {
  if (!item) return false;
  return item.ingredients?.length ? item.ingredients.some((i) => hit(data, i)) : hit(data, item.name);
}

export const choiceHasPork = (data, choice) => hit(data, choice.name);

// 현재 식단 선택에서 보여 줄 수 있는 메뉴인가
export const dietAllows = (data, item) => !noPork() || !itemHasPork(data, item);
export const dietAllowsChoice = (data, choice) => !noPork() || !choiceHasPork(data, choice);

// 장바구니 줄 중 돼지고기가 들어간 줄의 id (식단을 바꿀 때 정리용)
export function porkLineIds(data, cart) {
  return cart.lines
    .filter((l) =>
      itemHasPork(data, data.index.items[l.itemId]) ||
      (l.halfFlavors || []).some((id) => itemHasPork(data, data.index.items[id])) ||
      Object.keys(l.options?.toppings || {}).some((id) => data.index.choices[id] && choiceHasPork(data, data.index.choices[id])))
    .map((l) => l.id);
}
