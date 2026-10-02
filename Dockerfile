FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app
COPY --chown=node:node server.mjs domains.json ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:3000/healthz',{headers:{host:'localhost'}}).then(r=>process.exit(r.status===204?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "server.mjs"]
