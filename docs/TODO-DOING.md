# TODO-DOING

현재 진행 중인 작업.

* **카카오 신규 소셜 회원 온보딩 티켓** — 카카오 인증 후 신규 회원이 `CONSENT_REQUIRED`로 `/login?error=oauth`에 떨어지는 문제를 해결한다. 설계: `docs/superpowers/specs/2026-09-18-social-onboarding-ticket-design.md`, 트러블슈팅: `docs/ops/troubleshooting/2026-09-18-kakao-oauth-onboarding.md`. 문서 작성 완료, BE/FE 구현 진행 중.

---

* **외부 공연(KOPIS)·입시 공지 반입(IMPORT)** — 2026-09-13 대학 17곳 조사 반영 후 사양 승인. `DOMAIN-IMPORT-CONSTITUTION/STATUTE` 신설, NOTICE·아키텍처·배포 문서 개정, 구현 계획 `docs/superpowers/plans/2026-09-13-external-import-implementation.md` 작성 완료. 구현 착수 대기.
  * 사용자 조치: KOPIS 인증키 발급, User-Agent에 넣을 `IMPORT_CONTACT` 값 결정. 값이 없어도 테스트 더블과 대학 설정 검증부터 구현할 수 있다.

* **Vercel FE 분리·EC2 BE 블루/그린·Terraform 전환 설계** — `attacca.site`는 Vercel, `api.attacca.site`는 EC2 BE/Nginx/WebSocket/파일로 분리하는 방향을 사용자와 합의했다. 현행 단일 Compose를 유지한 채, Terraform import-first→API subdomain→Vercel 사전 검증→apex DNS 전환→채팅 Redis relay→BE 블루/그린 순서로 진행한다. 설계 초안: `docs/superpowers/specs/2026-09-17-vercel-api-blue-green-terraform-design.md`.
  * 단계 0 수집 진행: 로컬 Compose·Git·DNS 기준선과 AWS 호출자(`530310463238`, IAM user `predevho`), Attacca EC2(`i-0c04da18f6eb5292d`)를 읽기 전용으로 확인했다. `api.attacca.site`·`staging.attacca.site`는 NXDOMAIN이다.
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
  * 2026-09-18 Terraform 안전망 완료: `infra/bootstrap`으로 계정 전용 S3 state bucket을 생성하고 버전 관리·퍼블릭 접근 차단·AES256 암호화·`prevent_destroy`를 확인했다. `infra/production`을 원격 S3 backend에 연결하고 Attacca EC2, EIP/association, 보안 그룹 2개, RDS를 import했다. 적용 결과 `6 imported, 0 added, 0 changed, 0 destroyed`, 후속 `terraform plan`도 `No changes`였다.
  * 다음 단계: API subdomain·Nginx 분리 설계와 읽기 전용 DNS/서버 기준선 확인 후, 승인된 범위에서 `api.attacca.site`와 Vercel FE 사전 배포를 진행한다.
