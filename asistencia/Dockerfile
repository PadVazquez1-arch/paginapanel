FROM node:22-alpine
WORKDIR /app
ENV TZ=America/Matamoros
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
VOLUME ["/app/datos"]
EXPOSE 3000
CMD ["node", "server.js"]
