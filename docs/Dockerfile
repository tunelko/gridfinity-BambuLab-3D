FROM node:20-alpine

WORKDIR /docs

COPY package.json ./
RUN npm install

COPY . .

EXPOSE 4173

CMD ["npx", "vitepress", "dev", "--host", "0.0.0.0", "--port", "4173"]
