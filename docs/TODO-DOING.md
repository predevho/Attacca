# TODO-DOING

현재 진행 중인 작업.

* **밝은 콘텐츠 커뮤니티 UI·게시글 첨부** — 피드 인라인 작성 폼을 `/feed/new` 독립 흐름으로 옮기고, 기본 밝은 전역 UI와 피드·구인 임시 첨부 업로드(ID 연결)를 구현했다. JPG/PNG/WebP/PDF, 파일당 10MB, 최대 5개를 검증하고 실패 파일은 사유 표시와 개별 재시도가 가능하다. 자동 검증(BE 전체 테스트, FE 전체 테스트·타입검사·lint·색 토큰 검사·build)은 통과했다. 실제 브라우저에서 신규 작성·첨부 조회·실패 재시도 스모크 검증과 배포는 남아 있다. 설계: `docs/superpowers/specs/2026-09-22-content-community-attachments-ui-design.md`, 계획: `docs/superpowers/plans/2026-09-22-content-community-attachments-ui-implementation.md`.

* **관리자 진입점 정리** — ADMIN 계정에만 전역 헤더의 `/admin` 관리 버튼을 노출하고, 공지·외부 반입·인증 심사로 이동하는 관리 허브를 추가했다. `/admin/*` 경로에서는 버튼을 활성 상태로 표시한다. 각 하위 화면의 BE 권한 검사는 유지하며, 운영 브라우저 확인과 배포는 남아 있다.

* **카카오 신규 소셜 회원 온보딩 티켓** — 카카오 인증 후 신규 회원이 `CONSENT_REQUIRED`로 `/login?error=oauth`에 떨어지는 문제를 해결한다. 설계: `docs/superpowers/specs/2026-09-18-social-onboarding-ticket-design.md`, 트러블슈팅: `docs/ops/troubleshooting/2026-09-18-kakao-oauth-onboarding.md`. 문서 작성 완료, BE/FE 구현 진행 중.

---

* **외부 공연(KOPIS)·입시 공지 반입(IMPORT)** — 수집·승인 API, BFF, 어드민 심사 화면은 이미 `main`에 구현돼 있다. 2026-09-23에 IMPORT BE 선택 테스트와 IMPORT UI 테스트, BFF 경로 계약 테스트를 다시 통과시켰다. 같은 날 운영 어드민 화면이 `runs/latest`의 단일 객체·`null` 계약을 배열로 오해해 렌더링에 실패한 문제를 고쳤다. 화면은 이제 KOPIS·대학 공지 상태를 각각 병렬 조회하고, 실행 이력이 없으면 빈 상태로 표현한다. 수동 실행은 비동기 접수(`ACCEPTED`)이므로, 실행 기록이 저장될 때까지 해당 원천의 최신 상태를 재조회하고 요청 확인 상태를 표시하도록 보정했다. 운영 로그에서 MySQL 예약어 `trigger`로 인한 실행 기록 INSERT SQL 1064를 확인해, 기존 V5와 충돌하지 않는 Flyway **V8**과 엔티티를 `run_trigger`로 전환했다. 후속 운영 로그에서 외부 예외 전문이 `message(varchar 1000)`을 넘겨 실행 이력 저장을 다시 실패시키는 문제를 확인해, 메시지를 1,000자로 요약해 저장하도록 보완했다. 현재 Task 12 운영 검증 단계로, 수정 배포 후 KOPIS 수동 실행의 결과·신규 건수·후보 목록을 확인해야 한다. 정본: `docs/superpowers/plans/2026-09-13-external-import-implementation.md`.
  * 사용자 조치: KOPIS 인증키 발급, User-Agent에 넣을 `IMPORT_CONTACT` 값 결정. 값이 없어도 테스트 더블과 대학 설정 검증부터 구현할 수 있다.

* **Vercel FE 분리·EC2 BE 블루/그린·Terraform 전환 설계** — `attacca.site`는 Vercel, `api.attacca.site`는 EC2 BE/Nginx/WebSocket/파일로 분리하는 방향을 사용자와 합의했다. 현행 단일 Compose를 유지한 채, Terraform import-first→API subdomain→Vercel 사전 검증→apex DNS 전환→외부 STOMP broker relay·공유 presence 설계→BE 블루/그린 순서로 진행한다. 설계 초안: `docs/superpowers/specs/2026-09-17-vercel-api-blue-green-terraform-design.md`.
  * 단계 0 수집은 2026-09-17 당시 DNS 스냅샷이다. 현재 운영 주소·DNS는 `docs/ops/inventory/2026-09-21-production-state.md`를 기준으로 한다.
  * 다음 읽기 전용 수집: Attacca EIP/security group/subnet/volume/instance profile, RDS·snapshot, Route 53, S3 state backend 후보를 확인한다. Terraform/DNS/AWS 변경은 import 대상과 계획 검토 전까지 금지한다.
  * 보안 게이트: 현재 `default` CLI profile은 MFA가 있는 `predevho` IAM user지만 permissions boundary 없이 `AdministratorAccess` 장기 키를 쓴다. state bucket 생성·Terraform apply 전, IAM Identity Center 임시 자격 증명 기반 `attacca-terraform` profile을 사용하도록 전환 계획을 작성했다: `docs/superpowers/plans/2026-09-17-terraform-state-and-import.md`.
  * 2026-09-18 비용 영향: IAM Identity Center 활성화 중 AWS Organization이 생성돼 Free 플랜이 Paid 플랜으로 전환됐다. Free Tier 크레딧은 만료된 것으로 보고, Billing Support 확인 전까지 새 계정을 크레딧 회피 수단이나 Terraform 대상 계정으로 가정하지 않는다. Attacca 운영 자원은 현 account에 있으므로 계정 이전은 별도 마이그레이션 결정이 필요하다.
  * 2026-09-18 계정 전략 변경: 사용자가 별도 AWS 계정을 만들었고, 새 IAM 신원 확인 뒤 그 계정에서 인프라 작업을 다시 시작한다. 새 계정은 기존 Organization에 가입시키지 않는다. 기존 account의 팀 프로젝트 EC2·RDS는 유지하며, 계정 간 Attacca 운영 이전 여부는 새 기준선과 별도 마이그레이션 계획 없이 가정하지 않는다.
  * 이전 범위 확정: 새 계정으로 **Attacca와 Pokade의 EC2·RDS 모두** 이전한다. 새 계정에서 각 프로젝트의 데이터·HTTPS·배포·스모크 검증을 마치기 전에는 기존 계정의 EC2/RDS/EIP를 종료·삭제하지 않는다. 새 account ID와 양쪽 프로젝트 자원 기준선을 확보한 뒤 통합 마이그레이션 계획을 작성한다.
  * 비용·Free 플랜 조사 정본: `docs/ops/research/2026-09-18-aws-free-plan-and-account-migration.md`. 새 account의 Free Plan·credit status를 실제 Console에서 확인하기 전에는 무료·이전 가능을 가정하지 않는다.
  * 새 account 상태 확인(사용자 Billing Console, 2026-09-18): Free account plan, 미수금 `$0.00`, 남은 credit `$100.00`, plan 종료일 `2027-03-18`. 단, `Sign up for AWS (new)` 프로젝트 account라 AWS 관리 Organization/SCP와 Sydney 지정 리전이 적용된다. `migration-target`의 서울 EC2/RDS/S3 read API가 SCP explicit deny로 차단돼 Attacca·Pokade 서울 리전 이전 대상에서는 제외한다.
  * 결정: 기존 Paid Plan account의 서울 운영 자원을 유지하고 비용 가드레일을 적용한다. 새 Free Plan project는 서울 리전 이전 대상에서 제외했으며, 이때 만든 `migration-operator` IAM user도 삭제했다. 새 Advanced account로의 계정 간 이전은 별도 사용자 요청과 마이그레이션 계획이 있을 때만 재개한다.
  * 2026-09-18 비용 가드레일 적용: 월 전체 비용 예산 `$40`, 실제 비용 50%·100% 및 예상 비용 75% 이메일 알림을 생성했다. 기존 서비스별 비용 이상 탐지 구독은 예상 추가 지출 `$10` 및 40% 초과 조건의 일일 이메일 요약으로 조정했다. 알림은 청구 데이터 지연이 있으므로 절대 결제 상한선이 아니다.
  * Terraform 실행 주체 준비 완료: IAM Identity Center `AttaccaTerraformOperator` permission set과 `predevho-terraform` 사용자를 운영 account에 할당했고, 로컬 `attacca-terraform` SSO profile의 임시 역할 STS 인증을 확인했다. 기존 `default` 장기 키는 SSO 기반 작업이 안정화될 때까지 유지한다.
  * 2026-09-18 Terraform state 안전망 완료: `attacca-terraform-state-530310463238`을 생성하고 버전 관리·퍼블릭 접근 차단·AES256 암호화를 확인했다. production을 원격 S3 backend에 연결한 뒤 EC2, EIP/association, 보안 그룹 2개, RDS를 import했고, 결과는 `6 imported, 0 added, 0 changed, 0 destroyed`, 후속 plan은 `No changes`였다.
  * 2026-09-18 이미지 용량 위험 기록: 약 29GB EC2 디스크에서 GHCR SHA 이미지, Docker 캐시, `be-uploads` 볼륨이 함께 증가할 수 있다. `update.sh`는 사용하지 않는 7일 초과 이미지만 정리하고 4GB 미만 여유 공간을 경고하도록 수정했으며, 업로드 볼륨은 별도 보존·S3 전환 정책이 필요하다.
  * 2026-09-18 운영 결정: 런타임 환경변수는 EC2 SSH 접속 후 서버 `.env.prod`에 직접 주입·변경한다. 인프라 작업 후 BE 테스트, FE 타입체크·lint·테스트·빌드, 운영 스모크 검증을 수행하고 결과와 트러블슈팅을 문서에 기록한다.
  * 2026-09-18 배포 게이트 강화: CI가 이미지에 커밋 SHA 라벨을 기록하고, `update.sh`가 pull 후 BE/FE 라벨 존재 및 동일 커밋 여부를 확인한 뒤 컨테이너를 교체하도록 했다. 기존 라벨 없는 이미지는 새 CI 이미지가 생성될 때까지 교체하지 않는다.
  * 2026-09-19 사전 배포 검증: `api.attacca.site` 공개 API 응답, `staging.attacca.site`의 카카오 로그인·BFF 요청·WebSocket 101 handshake와 채팅 송수신을 확인했다. 채팅 입력창은 뷰포트 하단에 고정했고 한글 IME 조합 중 Enter 전송을 막아 마지막 글자 중복 전송을 해소했다.
  * 2026-09-19 Vercel Production DNS 전환: 사용자 승인 뒤 가비아에서 `A @ -> 216.198.79.1`, `CNAME www -> 335cd7f1e6a8d4bc.vercel-dns-017.com.`으로 저장했다. 공개 DNS 조회에서 `@`와 `www`의 Vercel 대상, `api -> 3.39.184.71`, 기존 `staging` CNAME 유지를 확인했다.
  * 2026-09-19 Vercel 도메인 검증: `attacca.site`, `www.attacca.site`, `staging.attacca.site`, 기본 Vercel 도메인이 모두 `Valid Configuration`인 것을 확인했다.
  * 2026-09-20 운영 smoke: 사용자가 운영 도메인의 홈, 카카오 로그인, 강제 새로고침 후 세션 유지, 보호 화면과 데이터 동선이 정상이라고 확인했다.
  * 2026-09-20 rollback 보존 확인: EC2에서 `attacca-fe-1`이 `Up 19 hours` 상태이며 `3000/tcp`로 실행 중인 것을 확인했다.
  * 2026-09-20 rollback 경로 검증: 현재 Production이 아닌 이전 `Ready` deployment에서 Vercel `Promote`가 활성화된 것을 확인했다. 실제 Promote와 DNS rollback은 실행하지 않았으며, DNS 복구값은 `A @ -> 3.39.184.71`, `A www -> 3.39.184.71`이고 `api`는 유지한다.
  * 2026-09-20 staging 실효성 점검: 원격 Git에는 `main`만 있고 `staging` 브랜치는 없으며, Vercel의 `staging.attacca.site`도 Production deployment로 연결돼 있다. `BE_BASE_URL`, `NEXT_PUBLIC_BE_WS_URL`, `KAKAO_REDIRECT_URI`는 Production과 Preview에 같은 값으로 주입돼 같은 EC2 API/WS를 바라본다. 따라서 현재 staging은 독립 검증 환경이 아니라 Production의 추가 호스트다. Git branch·Vercel Preview·BE/DB 격리 정책을 먼저 결정해야 한다.
  * 2026-09-20 staging 폐기 설계 승인: 별도 개발 인프라를 만들지 않고 `staging.attacca.site`와 그 전용 DNS·Vercel·카카오 콜백·WebSocket Origin 참조만 제거한다. `attacca.site`, `www.attacca.site`, `api.attacca.site`와 운영 자원은 유지한다. 실행 전 상세 순서와 검증/롤백 기준은 `docs/superpowers/specs/2026-09-20-staging-domain-retirement-design.md`에 고정했다.
  * 2026-09-21 staging 폐기 완료: Vercel·카카오·가비아의 staging 전용 항목을 제거하고 EC2 `WS_ALLOWED_ORIGINS`도 운영 두 도메인으로 축소했다. BE만 재생성해 `healthy`를 확인했으며, 운영 브라우저에서 로그인 상태의 WebSocket 채팅 연결과 입력창도 정상 확인했다. 상세 완료 기록은 `TODO-DONE`과 `AI-ACTION-LOGS`를 따른다.
  * 2026-09-21 배포 파이프라인 정적 재검토: `.github/workflows/ci.yml`은 BE 테스트 → FE 타입검사·테스트·lint·색 토큰 검사·build → 동일 SHA BE/FE GHCR publish 순서를 유지한다. `deploy/update.sh`와 Compose 문법 검증도 통과했고, SHA 라벨 대조·BE health 대기·이미지 용량 경고·수동 rollback 기준을 확인했다.
  * 2026-09-22 EC2 `attacca-update.timer` 운영 확인: timer는 `enabled`·`active`이고 다음 실행 주기가 등록돼 있다. 직후 service의 `Result=success`, `ExecMainStatus=0`을 확인했다. `ExecMainCode=1`은 systemd의 정상 종료 유형(`CLD_EXITED`)이며 실패 코드가 아니다.
  * 2026-09-22 WebSocket origin 정본화 결정: `PUBLIC_ORIGIN`은 카카오 콜백·파일 URL을 위한 대표 주소로 유지하고, `WS_ALLOWED_ORIGINS`는 허용할 브라우저 origin 목록으로 별도 관리한다. 단일 대표 주소 주입은 단순하지만 다중 도메인 허용 정책을 표현하지 못하므로 기각했다. 전체 허용(`*`)은 origin 방어층을 없애므로 기각했다.
  * 다음 관문: 운영 관찰을 계속한 뒤 사용자 별도 승인으로만 EC2 FE 제거 여부를 판단한다. 승인 전 `attacca-fe`와 관련 route/image publish를 변경하지 않는다.
