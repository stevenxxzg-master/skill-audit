# ─── Build stage ───
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
# No npm install needed — zero external dependencies
COPY . .

# ─── Runtime stage ───
FROM node:22-alpine
RUN apk add --no-cache git unzip && \
    addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app
COPY --from=build /app /app
USER appuser
EXPOSE 3847
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3847/api/health || exit 1
CMD ["node", "src/server-start.js"]
