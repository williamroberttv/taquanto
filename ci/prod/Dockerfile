FROM node:24-alpine3.23 AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build


FROM node:24-alpine3.23 AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist/taquanto ./dist/taquanto
EXPOSE 4000
CMD ["node", "dist/taquanto/server/server.mjs"]
