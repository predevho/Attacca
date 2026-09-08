#!/usr/bin/env bash
# EC2(Ubuntu) 최초 1회 실행. Docker와 스왑을 준비한다.
#
#   sudo apt-get update && sudo apt-get install -y git
#   git clone <레포> attacca && cd attacca
#   bash deploy/bootstrap.sh
#
# 여러 번 실행해도 안전하다(이미 되어 있으면 건너뛴다).
set -euo pipefail

say() { printf '\n\033[1m== %s\033[0m\n' "$1"; }

say "1/3 Docker 설치"
if command -v docker >/dev/null 2>&1; then
  echo "이미 설치됨: $(docker --version)"
else
  sudo apt-get update
  sudo apt-get install -y ca-certificates curl
  sudo install -m 0755 -d /etc/apt/keyrings
  sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  sudo chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
  sudo apt-get update
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

say "2/3 스왑 2GB"
# t3.micro/t2.micro는 메모리가 1GB뿐이라 Gradle 빌드가 OOM으로 죽는다.
# 에러가 "Killed" 한 줄만 남아 원인을 찾기 어려우므로 미리 잡아 둔다.
if swapon --show | grep -q '/swapfile'; then
  echo "이미 활성화됨"
else
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab > /dev/null
fi
free -h

say "3/3 docker 그룹에 현재 사용자 추가"
if id -nG "$USER" | tr ' ' '\n' | grep -qx docker; then
  echo "이미 포함됨"
else
  sudo usermod -aG docker "$USER"
  echo "추가했다. ⚠️ 적용하려면 SSH를 끊고 다시 접속할 것(exit 후 재접속)."
fi

cat <<'NEXT'

== 다음 순서 ==
  1) SSH 재접속 (docker 그룹 적용)
  2) cp .env.prod.example .env.prod && vi .env.prod
     - PUBLIC_ORIGIN=http://<Elastic IP>
     - NEXT_PUBLIC_BE_WS_URL=ws://<Elastic IP>/ws
     - DB_URL=jdbc:mysql://<RDS 엔드포인트>:3306/attacca
     - DB_USERNAME / DB_PASSWORD
     - JWT_SECRET=$(openssl rand -base64 48) 결과를 붙여넣기
  3) docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
     첫 빌드는 10~20분 걸린다.
  4) docker compose -f docker-compose.prod.yml logs -f be
     "Successfully applied 1 migration" 과 "Started AttaccaApplication" 확인
NEXT
