#!/bin/sh
# Injects runtime configuration before nginx starts. Baking the issuer in at
# build time would mean one image per deployment.
set -e
cat > /usr/share/nginx/html/config.js <<JS
window.__IDEN_CONFIG__ = { issuer: "${IDEN_ISSUER:-http://localhost:8000}" };
JS
