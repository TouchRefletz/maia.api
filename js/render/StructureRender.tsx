import React from 'react';
import ReactDOMServer from 'react-dom/server';

// --- DEFINIÇÃO DE TIPOS ---

declare global {
  interface Window {
    __imagensLimpas?: {
      questao_original?: any[];
      gabarito_original?: any[];
      alternativas?: {
        questao?: Record<string, string[]>;
      };
    };
    iniciar_ocr_campo?: (elementId: string) => void;
    expandirImagem?: (src: string) => void;
    iniciar_captura_para_slot_alternativa?: (letra: string, idx: number) => void;
    __targetSlotIndex?: number | null;
    __targetSlotContext?: string | null;
  }
}

export interface EstruturaBloco {
  tipo?: string;
  conteudo?: string | number;
  
  // Sistema de Imagens via PDF Embed + PDF.js Fallback
  pdf_url?: string | null;        // URL pública do PDF (do manifesto)
  pdf_page?: number;              // Número da página
  pdf_zoom?: number;              // Zoom para embed (100, 150, 200, etc)
  pdf_left?: number;              // Coordenada X (pontos PDF)
  pdf_top?: number;               // Coordenada Y (pontos PDF)
  pdf_width?: string;             // Largura do container ("714px")
  pdf_height?: string;            // Altura do container ("660px")
  // Fallback PDF.js
  pdfjs_source_w?: number;        // Largura do canvas fonte
  pdfjs_source_h?: number;        // Altura do canvas fonte  
  pdfjs_x?: number;               // X no canvas
  pdfjs_y?: number;               // Y no canvas
  pdfjs_crop_w?: number;          // Largura do crop
  pdfjs_crop_h?: number;          // Altura do crop
  
  url?: string;
}

interface CommonProps {
  contexto: string;
  isReadOnly: boolean;
}

// Props de revisão para MainStructure
interface ReviewProps {
  isReviewMode?: boolean;
  reviewState?: Record<string, 'approved' | 'rejected' | null>;
  onApprove?: (fieldId: string) => void;
  onReject?: (fieldId: string) => void;
  blockPrefix?: string;
}

// Importar safeMarkdown
import { useMathRender } from '../libs/loader';
import { safeMarkdown } from '../normalize/primitives.js';

// ... (imports existentes)

// --- HELPER DE SANITIZAÇÃO (Para manter compatibilidade com o regex original) ---
// Mantemos sanitizeContent apenas para o atributo data-raw
const sanitizeContent = (content: string) => {
  return content
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

// --- COMPONENTE: BLOCO DE TEXTO (REUTILIZÁVEL) ---
// Adaptado para aceitar atributos extras se necessário
const StructureTextBlock: React.FC<{
  bloco: EstruturaBloco;
  className?: string;
  dataRaw?: string;
}> = ({ bloco, className = '', dataRaw }) => {
  const tipo = (bloco.tipo || 'texto').toLowerCase();
  const conteudoRaw = bloco.conteudo ? String(bloco.conteudo) : '';
  const conteudoSafe = dataRaw || sanitizeContent(conteudoRaw);

  // Usamos safeMarkdown para renderizar o conteúdo, garantindo decode de entities e parse de markdown
  const conteudoRenderizado = safeMarkdown(conteudoRaw);

  // Hook para renderizar LaTeX (MathJax/KaTeX)
  // Re-executa sempre que o conteúdo renderizado mudar
  const mathRef = useMathRender([conteudoRenderizado]);

  const criarMarkdown = (classeExtra: string) => (
    <div
      ref={mathRef}
      className={`structure-block ${classeExtra} markdown-content ${className}`}
      data-raw={conteudoSafe}
      dangerouslySetInnerHTML={{ __html: conteudoRenderizado }}
    />
  );

  switch (tipo) {
    case 'texto': return criarMarkdown('structure-text');
    case 'citacao': return criarMarkdown('structure-citacao');
    case 'destaque': return criarMarkdown('structure-destaque');
    case 'titulo': return criarMarkdown('structure-titulo');
    case 'subtitulo': return criarMarkdown('structure-subtitulo');
    case 'fonte': return criarMarkdown('structure-fonte');
    case 'tabela':
      // Renderiza Tabela usando Marked (já integrado no safeMarkdown se disponível, mas aqui tratamos explicitamente se precisar lógica custom)
      // Como safeMarkdown já usa marked, podemos simplificar ou manter lógica específica de tabela se necessário.
      // Vou simplificar para usar criarMarkdown, já que safeMarkdown deve lidar com tabelas se for markdown padrão.
      // Mas para garantir compatibilidade com tabelas que podem não ser markdown padrão ou exigir processamento extra:
      return criarMarkdown('structure-tabela');
    case 'lista':
      // Para listas, garantimos que quebras de linha virem <br> se o markdown não pegar, 
      // mas safeMarkdown já deve tratar isso.
      return criarMarkdown('structure-lista');
    case 'equacao': 
      // Equação explícita também precisa de render
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const eqRef = useMathRender([conteudoRaw]);
      return (
        <div ref={eqRef} className={`structure-block structure-equacao ${className}`}>{`\\[${conteudoRaw}\\]`}</div>
      );
    case 'codigo': return (
      <pre className={`structure-block structure-codigo ${className}`}>
        <code>{conteudoRaw}</code>
      </pre>
    );
    case 'separador': return <hr className={`structure-block structure-separador ${className}`} />;
    default: return null;
  }
};

// --- COMPONENTE: BLOCO DE IMAGEM (QUESTÃO) ---
import { ImageSlotCard } from '../ui/ImageSlotCard';
import { PdfEmbedRenderer } from '../ui/PdfEmbedRenderer';

const ImageBlock: React.FC<{
  bloco: EstruturaBloco;
  imgIndex: number;
  src: string | undefined;
  contexto: string;
  isReadOnly: boolean;
  conteudoRaw: string;
  conteudoSafe: string;
  disableInteraction?: boolean;
  parentGroupId?: string | number;
  // Props de revisão para a descrição
  isReviewMode?: boolean;
  descricaoFieldId?: string;
  descricaoState?: 'approved' | 'rejected' | null;
  onApprove?: (fieldId: string) => void;
  onReject?: (fieldId: string) => void;
}> = ({ bloco, imgIndex, src, contexto, isReadOnly, conteudoRaw, conteudoSafe, disableInteraction, parentGroupId, isReviewMode, descricaoFieldId, descricaoState, onApprove, onReject }) => {

  // Renderiza legenda se houver conteúdo
  const renderCaption = (prefixo = '') => {
    if (!conteudoRaw) return null;
    
    // Em modo de revisão, a descrição tem seus próprios botões de aprovação
    if (isReviewMode && descricaoFieldId && onApprove && onReject) {
      const stateClass = descricaoState === 'approved' ? 'block-approved' : descricaoState === 'rejected' ? 'block-rejected' : '';
      
      return (
        <div className={`reviewable-block reviewable-caption ${stateClass}`} style={{ marginTop: '8px', padding: '8px', borderRadius: '6px' }}>
          <div className="reviewable-block-header" style={{ marginBottom: '4px' }}>
            <span className="reviewable-block-tipo" style={{ fontSize: '10px' }}>📝 Descrição da Imagem</span>
            <div className="review-btn-group">
              <button
                type="button"
                className={`review-btn review-btn--approve review-btn--xs ${descricaoState === 'approved' ? 'active' : ''}`}
                onClick={() => onApprove(descricaoFieldId)}
                title="Aprovar descrição"
              >
                ✓
              </button>
              <button
                type="button"
                className={`review-btn review-btn--reject review-btn--xs ${descricaoState === 'rejected' ? 'active' : ''}`}
                onClick={() => onReject(descricaoFieldId)}
                title="Rejeitar descrição"
              >
                ✗
              </button>
            </div>
          </div>
          <div
            className="structure-caption markdown-content"
            data-raw={conteudoSafe}
            dangerouslySetInnerHTML={{ __html: safeMarkdown(`${prefixo}${conteudoRaw}`) }}
          />
        </div>
      );
    }
    
    return (
      <div
        className="structure-caption markdown-content"
        data-raw={conteudoSafe}
        dangerouslySetInnerHTML={{ __html: safeMarkdown(`${prefixo}${conteudoRaw}`) }}
      />
    );
  };

  // If in ReadOnly mode (Bank View) - usa PdfImageRenderer se tem dados de PDF
  if (isReadOnly) {
      // Verifica se temos dados de PDF para renderizar via PdfImageRenderer
      const hasPdfData = bloco.pdf_page || bloco.pdfjs_x !== undefined;
      const pdfUrl = bloco.pdf_url || null;
      
      if (hasPdfData || pdfUrl) {
        // Renderiza via PDF Embed ou PDF.js Fallback (COM ScaleToFit)
        return (
          <div className="structure-block structure-image-wrapper">
            <PdfEmbedRenderer
              pdfUrl={pdfUrl}
              // downloadUrl não é prop explicita do Embed, mas ele deduz do window se precisar
              pdf_page={bloco.pdf_page}
              pdf_zoom={bloco.pdf_zoom}
              pdf_left={bloco.pdf_left}
              pdf_top={bloco.pdf_top}
              pdf_width={bloco.pdf_width}
              pdf_height={bloco.pdf_height}
              pdfjs_source_w={bloco.pdfjs_source_w}
              pdfjs_source_h={bloco.pdfjs_source_h}
              pdfjs_x={bloco.pdfjs_x}
              pdfjs_y={bloco.pdfjs_y}
              pdfjs_crop_w={bloco.pdfjs_crop_w}
              pdfjs_crop_h={bloco.pdfjs_crop_h}
              scaleToFit={true}
            />
            {renderCaption('')}
          </div>
        );
      } else if (src) {
        // Fallback legado: imagem direta (para dados antigos)
        return (
          <div className="structure-block structure-image-wrapper">
            <img
              src={src}
              className="structure-img"
              data-action="expand-image"
              data-src={src}
              title="Clique para ampliar"
              style={{ cursor: 'zoom-in' }}
              alt=""
            />
            {renderCaption('')}
          </div>
        );
      } else {
         return (
            <div className="structure-block" style={{ padding: '10px', border: '1px dashed #ccc', color: 'gray', fontSize: '11px', textAlign: 'center' }}>
              (Imagem não disponível)
            </div>
          );
      }
  }

  // INTERACTIVE MODE (Creation/Editing)
  // We delegate everything to ImageSlotCard which handles Empty vs Filled vs Capturing internally.
  // Force column layout so caption is BELOW the card, and allow card to take full width.
  const hasPdfData = bloco.pdf_page || bloco.pdfjs_x !== undefined;
  
  const captionRef = useMathRender([conteudoSafe]);

  return (
    <div className="structure-block" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
        <ImageSlotCard
            slotId={String(imgIndex)}
            label="Imagem"
          currentData={
            (src || hasPdfData)
              ? {
                  id: String(imgIndex),
                  previewUrl: src,
                  // Pass PDF props explicitly to ensure they are available for PdfEmbedRenderer
                  pdf_url: bloco.pdf_url,
                  pdf_page: bloco.pdf_page,
                  pdf_zoom: bloco.pdf_zoom,
                  pdf_left: bloco.pdf_left,
                  pdf_top: bloco.pdf_top,
                  pdf_width: bloco.pdf_width,
                  pdf_height: bloco.pdf_height,
                  pdfjs_source_w: bloco.pdfjs_source_w,
                  pdfjs_source_h: bloco.pdfjs_source_h,
                  pdfjs_x: bloco.pdfjs_x,
                  pdfjs_y: bloco.pdfjs_y,
                  pdfjs_crop_w: bloco.pdfjs_crop_w,
                  pdfjs_crop_h: bloco.pdfjs_crop_h,
                }
              : null
          }
            readOnly={disableInteraction}
            parentGroupId={parentGroupId}
        />
        {/* Caption is separate, or should it be inside card? 
            The card has a header, but caption is usually below image. 
            Let's keep it below the card for now. */}
        <div ref={captionRef}>
           {renderCaption('IA: ')}
        </div>
    </div>
  );
};

// --- COMPONENTE: ESTRUTURA PRINCIPAL (ORQUESTRADOR) ---
export const MainStructure: React.FC<{
  estrutura: EstruturaBloco[];
  imagensExternas: string[];
  contexto: string;
  disableInteraction?: boolean;
  isReadOnly?: boolean;
  parentGroupId?: string | number;
  // Props de revisão
  isReviewMode?: boolean;
  reviewState?: Record<string, 'approved' | 'rejected' | null>;
  onApprove?: (fieldId: string) => void;
  onReject?: (fieldId: string) => void;
  blockPrefix?: string;
}> = ({ estrutura, imagensExternas, contexto, disableInteraction, isReadOnly, parentGroupId, isReviewMode, reviewState, onApprove, onReject, blockPrefix = 'bloco' }) => {

  if (!estrutura || !Array.isArray(estrutura) || estrutura.length === 0) {
    return null;
  }

  const isReadOnlyMode = disableInteraction || isReadOnly || contexto === 'banco';
  let globalImgCounter = 0; // Contador mutável para simular o imgIndex++ condicional

  // Função para obter label do tipo de bloco
  const getTipoLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      'imagem': '🖼️ Imagem',
      'texto': '📝 Texto',
      'fonte': '📚 Fonte',
      'lista': '📋 Lista',
      'tabela': '📊 Tabela',
      'equacao': '🔢 Equação',
    };
    return labels[tipo] || `📦 ${tipo}`;
  };

  return (
    <div className="structure-container">
      {estrutura.map((bloco, idx) => {
        const tipo = (bloco?.tipo || 'imagem').toLowerCase();
        const conteudoRaw = bloco?.conteudo ? String(bloco.conteudo) : '';
        const conteudoSafe = sanitizeContent(conteudoRaw);
        const fieldId = `${blockPrefix}_${idx}`;
        const state = reviewState?.[fieldId] || null;

        let blockContent: React.ReactNode;

        if (tipo === 'imagem' || !tipo) {
          const currentImgIndex = globalImgCounter++;
          const src = bloco.url || imagensExternas?.[currentImgIndex];
          
          // ID específico para a descrição da imagem
          const descricaoFieldId = `${fieldId}_descricao`;
          const descricaoState = reviewState?.[descricaoFieldId] || null;

          blockContent = (
            <ImageBlock
              bloco={bloco}
              imgIndex={currentImgIndex}
              src={src}
              contexto={contexto}
              isReadOnly={isReadOnlyMode}
              conteudoRaw={conteudoRaw}
              conteudoSafe={conteudoSafe}
              disableInteraction={disableInteraction}
              parentGroupId={parentGroupId}
              // Props de revisão para a descrição
              isReviewMode={isReviewMode}
              descricaoFieldId={descricaoFieldId}
              descricaoState={descricaoState}
              onApprove={onApprove}
              onReject={onReject}
            />
          );
        } else {
          blockContent = <StructureTextBlock bloco={bloco} />;
        }

        // Em modo review, envolve com botões
        if (isReviewMode && onApprove && onReject) {
          const stateClass = state === 'approved' ? 'block-approved' : state === 'rejected' ? 'block-rejected' : '';
          
          return (
            <div key={idx} className={`reviewable-block ${stateClass}`}>
              <div className="reviewable-block-header">
                <span className="reviewable-block-tipo">{getTipoLabel(tipo)}</span>
                <div className="review-btn-group">
                  <button
                    type="button"
                    className={`review-btn review-btn--approve review-btn--xs ${state === 'approved' ? 'active' : ''}`}
                    onClick={() => onApprove(fieldId)}
                    title="Aprovar"
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    className={`review-btn review-btn--reject review-btn--xs ${state === 'rejected' ? 'active' : ''}`}
                    onClick={() => onReject(fieldId)}
                    title="Rejeitar"
                  >
                    ✗
                  </button>
                </div>
              </div>
              {blockContent}
            </div>
          );
        }

        return <React.Fragment key={idx}>{blockContent}</React.Fragment>;
      })}
    </div>
  );
};

// --- COMPONENTE: BLOCO DE IMAGEM (ALTERNATIVA) ---
const AlternativeImageBlock: React.FC<{
  bloco: EstruturaBloco;
  letra: string;
  imgIndex: number;
  src: string | undefined;
  isReadOnly: boolean;
  conteudo: string;
  conteudoRawAttr: string;
  temConteudo: boolean;
  // Props de revisão para a descrição
  isReviewMode?: boolean;
  descricaoFieldId?: string;
  descricaoState?: 'approved' | 'rejected' | null;
  onApprove?: (fieldId: string) => void;
  onReject?: (fieldId: string) => void;
}> = ({ bloco, letra, imgIndex, src, isReadOnly, conteudo, conteudoRawAttr, temConteudo, isReviewMode, descricaoFieldId, descricaoState, onApprove, onReject }) => {

  // Renderiza a descrição com ou sem controles de revisão
  const renderDescricao = () => {
    if (!temConteudo) return null;

    // Em modo de revisão, a descrição tem seus próprios botões de aprovação
    if (isReviewMode && descricaoFieldId && onApprove && onReject) {
      const stateClass = descricaoState === 'approved' ? 'block-approved' : descricaoState === 'rejected' ? 'block-rejected' : '';
      
      return (
        <div className={`reviewable-block reviewable-caption ${stateClass}`} style={{ marginTop: '8px', padding: '8px', borderRadius: '6px' }}>
          <div className="reviewable-block-header" style={{ marginBottom: '4px' }}>
            <span className="reviewable-block-tipo" style={{ fontSize: '10px' }}>📝 Descrição da Imagem</span>
            <div className="review-btn-group">
              <button
                type="button"
                className={`review-btn review-btn--approve review-btn--xs ${descricaoState === 'approved' ? 'active' : ''}`}
                onClick={(e) => { e.stopPropagation(); onApprove(descricaoFieldId); }}
                title="Aprovar descrição"
              >
                ✓
              </button>
              <button
                type="button"
                className={`review-btn review-btn--reject review-btn--xs ${descricaoState === 'rejected' ? 'active' : ''}`}
                onClick={(e) => { e.stopPropagation(); onReject(descricaoFieldId); }}
                title="Rejeitar descrição"
              >
                ✗
              </button>
            </div>
          </div>
          <div
            className="structure-caption markdown-content"
            data-raw={conteudoRawAttr}
            style={isReadOnly
              ? { fontSize: '0.9em', marginTop: '5px', color: '#555' }
              : { fontSize: '11px', marginTop: '4px', color: 'var(--color-text-secondary)' }
            }
          >
            {isReadOnly ? conteudo : `IA: ${conteudo}`}
          </div>
        </div>
      );
    }

    return (
      <div
        className="structure-caption markdown-content"
        data-raw={conteudoRawAttr}
        style={isReadOnly
          ? { fontSize: '0.9em', marginTop: '5px', color: '#555' }
          : { fontSize: '11px', marginTop: '4px', color: 'var(--color-text-secondary)' }
        }
      >
        {isReadOnly ? conteudo : `IA: ${conteudo}`}
      </div>
    );
  };

  if (src) {
    return (
      <div className="structure-block structure-image-wrapper">
        <img
          src={src}
          className="structure-img"
          data-action="expand-image"
          data-src={src}
          style={isReadOnly ? { cursor: 'zoom-in' } : undefined}
          alt=""
        />
        {renderDescricao()}
        {!isReadOnly && (
          <button
            className="btn-trocar-img"
            data-action="edit-slot-alt" 
            data-slot-id={imgIndex}
            data-letter={letra}
          >
            <span className="btn-ico">🔄</span>
          </button>
        )}
      </div>
    );
  } else if (!isReadOnly) {
    return (
      <div
        className="structure-block structure-image-placeholder"
        data-action="select-slot-alt"
        data-slot-id={imgIndex}
        data-letter={letra}
      >
        <div className="icon">📷</div>
        {temConteudo && !isReviewMode && (
          <div
            className="markdown-content"
            data-raw={conteudoRawAttr}
            style={{ fontSize: '10px', color: 'gray', marginTop: '4px', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            IA: {conteudo}
          </div>
        )}
        {isReviewMode && renderDescricao()}
      </div>
    );
  }
  return null;
};

// --- COMPONENTE: ESTRUTURA ALTERNATIVA (ORQUESTRADOR) ---
export const AlternativeStructure: React.FC<{
  estrutura: EstruturaBloco[];
  letra: string;
  imagensExternas: string[];
  contexto: string;
  // Props de revisão
  isReviewMode?: boolean;
  reviewState?: Record<string, 'approved' | 'rejected' | null>;
  onApprove?: (fieldId: string) => void;
  onReject?: (fieldId: string) => void;
  blockPrefix?: string;
}> = ({ estrutura, letra, imagensExternas, contexto, isReviewMode, reviewState, onApprove, onReject, blockPrefix }) => {
  if (!Array.isArray(estrutura) || estrutura.length === 0) return null;

  const isReadOnly = contexto === 'banco';

  // Lógica de Fallback de imagens
  const imgsFallback = (imagensExternas && imagensExternas.length > 0)
    ? imagensExternas
    : (typeof window !== 'undefined' ? window.__imagensLimpas?.alternativas?.questao?.[letra] || [] : []);

  let globalImgCounter = 0;

  // Função helper para labels (duplicada de MainStructure para isolamento)
  const getTipoLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      'imagem': '🖼️ Imagem',
      'texto': '📝 Texto',
      'fonte': '📚 Fonte',
      'lista': '📋 Lista',
      'tabela': '📊 Tabela',
      'equacao': '🔢 Equação',
    };
    return labels[tipo] || `📦 ${tipo}`;
  };

  return (
    <div className="alt-estrutura">
      {estrutura.map((bloco, idx) => {
        const tipo = String(bloco?.tipo || 'texto').toLowerCase();
        // Não sanitizamos aqui para preservar LaTeX, o componente filho sanitiza se precisar
        const conteudoRawAttr = bloco?.conteudo ? String(bloco.conteudo).replace(/"/g, '&quot;') : ''; 
        const conteudo = bloco?.conteudo ? String(bloco.conteudo) : '';

        // ID único para revisão deste bloco específico
        const fieldId = blockPrefix ? `${blockPrefix}_${idx}` : `alt_${letra}_bloco_${idx}`;
        const state = reviewState?.[fieldId] || null;

        let blockContent: React.ReactNode;

        if (tipo === 'imagem') {
          const currentImgIndex = globalImgCounter++;
          const src = bloco.url || imgsFallback?.[currentImgIndex];
          
          // ID específico para a descrição da imagem
          const descricaoFieldId = `${fieldId}_descricao`;
          const descricaoState = reviewState?.[descricaoFieldId] || null;

          blockContent = (
            <AlternativeImageBlock
              key={idx}
              bloco={bloco}
              letra={letra}
              imgIndex={currentImgIndex}
              src={src}
              isReadOnly={isReadOnly}
              conteudo={conteudo}
              conteudoRawAttr={conteudoRawAttr}
              temConteudo={!!(conteudo && conteudo.trim().length > 0)}
              // Props de revisão para a descrição
              isReviewMode={isReviewMode}
              descricaoFieldId={descricaoFieldId}
              descricaoState={descricaoState}
              onApprove={onApprove}
              onReject={onReject}
            />
          );
        } else {
          blockContent = <StructureTextBlock key={idx} bloco={bloco} />;
        }

        // Se estiver em modo review, envolve com a interface de botões
        if (isReviewMode && onApprove && onReject) {
          const stateClass = state === 'approved' ? 'block-approved' : state === 'rejected' ? 'block-rejected' : '';

          return (
            <div key={idx} className={`reviewable-block ${stateClass}`} style={{ margin: '4px 0', padding: '8px' }}>
              <div className="reviewable-block-header" style={{ marginBottom: '4px', paddingBottom: '4px' }}>
                <span className="reviewable-block-tipo" style={{ fontSize: '10px' }}>{getTipoLabel(tipo)}</span>
                <div className="review-btn-group">
                  <button
                    type="button"
                    className={`review-btn review-btn--approve review-btn--xs ${state === 'approved' ? 'active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); onApprove(fieldId); }}
                    title="Aprovar bloco"
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    className={`review-btn review-btn--reject review-btn--xs ${state === 'rejected' ? 'active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); onReject(fieldId); }}
                    title="Rejeitar bloco"
                  >
                    ✗
                  </button>
                </div>
              </div>
              {blockContent}
            </div>
          );
        }

        return blockContent;
      })}
    </div>
  );
};

// --- FUNÇÕES DE EXPORTAÇÃO (ADAPTERS) ---
// Estas funções geram a string HTML final para serem usadas pelo JS legado.

export const generateHtmlString = (
  estrutura: EstruturaBloco[],
  imagensExternas: string[],
  contexto: string,
  isReadOnly: boolean = false
): string => {
  return ReactDOMServer.renderToStaticMarkup(
    <MainStructure
      estrutura={estrutura}
      imagensExternas={imagensExternas}
      contexto={contexto}
      isReadOnly={isReadOnly}
    />
  );
};

export const generateAlternativeHtmlString = (
  estrutura: EstruturaBloco[],
  letra: string,
  imagensExternas: string[],
  contexto: string
): string => {
  return ReactDOMServer.renderToStaticMarkup(
    <AlternativeStructure
      estrutura={estrutura}
      letra={letra}
      imagensExternas={imagensExternas}
      contexto={contexto}
    />
  );
};

export const normalizeStructureBlock = (bloco: any) => {
  const rawTipo = bloco?.tipo ?? 'imagem';
  let tipo = String(rawTipo).toLowerCase().trim();

  // Importante: TIPOS_ESTRUTURA_VALIDOS deve ser verificado fora ou passado, 
  // mas aqui seguimos a lógica de fallback 'imagem' se desconhecido.
  // Como não temos acesso direto à constante do main.js aqui, assumimos a lógica local.
  // Se quiser importar, precisaria mover a constante para um arquivo de tipos compartilhado.
  // Vou assumir a lógica padrão: se não for texto/lista/etc conhecido, é imagem.

  const knownTypes = new Set(['texto', 'citacao', 'destaque', 'titulo', 'subtitulo', 'fonte', 'lista', 'equacao', 'codigo', 'separador', 'tabela']);
  if (!knownTypes.has(tipo) && tipo !== 'imagem') {
    tipo = 'imagem';
  }

  let conteudo = bloco?.conteudo ?? '';
  conteudo = String(conteudo);
  if (tipo === 'separador') conteudo = conteudo.trim();

  return { tipo, conteudo };
};

export const normalizeStructure = (estruturaLike: any[]) => {
  if (!Array.isArray(estruturaLike)) return [];
  return estruturaLike.map(normalizeStructureBlock);
};