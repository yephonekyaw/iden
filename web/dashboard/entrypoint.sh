#!/bin/sh
# Injects runtime configuration before nginx starts. Baking the issuer or the
# organization in at build time would mean one image per deployment.
set -e
cat > /usr/share/nginx/html/console/config.js <<JS
window.__IDEN_CONFIG__ = {
  issuer: "${IDEN_ISSUER:-http://localhost:8000}",
  organization: "${IDEN_ORG_NAME:-}",
  organizationLogoUrl: "${IDEN_ORG_LOGO_URL:-}",
};
JS
