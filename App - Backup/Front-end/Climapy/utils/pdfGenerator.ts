import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { generateMinimalistaHTML, generateModernoHTML } from './pdfStyles';
import type { AtendimentoPDFData, PDFStyle } from './pdfTypes';

export type { AtendimentoPDFData, PDFStyle } from './pdfTypes';

export const generateAtendimentoPDF = async (data: AtendimentoPDFData, style: PDFStyle = 'moderno'): Promise<void> => {
  try {
    const htmlContent = style === 'moderno' ? generateModernoHTML(data) : generateMinimalistaHTML(data);
    
    const { uri } = await Print.printToFileAsync({
      html: htmlContent,
      base64: false,
    });
    
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Ordem de Serviço - ${data.codigo}`,
        UTI: 'com.adobe.pdf',
      });
    } else {
      console.log('PDF gerado em:', uri);
      alert('PDF gerado com sucesso!');
    }
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    throw error;
  }
};
