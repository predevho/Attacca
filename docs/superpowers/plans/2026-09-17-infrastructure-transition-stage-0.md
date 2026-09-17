# Infrastructure Transition Stage 0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AWS·DNS·Vercel의 현재 상태와 복구점을 변경 없이 기록하고, Terraform import와 도메인 전환의 시작 조건을 판정한다.

**Architecture:** 이 단계는 읽기 전용 cloud API, DNS 질의, 로컬 저장소 확인만 사용한다. 확인값은 비밀값을 제외한 운영 기준선 문서로 남기고, 다음 단계의 Terraform 선언은 이 기준선을 근거로 작성한다.

**Tech Stack:** AWS CLI, DNS `dig`, Docker Compose metadata, Git, Markdown, Notion TODO/TIL.

**Spec:** `docs/superpowers/specs/2026-09-17-vercel-api-blue-green-terraform-design.md`

## Global Constraints

* AWS·DNS·Vercel·EC2에 상태를 변경하는 명령을 실행하지 않는다.
* 비밀값, 토큰, private key, DB password, JWT secret은 출력·문서·Notion에 기록하지 않는다.
* 확인에 실패한 항목은 추측하지 않고 `미확인`과 실패 원인을 기록한다.
* 대상 리전은 실제 AWS STS·EC2 조회 결과로 검증한다. 문서의 `ap-northeast-2`는 가정일 뿐 확정값이 아니다.
* 완료 뒤 `docs/TIL/` 학습 문서와 Notion TIL 미러링을 남긴다.

---

### Task 1: 읽기 전용 인프라 기준선 작성

**Files:**
- Create: `docs/ops/inventory/2026-09-17-infrastructure-baseline.md`
- Create: `docs/TIL/2026-09-17-infrastructure-inventory-import-first.md`
- Modify: `docs/TODO-DOING.md`
- Modify: `docs/CONTEXT.md`
- Modify: `docs/AI-ACTION-LOGS.md`
- Test: `git diff --check`

**Interfaces:**
- Consumes: AWS CLI 인증, 현재 DNS, 로컬 저장소의 Compose·Git metadata
- Produces: Terraform import 대상 식별자 목록, 복구점 목록, 다음 단계 진행 여부

- [x] **Step 1: AWS CLI와 호출자 신원을 확인한다**

```bash
aws --version
aws sts get-caller-identity --output json
aws configure get region
```

Expected: AWS CLI 버전, account ID, caller ARN, 기본 리전이 출력된다. 어느 하나라도 실패하면 실패 메시지만 기준선 문서에 기록하고 AWS 자원 식별을 중단한다.

Result: AWS CLI `2.35.15`, 기본 리전 `ap-northeast-2`, account `530310463238`, caller ARN `arn:aws:iam::530310463238:user/predevho`를 확인했다. `default` 프로필은 shared credentials file의 정적 키를 사용한다. 키 값은 확인·기록하지 않았다.

- [x] **Step 2: AWS 자원과 복구점을 읽기 전용으로 수집한다**

```bash
aws ec2 describe-instances --region ap-northeast-2 --output json
aws ec2 describe-addresses --region ap-northeast-2 --output json
aws ec2 describe-security-groups --region ap-northeast-2 --output json
aws rds describe-db-instances --region ap-northeast-2 --output json
aws rds describe-db-snapshots --region ap-northeast-2 --snapshot-type automated --output json
```

Expected: EC2 instance/EIP/security group/RDS instance/자동 snapshot의 식별자가 나온다. 원문 응답을 문서에 복사하지 않고 Attacca 관련 ID, 상태, 리전, 연결 관계, 백업 보존 기간만 요약한다.

Result: Attacca EC2/EIP/보안 그룹/root volume/RDS/자동 snapshot의 식별자와 연결 관계를 수집했다. 기본 VPC와 기본 RDS subnet/parameter/option group은 공유 또는 AWS 기본값이므로 Terraform import 대상에서 제외하고 data source로만 참조한다. Route 53 hosted zone은 없고 S3에는 Pokade 버킷만 있다.

- [x] **Step 3: 현행 애플리케이션과 DNS 기준선을 수집한다**

```bash
git rev-parse HEAD
git status --short
docker compose -f docker-compose.prod.yml config --images
dig +noall +answer attacca.site A
dig +noall +answer www.attacca.site A
dig +noall +answer api.attacca.site A
dig +noall +answer staging.attacca.site A
```

Expected: 현재 Git SHA, Compose image 목록, apex/www/api/staging A 레코드와 TTL이 나온다. Docker daemon 또는 `dig`가 없으면 해당 실패와 원인을 기록한다.

Result: Git SHA와 Compose image 목록을 수집했다. apex/www는 `3.39.184.71`(TTL 3600), api/staging은 NXDOMAIN이다.

- [x] **Step 4: 기준선 문서를 작성한다**

Create `docs/ops/inventory/2026-09-17-infrastructure-baseline.md` with sections `수집 범위와 안전 규칙`, `AWS 호출자와 리전`, `EC2·EIP·보안 그룹`, `RDS·자동 백업 복구점`, `현행 배포 이미지와 Git 기준점`, `DNS 기준선`, `Terraform import 대상`, `미확인 항목과 다음 단계 차단 조건`.

Only record observed values. Write `미확인` and the command error when a required observation is unavailable. Do not include credentials or secrets.

- [x] **Step 5: 학습 문서를 작성한다**

Create `docs/TIL/2026-09-17-infrastructure-inventory-import-first.md` with sections `왜 먼저 기준선을 고정하는가`, `Terraform import와 state의 역할`, `Attacca에서 확인한 실제 연결 관계`, `복구점과 변경 금지선`, `다음 단계 체크리스트`.

Tie each explanation to the observed baseline. If AWS access is unavailable, explain why identity verification is a hard stop rather than deriving infrastructure from repository documents.

- [x] **Step 6: 작업 상태와 Notion을 갱신한다**

Move the stage-0 item to DONE only when every required baseline field is observed. Otherwise leave the overall infrastructure transition in DOING and document the blocking observation. Mirror the result to the existing Notion TODO and create one TIL entry after the local TIL is complete.

Result: 전체 전환 TODO는 DOING으로 유지한다. AWS 인증 회복과 자원 수집 결과는 로컬 문서에 반영했다. Notion TODO/TIL 미러는 현재 연결 도구를 다시 사용할 수 있을 때 정본 문서를 기준으로 갱신한다.

- [x] **Step 7: 문서 결과를 검증한다**

```bash
git diff --check
rg -n 'AWS_ACCESS_KEY_ID=|AWS_SECRET_ACCESS_KEY=|DB_PASSWORD=|JWT_SECRET=|KAKAO_CLIENT_SECRET=|KOPIS_SERVICE_KEY=' docs/ops/inventory/2026-09-17-infrastructure-baseline.md docs/TIL/2026-09-17-infrastructure-inventory-import-first.md
```

Expected: `git diff --check` exits 0 and the secret scan returns no matching values. Then fetch the changed Notion pages to confirm their status and text.

Result: `git diff --check` exited 0. The assignment-pattern secret scan and trailing-whitespace scan returned no matches. Notion TODO and TIL pages were fetched after update; the TODO remains DOING and the TIL is complete.
