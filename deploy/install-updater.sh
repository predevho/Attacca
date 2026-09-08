#!/usr/bin/env bash
#
# 자동 배포 타이머를 설치한다. EC2에서 한 번만 실행하면 된다.
#
#   sudo ./deploy/install-updater.sh
#
# 이후 main에 푸시 → GitHub Actions가 GHCR에 이미지를 올림 → 이 타이머가
# 2분 안에 받아서 교체. 서버에 인바운드 포트를 열지 않는다.

set -euo pipefail

REPO_DIR=$(cd "$(dirname "$0")/.." && pwd)
RUN_USER=${SUDO_USER:-$(id -un)}

if [ "$(id -u)" -ne 0 ]; then
  echo "sudo로 실행할 것: sudo $0" >&2
  exit 1
fi
if [ ! -f "$REPO_DIR/.env.prod" ]; then
  echo ".env.prod가 없다: $REPO_DIR/.env.prod" >&2
  exit 1
fi

chmod +x "$REPO_DIR/deploy/update.sh" "$REPO_DIR/deploy/dc.sh"

cat > /etc/systemd/system/attacca-update.service <<EOF
[Unit]
Description=Attacca 자동 배포 (GHCR에서 새 이미지 확인 후 교체)
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
User=$RUN_USER
WorkingDirectory=$REPO_DIR
ExecStart=$REPO_DIR/deploy/update.sh
# 이미지 받기 + 교체 + 헬스체크 대기까지. 넘기면 죽인다.
TimeoutStartSec=900
EOF

cat > /etc/systemd/system/attacca-update.timer <<'EOF'
[Unit]
Description=Attacca 자동 배포를 2분마다 확인

[Timer]
OnBootSec=2min
OnUnitActiveSec=2min
# 배포가 오래 걸려도 타이머가 겹쳐 돌지 않는다(systemd가 실행 중인 서비스를
# 다시 시작하지 않는다). 별도 잠금장치가 필요 없는 이유.
AccuracySec=15s

[Install]
WantedBy=timers.target
EOF

# --- 인증서 갱신 ---
# 인증서가 아직 없어도 무해하다(certbot renew가 할 일 없이 끝난다).
# 하루 두 번은 Let's Encrypt 권장값이다 — 만료 30일 전부터 갱신하므로
# 한 번쯤 실패해도 여유가 있다.
cat > /etc/systemd/system/attacca-renew.service <<EOF
[Unit]
Description=Attacca 인증서 갱신 (Let's Encrypt)
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
User=$RUN_USER
WorkingDirectory=$REPO_DIR
# 갱신되면 nginx가 새 인증서를 읽도록 reload한다. 인증서는 디렉터리 마운트라
# 파일 교체가 컨테이너에도 보인다(설정 파일과 달리 재생성이 필요 없다).
ExecStart=/bin/bash -c '$REPO_DIR/deploy/dc.sh --profile tools run --rm certbot renew --webroot -w /var/www/certbot --quiet && $REPO_DIR/deploy/dc.sh exec -T nginx nginx -s reload'
TimeoutStartSec=600
EOF

cat > /etc/systemd/system/attacca-renew.timer <<'EOF'
[Unit]
Description=Attacca 인증서 갱신을 하루 두 번 확인

[Timer]
OnCalendar=*-*-* 03,15:17:00
RandomizedDelaySec=3600
Persistent=true

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now attacca-update.timer
systemctl enable --now attacca-renew.timer

echo "설치 완료."
systemctl list-timers attacca-update.timer --no-pager || true
echo
echo "로그:   journalctl -u attacca-update -f"
echo "즉시:   sudo systemctl start attacca-update"
echo "중지:   sudo systemctl disable --now attacca-update.timer"
