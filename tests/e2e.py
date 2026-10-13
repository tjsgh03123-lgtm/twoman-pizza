"""브라우저 end-to-end 점검 (실제 Chromium, 모바일 화면 크기).
사용: python3 tests/e2e.py [스크린샷 폴더]   -- 내부에서 http 서버를 직접 띄운다."""
import sys, threading, http.server, socketserver, functools, os, re
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = sys.argv[1] if len(sys.argv) > 1 else None
H = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
H.log_message = lambda *a, **k: None
srv = socketserver.TCPServer(("127.0.0.1", 0), H); PORT = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f"http://127.0.0.1:{PORT}"
errors = []

def shot(page, name):
    if not SHOTS: return
    try:
        page.bring_to_front()
        page.screenshot(path=f"{SHOTS}/{name}.png", timeout=5000)
    except Exception:
        print(f"(스크린샷 건너뜀: {name})")

def check(cond, msg):
    print(("OK   " if cond else "FAIL ") + msg)
    if not cond: errors.append(msg)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 800}, device_scale_factor=2)
    page = ctx.new_page()
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    page.on("console", lambda m: m.type == "error" and "imweb" not in m.text and "Failed to load resource" not in m.text and errors.append(f"console: {m.text}"))
    page.route(re.compile(r"https://cdn\.imweb\.me/.*"), lambda r: r.abort())  # 외부 이미지는 막아 이모지 대체 동작도 확인

    page.goto(f"{BASE}/index.html"); page.wait_for_selector(".gate")
    check(page.locator(".gate .btn").all_inner_texts() == ["한국어", "English", "日本語", "العربية", "Tiếng Việt"], "첫 화면: 언어 선택 (각 언어 표기)")
    shot(page, "00-lang")
    # 영어 / 아랍어 / 일본어 확인
    for lang, label, expect, rtl in (("en", "English", "Waterfall Cheese", False), ("ar", "العربية", "بيتزا الجبن الشلال", True), ("ja", "日本語", "ウォーターフォール チーズ", False), ("vi", "Tiếng Việt", "Waterfall Cheese (Phô mai thác đổ)", False)):
        page.click(f".gate .btn[lang={lang}]")
        page.wait_for_function("document.querySelector('.menu-card') || (document.querySelector('.gate') && !document.querySelector('.gate .btn[lang]'))", polling=100)
        if page.locator(".gate .btn.primary").count(): page.click(".gate .btn.primary")  # 돼지고기 선택은 처음 한 번만
        page.wait_for_selector(".menu-card")
        txt = page.inner_text("body")
        check(expect in txt and not re.search("[가-힣]", txt), f"{label}: 메뉴가 번역되어 표시됨 (한글 없음)")
        check((page.evaluate("document.documentElement.dir") == "rtl") == rtl and page.evaluate("document.documentElement.lang") == lang, f"{label}: lang/dir 설정")
        shot(page, f"00-menu-{lang}")
        page.click(".langbtn"); page.wait_for_selector(".gate")
    page.click(".gate .btn[lang=ko]"); page.wait_for_selector(".menu-card")
    page.click(".diet-chip .link"); page.wait_for_selector(".gate")
    check("돼지고기가 들어가지 않은 피자만 골라서 볼 수 있어요" in page.inner_text(".gate-notice"), "돼지고기 선택 화면: 돼지고기 없는 피자 선택 가능 안내")
    check(page.locator(".gate .btn").all_inner_texts() == ["돼지고기 메뉴 제외", "상관없다"], "첫 화면: 돼지고기 메뉴 제외 / 상관없다")
    shot(page, "00-gate")
    page.click(".gate .btn.primary"); page.wait_for_selector(".menu-card")
    check(page.locator(".tab").first.inner_text() == "피자", "탭 순서: 피자가 먼저")
    names = page.locator(".menu-name").all_inner_texts()
    check(not any(k in n for n in names for k in ("페퍼로니", "베이컨", "콤비네이션", "포테이토", "토핑폭탄")) and "폭포수 치즈" in names, "돼지고기 제외: 페퍼로니·베이컨·햄 메뉴 숨김 " + str(names))
    page.goto(f"{BASE}/index.html#/half-half"); page.wait_for_selector(".flavors input")
    fl = " ".join(page.locator(".flavors .opt-name").all_inner_texts())
    check("페퍼로니" not in fl and "베이컨" not in fl and "불향가득" in fl, "돼지고기 제외: 반반 맛 목록에서도 제외")
    page.goto(f"{BASE}/index.html#/item/pizza-cheese-waterfall"); page.wait_for_selector(".options")
    ot = page.inner_text(".options")
    check("페퍼로니" not in ot and "베이컨" not in ot and "황금 크러스트" in ot and "체다, 고구마무스" in ot, "토핑 옵션에서 돼지고기 제외, 크러스트 설명 표시")
    page.goto(f"{BASE}/index.html"); page.wait_for_selector(".menu-card")
    check("돼지고기 메뉴 제외 중" in page.inner_text(".diet-chip"), "선택이 유지됨")
    page.click(".diet-chip .link"); page.wait_for_selector(".gate")
    page.click(".gate .btn:not(.primary)"); page.wait_for_selector(".menu-card")
    check("페퍼로니 폭탄" in " ".join(page.get_by_role("tab", name="피자", exact=True).click() or page.locator(".menu-name").all_inner_texts()), "상관없어요: 전체 메뉴 표시")
    body = page.inner_text("body")
    check("포장 전용" in body and not re.search("배달|주소|전화|영업시간", body), "고객 메뉴: 포장 전용, 가게정보 없음")
    check(page.locator(".tab").count() == 4, "카테고리 탭 4개(피자·반반피자·사이드·음료)")
    shot(page, "01-menu")
    page.get_by_role('tab', name='피자', exact=True).click()
    page.click(".menu-card:has-text('폭포수')"); page.wait_for_selector(".detail")
    page.click(".seg-btn:has-text('라지')")
    check("23,900원" in page.inner_text(".action .btn"), "폭포수 L 상세에서는 할인 없이 23,900원")
    shot(page, "02-item")
    page.click(".action .btn"); page.wait_for_selector(".cartbar")
    check("장바구니 1개" in page.inner_text(".cartbar"), "장바구니 바 표시")

    page.goto(f"{BASE}/index.html#/half-half"); page.wait_for_selector(".flavors input")
    page.locator(".flavors input").nth(0).check(); page.locator(".flavors input").nth(1).check()
    check(page.locator(".flavors input:not(:checked):not(:disabled)").count() == 0, "맛 3개째 선택 막힘")
    shot(page, "03-half")
    page.click(".action .btn"); page.wait_for_selector(".cartbar")

    page.click(".cartbar"); page.wait_for_selector(".cart-line")
    check(page.locator(".cart-line").count() == 2, "장바구니 2줄")
    t = page.inner_text("body"); check("null" not in t and "[object" not in t, "장바구니 화면에 null/[object] 문구 없음")
    page.fill("input.input", "홍길동")
    shot(page, "04-cart")
    page.click(".action .btn"); page.wait_for_selector(".show-list")
    st = page.inner_text("body")
    check("이 화면을 직원에게 보여주세요" in st and "홍길동" in st and "폭포수 치즈" in st and "반반피자 (폭포수 치즈 + 페퍼로니 폭탄)" in st, "직원 확인 화면: 안내문·한국어 메뉴명·이름 표시")
    check("주문 내용이 맞는지 확인해 주세요" in st, "직원 확인 화면: 마지막에 주문 확인 문구")
    check("42,800원" in st and "-3,000원" in st and "null" not in st and "[object" not in st, "직원 확인 화면: 합계 42,800원 (L+M 섞여도 할인 3,000원 1회)")
    shot(page, "05-show")
    page.click(".back"); page.wait_for_selector(".cart-line")
    check(page.locator(".cart-line").count() == 2, "돌아가면 장바구니 유지")

    # 같은 탭에서 관리자 화면으로 이동 (localStorage 공유). 탭 두 개 동시 테스트는 headless에서 불안정해 순차로 한다.
    adm = page
    adm.goto(f"{BASE}/admin/index.html"); adm.fill("input[type=password]", "0000"); adm.click(".btn.primary")
    check("PIN이 맞지 않아요" in adm.inner_text("body"), "잘못된 PIN 거부")
    adm.fill("input[type=password]", "1234"); adm.click(".btn.primary"); adm.wait_for_selector(".admin-item")
    check(adm.locator(".adminnav a").all_inner_texts() == ["메뉴", "반반", "옵션", "데이터"], "관리자 메뉴: 주문 탭 없음")

    adm.goto(f"{BASE}/admin/index.html#/menu"); adm.wait_for_selector(".admin-item")
    row = adm.locator(".admin-item", has_text="폭포수 치즈")
    row.locator("input[type=checkbox]").nth(1).check()
    adm.wait_for_function("document.querySelector('.admin-item')")
    adm.locator(".admin-item", has_text="폭포수 치즈").locator("input.num").nth(1).fill("24900"); adm.keyboard.press("Tab")
    shot(adm, "07-admin-menu")
    page.goto(f"{BASE}/index.html"); page.get_by_role('tab', name='피자', exact=True).click()
    card = page.locator(".menu-card", has_text="폭포수")
    check("품절" in card.inner_text(), "관리자 품절 처리 → 고객 메뉴 품절 표시")
    check("26,900원" in card.inner_text() or "24,900원" in card.inner_text(), "관리자 가격 수정 → 고객 메뉴 반영 (" + card.inner_text().replace("\n", " ")[-40:] + ")")
    shot(page, "09-customer-soldout")
    adm.goto(f"{BASE}/admin/index.html#/half-half"); adm.wait_for_selector(".price-field")
    shot(adm, "08-admin-half")
    b.close()

print("\n문제 없음" if not errors else "\n문제:\n" + "\n".join(errors))
sys.exit(1 if errors else 0)
