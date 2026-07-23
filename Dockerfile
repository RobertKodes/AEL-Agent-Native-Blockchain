FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json README.md LICENSE CONTRIBUTING.md SECURITY.md CODE_OF_CONDUCT.md ./
COPY src ./src
COPY web ./web
COPY agent-sdk-py ./agent-sdk-py
COPY scripts ./scripts
COPY docs ./docs
COPY skills ./skills
COPY wallet-extension ./wallet-extension
COPY test ./test
COPY test-vectors ./test-vectors
COPY ci ./ci
COPY ops ./ops
COPY .github ./.github
COPY Dockerfile Dockerfile.actor Dockerfile.node Dockerfile.consensus ./
COPY compose*.yaml ./
COPY .dockerignore .railwayignore .gitignore ./
RUN npm install --ignore-scripts && node scripts/build.js --skip-tests

FROM node:22-alpine
WORKDIR /app
COPY --from=builder --chown=node:node /app ./
COPY --chown=root:root ops/container-entrypoint.sh ./ops/container-entrypoint.sh
USER root
ENV AEL_HOST=0.0.0.0 AEL_STATE=/data/devnet-state.json AEL_VALIDATORS=4
EXPOSE 1317
HEALTHCHECK --interval=10s --timeout=3s --start-period=3s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||1317)+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
ENTRYPOINT ["sh", "/app/ops/container-entrypoint.sh"]
CMD ["node", "src/devnet.js"]
