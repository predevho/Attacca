# 점진적 파일 구조 리팩터링 설계

> 작성일: 2026-09-28
> 상태: 사용자 설계 승인 완료, 구현 계획 작성 전
> 관련 문서: `docs/ARCHITECTURE-CONSTITUTION.md §2·§5`, `docs/ARCHITECTURE-STATUTE.md §1·§2`, `docs/DOMAIN-MEMBER-STATUTE.md`, `docs/superpowers/specs/2026-07-16-fe-member-profile-design.md`
> 참고 코드: `FE/app/profile/page.tsx`, `FE/app/chat/[id]/page.tsx`, `BE/src/main/java/com/back/domain/notice/service/NoticeService.java`, `BE/src/main/java/com/back/global/storage/FileService.java`

## 목적

기능을 바꾸지 않으면서, 화면과 서비스가 맡은 책임을 작게 나누어 다음 변경의 영향 범위를 줄인다. 현재 사용자 수가 적고 단일 운영 환경인 점을 고려해, 대규모 이관보다 기능 단위의 작은 리팩터링과 매 단계 회귀 검증을 선택한다.

성공 기준은 다음과 같다.

1. 기존 URL, BFF 경로, BE API 요청·응답 계약을 바꾸지 않는다.
2. 한 번의 변경은 하나의 기능 경계만 다룬다.
3. 분리 전후의 단위 테스트, 타입 검사, 린트, 프로덕션 스모크 체크가 같은 동작을 보장한다.
4. 새 파일 위치만 보고도 화면 조합, 상태 처리, API 호출 책임을 구분할 수 있다.

## 현재 진단

### 확인한 사실

* BE 도메인·계층 구조는 `Controller -> Service -> Repository` 단방향을 지키며, 정적 import 기준 순환 의존은 확인되지 않았다.
* FE의 브라우저 요청은 `lib/api.ts`와 `lib/chat/stompClient.ts`에 집중되어 있고, BFF는 다수의 `app/api/bff/**/route.ts` 파일이 파일 시스템 라우팅으로 구성되어 있다.
* `FE/app/profile/page.tsx`는 조회·수정·이미지 업로드·비밀번호 변경·회원 탈퇴를 한 화면 파일에서 함께 처리한다.
* `FE/app/chat/[id]/page.tsx`는 WebSocket 수명주기, 메시지 목록, 읽음 처리, 무한 스크롤, 초대와 퇴장을 함께 처리한다.
* `NoticeService`는 공지 명령, 조회, 표지 이미지, 응답 조립을 함께 처리한다.
* `FileService`는 임시 첨부파일 귀속, 정리 스케줄러, 다수 도메인의 파일 저장을 지원하는 공용 깊은 모듈이다.

### 문제 정의

현재 구조는 즉시 장애를 만드는 순환 의존이나 중복 API 계층이 아니라, 개별 파일 안의 책임 집중이 주된 유지보수 비용이다. 따라서 전체 디렉터리를 한 번에 재편성하는 방식은 import 충돌과 리뷰 난이도만 키우며, 현재 문제를 가장 안전하게 해결하지 못한다.

## 검토한 접근

### A. 전체 기능 폴더 구조로 일괄 이동

`app`, `components`, `lib`의 파일을 도메인별 최상위 폴더로 한 번에 옮기는 방식이다.

* 장점: 외형상 일관된 트리로 빠르게 보인다.
* 단점: App Router와 BFF의 파일 시스템 라우팅을 훼손하기 쉽고, 대량 import 변경 때문에 기능 회귀 원인을 찾기 어렵다.
* 결정: 채택하지 않는다.

### B. 화면별 기능 슬라이스를 점진적으로 도입

`app/**/page.tsx`는 페이지 조립과 경로 경계로 남기고, 복잡한 화면의 상태·행동·표현을 `features/<domain>` 아래로 조금씩 옮긴다.

* 장점: 경로와 공개 API를 보존하면서 책임을 분리할 수 있고, 기능별 테스트가 자연스럽게 가까워진다.
* 단점: 이전 구조와 새 구조가 전환 기간 동안 공존한다.
* 결정: 채택한다.

### C. BE 서비스를 전면 Command/Query 분리

모든 서비스의 쓰기와 읽기를 별도 클래스로 나누는 방식이다.

* 장점: 서비스의 책임 경계가 명확해진다.
* 단점: 현재 규모에서는 반복적인 위임 클래스가 증가할 수 있고, 도메인별 위험도가 다르다.
* 결정: 일괄 적용하지 않는다. 실제로 명령·조회가 함께 커진 `NoticeService`만 후속 후보로 제한한다.

## 확정 구조

### FE 경계

```text
FE/
  app/profile/page.tsx              # 경로 진입, 화면 조립만 담당
  features/profile/
    components/                     # ProfileView, ProfileEditForm, PasswordChangeForm, WithdrawSection
    hooks/                          # useProfile, useProfileEditor 등 화면 상태와 요청 조정
    model/                          # Profile 관련 화면 전용 타입·검증
    api/                            # 기존 lib/api.ts 호출을 감싼 프로필 전용 요청 함수
    __tests__/                      # 사용자 흐름 중심 테스트
  lib/api.ts                        # 공통 HTTP/BFF primitive 유지
  app/api/bff/**/route.ts           # Next 파일 시스템 라우트 유지
```

* `page.tsx`는 URL 파라미터, 레이아웃, 기능 루트 컴포넌트만 조립한다.
* `features/profile/api`는 HTTP primitive를 새로 만들지 않고 기존 `getBff`, `putBff`, `putBffForm`, `deleteBff`만 호출한다.
* `features/profile/model`은 프로필 화면에만 필요한 폼 상태·검증을 둔다. 다른 도메인이 쓰는 타입은 기존 공용 위치를 유지한다.
* BFF 라우트의 물리 경로는 Next.js 라우팅 계약이므로 이동하지 않는다.

### BE 경계

```text
BE/src/main/java/com/back/domain/notice/
  service/
    NoticeService.java              # 당장은 기존 공개 API 유지
    NoticeCommandService.java       # 등록·수정·삭제·표지 이미지 쓰기 책임, 후속 단계 후보
    NoticeQueryService.java         # 관리자·공개 조회와 응답 조립, 후속 단계 후보
```

* 첫 FE 단계에서는 BE 파일을 이동하거나 클래스를 추가하지 않는다.
* `NoticeService` 분리는 프로필 단계가 안정화된 뒤 별도 설계·승인을 거친다.
* `FileService`는 여러 도메인과 임시 파일 정리 작업의 공용 경계이므로 유지한다. 현재는 쪼개거나 `domain/*`으로 이동하지 않는다.
* 채팅은 WebSocket 재연결과 읽음·페이지네이션이 얽혀 있으므로 두 번째 FE 후보로만 기록한다. 프로필 분리 후 관측된 복잡도를 다시 평가한다.

## 단계와 우선순위

### 1단계: 프로필 화면 분리

가장 먼저 `FE/app/profile/page.tsx`를 기능 슬라이스로 분리한다. 외부 동작은 유지하며 다음 다섯 흐름을 각각 독립된 컴포넌트 또는 훅 경계로 만든다.

1. 초기 프로필·선택지 병렬 조회
2. 소개·악기 편집 저장
3. 프로필 이미지 업로드와 성공 후 화면 갱신
4. 비밀번호 검증·변경
5. 회원 탈퇴 확인·실행

이 단계의 비목표는 디자인 변경, API 계약 변경, 공통 HTTP 계층 교체다.

### 2단계: 공지 서비스 책임 분리 검토

프로필 단계의 실제 변경량과 테스트 패턴을 확인한 뒤, `NoticeService`의 명령과 조회를 분리할지 결정한다. 표지 이미지 저장은 쓰기 흐름에 남기며, 컨트롤러 공개 메서드와 DTO는 유지한다.

### 3단계: 채팅 화면 분리 검토

채팅은 `useChatRoom` 같은 수명주기 훅, 메시지 목록 표현, 초대·퇴장 행동으로 나눌 수 있다. 단, WebSocket 구독 중복, 재연결, 스크롤 위치 보존 테스트가 준비되지 않으면 구현하지 않는다.

## 호환성과 위험 관리

* 브라우저는 기존 BFF same-origin 경로만 사용한다. FE가 BE를 직접 호출하도록 바꾸지 않는다.
* `/profile` URL과 기존 HTTP 메서드·payload·응답 shape를 유지한다.
* 이미지 업로드는 `FormData`에서 `Content-Type`을 수동으로 설정하지 않는 현재 규칙을 유지한다.
* 인증 쿠키나 opaque refresh session 구조는 이번 범위의 변경 대상이 아니다.
* React Strict Mode에서 초기 요청이나 상태 업데이트가 중복되지 않는지 테스트한다.
* 화면 분리 중 접근성 레이블, 오류 메시지, 로딩·저장 중 버튼 상태를 유지한다.

## 검증 기준

### 자동 검증

* 기존 프로필 화면 테스트와 분리한 기능별 테스트가 통과한다.
* `npm --prefix FE test -- --run ...`의 대상 테스트가 통과한다.
* `npm --prefix FE run typecheck`, `npm --prefix FE run lint`, `npm --prefix FE run build`가 통과한다.
* BE 코드를 변경하는 후속 단계는 해당 서비스 테스트와 전체 `./gradlew test`를 통과한다.

### 수동 스모크 검증

1. 로그인 후 `/profile` 진입 시 조회 화면이 표시된다.
2. 소개·악기 수정, 이미지 교체, 비밀번호 변경, 탈퇴 흐름의 성공·실패 메시지가 기존과 동일하게 동작한다.
3. 페이지 새로고침 후 저장된 프로필이 다시 표시된다.
4. BFF 네트워크 요청이 기존 경로와 상태 코드로 유지된다.

## 문서화 원칙

각 단계 완료 시 `docs/ARCHITECTURE-STATUTE.md`에는 실제 확정된 폴더 경계만 반영한다. 계획만으로 아키텍처 규칙을 선반영하지 않는다. `docs/TODO-*`, `docs/AI-ACTION-LOGS.md`, 필요 시 도메인 문서는 구현 사실과 다음 후보를 분리해 기록한다.

## 참고

* 기존 프로필 설계: `docs/superpowers/specs/2026-07-16-fe-member-profile-design.md`
* FE-BFF 경계: `docs/ARCHITECTURE-CONSTITUTION.md §2`, `docs/ARCHITECTURE-STATUTE.md §1`
* BE 계층 원칙: `docs/ARCHITECTURE-CONSTITUTION.md §5`
* 공용 파일 저장소 설계: `docs/superpowers/specs/2026-07-14-be-file-storage-design.md`
