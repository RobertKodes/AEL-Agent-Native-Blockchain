FROM node:22-alpine
WORKDIR /app
COPY --chown=node:node package.json README.md ./
COPY --chown=node:node src ./src
COPY --chown=node:node web ./web
COPY --chown=node:node agent-sdk-py ./agent-sdk-py
COPY --chown=node:node scripts/ael-join.mjs ./scripts/ael-join.mjs
COPY --chown=node:node scripts/ael-mirror-proof.mjs ./scripts/ael-mirror-proof.mjs
COPY --chown=node:node dist/ael-local-devnet.tar.gz ./dist/ael-local-devnet.tar.gz
COPY --chown=root:root ops/container-entrypoint.sh ./ops/container-entrypoint.sh
USER root
ENV AEL_HOST=0.0.0.0 AEL_STATE=/data/devnet-state.json AEL_VALIDATORS=4
EXPOSE 1317
HEALTHCHECK --interval=10s --timeout=3s --start-period=3s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||1317)+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
ENTRYPOINT ["sh", "/app/ops/container-entrypoint.sh"]
CMD ["node", "src/devnet.js"]
