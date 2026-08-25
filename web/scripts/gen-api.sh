#!/usr/bin/env bash
# Regenerate shared/api/schema.d.ts from the provider's OpenAPI document.
#
# The schema is read straight out of the FastAPI app rather than over HTTP, so
# this works without a running server, a database, or Redis — a clone can
# regenerate types before anything is deployed.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
provider="$here/../../provider"
out="$here/../shared/api/schema.d.ts"
tmp="$(mktemp -t iden-openapi)"
trap 'rm -f "$tmp"' EXIT

uv run --project "$provider" python -c \
  'import json; from provider.core.app import app; print(json.dumps(app.openapi()))' > "$tmp"

pnpm exec openapi-typescript "$tmp" -o "$out"
