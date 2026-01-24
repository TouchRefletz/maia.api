import { createRoot } from 'react-dom/client';
import { MainStructure } from '../render/StructureRender';

export function hydrateBankCard(cardElement: HTMLElement, data: { q: any, g: any, imgsOriginalQ: string[], jsonImgsG: string }) {
  if (!cardElement) return;

  // 1. Hydrate Question Body
  const qBodyContainer = cardElement.querySelector('.js-react-q-body');
  if (qBodyContainer && data.q) {
     const root = createRoot(qBodyContainer);
     root.render(
        <MainStructure 
            estrutura={data.q.estrutura} 
            imagensExternas={data.imgsOriginalQ} 
            contexto="banco_q" 
            isReadOnly={true}
        />
     );
  }

  // 2. Hydrate Explanation Steps
  // The steps are identified by .js-react-step-{index}
  if (data.g && Array.isArray(data.g.explicacao)) {
      data.g.explicacao.forEach((passo: any, idx: number) => {
          const stepContainer = cardElement.querySelector(`.js-react-step-${idx}`);
          if (stepContainer) {
              const root = createRoot(stepContainer);
              // Parse images for this step (logic from MainStructure logic or passed in)
              // For now assuming empty external images or extracted from somewhere else
              // In RenderComponents.tsx it was: (window as any).__imagensLimpas?.gabarito_passos?.[idx]
              // Here in Bank View we might need similar logic or pass it down.
              // For simpler implementation, we pass empty array as fallback usually works for embedded PDFs
              
              const estrutura = Array.isArray(passo.estrutura) ? passo.estrutura : [{ tipo: 'texto', conteudo: passo.passo || '' }];
              
              root.render(
                  <MainStructure 
                      estrutura={estrutura}
                      imagensExternas={[]} // TODO: Check if we have step images in bank view
                      contexto={`banco_step_${idx}`}
                      isReadOnly={true}
                  />
              );
          }
      });
  }
}
