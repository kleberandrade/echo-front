# Build from the repository root. The server and agents share an internal
# network; the sandbox does not depend on host port publishing.
FROM node:24-slim AS build
ENV CI=true
RUN npm install --global pnpm@10.34.9
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
# tournament.ts imports SDK types, so the SDK must be built before the server.
RUN pnpm --filter @echo-front/protocol build \
 && pnpm --filter @echo-front/sim build \
 && pnpm --filter @echo-front/agents-sdk build \
 && pnpm --filter @echo-front/server build
# Copy workspace dependencies as real files into a standalone runtime tree.
RUN pnpm --filter @echo-front/server deploy --prod --legacy /out

FROM node:24-slim AS runtime
WORKDIR /app
COPY --from=build /out ./
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "dist/main.js"]
