import { Ionicons } from '@expo/vector-icons';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';

interface Material {
  id: string;
  nome: string;
  quantidade: string;
  precoCusto: string;
  markup: string;
  markupTipo: 'percentual' | 'soma';
  valorTotal: string;
}

interface Servico {
  id: string;
  descricao: string;
  valor: string;
}

export default function LaunchBudgetScreen() {
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [temGarantia, setTemGarantia] = useState(false);
  const [garantiaTipo, setGarantiaTipo] = useState<'dias' | 'meses'>('dias');
  const [garantiaTempo, setGarantiaTempo] = useState('');
  const [visitaRecebida, setVisitaRecebida] = useState(false);
  // ✅ Puxar valorVisita dos parâmetros da navegação, com fallback para '80,00'
  const [valorVisita, setValorVisita] = useState<string>(() => {
    const paramValor = params.valorVisita as string;
    return paramValor || '80,00';
  });
  const [imagens, setImagens] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showImageOptions, setShowImageOptions] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [markupMenuVisible, setMarkupMenuVisible] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);

  // ✅ Atualizar valorVisita quando params mudar
  React.useEffect(() => {
    if (params.valorVisita) {
      setValorVisita(params.valorVisita as string);
    }
  }, [params.valorVisita]);

  const adicionarMaterial = () => {
    setMateriais([...materiais, {
      id: Date.now().toString(),
      nome: '',
      quantidade: '',
      precoCusto: '',
      markup: '',
      markupTipo: 'percentual',
      valorTotal: 'R$ 0,00'
    }]);
  };

  const removerMaterial = (id: string) => {
    setMateriais(materiais.filter(m => m.id !== id));
  };

  const atualizarMaterial = (id: string, campo: keyof Material, valor: string) => {
    setMateriais(materiais.map(m => {
      if (m.id === id) {
        const updated = { ...m, [campo]: valor };
        
        // Se mudou o tipo de markup, formata o valor
        if (campo === 'markupTipo') {
          if (valor === 'soma') {
            // Formata para moeda quando mudar para R$
            const markupNum = parseFloat(updated.markup.replace(/\D/g, '')) || 0;
            updated.markup = (markupNum / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          } else {
            // Limpa formatação quando mudar para %
            updated.markup = updated.markup.replace(/\D/g, '');
          }
        }
        
        if (campo === 'quantidade' || campo === 'precoCusto' || campo === 'markup' || campo === 'markupTipo') {
          const qtd = parseFloat(updated.quantidade.replace(/\D/g, '')) || 0;
          const custo = parseFloat(updated.precoCusto.replace(/\D/g, '')) / 100 || 0;
          const markup = parseFloat(updated.markup.replace(/\D/g, '')) || 0;
          
          let precoVenda = custo;
          if (updated.markupTipo === 'percentual') {
            precoVenda = custo * (1 + markup / 100);
          } else {
            precoVenda = custo + (markup / 100);
          }
          
          const total = qtd * precoVenda;
          updated.valorTotal = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }
        return updated;
      }
      return m;
    }));
  };

  const adicionarServico = () => {
    setServicos([...servicos, {
      id: Date.now().toString(),
      descricao: '',
      valor: ''
    }]);
  };

  const removerServico = (id: string) => {
    setServicos(servicos.filter(s => s.id !== id));
  };

  const atualizarServico = (id: string, campo: keyof Servico, valor: string) => {
    setServicos(servicos.map(s => s.id === id ? { ...s, [campo]: valor } : s));
  };

  const formatCurrency = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    const amount = parseFloat(numbers) / 100;
    return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const calcularTotal = () => {
    const totalMateriais = materiais.reduce((acc, m) => {
      const valor = parseFloat(m.valorTotal.replace(/\D/g, '')) / 100;
      return acc + valor;
    }, 0);
    const totalServicos = servicos.reduce((acc, s) => {
      const valor = parseFloat(s.valor.replace(/\D/g, '')) / 100;
      return acc + valor;
    }, 0);
    return (totalMateriais + totalServicos).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const typeText = async (text: string, onUpdate: (currentText: string) => void) => {
    for (let i = 0; i <= text.length; i++) {
      onUpdate(text.substring(0, i));
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  };

  const processarAudio = async (uri: string) => {
    try {
      setAudioLoading(true);

      const file = new File(uri);
      const base64Audio = await file.base64();

      const response = await fetch('https://back-end-restless-darkness-2411.fly.dev/ai/process-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioData: base64Audio,
          audioFormat: 'webm',
          uid: user?.id || 'anonymous',
          clientId: user?.id || 'anonymous',
        }),
      });

      if (!response.ok) throw new Error('Erro ao processar áudio');

      const data = await response.json();

      if (data.success && data.data) {
        // Adicionar materiais com animação
        if (data.data.pecas_materiais) {
          for (const peca of data.data.pecas_materiais) {
            const materialNome = Object.values(peca).find((v: any) => typeof v === 'string' && v !== peca.quantidade) as string;
            const materialId = Date.now().toString() + Math.random();
            
            const novoMaterial: Material = {
              id: materialId,
              nome: '',
              quantidade: peca.quantidade || '1',
              precoCusto: '',
              markup: '',
              markupTipo: 'percentual',
              valorTotal: 'R$ 0,00'
            };

            setMateriais(prev => [...prev, novoMaterial]);
            
            await typeText(materialNome, (currentText) => {
              setMateriais(prev => prev.map(m => 
                m.id === materialId ? { ...m, nome: currentText } : m
              ));
            });

            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }

        // Adicionar serviços com animação
        if (data.data.servicos) {
          for (const servico of data.data.servicos) {
            const servicoDesc = Object.values(servico).find((v: any) => typeof v === 'string') as string;
            const servicoId = Date.now().toString() + Math.random();
            
            const novoServico: Servico = {
              id: servicoId,
              descricao: '',
              valor: ''
            };

            setServicos(prev => [...prev, novoServico]);
            
            await typeText(servicoDesc, (currentText) => {
              setServicos(prev => prev.map(s => 
                s.id === servicoId ? { ...s, descricao: currentText } : s
              ));
            });

            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
      }
    } catch (error) {
      console.error('Erro ao processar áudio:', error);
    } finally {
      setAudioLoading(false);
    }
  };

  const handleAudioRecord = async () => {
    try {
      if (recorderState.isRecording) {
        await audioRecorder.stop();
        const uri = audioRecorder.uri;
        if (uri) await processarAudio(uri);
      } else {
        const permission = await requestRecordingPermissionsAsync();
        if (!permission.granted) return;
        
        await audioRecorder.prepareToRecordAsync();
        await audioRecorder.record();
      }
    } catch (error) {
      console.error('Erro na gravação:', error);
    }
  };

  const selecionarImagem = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        alert('Permissão para acessar a galeria é necessária!');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets.length > 0) {
        setShowImageOptions(false);
        
        // Upload múltiplas imagens
        for (const asset of result.assets) {
          await uploadImagem(asset.uri);
        }
      }
    } catch (error) {
      console.error('Erro ao selecionar imagem:', error);
      alert('Erro ao selecionar imagem');
    }
  };

  const tirarFoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (!permissionResult.granted) {
        alert('Permissão para usar a câmera é necessária!');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setShowImageOptions(false);
        await uploadImagem(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Erro ao tirar foto:', error);
      alert('Erro ao tirar foto');
    }
  };

  const uploadImagem = async (uri: string) => {
    try {
      setUploadingImage(true);

      // Preparar FormData
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'image.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('image', {
        uri,
        name: filename,
        type,
      } as any);

      // Adicionar atendimentoId e userId
      formData.append('atendimentoId', params.atendimentoId as string);
      formData.append('userId', user?.id || '');

      // Upload para o backend
      const response = await fetch(
        'https://back-end-restless-darkness-2411.fly.dev/upload/orcamento',
        {
          method: 'POST',
          body: formData,
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Erro ao fazer upload da imagem');
      }

      // Adiciona a URL pública retornada pelo Cloudinary
      setImagens(prev => [...prev, data.data.url]);
      
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      alert('Erro ao fazer upload da imagem. Tente novamente.');
    } finally {
      setUploadingImage(false);
    }
  };

  const removerImagem = async (index: number, url: string) => {
    try {
      // Extrai o publicId da URL do Cloudinary
      // URL exemplo: https://res.cloudinary.com/cloud-name/image/upload/v123456/folder/publicId.jpg
      const urlParts = url.split('/');
      const lastPart = urlParts[urlParts.length - 1]; // "publicId.jpg"
      const publicId = lastPart.split('.')[0]; // "publicId"

      console.log('Removendo imagem - publicId:', publicId);

      // Tenta deletar do Cloudinary
      try {
        const response = await fetch(
          `https://back-end-restless-darkness-2411.fly.dev/upload/orcamento/${publicId}`,
          { method: 'DELETE' }
        );

        const data = await response.json();
        console.log('Resposta delete:', data);

        if (!response.ok) {
          console.warn('Erro ao deletar no servidor, removendo localmente');
        }
      } catch (deleteError) {
        console.warn('Erro na requisição de delete, removendo localmente:', deleteError);
      }

      // Remove da lista local independente do resultado do servidor
      setImagens(imagens.filter((_, i) => i !== index));
      
    } catch (error) {
      console.error('Erro ao remover imagem:', error);
      // Remove localmente mesmo com erro
      setImagens(imagens.filter((_, i) => i !== index));
    }
  };

  const salvarOrcamento = async () => {
    try {
      setLoading(true);

      const payload = {
        atendimentoId: params.atendimentoId,
        userId: user?.id,
        clienteNome: params.clienteNome,
        produto: params.produto,
        materiais: materiais.map(m => ({
          id: m.id,
          nome: m.nome,
          quantidade: m.quantidade,
          precoCusto: m.precoCusto,
          markup: m.markup,
          markupTipo: m.markupTipo,
          valorTotal: m.valorTotal
        })),
        servicos: servicos.map(s => ({
          id: s.id,
          descricao: s.descricao,
          valor: s.valor
        })),
        garantia: {
          temGarantia,
          tipo: garantiaTipo,
          tempo: garantiaTempo
        },
        visitaRecebida,
        valorVisita,
        imagens,
        valorTotal: calcularTotal(),
        timestamp: new Date().toISOString()
      };

      console.log('Salvando orçamento:', payload);
      console.log('URL do endpoint:', `https://back-end-restless-darkness-2411.fly.dev/atendimentos/${params.atendimentoId}/orcamento`);
      console.log('atendimentoId recebido:', params.atendimentoId);

      const response = await fetch(
        `https://back-end-restless-darkness-2411.fly.dev/atendimentos/${params.atendimentoId}/orcamento`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        }
      );

      const data = await response.json();

      console.log('Resposta do servidor:', data);

      if (!response.ok || !data.success) {
        // Se o atendimento não foi encontrado, mostra erro mais claro
        if (data.error === 'ATENDIMENTO_NOT_FOUND') {
          throw new Error(`Atendimento "${params.atendimentoId}" não encontrado no sistema. Verifique se o atendimento foi criado corretamente.`);
        }
        throw new Error(data.message || 'Erro ao salvar orçamento');
      }

      console.log('Orçamento salvo com sucesso:', data);
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Erro ao salvar orçamento:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao salvar orçamento';
      alert(`Erro: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const consultarPrecos = async () => {
    try {
      setLoading(true);
      
      // Atualizar status do atendimento para "Sob Consulta"
      const response = await fetch(
        `https://back-end-restless-darkness-2411.fly.dev/atendimentos/${user?.id}/${params.atendimentoId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            Status: 'Sob Consulta'
          })
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Erro ao atualizar status');
      }

      console.log('Status atualizado para "Sob Consulta"');
      setShowSuccessModal(false);
      router.push('/orcamentos-panel');
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      alert('Erro ao atualizar status do atendimento');
    } finally {
      setLoading(false);
    }
  };

  const enviarOrcamento = async () => {
    try {
      setLoading(true);
      
      // Atualizar status do atendimento para "Aguardando"
      const response = await fetch(
        `https://back-end-restless-darkness-2411.fly.dev/atendimentos/${user?.id}/${params.atendimentoId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            Status: 'Aguardando'
          })
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Erro ao atualizar status');
      }

      console.log('Status atualizado para "Aguardando"');
      setShowSuccessModal(false);
      // TODO: Navegar para tela de envio de orçamento
      alert('Orçamento enviado! Status atualizado para "Aguardando"');
      router.back();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      alert('Erro ao atualizar status do atendimento');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#7902E0" />
          </TouchableOpacity>
          <Text style={styles.title}>Orçamento #{params.atendimentoId}</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Card Gravação de Voz */}
          <View style={[styles.card, styles.audioCard]}>
            <TouchableOpacity 
              style={[styles.micButton, recorderState.isRecording && styles.micButtonRecording]} 
              onPress={handleAudioRecord}
              disabled={audioLoading}
            >
              {audioLoading ? (
                <ActivityIndicator size="large" color="#fff" />
              ) : recorderState.isRecording ? (
                <Ionicons name="stop" size={32} color="#fff" />
              ) : (
                <Image 
                  source={require('../assets/images/mic-orç.png')} 
                  style={{ width: 80, height: 80, tintColor: '#fff' }}
                  resizeMode="contain"
                />
              )}
            </TouchableOpacity>
            <Text style={styles.audioHint}>
              {audioLoading 
                ? 'Processando áudio...' 
                : recorderState.isRecording 
                  ? 'Toque para parar e processar' 
                  : 'Toque para gravar diagnóstico por voz'}
            </Text>
          </View>

          {/* Card Materiais */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="construct-outline" size={24} color="#1BAFE0" />
              <Text style={styles.cardTitle}>Materiais</Text>
            </View>
            
            {materiais.map((material) => (
              <View key={material.id} style={styles.itemContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Nome da peça"
                  value={material.nome}
                  onChangeText={(v) => atualizarMaterial(material.id, 'nome', v)}
                />
                <View style={styles.row}>
                  <TextInput
                    style={[styles.input, { flex: 1.2 }]}
                    placeholder="Qtd"
                    keyboardType="numeric"
                    value={material.quantidade}
                    onChangeText={(v) => atualizarMaterial(material.id, 'quantidade', v)}
                  />
                  <TextInput
                    style={[styles.input, { flex: 2 }]}
                    placeholder="R$"
                    keyboardType="numeric"
                    value={material.precoCusto}
                    onChangeText={(v) => atualizarMaterial(material.id, 'precoCusto', formatCurrency(v))}
                  />
                </View>
                <View style={styles.bottomRow}>
                  <TextInput
                    style={[styles.input, styles.markupInputField]}
                    placeholder={material.markupTipo === 'percentual' ? 'Markup %' : 'Markup R$'}
                    keyboardType="numeric"
                    value={material.markup}
                    onChangeText={(v) => {
                      if (material.markupTipo === 'soma') {
                        // Formata como moeda para tipo R$
                        const formatted = formatCurrency(v);
                        atualizarMaterial(material.id, 'markup', formatted);
                      } else {
                        // Apenas números para percentual
                        atualizarMaterial(material.id, 'markup', v);
                      }
                    }}
                  />
                  <TouchableOpacity
                    style={styles.markupTypeSelector}
                    onPress={() => setMarkupMenuVisible(material.id)}
                  >
                    <Text style={styles.markupTypeSelectorText}>
                      {material.markupTipo === 'percentual' ? '%' : 'R$'}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="#666" />
                  </TouchableOpacity>
                  <View style={styles.totalContainer}>
                    <Text style={styles.totalText}>{material.valorTotal}</Text>
                  </View>
                </View>
                
                {/* Menu suspenso de seleção de tipo */}
                {markupMenuVisible === material.id && (
                  <Modal
                    transparent
                    visible={markupMenuVisible === material.id}
                    onRequestClose={() => setMarkupMenuVisible(null)}
                    animationType="fade"
                  >
                    <TouchableOpacity
                      style={styles.modalOverlay}
                      activeOpacity={1}
                      onPress={() => setMarkupMenuVisible(null)}
                    >
                      <View style={styles.dropdownMenu}>
                        <TouchableOpacity
                          style={styles.dropdownItem}
                          onPress={() => {
                            atualizarMaterial(material.id, 'markupTipo', 'percentual');
                            setMarkupMenuVisible(null);
                          }}
                        >
                          <Text style={styles.dropdownItemText}>Percentual (%)</Text>
                          {material.markupTipo === 'percentual' && (
                            <Ionicons name="checkmark" size={20} color="#1BAFE0" />
                          )}
                        </TouchableOpacity>
                        <View style={styles.dropdownDivider} />
                        <TouchableOpacity
                          style={styles.dropdownItem}
                          onPress={() => {
                            atualizarMaterial(material.id, 'markupTipo', 'soma');
                            setMarkupMenuVisible(null);
                          }}
                        >
                          <Text style={styles.dropdownItemText}>Valor Fixo (R$)</Text>
                          {material.markupTipo === 'soma' && (
                            <Ionicons name="checkmark" size={20} color="#1BAFE0" />
                          )}
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  </Modal>
                )}
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removerMaterial(material.id)}
                >
                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  <Text style={styles.removeButtonText}>Excluir item</Text>
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity style={styles.addButton} onPress={adicionarMaterial}>
              <Ionicons name="add-circle-outline" size={20} color="#1BAFE0" />
              <Text style={styles.addButtonText}>Adicionar Material</Text>
            </TouchableOpacity>
          </View>

          {/* Card Serviços */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="settings-outline" size={24} color="#7902E0" />
              <Text style={styles.cardTitle}>Serviços</Text>
            </View>

            {servicos.map((servico) => (
              <View key={servico.id} style={styles.itemContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Descrição do serviço"
                  value={servico.descricao}
                  onChangeText={(v) => atualizarServico(servico.id, 'descricao', v)}
                />
                <TextInput
                  style={styles.input}
                  placeholder="R$ 0,00"
                  keyboardType="numeric"
                  value={servico.valor}
                  onChangeText={(v) => atualizarServico(servico.id, 'valor', formatCurrency(v))}
                />
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removerServico(servico.id)}
                >
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity style={styles.addButton} onPress={adicionarServico}>
              <Ionicons name="add-circle-outline" size={20} color="#7902E0" />
              <Text style={styles.addButtonText}>Adicionar Serviço</Text>
            </TouchableOpacity>
          </View>

          {/* Card Imagens */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="images-outline" size={24} color="#7902E0" />
              <Text style={styles.cardTitle}>Imagens</Text>
            </View>

            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.imagensContainer}
            >
              {imagens.map((url, index) => (
                <View key={index} style={styles.imagemWrapper}>
                  <Image source={{ uri: url }} style={styles.imagemPreview} />
                  <TouchableOpacity 
                    style={styles.removerImagemButton}
                    onPress={() => removerImagem(index, url)}
                  >
                    <Ionicons name="close-circle" size={24} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}
              
              {uploadingImage && (
                <View style={styles.imagemWrapper}>
                  <View style={[styles.imagemPreview, styles.uploadingPreview]}>
                    <ActivityIndicator size="large" color="#7902E0" />
                    <Text style={styles.uploadingText}>Enviando...</Text>
                  </View>
                </View>
              )}
              
              <TouchableOpacity 
                style={styles.adicionarImagemButton}
                onPress={() => setShowImageOptions(true)}
                disabled={uploadingImage}
              >
                <Ionicons name="add-circle-outline" size={40} color="#1BAFE0" />
                <Text style={styles.adicionarImagemText}>
                  {imagens.length === 0 ? 'Adicionar Imagem' : 'Mais'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Card Pagamento Visita */}
          <View style={styles.card}>
            <View style={styles.checkboxRow}>
              <Switch
                value={visitaRecebida}
                onValueChange={setVisitaRecebida}
                trackColor={{ false: '#D1D5DB', true: '#1BAFE0' }}
                thumbColor={visitaRecebida ? '#fff' : '#f4f3f4'}
              />
              <Text style={styles.checkboxLabel}>Valor de R$ {valorVisita} da visita recebido</Text>
            </View>
          </View>

          {/* Card Garantia */}
          <View style={[styles.card, styles.garantiaCard]}>
            <View style={styles.cardHeader}>
              <Ionicons name="shield-checkmark-outline" size={24} color="#10B981" />
              <Text style={styles.cardTitle}>Garantia</Text>
            </View>

            <View style={styles.garantiaContent}>
              <View style={styles.checkboxRow}>
                <Switch
                  value={temGarantia}
                  onValueChange={setTemGarantia}
                  trackColor={{ false: '#D1D5DB', true: '#10B981' }}
                  thumbColor={temGarantia ? '#fff' : '#f4f3f4'}
                />
                <Text style={styles.checkboxLabel}>Garantia</Text>
              </View>

              {temGarantia && (
                <View style={styles.garantiaInputRow}>
                  <TextInput
                    style={[styles.input, styles.garantiaTempoInput]}
                    placeholder=""
                    keyboardType="numeric"
                    value={garantiaTempo}
                    onChangeText={setGarantiaTempo}
                  />
                  <View style={styles.pickerContainer}>
                    <TouchableOpacity
                      style={[styles.pickerButton, garantiaTipo === 'dias' && styles.pickerButtonActive]}
                      onPress={() => setGarantiaTipo('dias')}
                    >
                      <Text style={[styles.pickerButtonText, garantiaTipo === 'dias' && styles.pickerButtonTextActive]}>
                        Dias
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.pickerButton, garantiaTipo === 'meses' && styles.pickerButtonActive]}
                      onPress={() => setGarantiaTipo('meses')}
                    >
                      <Text style={[styles.pickerButtonText, garantiaTipo === 'meses' && styles.pickerButtonTextActive]}>
                        Meses
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </View>

          <View style={{ height: 120 }} />
        </ScrollView>

        {/* Total e Botão Salvar */}
        <View style={styles.footer}>
          <View style={styles.totalFooter}>
            <Text style={styles.totalFooterLabel}>Total do Orçamento:</Text>
            <Text style={styles.totalValue}>{calcularTotal()}</Text>
          </View>

          <TouchableOpacity
            style={styles.saveButton}
            onPress={salvarOrcamento}
            disabled={loading}
          >
            <LinearGradient colors={['#1BAFE0', '#7902E0']} style={styles.saveButtonGradient}>
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                  <Text style={styles.saveButtonText}>SALVAR ORÇAMENTO</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Modal de Opções de Imagem */}
        <Modal
          transparent
          visible={showImageOptions}
          onRequestClose={() => setShowImageOptions(false)}
          animationType="fade"
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowImageOptions(false)}
          >
            <View style={styles.imageOptionsMenu}>
              <Text style={styles.imageOptionsTitle}>Adicionar Imagem</Text>
              
              <TouchableOpacity
                style={styles.imageOptionItem}
                onPress={tirarFoto}
              >
                <Ionicons name="camera" size={24} color="#7902E0" />
                <Text style={styles.imageOptionText}>Tirar Foto</Text>
              </TouchableOpacity>
              
              <View style={styles.dropdownDivider} />
              
              <TouchableOpacity
                style={styles.imageOptionItem}
                onPress={selecionarImagem}
              >
                <Ionicons name="images" size={24} color="#7902E0" />
                <Text style={styles.imageOptionText}>Escolher da Galeria</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Modal de Sucesso - Próximos Passos */}
        <Modal
          transparent
          visible={showSuccessModal}
          onRequestClose={() => {
            setShowSuccessModal(false);
            router.back();
          }}
          animationType="fade"
        >
          <Pressable 
            style={styles.modalOverlay}
            onPress={() => {
              // Não faz nada ao clicar fora - força o usuário a escolher uma opção
            }}
          >
            <TouchableWithoutFeedback>
              <View style={styles.successModal}>
                <View style={styles.successIconContainer}>
                  <Ionicons name="checkmark-circle" size={64} color="#10B981" />
                </View>
                
                <Text style={styles.successTitle}>Orçamento Salvo!</Text>
                <Text style={styles.successSubtitle}>O que deseja fazer agora?</Text>

                <View style={styles.successActionsContainer}>
                  <TouchableOpacity
                    style={[styles.successActionButton, styles.consultaPrecosButton]}
                    onPress={consultarPrecos}
                  >
                    <Ionicons name="search-outline" size={24} color="#1BAFE0" />
                    <Text style={styles.consultaPrecosText}>Consultar Preços de Peças</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.successActionButton, styles.enviarOrcamentoButton]}
                    onPress={enviarOrcamento}
                  >
                    <LinearGradient 
                      colors={['#1BAFE0', '#7902E0']} 
                      style={styles.enviarOrcamentoGradient}
                    >
                      <Ionicons name="send-outline" size={24} color="#fff" />
                      <Text style={styles.enviarOrcamentoText}>Enviar Orçamento ao Cliente</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.voltarButton}
                  onPress={() => {
                    setShowSuccessModal(false);
                    router.back();
                  }}
                >
                  <Text style={styles.voltarButtonText}>Voltar ao Painel</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </Pressable>
        </Modal>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 16,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  garantiaCard: {
    backgroundColor: '#F0FDF4',
  },
  audioCard: {
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  micButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1BAFE0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1BAFE0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  micButtonRecording: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
  },
  audioHint: {
    marginTop: 16,
    fontSize: 14,
    color: '#0891B2',
    fontWeight: '600',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  itemContainer: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#333',
    backgroundColor: '#F9FAFB',
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  markupInputField: {
    flex: 1.5,
    marginBottom: 0,
  },
  markupTypeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    minWidth: 65,
  },
  markupTypeSelectorText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownMenu: {
    backgroundColor: '#fff',
    borderRadius: 12,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dropdownItemText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  markupTypePicker: {
    flexDirection: 'row',
    gap: 6,
  },
  typeButton: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#1BAFE0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    minWidth: 42,
  },
  typeButtonActive: {
    backgroundColor: '#1BAFE0',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1BAFE0',
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  markupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 0,
    marginBottom: 10,
    overflow: 'hidden',
  },
  markupInput: {
    flex: 1,
    padding: 12,
    fontSize: 15,
    color: '#333',
    backgroundColor: 'transparent',
  },
  markupPicker: {
    flexDirection: 'row',
    borderLeftWidth: 1,
    borderLeftColor: '#E5E7EB',
  },
  markupOption: {
    paddingHorizontal: 10,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    minWidth: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markupOptionActive: {
    backgroundColor: '#1BAFE0',
  },
  markupOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  markupOptionTextActive: {
    color: '#fff',
  },
  totalContainer: {
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1BAFE0',
  },
  totalText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1BAFE0',
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    marginTop: 8,
  },
  removeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderWidth: 2,
    borderColor: '#1BAFE0',
    borderStyle: 'dashed',
    borderRadius: 10,
    marginTop: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1BAFE0',
  },
  garantiaContent: {
    gap: 12,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkboxLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  garantiaInputRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  garantiaTempoInput: {
    flex: 1,
    marginBottom: 0,
  },
  pickerContainer: {
    flex: 1.5,
    flexDirection: 'row',
    gap: 8,
  },
  pickerButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#10B981',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  pickerButtonActive: {
    backgroundColor: '#10B981',
  },
  pickerButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  pickerButtonTextActive: {
    color: '#fff',
  },
  tipoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  tipoButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#10B981',
    alignItems: 'center',
  },
  tipoButtonActive: {
    backgroundColor: '#10B981',
  },
  tipoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  tipoTextActive: {
    color: '#fff',
  },
  garantiaButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#10B981',
    alignItems: 'center',
  },
  garantiaButtonActive: {
    backgroundColor: '#10B981',
  },
  garantiaButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  garantiaButtonTextActive: {
    color: '#fff',
  },
  footer: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  totalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  totalFooterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1BAFE0',
  },
  saveButton: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  imagensContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  imagemWrapper: {
    position: 'relative',
    width: 120,
    height: 120,
  },
  imagemPreview: {
    width: 120,
    height: 120,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  uploadingPreview: {
    backgroundColor: '#F3E8FF',
    borderWidth: 2,
    borderColor: '#7902E0',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  uploadingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7902E0',
    marginTop: 4,
  },
  removerImagemButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  adicionarImagemButton: {
    width: 120,
    height: 120,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#1BAFE0',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    gap: 4,
  },
  adicionarImagemText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1BAFE0',
    textAlign: 'center',
  },
  imageOptionsMenu: {
    backgroundColor: '#fff',
    borderRadius: 16,
    minWidth: 280,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  imageOptionsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  imageOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  imageOptionText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  successModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 32,
    paddingHorizontal: 24,
    maxWidth: 380,
    width: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  successIconContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
    textAlign: 'center',
    marginBottom: 28,
  },
  successActionsContainer: {
    gap: 12,
    marginBottom: 20,
  },
  successActionButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  consultaPrecosButton: {
    borderWidth: 2,
    borderColor: '#1BAFE0',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  consultaPrecosText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1BAFE0',
  },
  enviarOrcamentoButton: {
    overflow: 'hidden',
  },
  enviarOrcamentoGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  enviarOrcamentoText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  voltarButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  voltarButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
  },
});
