# ---- Build ----
FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn build

# ---- Release ----
FROM node:18-alpine AS release
WORKDIR /app
ENV DB_PATH=/data
ENV SERVER_HOST=0.0.0.0
ENV SERVER_PORT=4000
COPY --from=builder /app/dist /app

EXPOSE 4000
CMD ["node", "/app/server.cjs"]
