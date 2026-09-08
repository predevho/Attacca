# DOMAIN-PERFORMANCE-STATUTE

연주회(공연) 도메인 구현 규칙.

> 작성일: 2026-07-22. 세부 필드·엔드포인트 시그니처는 구현 착수 시 확정하며, 변경 시 이 문서를 갱신한다.
> 등록 자격·soft delete·도메인 경계·페이징은 확정 규칙이다.

---

## 1. 패키지

```
com.back.domain.performance
├── controller
├── service
├── repository
├── entity
└── dto
```

---

## 2. 엔티티 (초안)

`BaseEntity` 상속(createdAt/updatedAt). 기존 패턴 준수: `@NoArgsConstructor(access = PROTECTED)` + private 생성자 + static 팩토리, 단순 접근자는 Lombok `@Getter`, setter 금지(의도가 드러나는 변경 메서드).

### Performance

| 필드 | 타입 | 제약 |
|---|---|---|
| `id` | Long | PK |
| `organizerId` | Long | 등록 회원(인증 연주자 또는 어드민). non-null |
| `title` | String | 공연명. non-null, ≤100 |
| `description` | String | 홍보문구/소개. ≤2000, nullable |
| `performedAt` | LocalDateTime | 공연 시작 일시. non-null |
| `venue` | String | 장소(장소명/주소 한 줄). non-null, ≤200 |
| `program` | String | 프로그램(자유 텍스트). ≤2000, nullable |
| `ticketInfo` | String | 관람료/예매 안내(예: "전석 3만원", "무료"). ≤200, nullable |
| `ticketUrl` | String | 예매·상세 외부 링크. ≤500, nullable |
| `posterImageKey` | String | 포스터 이미지 key(FileService). nullable |
| `deletedAt` | LocalDateTime | soft delete 마킹. null=미삭제 |

* 팩토리 `create(organizerId, title, description, performedAt, venue, program, ticketInfo, ticketUrl)`.
* 변경 메서드: `edit(...)`(본문 필드 전체 교체, PUT 시맨틱), `changePoster(newKey)`, `delete()`(=`deletedAt=now`), `isDeleted()`.
* `organizerId`는 원시 Long. 주최자 정보가 필요하면 서비스 계층에서 MEMBER 서비스로 협력한다.

---

## 3. 등록 자격 & 권한 규칙 (확정)

* **등록**: `VerifiedPerformerService.isVerified(memberId)` 가 true 이거나 요청자가 `ROLE_ADMIN` 이면 허용. 둘 다 아니면 `NOT_VERIFIED_PERFORMER`(403-02).
  * 어드민 판정은 컨트롤러가 `Authentication` 의 authority 에 `ROLE_ADMIN` 포함 여부로 계산해 서비스에 전달한다(FEED 삭제와 동일 패턴).
  * 주최자(`organizerId`)는 등록한 본인이다(어드민이 등록하면 어드민이 주최자).
* **수정**: 주최자 본인만. 위반 시 `FORBIDDEN`(403-01).
* **삭제**: 주최자 또는 `ROLE_ADMIN`(모더레이션). 위반 시 `FORBIDDEN`(403-01). soft delete.
* **조회·목록**: 인증된 회원 누구나.
* 어드민 전용 경로(`/api/admin/**`)는 두지 않는다. 등록 자격·모더레이션 삭제는 동일 엔드포인트에서 principal 의 역할/자격으로 판정한다.

---

## 4. soft delete 규칙 (확정)

* 공연의 모든 조회(목록·단건)는 `deletedAt IS NULL` 조건을 포함한다.
* 삭제된 공연의 단건 조회·수정·포스터 변경은 `PERFORMANCE_NOT_FOUND`.

---

## 5. 주최자 표시 협력 (확정)

* PERFORMANCE 는 `organizerId` 만 저장한다. 주최자 표시정보는 **MEMBER 서비스 배치 조회**로 파생한다.
  * FEED 에서 신설한 `MemberQueryService.findDisplaysByIds(Set<Long>) → Map<Long, MemberDisplay>` 를 재사용한다(`MemberDisplay{memberId, nickname, verified}`).
  * 목록 응답은 페이지의 `organizerId` 묶음을 한 번에 조회해 N+1 을 피한다.
* fetch join 을 쓰지 않는 이유: 도메인 경계상 `Performance` 에 `Member` 연관 매핑이 없다(주최자는 원시 Long). 표시정보는 서비스 협력 + IN 배치 조회로 조립한다.

---

## 6. 페이징 & 목록 규칙 (확정)

* 목록은 Spring `Pageable`(offset, 페이지 정보 포함 — DOMAIN-COMMON-STATUTE §5).
* `scope` 쿼리로 구분한다:
  * `upcoming`(기본): `performedAt >= now AND deletedAt IS NULL`, `performedAt ASC`(가까운 공연 먼저).
  * `past`: `performedAt < now AND deletedAt IS NULL`, `performedAt DESC`(최근 지난 공연 먼저).
  * `all`: `deletedAt IS NULL`, `performedAt DESC`.
* `now` 기준 경계는 서비스에서 `LocalDateTime.now()` 로 계산한다.

---

## 7. API (초안)

모두 인증 필요(principal = memberId). 경로 접두사 `/api/performances`.

* `POST /` : 등록(인증 연주자 또는 어드민). body `{title, description, performedAt, venue, program, ticketInfo, ticketUrl}`. 자격 없으면 403-02. → `PerformanceResponse`.
* `GET /?scope=upcoming|past|all&page=&size=` : 목록(페이징). → `Page<PerformanceResponse>`.
* `GET /{id}` : 단건 상세. 삭제/없음이면 `PERFORMANCE_NOT_FOUND`. → `PerformanceResponse`.
* `PUT /{id}` : 수정(주최자만, 아니면 403). body 는 등록과 동일(전체 교체). → `PerformanceResponse`.
* `DELETE /{id}` : 삭제(주최자 또는 ADMIN). soft delete. → 성공.
* `PUT /{id}/poster` : 포스터 이미지 업로드(주최자만). `image/*` 멀티파트. 교체 시 옛 파일 삭제. → 갱신된 `PerformanceResponse` 또는 이미지 URL(구현 시 확정). MEMBER 프로필 이미지 로직 재사용.

### 7.1 응답 DTO

* `PerformanceResponse`: `id, organizer{id, nickname, verified}, title, description, performedAt, venue, program, ticketInfo, ticketUrl, posterImageUrl, createdAt, updatedAt`.
  * `organizer` 는 `MemberDisplay`(닉네임·인증뱃지). `posterImageUrl` 은 `posterImageKey` 를 `FileService.getUrl` 로 변환(없으면 null).

---

## 8. 포스터 이미지 규칙 (확정)

* `FileService.upload(file, "performance", organizerId)` 로 저장, `image/*` contentType 만 허용(아니면 `INVALID_FILE` 400-02).
* 엔티티는 `posterImageKey` 만 보관. 새 이미지 저장이 확정된 뒤에만 옛 파일을 제거한다(실패해도 이미지 유실 없음 — 프로필 이미지 패턴).

---

## 9. 에러 코드 (전역 `ErrorCode`에 추가, 도메인 전용 enum 분리는 계속 보류)

| 코드 | resultCode | HTTP | 사유 |
|---|---|---|---|
| `PERFORMANCE_NOT_FOUND` | 404-07 | 404 | 공연 없음/삭제됨 |
| `NOT_VERIFIED_PERFORMER` | 403-02 | 403 | 인증 연주자·어드민이 아닌데 등록 시도 |

* 권한(수정/삭제 위반)은 기존 `FORBIDDEN`(403-01) 재사용. 번호는 현재 미사용값(404-07, 403-02)으로 확정, 구현 시 최종 대조.

---

## 10. 테스트 (구현 시)

* 엔티티: 생성/전체 교체(edit)/포스터 교체/soft delete 마킹.
* 리포지토리: `scope` 별 목록(upcoming asc / past desc / all desc, `deletedAt` 필터, `performedAt` 경계), 단건 미삭제 조회.
* 서비스: 등록 자격(인증 연주자 허용·어드민 허용·둘 다 아니면 403-02), 수정(주최자 아님 403), 삭제(주최자·어드민 허용, 타인 403), 삭제 대상 접근 404, 주최자 표시 협력 파생(닉네임·verified), 포스터 업로드/교체.
* 컨트롤러: 회원 API 흐름, 등록 자격 403-02, 권한 403/404, 페이징·scope 응답.

---

## 11. 구현 착수 시 확정한 결정 (2026-07-22 BE 구현)

* `PUT /{id}/poster` 응답 = **갱신된 `PerformanceResponse`**(posterImageUrl 포함).
* 목록 `size` = **기본 20, 최대 50**(초과 clamp, `<1`이면 기본). `page<0`이면 0. 컨트롤러에서 처리.
* `performedAt` 과거 일시 등록 = **허용**(과거 공연 기록용, scope=past 로 노출).
* `edit` = 등록과 동일 `PerformanceRequest`(`@Valid`, 전체 교체).
* `description`/`program` 정규화 = 별도 트림 없이 `@NotBlank`(title/venue) + `@Size` 로만 제약.
* 어드민 판정 `isAdmin` = `PerformanceController` 로컬 static(FEED의 것과 공용 헬퍼 추출은 BACKLOG).
* 목록 응답 = `Page<PerformanceResponse>`(Spring Pageable). PageImpl 직렬화 안정화를 위한 공통 `PageResponse` DTO 도입은 코드베이스 공통 BACKLOG(VERIFIED-PERFORMER 목록과 함께).

---

## 12. 공개 조회 (2026-09-08 추가)

새 홈이 공개 랜딩이 되면서 비인증 읽기를 열었다. 규칙 자체는 NOTICE가 먼저 확정했고(DOMAIN-NOTICE-STATUTE §6) 이 도메인은 그것을 따른다.

* 접두사 `/api/public/performances`. **읽기만** 둔다 — 등록·수정·삭제·포스터는 인증 경로(`/api/performances`)에 그대로 있다.
* `GET /?scope=UPCOMING|PAST|ALL|SCHEDULED&from=&to=&page=&size=` → `PageResponse<PublicPerformanceResponse>`
  * `UPCOMING`(기본)·`PAST`·`ALL`은 인증 목록과 같은 정렬.
  * `SCHEDULED`는 홈 달력용 — `performedAt`이 `[from, to)` 범위, `performedAt ASC`. `from`/`to` 없으면 400-01. 이름과 규약은 NOTICE의 같은 값과 일부러 맞췄다(BFF가 두 도메인을 같은 모양으로 호출한다).
* `GET /{id}` → `PublicPerformanceResponse`. 삭제/없음이면 404-07.
* **enum은 공개 전용 `PublicPerformanceScope`로 분리한다.** 인증 경로의 `PerformanceScope`에 `SCHEDULED`를 더하면 그 경로에서도 의미 없는 값을 받게 되기 때문이다.
* `PublicPerformanceResponse`: `id, organizer{nickname, verified}, title, description, performedAt, venue, program, ticketInfo, ticketUrl, posterImageUrl, createdAt`
  * `organizer`는 `PublicMemberDisplay` — **회원 id 없음**. 인증 응답의 `MemberDisplay`를 재사용하면 `@JsonProperty("id")`로 회원 id가 새므로 쓰지 않는다.
  * `updatedAt`은 담지 않는다(내부 상태).
* 목록 `size` 기본 20 / 최대 50.
