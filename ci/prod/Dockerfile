FROM node:alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build


FROM nginx:alpine

COPY ci/prod/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/taquanto/browser /usr/share/nginx/html
