# 홈 화면 기능 슬라이스 리팩터링

## 목표

기존 홈 화면의 URL, 공개 BFF 호출, 데이터 표현, 화면 동작을 유지하면서 데이터 조회와 상태 전이를 `features/home`으로 옮긴다. `app/page.tsx`는 경로와 UI 조립을 담당한다.

## 범위

- 히어로 공연·공지 조회와 실패 재시도 상태
- 피드 조회, 정렬 변경, 로딩 상태
- 달력 조회, 월 이동, 로딩 상태
- 홈 데이터 훅 단위 테스트

비목표: 디자인 변경, BFF/API 계약 변경, 공용 HTTP 계층 변경, 전체 폴더 일괄 이동.

## 검증 기준

- 초기 렌더에서 히어로·피드·달력 공개 조회 경로를 유지한다.
- 피드 정렬 변경은 피드만 다시 조회하고, 달 이동은 해당 월 범위로 달력을 다시 조회한다.
- FE 테스트, 타입 검사, 린트, 색상 토큰 검사, 프로덕션 빌드가 통과한다.

## 참고

- `docs/superpowers/specs/2026-09-28-incremental-file-structure-refactoring-design.md`
- `docs/ARCHITECTURE-STATUTE.md`

## 진행 결과

- 구현: `FE/features/home/hooks/useHomePageData.ts`를 만들고 홈 라우트의 데이터 상태/요청 효과를 이동했다.
- 테스트: `FE/__tests__/home-page-data.test.tsx`에서 초기 조회와 피드 정렬·월 이동을 검증한다.
- 최종 검증: FE 전체 테스트 100개 파일/589개 테스트 통과, 타입 검사 통과, 린트 오류 0건(기존 `<img>` 경고 6건), 색상 토큰 검사 통과.
- 프로덕션 빌드: 로컬에서 Google Fonts(`fonts.googleapis.com`) 연결이 차단되어 Geist/Geist Mono 다운로드 단계에서 실패했다. 코드 컴파일 오류로 판정하지 않으며 CI 빌드 결과로 재확인한다.
- UI 스크린샷: Playwright Chromium 실행이 macOS 권한 제한(`bootstrap_check_in ... Permission denied`)으로 종료되어 캡처 파일은 생성하지 못했다.
