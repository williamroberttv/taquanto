FROM node:24-alpine3.23 AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.31.2-alpine

COPY ci/prod/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/taquanto/browser /usr/share/nginx/html

EXPOSE 80

