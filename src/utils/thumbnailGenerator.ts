import { PDFDocument } from 'pdf-lib';

export const generatePdfThumbnail = async (file: File): Promise<string | null> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    
    if (pdfDoc.getPageCount() === 0) return null;
    
    // Para PDFs, vamos criar uma representação visual simples
    // já que extrair a primeira página requer mais bibliotecas pesadas
    return null;
  } catch (error) {
    console.error('Erro ao gerar thumbnail do PDF:', error);
    return null;
  }
};

export const generateVideoThumbnail = async (file: File): Promise<string | null> => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    video.onloadedmetadata = () => {
      // Configurar o canvas com as dimensões do vídeo
      const { videoWidth, videoHeight } = video;
      const aspectRatio = videoWidth / videoHeight;
      
      // Limitar o tamanho do thumbnail
      const maxWidth = 400;
      const maxHeight = 400;
      
      let width = maxWidth;
      let height = maxWidth / aspectRatio;
      
      if (height > maxHeight) {
        height = maxHeight;
        width = maxHeight * aspectRatio;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Buscar o primeiro frame
      video.currentTime = 0.1; // Um pouco depois do início para evitar frames pretos
    };

    video.oncanplay = () => {
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve(thumbnailUrl);
      } else {
        resolve(null);
      }
      
      // Limpar recursos
      video.remove();
    };

    video.onerror = () => {
      console.error('Erro ao carregar vídeo para thumbnail');
      resolve(null);
      video.remove();
    };

    // Configurar o vídeo
    video.src = URL.createObjectURL(file);
    video.muted = true;
    video.preload = 'metadata';
    video.style.display = 'none';
    document.body.appendChild(video);
  });
};

export const generateImageThumbnail = async (file: File): Promise<string | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      const { naturalWidth, naturalHeight } = img;
      const aspectRatio = naturalWidth / naturalHeight;
      
      // Limitar o tamanho do thumbnail
      const maxWidth = 400;
      const maxHeight = 400;
      
      let width = maxWidth;
      let height = maxWidth / aspectRatio;
      
      if (height > maxHeight) {
        height = maxHeight;
        width = maxHeight * aspectRatio;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve(thumbnailUrl);
      } else {
        resolve(null);
      }
    };

    img.onerror = () => {
      console.error('Erro ao carregar imagem para thumbnail');
      resolve(null);
    };

    img.src = URL.createObjectURL(file);
  });
};