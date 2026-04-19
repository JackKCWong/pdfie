FROM node:24
WORKDIR /app

# COPY package.json tsconfig.json postcss.config.mjs next.config.ts eslint.config.mjs ./
COPY *.json  *.mjs *.ts ./
COPY src src
COPY public public
RUN npm i

EXPOSE 3000 4111

CMD ["sh", "-c", "npx next dev & npx mastra dev"]
