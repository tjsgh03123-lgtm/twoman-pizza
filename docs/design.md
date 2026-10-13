# 설계 메모

- 포장 전용: `data/menu.json`의 `orderType: takeout`, 가게 정보 파일 없음.
- 화면: 고객(메뉴 / 상품 상세 / 반반피자 / 장바구니 / 직원 확인) · 관리자(PIN / 메뉴 / 반반 규칙 / 옵션 / 데이터).
- 데이터 흐름: `data/*.json` + 관리자 수정값(localStorage) → `loadData()` → 화면. 가격 계산은 `src/shared/lib/price.js` 한 곳.
- 주문 전송 없음: 장바구니 → 「직원에게 보여주기」 확인 화면(직원용 한국어 + 손님 언어).
- 확장: 메뉴 추가는 JSON 수정, 서버 연동은 `data.js`/`orders.js` 교체, 새 관리자 화면은 `src/admin/pages/`에 추가 후 `main.js` 목록에 등록.
