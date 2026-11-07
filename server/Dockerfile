FROM node:26-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY migrations ./migrations
ENV PORT=3000
EXPOSE 3000
CMD ["node", "src/main.ts"]
