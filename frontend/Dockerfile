# Stage 1: Development
FROM node:20-alpine AS dev

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]

# Stage 2: Build Production Bundle
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 3: Production Nginx Runtime
FROM nginx:1.27-alpine AS prod

# Remove default Nginx website
RUN rm -rf /usr/share/nginx/html/*

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom production Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
