FROM node:alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
ARG POSTHOG_PROJECT_TOKEN=""
ARG POSTHOG_HOST="https://us.i.posthog.com"
RUN if [ -n "${POSTHOG_PROJECT_TOKEN}" ]; then \
      sed -i "s|__POSTHOG_PROJECT_TOKEN__|${POSTHOG_PROJECT_TOKEN}|g" src/environments/environment.ts && \
      sed -i "s|__POSTHOG_HOST__|${POSTHOG_HOST}|g" src/environments/environment.ts; \
    fi
RUN npm run build


FROM nginx:alpine

COPY ci/prod/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/taquanto/browser /usr/share/nginx/html
