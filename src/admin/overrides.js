// 관리자 수정값 저장/조회 (data.js의 applyOverrides가 원본 위에 덮어쓴다)
import { KEYS, load, save, remove } from '../shared/lib/storage.js';

export const getOverrides = () => load(KEYS.overrides, {});
const write = (fn) => { const o = getOverrides(); fn(o); save(KEYS.overrides, o); };
const slot = (o, group, id) => ((o[group] ||= {})[id] ||= {});

export const patchItem = (id, patch) => write((o) => Object.assign(slot(o, 'items', id), patch));
export const setItemPrice = (id, size, price) => write((o) => {
  const s = slot(o, 'items', id);
  (s.prices ||= {})[size] = price;
});
export const patchChoice = (id, patch) => write((o) => Object.assign(slot(o, 'choices', id), patch));
export const setHalfBase = (size, price) => write((o) => { ((o.halfHalf ||= {}).base ||= {})[size] = price; });
export const setHalfSurcharge = (itemId, price) => write((o) => { ((o.halfHalf ||= {}).surcharge ||= {})[itemId] = price; });
export const setHalfCombine = (mode) => write((o) => { (o.halfHalf ||= {}).combine = mode; });
export const resetOverrides = () => remove(KEYS.overrides);
