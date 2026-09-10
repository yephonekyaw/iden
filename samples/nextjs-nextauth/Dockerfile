# A stock Next.js server, built the way Next documents for containers.
#
# `output: "standalone"` in next.config.ts is what makes the second stage
# possible: the build traces the files actually imported and writes a server
# with its own minimal node_modules, so the runtime image carries neither pnpm
# nor the dev dependencies that compiled it.
#
# Nothing IDEN-specific is baked in. The issuer, the client credentials and
# AUTH_SECRET are read from the environment when the server starts, so one
# image serves any deployment:
#
#   docker run -p 5300:5300 \
#     -e IDEN_ISSUER=https://iden.example.org \
#     -e IDEN_CLIENT_ID=demo-nextjs -e IDEN_CLIENT_SECRET=... \
#     -e AUTH_SECRET=... -e AUTH_URL=https://nextjs.example.org \
#     iden-nextjs-nextauth
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app

# Dependencies before source, so editing a page does not reinstall them.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build


FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

# Three pieces, and all three are required. `standalone` holds the server and
# its traced dependencies; `static` is deliberately not traced into it and has
# to be placed where the server expects to find it.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static

# Not root. A container that is compromised should not also be privileged.
USER node

# Next binds loopback unless told otherwise, which inside a container means
# nothing outside it can connect.
ENV PORT=5300 HOSTNAME=0.0.0.0
EXPOSE 5300

CMD ["node", "server.js"]
