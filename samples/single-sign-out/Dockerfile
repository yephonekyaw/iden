# Two applications from one image.
#
# APP picks which — `portal` on 5200, `library` on 5201 — the same switch
# `pnpm portal` and `pnpm library` use. Run it twice, once with each value:
# that the two share nothing but the browser and IDEN is the entire point of
# the demo, so one container running both would prove nothing.
#
#   docker run -e APP=portal  -p 5200:5200 iden-single-sign-out
#   docker run -e APP=library -p 5201:5201 iden-single-sign-out
#
# Behind a proxy, set ORIGIN to the public URL. The redirect URI and the
# post-logout redirect are both built from it, and both are matched exactly.
FROM node:22-alpine
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Dev dependencies included on purpose: the sample runs its TypeScript directly
# through tsx and has no build step, which is one less layer between a reader
# and the two hundred lines that matter.
RUN pnpm install --frozen-lockfile

COPY . .

# Not root. Nothing here is ever written to, so read access is enough.
USER node

ENV APP=portal
EXPOSE 5200 5201

# tsx directly rather than through `pnpm exec`: corepack resolves pnpm against
# the *running* user's cache, and this user has none — it would try to download
# pnpm again on every start, offline or not.
CMD ["./node_modules/.bin/tsx", "src/server.ts"]
