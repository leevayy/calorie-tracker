FROM node:22-alpine

WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json* ./
RUN npm install
RUN ln -s /app/backend/node_modules /app/node_modules

COPY backend/tsconfig.json ./tsconfig.json
COPY backend/drizzle.config.ts ./drizzle.config.ts
COPY backend/src ./src
COPY contracts ../contracts

EXPOSE 3000

CMD ["sh", "-c", "npm run db:migrate && npm run start"]
