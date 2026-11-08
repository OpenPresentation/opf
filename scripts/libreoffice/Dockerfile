# The LibreOffice qualification environment for a local run (docs/libreoffice.md). The CI leg runs the same install script in
# the same image. The base image is passed in so it can never differ from the pinned workflow image:
#   docker build -f scripts/libreoffice/Dockerfile --build-arg IMAGE="$(node scripts/libreoffice/image.mjs)" -t opf-libreoffice .
#   docker run --rm -v "$PWD:/opf" -w /opf opf-libreoffice bash -lc "corepack enable && pnpm install --frozen-lockfile && pnpm build && node scripts/libreoffice/run.mjs"
ARG IMAGE
FROM ${IMAGE}
COPY scripts/libreoffice/environment.json scripts/libreoffice/install.sh /opt/opf-libreoffice/
RUN bash /opt/opf-libreoffice/install.sh /tmp/opf-libreoffice && rm -rf /tmp/opf-libreoffice /var/lib/apt/lists/*
