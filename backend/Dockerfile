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
ENV SQLITE_DATASETS=/sqlite_datasets
ENV SERVER_HOST=0.0.0.0
ENV SERVER_PORT=4000
COPY --from=builder /app/dist /app
COPY --from=builder /app/scripts /app/scripts
# we need ssh to be able to use with mrsk app exec -i --reuse bash
RUN apk add --no-cache openssh-client curl bash sqlite jq file
EXPOSE 4000
CMD ["node", "/app/server.cjs"]
