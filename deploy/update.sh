#!/usr/bin/env bash
#
# 새 이미지가 올라왔으면 받아서 컨테이너를 교체한다. systemd 타이머가 2분마다 부른다.
#
#   설치:  sudo ./deploy/install-updater.sh
#   로그:  journalctl -u attacca-update -n 50
#   수동:  ./deploy/update.sh
#
# 왜 당겨오는(pull) 방식인가 — GitHub이 서버로 밀어넣으려면 EC2에 인바운드 경로를
# 열거나(22번 전체 개방) AWS SSM/OIDC를 붙여야 한다. 서버가 스스로 확인하면
# 인바운드 포트를 하나도 열지 않고, GitHub에 서버 자격증명을 두지 않아도 된다.
# 대가는 최대 2분의 배포 지연이다.

set -euo pipefail
cd "$(dirname "$0")/.."

DC=./deploy/dc.sh

$DC pull --quiet 2>&1 | grep -v '^$' || true

# 배포가 필요한가? "태그가 바뀌었나"가 아니라 **지금 돌고 있는 컨테이너가
# 제 이미지를 쓰고 있나**를 본다.
#
# 태그 변화만 보면 직전 실행이 중간에 실패했을 때(BE가 healthy가 안 돼 exit 1)
# 다음 실행에서 태그는 이미 새것이라 아무것도 안 하고 반쯤 적용된 상태로 방치된다.
#
# 이 비교는 `IMAGE_TAG=<sha>`로 되돌려 둔 상태도 지켜 준다 — 그 컨테이너는
# `:<sha>`로 만들어졌고 그 태그는 움직이지 않으므로 드리프트로 잡히지 않는다.
# (그래도 다음 푸시 때 굴러가는 걸 막으려면 타이머를 멈춰야 한다. docs/DEPLOY.md)
needs_deploy() {
  for svc in $($DC config --services); do
    cid=$($DC ps -q "$svc" 2>/dev/null || true)
    if [ -z "$cid" ]; then
      echo "  $svc: 컨테이너가 없다"
      return 0
    fi
    running=$(docker inspect -f '{{.Image}}' "$cid")
    ref=$(docker inspect -f '{{.Config.Image}}' "$cid")
    wanted=$(docker image inspect -f '{{.Id}}' "$ref" 2>/dev/null || echo "")
    if [ -n "$wanted" ] && [ "$running" != "$wanted" ]; then
      echo "  $svc: $ref 가 새 이미지를 가리킨다"
      return 0
    fi
  done
  return 1
}

if ! needs_deploy; then
  exit 0
fi

echo "새 이미지 감지 — 컨테이너를 교체한다."
# --no-build: 서버에서는 절대 굽지 않는다. GHCR에서 못 받으면 그대로 실패하는 편이
# 낫다 — t3.micro에서 조용히 빌드가 시작되면 스왑을 긁으며 서비스까지 느려진다.
$DC up -d --no-build

# nginx는 업스트림을 요청마다 다시 해석하므로(deploy/nginx.conf의 resolver)
# 컨테이너가 새 IP를 받아도 재시작이 필요 없다.

# BE가 실제로 떴는지 확인한다. 컨테이너 이름을 박아 두면 디렉터리명이 바뀔 때
# 조용히 깨지므로 compose에게 물어본다.
be_cid=$($DC ps -q be)
status=unknown
for _ in $(seq 1 40); do
  status=$(docker inspect --format '{{.State.Health.Status}}' "$be_cid" 2>/dev/null || echo unknown)
  [ "$status" = "healthy" ] && break
  sleep 5
done
if [ "$status" != "healthy" ]; then
  echo "경고: BE가 healthy가 되지 않았다(status=$status). 롤백은 수동이다 —"
  echo "  IMAGE_TAG=<직전 커밋 sha> ./deploy/dc.sh up -d --no-build"
  exit 1
fi

# 교체로 참조를 잃은 옛 이미지를 지운다. 안 지우면 배포마다 한 벌(약 1GB)씩 쌓여
# 29GB 디스크가 찬다.
docker image prune -f >/dev/null

echo "배포 완료: $(docker inspect --format '{{.Config.Image}}' "$be_cid")"
