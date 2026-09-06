# CPU image. A GPU image needs a CUDA base plus `onnxruntime-gpu` instead of
# `onnxruntime` in pyproject.toml — not needed for the dev setup described in
# README.md, where the engine runs directly on a machine with a GPU instead
# of inside this container.
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS build
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project --no-dev
COPY src ./src
RUN uv sync --frozen --no-dev

FROM python:3.12-slim
RUN useradd --uid 1000 --create-home engine
WORKDIR /app
COPY --from=build --chown=1000:1000 /app/.venv ./.venv
COPY --chown=1000:1000 src ./src
USER 1000
ENV PATH="/app/.venv/bin:$PATH"
EXPOSE 8000
HEALTHCHECK CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"]
CMD ["engine"]
