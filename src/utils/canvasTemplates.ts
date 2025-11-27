/**
 * Canvas Templates for Fabric.js
 * 
 * Generates initial canvas JSON structures for different layout types
 */

export const createNewsLayoutCanvas = (newsText: string) => {
  return {
    version: '6.0.0',
    objects: [
      // Header preto
      {
        type: 'rect',
        left: 0,
        top: 0,
        width: 700,
        height: 80,
        fill: '#000000',
        selectable: true,
        hasControls: true
      },
      // Texto "Notícias" no header
      {
        type: 'textbox',
        left: 350,
        top: 25,
        width: 300,
        text: 'Notícias',
        fill: '#FFFFFF',
        fontSize: 32,
        fontWeight: 'bold',
        fontFamily: 'Arial',
        textAlign: 'center',
        originX: 'center',
        selectable: true,
        hasControls: true
      },
      // Separador
      {
        type: 'line',
        left: 50,
        top: 100,
        x1: 0,
        y1: 0,
        x2: 600,
        y2: 0,
        stroke: '#CCCCCC',
        strokeWidth: 2,
        selectable: true,
        hasControls: true
      },
      // Texto da notícia (principal)
      {
        type: 'textbox',
        left: 350,
        top: 180,
        width: 600,
        text: newsText || 'Texto da notícia',
        fill: '#000000',
        fontSize: 24,
        fontFamily: 'Arial',
        textAlign: 'center',
        originX: 'center',
        selectable: true,
        hasControls: true,
        splitByGrapheme: true
      },
      // Área cinza para imagem (placeholder)
      {
        type: 'rect',
        left: 50,
        top: 350,
        width: 600,
        height: 300,
        fill: '#E5E5E5',
        selectable: true,
        hasControls: true
      },
      // Texto "Imagem" no placeholder
      {
        type: 'textbox',
        left: 350,
        top: 475,
        width: 150,
        text: 'Imagem',
        fill: '#999999',
        fontSize: 20,
        fontFamily: 'Arial',
        textAlign: 'center',
        originX: 'center',
        selectable: true,
        hasControls: true
      }
    ],
    background: '#FFFFFF'
  };
};

export const createCardLayoutCanvas = (cardText: string, ctaText: string) => {
  return {
    version: '6.0.0',
    objects: [
      // Área cinza grande para texto/imagem
      {
        type: 'rect',
        left: 173.86,
        top: 133.16,
        width: 365.52,
        height: 365.52,
        fill: '#B8B8B8',
        selectable: true,
        hasControls: true
      },
      // Texto no card
      {
        type: 'textbox',
        left: 356,
        top: 280,
        width: 350,
        text: cardText || 'Texto',
        fill: '#000000',
        fontSize: 20,
        fontFamily: 'Times New Roman',
        textAlign: 'center',
        originX: 'center',
        selectable: true,
        hasControls: true,
        splitByGrapheme: true
      },
      // Botão CTA (retângulo preto)
      {
        type: 'rect',
        left: 263.48,
        top: 427.52,
        width: 186.17,
        height: 39.3,
        fill: '#000000',
        selectable: true,
        hasControls: true
      },
      // Texto do CTA
      {
        type: 'textbox',
        left: 356,
        top: 435,
        width: 150,
        text: ctaText || 'CTA',
        fill: '#F2F2F2',
        fontSize: 20,
        fontFamily: 'Times New Roman',
        textAlign: 'center',
        originX: 'center',
        selectable: true,
        hasControls: true
      },
      // Área do Logo (retângulo preto)
      {
        type: 'rect',
        left: 288.75,
        top: 540.78,
        width: 142.53,
        height: 43.73,
        fill: '#000000',
        selectable: true,
        hasControls: true
      },
      // Texto "Logo"
      {
        type: 'textbox',
        left: 360,
        top: 548,
        width: 100,
        text: 'Logo',
        fill: '#FCFCFC',
        fontSize: 20,
        fontFamily: 'Times New Roman',
        textAlign: 'center',
        originX: 'center',
        selectable: true,
        hasControls: true
      }
    ],
    background: '#FFFFFF'
  };
};

export const createDefaultLayoutCanvas = (mainText: string, cta: string) => {
  return {
    version: '6.0.0',
    objects: [
      // Logo área (retângulo preto no topo esquerdo)
      {
        type: 'rect',
        left: 50,
        top: 50,
        width: 150,
        height: 60,
        fill: '#000000',
        selectable: true,
        hasControls: true
      },
      // Texto "Logo"
      {
        type: 'textbox',
        left: 125,
        top: 65,
        width: 100,
        text: 'Logo',
        fill: '#FFFFFF',
        fontSize: 24,
        fontFamily: 'Arial',
        fontWeight: 'bold',
        textAlign: 'center',
        originX: 'center',
        selectable: true,
        hasControls: true
      },
      // Texto principal (centralizado)
      {
        type: 'textbox',
        left: 350,
        top: 280,
        width: 600,
        text: mainText || 'Texto',
        fill: '#000000',
        fontSize: 32,
        fontFamily: 'Arial',
        textAlign: 'center',
        originX: 'center',
        selectable: true,
        hasControls: true,
        splitByGrapheme: true
      },
      // CTA Button (retângulo preto)
      {
        type: 'rect',
        left: 275,
        top: 480,
        width: 150,
        height: 50,
        fill: '#000000',
        selectable: true,
        hasControls: true
      },
      // Texto do CTA
      {
        type: 'textbox',
        left: 350,
        top: 492,
        width: 130,
        text: cta || 'CTA',
        fill: '#FFFFFF',
        fontSize: 20,
        fontFamily: 'Arial',
        fontWeight: 'bold',
        textAlign: 'center',
        originX: 'center',
        selectable: true,
        hasControls: true
      }
    ],
    background: '#FFFFFF'
  };
};
