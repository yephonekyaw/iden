# Build the SPA, then serve it as static files.
#
# The workspace root is the build context: `@iden/shared` is a workspace
# dependency, so a context of `auth-ui/` alone could not resolve it.
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY shared/package.json shared/
COPY auth-ui/package.json auth-ui/
RUN pnpm install --frozen-lockfile --filter @iden/auth-ui...

COPY shared/ shared/
COPY auth-ui/ auth-ui/
RUN pnpm --filter @iden/auth-ui build

FROM nginx:alpine
COPY --from=build /app/auth-ui/dist /usr/share/nginx/html
COPY auth-ui/nginx.conf /etc/nginx/conf.d/default.conf
COPY auth-ui/entrypoint.sh /docker-entrypoint.d/40-iden-config.sh
RUN chmod +x /docker-entrypoint.d/40-iden-config.sh
EXPOSE 4000
