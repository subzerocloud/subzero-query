# First stage: Node.js builder
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package.json and yarn.lock files
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --ignore-optional

# Copy the rest of the source code
COPY . .

# Run the build script
RUN yarn build

# Second stage: Nginx web server
FROM nginx:stable-alpine

# Copy the static content from the builder stage to the Nginx default directory
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80 (HTTP)
EXPOSE 80
