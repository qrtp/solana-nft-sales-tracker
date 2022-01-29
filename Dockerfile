# base stage
FROM node:16 as base
WORKDIR /app

# build and run
COPY package.json package-lock.json ./
COPY . /app
RUN npm install
CMD ["node", "run-script-standalone.js"]
