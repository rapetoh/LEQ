# Build context is the repository root:
#   fly deploy -c apps/serveur/fly.toml --dockerfile apps/serveur/Dockerfile .
# Stage 1 installs and compiles the three TypeScript workspaces the server needs.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
# Every workspace manifest, so the lockfile resolves; only three are installed.
COPY apps/mobile/package.json apps/mobile/
COPY apps/admin/package.json apps/admin/
COPY apps/serveur/package.json apps/serveur/
COPY packages/domaine/package.json packages/domaine/
COPY packages/moteur/package.json packages/moteur/
RUN npm ci --no-audit --no-fund --include-workspace-root \
      --workspace @leq/domaine --workspace @leq/moteur --workspace @leq/serveur
COPY packages/domaine packages/domaine
COPY packages/moteur packages/moteur
COPY apps/serveur apps/serveur
RUN npm run build --workspace @leq/domaine \
 && npm run build --workspace @leq/moteur \
 && npm run build --workspace @leq/serveur \
 && npm prune --omit=dev --no-audit --no-fund --include-workspace-root \
      --workspace @leq/domaine --workspace @leq/moteur --workspace @leq/serveur

# Stage 2 is the runtime: Node 22, ffmpeg for decoding, Python with Praat for prosody.
FROM node:22-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg python3 python3-venv ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY apps/serveur/prosodie/requirements.txt /app/apps/serveur/prosodie/requirements.txt
RUN python3 -m venv /opt/prosodie \
 && /opt/prosodie/bin/pip install --no-cache-dir -r /app/apps/serveur/prosodie/requirements.txt
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/domaine/package.json ./packages/domaine/package.json
COPY --from=build /app/packages/domaine/dist ./packages/domaine/dist
COPY --from=build /app/packages/moteur/package.json ./packages/moteur/package.json
COPY --from=build /app/packages/moteur/dist ./packages/moteur/dist
COPY --from=build /app/apps/serveur/package.json ./apps/serveur/package.json
COPY --from=build /app/apps/serveur/dist ./apps/serveur/dist
COPY apps/serveur/prosodie ./apps/serveur/prosodie
ENV NODE_ENV=production \
    PORT=8080 \
    PYTHON_PATH=/opt/prosodie/bin/python3 \
    FFMPEG_PATH=ffmpeg
USER node
EXPOSE 8080
CMD ["node", "apps/serveur/dist/index.js"]
