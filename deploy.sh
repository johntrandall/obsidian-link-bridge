#!/bin/sh
# Test, then deploy the bridge to the hostname in deploy.env.
set -eu
cd "$(dirname "$0")"
if [ ! -f deploy.env ]; then
  echo "deploy.sh: copy deploy.env.example to deploy.env and fill it in" >&2
  exit 1
fi
node --test test/
if grep -q 'op://' deploy.env; then
  # 1Password secret references: resolve them for this one command only.
  exec op run --env-file=deploy.env -- sh -c 'wrangler deploy --domain "$BRIDGE_DOMAIN"'
fi
set -a
. ./deploy.env
set +a
exec wrangler deploy --domain "$BRIDGE_DOMAIN"
