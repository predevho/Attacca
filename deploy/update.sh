#!/usr/bin/env bash
#
# 새 이미지나 새 설정이 올라왔으면 받아서 반영한다. systemd 타이머가 2분마다 부른다.
#
#   설치:  sudo ./deploy/install-updater.sh
#   로그:  journalctl -u attacca-update -n 50
#   수동:  ./deploy/update.sh
#
# 왜 당겨오는(pull) 방식인가 — GitHub이 서버로 밀어넣으려면 EC2에 인바운드 경로를
# 열거나(22번 전체 개방) AWS SSM/OIDC를 붙여야 한다. 서버가 스스로 확인하면
# 인바운드 포트를 하나도 열지 않고, GitHub에 서버 자격증명을 두지 않아도 된다.
# 대가는 최대 2분의 배포 지연이다.
#
# ⚠️ 전체를 main()으로 감싼 이유: 이 스크립트는 git pull로 자기 자신을 갱신한다.
#    bash는 스크립트를 조금씩 읽어 가며 실행하므로, 실행 도중 파일이 바뀌면
#    엉뚱한 위치를 읽어 깨진다. 함수로 감싸면 호출 전에 전부 파싱된다.
#    (새 내용은 이번 실행이 아니라 다음 주기부터 적용된다.)

set -euo pipefail

main() {
  cd "$(dirname "$0")/.."
  local DC=./deploy/dc.sh
  local repo_changed=0 nginx_changed=0

  # --- 1. 저장소 따라가기 ---------------------------------------------------
  # compose 파일·nginx 설정·이 스크립트 자신이 저장소에 있다. 안 당겨오면
  # 인프라 변경만 영영 수동으로 남는다.
  #
  # fast-forward만 받는다. 서버에서 급히 손본 게 있으면 조용히 덮지 않고 넘어간다 —
  # 그걸 날리는 게 제일 나쁘다.
  if [ -n "$(git status --porcelain)" ]; then
    echo "경고: 작업 트리가 깨끗하지 않다. git pull을 건너뛴다."
  else
    local before_head after_head
    before_head=$(git rev-parse HEAD)
    git fetch --quiet origin main || echo "경고: git fetch 실패."
    if git merge --ff-only --quiet origin/main 2>/dev/null; then
      after_head=$(git rev-parse HEAD)
      if [ "$before_head" != "$after_head" ]; then
        repo_changed=1
        echo "저장소 갱신: $(git log --oneline -1)"
        # nginx 설정은 파일 마운트라 compose가 변화를 모른다. 직접 reload해야 한다.
        git diff --name-only "$before_head" "$after_head" | grep -q '^deploy/nginx' \
          && nginx_changed=1
      fi
    else
      echo "경고: fast-forward가 안 된다(로컬 커밋?). git pull을 건너뛴다."
    fi
  fi

  # --- 2. 이미지 받기 -------------------------------------------------------
  $DC pull --quiet 2>&1 | grep -v '^$' || true

  # --- 3. 배포가 필요한가 ---------------------------------------------------
  local drifted
  drifted=$(drifted_services "$DC")

  if [ "$repo_changed" -eq 0 ] && [ -z "$drifted" ]; then
    exit 0
  fi
  [ -n "$drifted" ] && echo "새 이미지를 쓸 서비스: $drifted"

  echo "반영 시작."
  # --no-build: 서버에서는 절대 굽지 않는다. GHCR에서 못 받으면 그대로 실패하는 편이
  # 낫다 — t3.micro에서 조용히 빌드가 시작되면 스왑을 긁으며 서비스까지 느려진다.
  $DC up -d --no-build

  # 이미지가 바뀐 서비스는 **명시적으로** 교체한다.
  # 그냥 `up -d`만 믿으면 안 된다 — compose가 이미지 변경을 못 알아채고 컨테이너를
  # 그대로 두는 경우가 있었고(2026-09-08, prod compose에 build: 섹션이 남아 있을 때),
  # 그러면 매 주기마다 "새 이미지가 있다"만 반복하며 영영 배포되지 않는다.
  # 바뀐 서비스만 지정해 nginx·redis까지 괜히 끊지 않는다.
  if [ -n "$drifted" ]; then
    # shellcheck disable=SC2086
    $DC up -d --no-build --force-recreate $drifted
  fi

  if [ "$nginx_changed" -eq 1 ]; then
    # ⚠️ reload로는 안 된다. 설정을 **파일 하나**로 bind mount 했는데, 이런 마운트는
    # 그 inode에 고정된다. git이 파일을 새로 써서 갈아끼우면 inode가 바뀌므로
    # 컨테이너는 영영 옛 파일을 본다 — reload해 봐야 옛 설정을 다시 읽을 뿐이다
    # (2026-09-08에 겪음: 호스트 inode 298981 / 컨테이너 320796).
    # 컨테이너를 새로 만들어야 새 파일이 물린다.
    echo "nginx 설정이 바뀌었다 — 컨테이너 재생성."
    $DC up -d --no-build --force-recreate nginx
    $DC exec -T nginx nginx -t
  fi

  # --- 4. 실제로 떴는지 -----------------------------------------------------
  # 컨테이너 이름을 박아 두면 디렉터리명이 바뀔 때 조용히 깨지므로 compose에게 묻는다.
  local be_cid status=unknown
  be_cid=$($DC ps -q be)
  for _ in $(seq 1 40); do
    status=$(docker inspect --format '{{.State.Health.Status}}' "$be_cid" 2>/dev/null || echo unknown)
    [ "$status" = "healthy" ] && break
    sleep 5
  done
  if [ "$status" != "healthy" ]; then
    echo "경고: BE가 healthy가 되지 않았다(status=$status)."
    echo "  되돌리려면 타이머를 멈추고 직전 sha로 고정할 것:"
    echo "    sudo systemctl stop attacca-update.timer"
    echo "    IMAGE_TAG=<직전 커밋 sha> ./deploy/dc.sh up -d --no-build"
    exit 1
  fi

  # --- 5. 정리 --------------------------------------------------------------
  # 교체로 참조를 잃은 옛 이미지를 지운다. 안 지우면 배포마다 한 벌(약 1GB)씩 쌓여
  # 29GB 디스크가 찬다.
  docker image prune -f >/dev/null

  echo "반영 완료: $(docker inspect --format '{{.Config.Image}}' "$be_cid")"
}

# "태그가 바뀌었나"가 아니라 **지금 돌고 있는 컨테이너가 제 이미지를 쓰고 있나**를 본다.
#
# 태그 변화만 보면 직전 실행이 중간에 실패했을 때(BE가 healthy가 안 돼 exit 1)
# 다음 실행에서 태그는 이미 새것이라 아무것도 안 하고 반쯤 적용된 상태로 방치된다.
#
# 이 비교는 `IMAGE_TAG=<sha>`로 되돌려 둔 상태를 지켜 준다 — 그 컨테이너는
# `:<sha>`로 만들어졌고 그 태그는 움직이지 않으므로 드리프트로 잡히지 않는다.
# (그래도 다음 푸시 때 굴러가는 걸 막으려면 타이머를 멈춰야 한다. docs/DEPLOY.md)
drifted_services() {
  local DC=$1 svc cid running ref wanted out=""
  for svc in $($DC config --services); do
    cid=$($DC ps -q "$svc" 2>/dev/null || true)
    if [ -z "$cid" ]; then
      out="$out $svc"
      continue
    fi
    running=$(docker inspect -f '{{.Image}}' "$cid")
    ref=$(docker inspect -f '{{.Config.Image}}' "$cid")
    wanted=$(docker image inspect -f '{{.Id}}' "$ref" 2>/dev/null || echo "")
    if [ -n "$wanted" ] && [ "$running" != "$wanted" ]; then
      out="$out $svc"
    fi
  done
  echo "${out# }"
}

main "$@"
