# API 페이지 계약 안정화 설계

## 목적

Spring Data의 `PageImpl` 내부 직렬화 형태에 의존하는 API를 프로젝트 공통 `PageResponse<T>` 계약으로 전환한다. 사용자 기능과 화면 흐름은 바꾸지 않고, 프레임워크 구현 변경에 따른 JSON 응답 드리프트와 운영 경고를 제거한다.

## 배경

`PageResponse<T>`는 NOTICE API에서 이미 사용 중이며, 다음 필드를 안정적인 외부 계약으로 정의한다.

```text
content, page, size, totalElements, totalPages, first, last
```

그러나 공연 목록과 관리자 인증 심사 목록은 여전히 `Page<T>`를 그대로 반환한다. Spring Boot는 `PageImpl` 직접 직렬화에 대해 구조 안정성을 보장하지 않는다고 경고하며, 프론트의 공연 목록은 Spring 내부 필드인 `number`를 직접 소비한다.

## 확정 범위

### 백엔드

다음 컨트롤러의 반환 타입을 `ApiResponse<PageResponse<T>>`로 전환한다.

| API | 현재 반환 | 전환 반환 |
| --- | --- | --- |
| `GET /api/performances` | `Page<PerformanceResponse>` | `PageResponse<PerformanceResponse>` |
| `GET /api/admin/verified-performers/applications` | `Page<ApplicationResponse>` | `PageResponse<ApplicationResponse>` |

서비스와 리포지토리는 계속 `Page<T>`를 반환한다. 컨트롤러가 `PageResponse.from(...)`으로 외부 경계에서만 변환한다.

### 프런트엔드

공연 목록의 페이지 타입과 변환 로직을 새 계약에 맞춘다.

* `SpringPage<T>.number` 의존을 `PageResponse<T>.page`로 전환한다.
* `content`, `last`를 사용하는 무한 목록의 동작은 유지한다.
* 인증 심사 화면이 페이지 필드를 소비하면 같은 공통 타입으로 전환한다.

### 중복 정리 조사

컨트롤러 내부 `clamp(size)`와 `isAdmin(authentication)`는 이번 작업에서 무조건 하나로 합치지 않는다.

* 페이지 크기의 기본값·상한·잘못된 값 처리 정책이 동일한 경우에만 순수 공용 헬퍼로 추출한다.
* 정책이 다르면 도메인 컨트롤러에 남긴다. 공용화 때문에 요청 결과가 달라져서는 안 된다.
* 관리자 판별은 Spring Security의 경로 권한 검사를 대체하지 않는다. 권한의 최종 강제 지점은 계속 `SecurityConfig`와 도메인 서비스다.

## 비목표

* 새 목록 API, 필터, 정렬, 페이지네이션 UX를 추가하지 않는다.
* 페이지 기본값·최대 크기·정렬 순서를 바꾸지 않는다.
* 기존 NOTICE API의 응답을 다시 변경하지 않는다.
* 인증·권한 모델을 재설계하지 않는다.
* Flyway 업그레이드, S3 기동 보완, 모니터링 도입은 별도 운영 정리 작업으로 다룬다.

## 호환성 및 위험 관리

이 전환은 API JSON 필드 하나를 `number`에서 `page`로 바꾼다. 따라서 같은 배포 단위에서 BE와 FE를 함께 배포해야 하며, 프론트 타입·변환 로직·BFF 경로의 계약 테스트를 먼저 갱신한다.

`PageResponse`는 현재 공지 API와 동일한 필드 집합을 사용한다. 프론트가 Spring 구현 세부 정보에 다시 의존하지 않도록 새 `number` 별칭은 제공하지 않는다.

## 검증 기준

* 두 컨트롤러 테스트가 `content`, `page`, `size`, `totalElements`, `totalPages`, `first`, `last`를 검증한다.
* 공연 목록과 인증 심사 프론트 테스트가 새 `page` 필드로 다음 페이지를 계산한다.
* 백엔드 전체 테스트와 프론트 테스트·타입 검사·lint·build가 통과한다.
* 배포 뒤 해당 목록 API 호출에서 `PageImpl` 직접 직렬화 경고가 발생하지 않는다.

## 참고

* Spring Data의 페이지 직렬화 주의 메시지와 현재 운영 로그
* 기존 공통 DTO: `BE/src/main/java/com/back/global/common/PageResponse.java`
* 기존 TODO: `docs/TODO-BACKLOG.md`의 `PageResponse<T>` 공통화 항목
