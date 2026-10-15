FROM node:22

WORKDIR /app

COPY package*.json ./

ARG NODE_ENV=development
ENV NODE_ENV=${NODE_ENV}

RUN npm ci

COPY . .

ENV PORT=3000
EXPOSE 3000

CMD [ "npm", "run","dev" ]

