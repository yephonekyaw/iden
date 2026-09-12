# The door controller.
#
# A resource server and nothing else: it holds no credential, starts no sign-in,
# and talks to IDEN only to fetch the public signing keys. That is why there is
# no secret to pass in here and no `.env` to mount — the only configuration is
# an issuer to trust and an audience to be.
#
#   docker run -p 5400:5400 \
#     -e IDEN_ISSUER=https://iden.example.org \
#     -e DOOR_AUDIENCE=https://api.example.org/door \
#     iden-door-api
FROM node:22-alpine
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Dev dependencies included on purpose: the sample runs its TypeScript directly
# through tsx and has no build step, which is one less layer between a reader
# and the hundred lines that matter.
RUN pnpm install --frozen-lockfile

COPY . .

# Not root. Nothing here is ever written to, so read access is enough.
USER node

EXPOSE 5400

# tsx directly rather than through `pnpm exec`: corepack resolves pnpm against
# the *running* user's cache, and this user has none — it would try to download
# pnpm again on every start, offline or not.
CMD ["./node_modules/.bin/tsx", "src/server.ts"]
