# CONTEXT

현재 작업 수행에 필요한 최소 정보만 유지한다. 기능별 상세·작업 로그는 복제하지 않고 정본 문서를 참조한다.

---

## 현재 상태

* **시스템 아키텍처 정본**: `docs/system-architecture.md`. 현재 운영은 Vercel Next.js FE/BFF, AWS EC2의 Nginx·Spring Boot BE·Redis·로컬 파일 볼륨, AWS RDS MySQL 8.4, Kakao OAuth2다. EC2 FE 컨테이너는 rollback 후보로 남아 있다.
* **인증 핵심**: 브라우저 인증 쿠키는 HttpOnly다. access token은 JWT, refresh session은 opaque 값이며 Redis에서 TTL로 관리한다. 일반 API는 Vercel BFF가 access cookie를 Bearer로 변환한다. 상세 흐름과 WebSocket 예외는 `system-architecture.md` 및 보안 문서를 확인한다.
* **채팅·배포 제약**: STOMP Simple Broker와 presence가 단일 BE 메모리에 있다. 현재 배포는 무중단이 아니며, Blue/Green 전환에는 외부 STOMP broker relay와 공유 presence 검토가 선행되어야 한다.
* **파일 저장**: 운영은 EC2 Docker volume 기반 local storage다. S3 코드는 있으나 운영 자격증명·권한·업로드/삭제/URL 동작은 검증되지 않았다.
* **폐기 기능**: 외부 반입(IMPORT)은 2026-09-26 제거했다. 재도입은 별도 설계와 사용자 승인 전까지 하지 않는다. 결정 근거는 `docs/superpowers/specs/2026-09-26-retire-external-import-design.md`.
* **문서 정본**: 운영 절차=`docs/DEPLOY.md`, 테이블 구조=`docs/ERD.md`, 원칙·규칙=`docs/ARCHITECTURE-CONSTITUTION.md`·`docs/ARCHITECTURE-STATUTE.md`, 진행 상태=`docs/TODO-*.md`, 운영 실측=`docs/ops/inventory/`.
* **외부 참고 자료**: 설계·계획·트러블슈팅 판단에 사용한 외부 URL과 적용 범위는 해당 문서의 `참고 자료`에 기록한다. 참고 자료가 없으면 없다고 명시한다.

## 작업 시 주의

* 배포·AWS 변경 전 `docs/DEPLOY.md`와 최신 운영 인벤토리를 확인한다. 비밀값은 EC2 `.env.prod`에서만 관리하며 저장소·이미지·Actions 로그에 넣지 않는다.
* 운영 자동 배포의 마지막 기록된 확인은 2026-09-22다. 현재 상태가 필요한 작업은 실행 전에 다시 확인한다.
* FE/BE 로직의 구체적인 클래스·API 계약은 CONTEXT에 복사하지 말고 각 도메인 문서와 현재 코드를 확인한다.
* 작업 우선순위는 `TODO-DOING.md` → `TODO-READY.md` → `TODO-BACKLOG.md`를 따른다. CONTEXT는 작업 이력 저장소가 아니다.
