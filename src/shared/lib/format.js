// 표시용 포맷 함수 (순수 함수)

export const won = (n) => `${Number(n).toLocaleString('ko-KR')}원`;

// +1,000원 / -3,000원 / 0원
export const signedWon = (n) => {
  if (n > 0) return `+${won(n)}`;
  if (n < 0) return `-${won(-n)}`;
  return won(0);
};

const SIZE_LABELS = {
  M: '미디엄(M)',
  L: '라지(L)',
  DEFAULT: '',
  '500ml': '500ml',
  '1.25L': '1.25L',
};
export const sizeLabel = (id) => (id in SIZE_LABELS ? SIZE_LABELS[id] : id);

const pad = (n, w = 2) => String(n).padStart(w, '0');

export const formatTime = (ts) => {
  const d = new Date(ts);
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const dateKey = (ts = Date.now()) => {
  const d = new Date(ts);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
};

export { pad };
