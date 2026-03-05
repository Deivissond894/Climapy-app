#!/bin/bash

# Script de instalação de dependências para melhorias de escalabilidade
# Execute: chmod +x install-deps.sh && ./install-deps.sh

echo "🚀 Instalando dependências para escalabilidade..."
echo ""

# Dependências de teste
echo "📦 Instalando dependências de teste..."
npm install --save-dev jest @testing-library/react-native @testing-library/jest-native @testing-library/react-hooks react-test-renderer

# Sentry
echo ""
echo "📦 Instalando Sentry..."
npm install @sentry/react-native

# Jest Expo preset
echo ""
echo "📦 Instalando Jest Expo preset..."
npm install --save-dev jest-expo

echo ""
echo "✅ Todas as dependências instaladas com sucesso!"
echo ""
echo "📝 Próximos passos:"
echo "1. Execute 'npm test' para rodar os testes"
echo "2. Configure o Sentry (veja ESCALABILIDADE.md)"
echo "3. Configure GitHub Actions (veja RESUMO_IMPLEMENTACOES.md)"
echo ""
echo "📚 Documentação completa em:"
echo "   - ESCALABILIDADE.md"
echo "   - RESUMO_IMPLEMENTACOES.md"
echo ""
