# Build the playground, then serve it as static files.
#
# The context is this directory alone. Every sample is its own project with its
# own lockfile — nothing here resolves out of the repository, which is what
# makes a sample something you can copy out and run.
#
# Nothing is baked in: the issuer, the client id and every parameter are typed
# into the page, so one image works against any deployment.
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app

# Dependencies before source, so editing a component does not reinstall them.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
# `pnpm build` is `tsc --noEmit && vite build`, so a type error fails the image
# rather than shipping.
RUN pnpm build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 5100
