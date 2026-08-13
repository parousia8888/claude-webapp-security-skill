FROM node:22-alpine
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --chown=app:app server.js healthcheck.js ./
USER app
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD ["node", "healthcheck.js"]
CMD ["node", "server.js"]
