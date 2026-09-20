# Terraform State와 기존 자원 Import 실행 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Attacca 전용 Terraform state backend를 안전하게 준비하고, 기존 Attacca 자원만 import해 첫 plan의 의도하지 않은 변경을 0건으로 만든다.

> **상태: 재개 (2026-09-18).** 새 Free Plan 프로젝트 account는 관리 SCP와 Sydney 지정 리전 때문에 서울 운영 자원의 이전 대상으로 제외됐다. 사용자는 기존 Paid Plan account `530310463238`의 Attacca 운영 자원을 유지하고 비용 가드레일을 적용하기로 결정했다. 따라서 이 계획은 기존 Attacca 자원의 import-first Terraform 전환에 다시 유효하다. Pokade는 별도 프로젝트이므로 이 계획의 Terraform 범위에 넣지 않는다.

**Architecture:** 공유 기본 VPC·subnet·AWS 기본 RDS 그룹은 data source로 참조한다. Attacca 전용 EC2/EIP/보안 그룹/RDS만 Terraform resource와 import block으로 state에 편입한다. Terraform은 Docker 배포나 EC2 명령 실행을 맡지 않는다.

**Tech Stack:** Terraform 1.15.7, AWS provider, S3 backend with versioning and `use_lockfile`, AWS IAM Identity Center, AWS CLI v2.

**Spec:** `docs/superpowers/specs/2026-09-17-vercel-api-blue-green-terraform-design.md`

## Verified Baseline

* AWS account: `530310463238`, region: `ap-northeast-2`.
* Terraform: `v1.15.7` on `darwin_arm64`.
* Current user `predevho` has MFA but has `AdministratorAccess` without a permissions boundary.
* IAM Identity Center instance는 `ACTIVE`다. `attacca-terraform` named profile은 `AWSReservedSSO_AttaccaTerraformOperator` 임시 역할로 account `530310463238` 접근을 검증했다. 이 account는 Paid 플랜이며 Free Tier 크레딧은 만료된 것으로 취급한다.
* Attacca import candidates: EC2 `i-0c04da18f6eb5292d`, EIP `eipalloc-01966a32c2b275242` / association `eipassoc-008e4a114fb9414da`, EC2 security group `sg-0b69d1a077984fddc`, RDS security group `sg-0452642da9fdafe45`, RDS `attacca-db`.
* Route 53 hosted zone and existing Attacca Terraform state bucket do not exist. `pokade-storage` is outside this plan.

## Security Gate

Do not create an S3 bucket or run `terraform apply` with the current long-lived `AdministratorAccess` key. AWS recommends temporary credentials and least-privilege permissions for human CLI access.

**Proposed default:** enable IAM Identity Center, create an `AttaccaTerraformOperator` permission set, and configure a named `attacca-terraform` CLI profile with `aws configure sso`. Keep the current `default` profile out of Terraform commands. The permission set must be scoped to the Attacca resources and Terraform state bucket after the initial access analysis.

The user must approve this authentication direction before any IAM policy, Identity Center, S3, Terraform, DNS, or EC2 change. Organization 생성의 비용·계정 구조를 사용자와 확인하기 전까지 state backend 작업은 보류한다. Until then, only file creation and read-only AWS inspection are allowed.

---

### Task 1: Approve and prepare the Terraform execution identity

**Files:**
- Modify: `docs/ARCHITECTURE-STATUTE.md`
- Modify: `docs/TODO-DOING.md`
- Test: `aws sts get-caller-identity --profile attacca-terraform --output json`

- [x] IAM Identity Center instance 활성 상태를 읽기 전용으로 확인했다.
- [x] `AttaccaTerraformOperator` permission set을 만들고 `predevho-terraform` 사용자에게 할당했다.
- [x] `aws configure sso --profile attacca-terraform`로 local named profile을 구성했다.
- [x] 임시 역할로 account `530310463238`과 region `ap-northeast-2`를 검증했다.
- [ ] Do not remove existing access until the new profile is independently verified.

Expected: Terraform commands use temporary credentials from the named profile, never the long-lived default access key.

### Task 2: Create the isolated state bootstrap definition

**Files:**
- Create: `infra/bootstrap/main.tf`
- Create: `infra/bootstrap/variables.tf`
- Create: `infra/bootstrap/outputs.tf`
- Create: `infra/bootstrap/versions.tf`
- Create: `infra/.gitignore`
- Test: `terraform -chdir=infra/bootstrap fmt -check`
- Test: `terraform -chdir=infra/bootstrap validate`

- [x] Define an account-unique Attacca state bucket name; do not reuse `pokade-storage`.
- [x] Require bucket versioning, all S3 public access blocks, default SSE-S3 encryption, and ownership enforcement.
- [x] Use `prevent_destroy` on the state bucket.
- [x] Exclude `.terraform/`, `*.tfstate`, `*.tfstate.*`, backend override files, and plans containing sensitive metadata from Git.
- [x] Run `init -backend=false`, format, and validate locally before reviewing an apply.

Expected: code is valid without creating a cloud resource. The first bootstrap apply remains an explicit approval point.

### Task 3: Declare production resources and imports without applying

**Files:**
- Create: `infra/production/main.tf`
- Create: `infra/production/data.tf`
- Create: `infra/production/imports.tf`
- Create: `infra/production/versions.tf`
- Create: `infra/production/backend.hcl.example`
- Create: `infra/production/variables.tf`
- Test: `terraform -chdir=infra/production fmt -check`
- Test: `terraform -chdir=infra/production validate`

- [x] Use data sources for `vpc-0da3998132b39cea4`, Attacca subnet, and AWS default RDS groups.
- [x] Declare the import targets for Attacca EC2, EIP/association, the two Attacca security groups, and `attacca-db`.
- [x] Model EC2 root storage through the imported instance; do not create a separate EBS resource for `vol-006f02a8c49a11539`.
- [x] Declare the observed RDS settings without turning on deletion protection or Multi-AZ.
- [x] Add account and region preconditions so this configuration cannot target another account or region by accident.

Expected: local configuration validates without state or secrets committed.

### Task 4: Bootstrap, import, and prove zero unintended change

**Files:**
- Modify: `docs/ops/inventory/2026-09-17-infrastructure-baseline.md`
- Modify: `docs/TODO-DOING.md`
- Create: `docs/TIL/2026-09-17-terraform-state-and-import.md`
- Test: `terraform -chdir=infra/bootstrap plan`
- Test: `terraform -chdir=infra/production plan -detailed-exitcode`

- [x] With explicit user approval, apply bootstrap through `attacca-terraform` and record only the bucket name and verification result. Applied: `attacca-terraform-state-530310463238`, `5 added, 0 changed, 0 destroyed`.
- [x] Initialize production with the remote S3 backend and lockfile.
- [x] Run import-aware plan; review every action before applying.
- [x] Stop before apply while the production declarations are still an import scaffold; no non-import action has been approved.
- [x] Record the final plan result and state protection; follow-up TIL/Notion mirror remains a documentation task.

Expected: the first successful production plan imports existing Attacca resources with no unreviewed infrastructure change.

## Verification Checklist

- [x] `git diff --check` passes.
- [x] No `.tfstate`, access key, secret, or local backend override is tracked.
- [x] Terraform uses `attacca-terraform`, not `default`.
- [x] State bucket is versioned, private, encrypted, and protected from destruction.
- [x] Production plan addresses only account `530310463238`, region `ap-northeast-2`, and Attacca-owned resources.

## Sources

* [AWS IAM security best practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
* [AWS CLI IAM Identity Center configuration](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html)
* [Terraform import language reference](https://developer.hashicorp.com/terraform/language/import)
* [Terraform S3 backend](https://developer.hashicorp.com/terraform/language/backend/s3)
