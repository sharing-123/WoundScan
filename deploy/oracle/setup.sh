#!/usr/bin/env bash
# Run on the Oracle Cloud VM (Ubuntu, Ampere A1). Safe to run more than once.
#   1st run: installs Docker, opens ports 80/443, clones the code, then asks you to upload the models.
#   after the models are uploaded: run it again to build and start everything and print the public address.
set -euo pipefail

REPO="https://github.com/sharing-123/WoundScan.git"
DIR="$HOME/WoundScan"
NEED=(models/wound_seg.onnx models/wound_seg_medetec_adapted_320.onnx models/type/type_cls.onnx models/type/type_cls.json models/meta.json models/medetec_cv_metrics.json)

if ! command -v docker >/dev/null 2>&1; then
  echo ">> installing Docker"
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER" || true
fi
DOCKER="docker"; docker info >/dev/null 2>&1 || DOCKER="sudo docker"

echo ">> opening ports 80 and 443 in the VM firewall (the Oracle network rules must allow them too)"
for p in 80 443; do
  sudo iptables -C INPUT -p tcp --dport "$p" -j ACCEPT 2>/dev/null || sudo iptables -I INPUT 5 -p tcp --dport "$p" -j ACCEPT
done
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq netfilter-persistent iptables-persistent >/dev/null 2>&1 || true
sudo netfilter-persistent save >/dev/null 2>&1 || true

[ -d "$DIR/.git" ] && git -C "$DIR" pull -q || git clone -q "$REPO" "$DIR"
mkdir -p "$DIR/models/type"
cd "$DIR"

missing=()
for f in "${NEED[@]}"; do [ -s "$f" ] || missing+=("$f"); done
if [ "${#missing[@]}" -gt 0 ]; then
  echo
  echo "Model files still missing on the server:"; printf '  %s\n' "${missing[@]}"
  echo "Upload them from your PC (see deploy/oracle/README.md, step 4), then run this script again."
  exit 0
fi

cd "$DIR/deploy/oracle"
if [ ! -s .env ]; then
  echo
  read -r -s -p "Paste your Neon DATABASE_URL (hidden, it stays on this server): " DBURL; echo
  IP="$(curl -fsS https://api.ipify.org)"
  printf 'DATABASE_URL=%s\nSITE_ADDRESS=%s.sslip.io\n' "$DBURL" "${IP//./-}" > .env
  chmod 600 .env
fi
. ./.env 2>/dev/null || true
echo ">> building and starting (the first build takes about 10 minutes on the ARM server)"
$DOCKER compose up -d --build
for i in $(seq 1 60); do
  if curl -fsS -m 5 "https://${SITE_ADDRESS}/api/health" >/dev/null 2>&1; then
    echo; echo "READY: https://${SITE_ADDRESS}"; curl -fsS "https://${SITE_ADDRESS}/api/health"; echo; exit 0
  fi
  sleep 5
done
echo "The containers started but https://${SITE_ADDRESS} did not answer yet. Check:  $DOCKER compose logs --tail 50"
echo "Most common cause: Oracle's network security list does not allow ports 80 and 443 (README step 2)."
