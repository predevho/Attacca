# TODO-DOING

현재 진행 중인 작업.

---

* **외부 공연(KOPIS)·입시 공지 반입(IMPORT)** — 2026-09-13 대학 17곳 조사 반영 후 사양 승인. `DOMAIN-IMPORT-CONSTITUTION/STATUTE` 신설, NOTICE·아키텍처·배포 문서 개정, 구현 계획 `docs/superpowers/plans/2026-09-13-external-import-implementation.md` 작성 완료. 구현 착수 대기.
  * 사용자 조치: KOPIS 인증키 발급, User-Agent에 넣을 `IMPORT_CONTACT` 값 결정. 값이 없어도 테스트 더블과 대학 설정 검증부터 구현할 수 있다.

* **Vercel FE 분리·EC2 BE 블루/그린·Terraform 전환 설계** — `attacca.site`는 Vercel, `api.attacca.site`는 EC2 BE/Nginx/WebSocket/파일로 분리하는 방향을 사용자와 합의했다. 현행 단일 Compose를 유지한 채, Terraform import-first→API subdomain→Vercel 사전 검증→apex DNS 전환→채팅 Redis relay→BE 블루/그린 순서로 진행한다. 설계 초안: `docs/superpowers/specs/2026-09-17-vercel-api-blue-green-terraform-design.md`.
  * 단계 0 수집 진행: 로컬 Compose·Git·DNS 기준선과 AWS 호출자(`530310463238`, IAM user `predevho`), Attacca EC2(`i-0c04da18f6eb5292d`)를 읽기 전용으로 확인했다. `api.attacca.site`·`staging.attacca.site`는 NXDOMAIN이다.
  * 다음 읽기 전용 수집: Attacca EIP/security group/subnet/volume/instance profile, RDS·snapshot, Route 53, S3 state backend 후보를 확인한다. Terraform/DNS/AWS 변경은 import 대상과 계획 검토 전까지 금지한다.
