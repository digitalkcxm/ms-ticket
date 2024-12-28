#!/bin/sh

# Rodar as migrations
echo "Rodando migrations..."
npm run migrate:latest

# Iniciar a aplicação
echo "Iniciando a aplicação..."
exec npm run start:prod
