# Attacca — 프론트엔드

Next.js 16(App Router) / React 19 / TypeScript / Tailwind CSS v4 / Vitest.
서비스 전체 소개는 [루트 README](../README.md)를 보세요.

## 실행

```bash
npm install
npm run dev        # http://localhost:3000
```

BE가 `http://localhost:8080`에 떠 있어야 합니다. 주소를 바꾸려면 `FE/.env.local`:

```bash
BE_BASE_URL=http://localhost:8081
NEXT_PUBLIC_BE_WS_URL=ws://localhost:8081/ws
```

`.env.local`은 PC별 값이라 커밋하지 않습니다.

## 스크립트

```bash
npm test            # Vitest 전체
npm run lint        # eslint
npm run build       # 프로덕션 빌드
npm run check:colors  # 하드코딩된 색이 남아 있는지 검사
npm run test:e2e      # Playwright 브라우저 smoke 테스트
```

## 구조

```
app/
├── page.tsx              홈(공개 랜딩)
├── (auth)/               로그인·회원가입 — 헤더 없음
├── feed|performances|recruitments|chat|profile|verified-performer|admin/
└── api/bff/              BFF 라우트 (서버에서만 도는 코드)
    └── public/           비인증 조회 (쿠키를 읽지 않음)
components/{layout,home,feed,performance,recruitment,chat,verification}/
lib/
├── api.ts                클라이언트 → BFF 호출 헬퍼
├── server/               BE 호출·쿠키·세션 ('server-only')
└── <도메인>/              타입과 순수 로직
```

## 토큰을 UI에 두지 않는 3계층

```
UI(클라이언트) ──> app/api/bff/** ──> lib/server/* ──> Spring BE
```

- 토큰은 **httpOnly 쿠키**에 있습니다. UI 코드는 토큰을 만지지 않고 `document.cookie`로도 읽히지 않습니다.
- 클라이언트 컴포넌트는 `lib/api.ts`(`getBff`/`postBff`/…)로 **same-origin BFF만** 호출합니다.
- BFF는 `proxyAuthed`(인증) 또는 `proxyPublic`(공개)을 씁니다.
  `proxyPublic`은 쿠키를 읽지도 붙이지도 않습니다 — 토큰 유무로 공개 응답이 달라지면 안 되니까요.
- `lib/api.ts`의 모든 헬퍼는 공용 `request()`를 거쳐 fetch reject까지 `{ok:false}`로 흡수합니다.
  호출부에 별도 `.catch`가 필요 없습니다.

브라우저가 BE를 직접 호출하지 않으므로 **CORS 설정이 없습니다**.
예외는 채팅뿐 — STOMP는 BE에 직접 연결하고, CONNECT용 토큰만 BFF에서 받아옵니다.

## 색

컴포넌트는 **다크 모드를 알지 못합니다.** 시맨틱 토큰(`bg-paper`, `text-ink-muted`, `border-line` …)만
쓰고, 다크에서는 `globals.css`가 값을 교체합니다. 새 색이 필요하면 하드코딩하지 말고 토큰을 추가하세요.
`npm run check:colors`가 하드코딩된 색과 테두리 색 미지정을 잡습니다.

## 테마

Header의 테마 control에서 `시스템`, `라이트`, `다크`를 선택할 수 있습니다. 선택값은
`attacca-theme` localStorage에 저장되고, 공개 홈·공지 상세·공연 상세와 NOTICE/IMPORT
운영 화면은 semantic token으로 두 테마를 렌더링합니다. 아직 테마를 별도로 점검하지 않은
기존 도메인 화면은 공통 토큰을 계속 사용하며 후속 화면 점검 대상으로 남아 있습니다.

## 레이아웃 주의

사이드바가 있는 2단 그리드는 **`minmax(0,1fr)`**을 쓰세요. 그냥 `1fr`이면 최소 크기가 `auto`라
`truncate`된 긴 텍스트의 min-content 폭만큼 열이 부풀어 옆 칸을 화면 밖으로 밀어냅니다
(홈에서 실제로 가로 스크롤이 생겼던 건입니다).

## 테스트

Vitest + Testing Library. BFF 라우트 테스트는 파일 상단에 `// @vitest-environment node`를 답니다.

테스트는 "렌더된다"보다 **규칙이 지켜지는지**를 겨냥합니다 — 미들웨어 matcher가 보호 화면을
빠뜨리지 않는지, 공개 응답에 회원 id가 값으로도 없는지, 공개 BFF가 쿠키를 읽지 않는지 같은 것들.

브라우저 smoke 테스트는 `npm run test:e2e`로 실행합니다. 로컬 Next.js 서버에서 공개 공지 상세,
비로그인 보호 라우트의 로그인 리다이렉트, IMPORT 심사 화면 접근 게이트를 확인합니다.
공개 홈은 375px 모바일과 1280px 데스크톱 viewport에서 Header/본문 겹침과 가로 넘침도 확인합니다.
