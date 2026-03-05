#!/bin/bash

# Script de teste para o endpoint de processamento de áudio
# Certifique-se de ter um arquivo de áudio em base64 para testar

BASE_URL="http://localhost:10000"
# BASE_URL="https://climapp-1hxc.onrender.com"

echo "======================================"
echo "🧪 TESTES DA API DE PROCESSAMENTO DE ÁUDIO"
echo "======================================"
echo ""

# Teste 1: Verificar status do serviço
echo "📊 Teste 1: Verificando status do serviço..."
curl -X GET "${BASE_URL}/ai/status" \
  -H "Content-Type: application/json" \
  | python -m json.tool

echo ""
echo "======================================"
echo ""

# Teste 2: Processar áudio de exemplo (você precisa substituir pelo seu base64)
echo "🎤 Teste 2: Processando áudio de exemplo..."
echo "⚠️ NOTA: Substitua AUDIO_BASE64_AQUI pelo seu áudio codificado em base64"
echo ""

# Exemplo de payload
# Você precisa ter um áudio real em base64 para testar
cat << 'EOF' > test-audio-payload.json
{
  "audioData": "AUDIO_BASE64_AQUI",
  "audioFormat": "wav",
  "uid": "test_user_123",
  "clientId": "test_client_456"
}
EOF

echo "Payload salvo em test-audio-payload.json"
echo "Para testar, execute:"
echo ""
echo "curl -X POST \"${BASE_URL}/ai/process-audio\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d @test-audio-payload.json \\"
echo "  | python -m json.tool"
echo ""

# Teste 3: Testar erro de áudio faltando
echo "======================================"
echo "❌ Teste 3: Testando validação (áudio faltando)..."
curl -X POST "${BASE_URL}/ai/process-audio" \
  -H "Content-Type: application/json" \
  -d '{
    "audioFormat": "wav"
  }' \
  | python -m json.tool

echo ""
echo "======================================"
echo ""

# Teste 4: Testar formato inválido
echo "❌ Teste 4: Testando validação (formato inválido)..."
curl -X POST "${BASE_URL}/ai/process-audio" \
  -H "Content-Type: application/json" \
  -d '{
    "audioData": "fake_base64_data",
    "audioFormat": "invalid_format"
  }' \
  | python -m json.tool

echo ""
echo "======================================"
echo "✅ Testes de validação concluídos!"
echo "======================================"
