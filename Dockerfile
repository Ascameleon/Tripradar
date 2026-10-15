FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --chown=node:node api ./api
USER node
EXPOSE 3000
CMD ["node", "api/server.mjs"]
