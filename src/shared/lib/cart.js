// 장바구니 (localStorage에 저장 - 새로고침해도 유지)

import { KEYS, load, save } from './storage.js';

const EMPTY = () => ({ lines: [], sauces: {} });

export function getCart() {
  const c = load(KEYS.cart, null);
  return c && Array.isArray(c.lines) ? { lines: c.lines, sauces: c.sauces || {} } : EMPTY();
}

const newId = () =>
  globalThis.crypto?.randomUUID?.() ?? `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

// 같은 메뉴·크기·옵션이면 한 줄로 합친다
export function lineSignature(line) {
  const toppings = Object.entries(line.options?.toppings || {})
    .filter(([, q]) => q > 0)
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify([
    line.itemId,
    line.size,
    [...(line.halfFlavors || [])].sort(),
    line.options?.crust || null,
    toppings,
  ]);
}

export function addLine(line) {
  const cart = getCart();
  const sig = lineSignature(line);
  const same = cart.lines.find((l) => lineSignature(l) === sig);
  if (same) same.qty += line.qty;
  else cart.lines.push({ ...line, id: newId() });
  save(KEYS.cart, cart);
  return cart;
}

export function setLineQty(id, qty) {
  const cart = getCart();
  const line = cart.lines.find((l) => l.id === id);
  if (!line) return cart;
  if (qty <= 0) cart.lines = cart.lines.filter((l) => l.id !== id);
  else line.qty = qty;
  save(KEYS.cart, cart);
  return cart;
}

export function removeLine(id) {
  return setLineQty(id, 0);
}

export function setSauce(choiceId, qty) {
  const cart = getCart();
  if (qty <= 0) delete cart.sauces[choiceId];
  else cart.sauces[choiceId] = qty;
  save(KEYS.cart, cart);
  return cart;
}

export function clearCart() {
  save(KEYS.cart, EMPTY());
}

export const cartCount = (cart) => cart.lines.reduce((s, l) => s + l.qty, 0);
