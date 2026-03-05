# Use Node.js 20 LTS
FROM node:20-alpine

# Defina o diretório de trabalho
WORKDIR /app

# Copie o package.json e package-lock.json
COPY package*.json ./

# Instale as dependências
RUN npm install --production

# Copie o resto do código
COPY . .

# Exponha a porta
EXPOSE 10000

# Comando para iniciar a aplicação
CMD ["npm", "start"]
