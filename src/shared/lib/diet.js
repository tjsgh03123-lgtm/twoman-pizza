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

// 빼 달라고 요청할 수 있는 고기 재료 (돼지고기 키워드 + diet-rules.json 의 meat.keywords)
const meatKeywords = (data) => [...keywords(data), ...(data.diet?.meat?.keywords ?? [])];
export const removableIngredients = (data, item) =>
  (item?.ingredients || []).filter((i) => meatKeywords(data).some((k) => String(i).includes(k)));
export const porkIngredients = (data, item) => (item?.ingredients || []).filter((i) => hit(data, i));

// 돼지고기가 들어간 메뉴인가. removals(빼 달라고 한 재료)는 제외하고 본다.
// 재료 목록이 있으면 재료로, 없으면(사이드 등) 메뉴 이름으로 판단
export function itemHasPork(data, item, removals = []) {
  if (!item) return false;
  return item.ingredients?.length
    ? item.ingredients.some((i) => !removals.includes(i) && hit(data, i))
    : hit(data, item.name);
}

export const choiceHasPork = (data, choice) => hit(data, choice.name);

// 재료를 뺄 수 있으면 돼지고기 제외 중에도 보여 준다 (주문할 때 고기 빼기가 자동 선택됨)
export const canRemovePork = (data, item) => porkIngredients(data, item).length > 0;
export const dietAllows = (data, item) => !noPork() || !itemHasPork(data, item) || canRemovePork(data, item);
export const dietAllowsChoice = (data, choice) => !noPork() || !choiceHasPork(data, choice);

// 장바구니 줄에 아직 돼지고기가 남아 있나
export function lineHasPork(data, line) {
  const rem = line.removals || [];
  return (
    itemHasPork(data, data.index.items[line.itemId], rem) ||
    (line.halfFlavors || []).some((id) => itemHasPork(data, data.index.items[id], rem)) ||
    Object.keys(line.options?.toppings || {}).some((id) => data.index.choices[id] && choiceHasPork(data, data.index.choices[id]))
  );
}

// 장바구니 줄 중 돼지고기가 들어간 줄의 id (식단을 바꿀 때 정리용)
export function porkLineIds(data, cart) {
  return cart.lines.filter((l) => lineHasPork(data, l)).map((l) => l.id);
}
