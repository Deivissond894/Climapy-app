import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { File } from 'expo-file-system';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';

interface ProcessingStatus {
  transcribing: boolean;
  analyzing: boolean;
  finalizing: boolean;
}

interface AnalysisResult {
  transcricao: string;
  problema_mencionado: string;
  pecas_mencionadas: string[];
  acao_necessaria: string[];
}

export default function AudioRecording() {
  const { user } = useAuth();
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);
  const [loadingModalVisible, setLoadingModalVisible] = useState(false);
  const [resultModalVisible, setResultModalVisible] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
    transcribing: false,
    analyzing: false,
    finalizing: false,
  });
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  // Solicitar permissões e iniciar gravação
  const startRecording = async () => {
    try {
      console.log('📱 Botão pressionado - Solicitando permissões...');
      
      // Solicitar permissões de áudio
      const permissionResponse = await requestRecordingPermissionsAsync();
      console.log('🔐 Resposta de permissão:', permissionResponse);
      
      if (!permissionResponse.granted) {
        console.log('❌ Permissão negada');
        Alert.alert('Permissão Negada', 'É necessário permitir o acesso ao microfone.');
        return;
      }

      console.log('✅ Permissão concedida, preparando gravação...');
      
      // Preparar e iniciar gravação
      await audioRecorder.prepareToRecordAsync();
      console.log('🎤 Gravador preparado, iniciando...');
      
      await audioRecorder.record();
      console.log('🔴 Gravação iniciada com sucesso!');
    } catch (err) {
      console.error('❌ Erro ao iniciar gravação:', err);
      Alert.alert('Erro', `Não foi possível iniciar a gravação: ${err}`);
    }
  };

  // Parar gravação e enviar para o backend
  const stopRecording = async () => {
    console.log('Parando gravação...');

    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      console.log('Gravação salva em:', uri);

      if (uri) {
        await sendAudioToBackend(uri);
      }
    } catch (error) {
      console.error('Erro ao parar gravação:', error);
      Alert.alert('Erro', 'Não foi possível processar a gravação.');
    }
  };

  // Converter áudio para base64 e enviar ao backend
  const sendAudioToBackend = async (uri: string) => {
    try {
      setLoadingModalVisible(true);

      // Simular status de transcrição
      setProcessingStatus({ transcribing: true, analyzing: false, finalizing: false });
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Ler o arquivo de áudio e converter para base64 usando nova API
      console.log('📂 Lendo arquivo de áudio:', uri);
      const file = new File(uri);
      const base64Audio = await file.base64();
      console.log('✅ Áudio convertido para base64, tamanho:', base64Audio.length);

      // Simular status de análise
      setProcessingStatus({ transcribing: true, analyzing: true, finalizing: false });
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Enviar para o backend
      console.log('🌐 Enviando para o backend...');
      
      const payload = {
        audioData: base64Audio,
        audioFormat: 'webm',
        uid: user?.id || 'anonymous',
        clientId: user?.id || 'anonymous',
      };
      
      console.log('📦 Payload preview:', {
        audioFormat: payload.audioFormat,
        uid: payload.uid,
        clientId: payload.clientId,
        audioDataLength: payload.audioData.length,
        audioDataPreview: payload.audioData.substring(0, 50) + '...'
      });

      const response = await fetch('https://back-end-restless-darkness-2411.fly.dev/ai/process-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log('📡 Status da resposta:', response.status);
      
      // Verificar se a resposta é válida
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro HTTP:', response.status, errorText);
        throw new Error(`Servidor retornou erro ${response.status}: ${errorText || 'Serviço indisponível'}`);
      }
      
      // Simular finalização
      setProcessingStatus({ transcribing: true, analyzing: true, finalizing: true });
      await new Promise((resolve) => setTimeout(resolve, 800));

      const data = await response.json();
      console.log('📥 Resposta do backend:', JSON.stringify(data, null, 2));

      if (data.success) {
        console.log('✅ Análise recebida com sucesso!');
        
        // Log da transcrição
        if (data.data?.transcricao) {
          console.log('🗣️ Transcrição do áudio:', data.data.transcricao);
        }
        
        // Log dos metadados
        if (data.data?.metadata) {
          console.log('📊 Metadata:', {
            modelo_transcricao: data.data.metadata.modelo_transcricao,
            modelo_extracao: data.data.metadata.modelo_extracao,
            total_pecas: data.data.metadata.total_pecas,
            total_servicos: data.data.metadata.total_servicos
          });
        }
        
        // Adaptar a estrutura da resposta para o formato esperado
        const resultado: AnalysisResult = {
          transcricao: data.data?.transcricao || 'Transcrição não disponível',
          problema_mencionado: data.data?.problema_mencionado || 'Problema não especificado',
          pecas_mencionadas: data.data?.pecas_materiais?.map((p: any) => 
            Object.values(p).find((v: any) => typeof v === 'string') as string
          ) || [],
          acao_necessaria: data.data?.servicos?.map((s: any) => 
            Object.values(s).find((v: any) => typeof v === 'string') as string
          ) || []
        };
        
        setAnalysisResult(resultado);
        setLoadingModalVisible(false);
        setResultModalVisible(true);
      } else {
        console.error('❌ Resposta sem sucesso:', data);
        throw new Error(data.message || 'Erro ao processar áudio');
      }
    } catch (error) {
      console.error('Erro ao enviar áudio:', error);
      setLoadingModalVisible(false);
      Alert.alert('Erro', 'Não foi possível processar o áudio. Tente novamente.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🎙️ Gravação de Áudio</Text>
        <Text style={styles.subtitle}>Grave informações técnicas sobre manutenção</Text>
      </View>

      <View style={styles.recordingContainer}>
        {recorderState.isRecording && (
          <View style={styles.recordingIndicator}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>Gravando...</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.recordButton, recorderState.isRecording && styles.recordButtonActive]}
          onPress={recorderState.isRecording ? stopRecording : startRecording}
        >
          <Text style={styles.recordButtonText}>
            {recorderState.isRecording ? '⏹️ Parar Gravação' : '🎙️ Iniciar Gravação'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.hint}>
          {recorderState.isRecording
            ? 'Toque para parar e enviar para análise'
            : 'Toque para começar a gravar'}
        </Text>
      </View>

      {/* Modal de Carregamento */}
      <Modal
        visible={loadingModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.loadingModal}>
            <Text style={styles.loadingTitle}>Processando Áudio</Text>

            <View style={styles.statusContainer}>
              <View style={styles.statusItem}>
                {processingStatus.transcribing ? (
                  <Text style={styles.statusCheck}>✅</Text>
                ) : (
                  <ActivityIndicator size="small" color="#007AFF" />
                )}
                <Text style={styles.statusText}>Transcrevendo áudio...</Text>
              </View>

              <View style={styles.statusItem}>
                {processingStatus.analyzing ? (
                  <Text style={styles.statusCheck}>✅</Text>
                ) : processingStatus.transcribing ? (
                  <ActivityIndicator size="small" color="#007AFF" />
                ) : (
                  <Text style={styles.statusPending}>⏳</Text>
                )}
                <Text style={styles.statusText}>Analisando informações técnicas...</Text>
              </View>

              <View style={styles.statusItem}>
                {processingStatus.finalizing ? (
                  <Text style={styles.statusCheck}>✅</Text>
                ) : processingStatus.analyzing ? (
                  <ActivityIndicator size="small" color="#007AFF" />
                ) : (
                  <Text style={styles.statusPending}>⏳</Text>
                )}
                <Text style={styles.statusText}>Finalizando...</Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Resultado */}
      <Modal
        visible={resultModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setResultModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.resultModal}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.resultTitle}>🔍 Análise Técnica</Text>

              {analysisResult && (
                <>
                  {/* Transcrição */}
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🗣️ Transcrição</Text>
                    <Text style={styles.transcriptionText}>
                      {analysisResult.transcricao}
                    </Text>
                  </View>

                  {/* Problema Mencionado */}
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>⚠️ Problema Mencionado</Text>
                    <Text style={styles.problemText}>
                      {analysisResult.problema_mencionado}
                    </Text>
                  </View>

                  {/* Peças Mencionadas */}
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🔧 Peças Mencionadas</Text>
                    {analysisResult.pecas_mencionadas.map((peca, index) => (
                      <Text key={index} style={styles.listItem}>
                        • {peca}
                      </Text>
                    ))}
                  </View>

                  {/* Ações Necessárias */}
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>✅ Ações Necessárias</Text>
                    {analysisResult.acao_necessaria.map((acao, index) => (
                      <Text key={index} style={styles.listItem}>
                        {index + 1}. {acao}
                      </Text>
                    ))}
                  </View>
                </>
              )}

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setResultModalVisible(false)}
              >
                <Text style={styles.closeButtonText}>Fechar</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  recordingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ff3b30',
    marginRight: 8,
  },
  recordingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ff3b30',
  },
  recordButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 50,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  recordButtonActive: {
    backgroundColor: '#ff3b30',
  },
  recordButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  hint: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingModal: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 30,
    width: '85%',
    maxWidth: 400,
  },
  loadingTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 25,
    textAlign: 'center',
  },
  statusContainer: {
    gap: 20,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusCheck: {
    fontSize: 24,
    marginRight: 12,
  },
  statusPending: {
    fontSize: 24,
    marginRight: 12,
    opacity: 0.3,
  },
  statusText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  resultModal: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 25,
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    marginBottom: 25,
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  transcriptionText: {
    fontSize: 15,
    color: '#555',
    fontWeight: '400',
    lineHeight: 22,
    fontStyle: 'italic',
  },
  problemText: {
    fontSize: 16,
    color: '#d32f2f',
    fontWeight: '500',
    lineHeight: 24,
  },
  listItem: {
    fontSize: 15,
    color: '#555',
    marginBottom: 8,
    lineHeight: 22,
  },
  closeButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
});
