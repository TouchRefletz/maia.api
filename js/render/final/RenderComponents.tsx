// --- components/RenderComponents.tsx ---
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { safe } from '../../normalize/primitives.js';
import { renderizarEstruturaHTML, renderizar_estrutura_alternativa } from '../structure.js';

// --- Interfaces para Tipagem (Inferidas do código original) ---
interface ImgProps {
  lista: string[];
  titulo: string;
}

interface ComplexidadeProps {
  comp: {
    fatores?: Record<string, boolean>;
    justificativa_dificuldade?: string;
  };
}

interface CreditosProps {
  c: {
    autor_ou_instituicao?: string;
    autorouinstituicao?: string;
    material?: string;
    ano?: string | number;
    origem_resolucao?: string;
  };
}

interface Alternativa {
  letra: string;
  texto?: string;
  estrutura?: any[]; // Estrutura complexa vinda do legado
}

interface TagsProps {
  list: string[];
  className: string;
}

interface QuestaoProps {
  q: {
    identificacao: string;
    estrutura: any[];
    alternativas: Alternativa[];
    materias_possiveis: string[];
    palavras_chave: string[];
  };
  tituloMaterial: string;
  imagensFinais: {
    q_original: string[];
    q_suporte: string[];
  };
}

interface PassoExplicacao {
  estrutura: any[];
  origem?: string;
  fontematerial?: string;
}

interface GabaritoProps {
  g: {
    confianca: number;
    alternativa_correta: string;
    justificativa_curta: string;
    analise_complexidade: any;
    creditos: any;
  };
  imagensFinais: {
    g_suporte: string[];
  };
  explicacaoArray: PassoExplicacao[];
}

// --- Componentes ---

export const ImgsLimpas: React.FC<ImgProps> = ({ lista, titulo }) => {
  if (!lista || lista.length === 0) return null;
  return (
    <div className="field-group" style={{ marginBottom: '15px', border: '1px solid var(--color-border)', padding: '10px', borderRadius: '8px' }}>
      <span className="field-label" style={{ display: 'block', marginBottom: '5px' }}>
        {titulo} ({lista.length})
      </span>
      <div className="img-final-gallery" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {lista.map((src, i) => (
          <div key={i} style={{ width: '60px', height: '60px', border: '1px solid var(--color-border)', borderRadius: '4px', overflow: 'hidden', background: 'var(--color-surface)' }}>
            <img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
          </div>
        ))}
      </div>
    </div>
  );
};

export const ComplexidadeVisual: React.FC<ComplexidadeProps> = ({ comp }) => {
  if (!comp || !comp.fatores) return null;

  const labels: Record<string, string> = {
    texto_extenso: 'Texto Extenso',
    vocabulario_complexo: 'Vocabulário Denso',
    multiplas_fontes_leitura: 'Múltiplas Fontes',
    interpretacao_visual: 'Interp. Visual',
    dependencia_conteudo_externo: 'Conteúdo Prévio',
    interdisciplinaridade: 'Interdisciplinar',
    contexto_abstrato: 'Abstrato',
    raciocinio_contra_intuitivo: 'Contra-Intuitivo',
    abstracao_teorica: 'Teoria Pura',
    deducao_logica: 'Dedução Lógica',
    resolucao_multiplas_etapas: 'Multi-etapas',
    transformacao_informacao: 'Transformação Info',
    distratores_semanticos: 'Distratores Fortes',
    analise_nuance_julgamento: 'Julgamento Sutil',
  };

  const badges = Object.entries(comp.fatores).map(([k, v]) => {
    const key = k.replace(/([A-Z])/g, '_$1').toLowerCase();
    if (v === true && labels[key]) {
      return (
        <span key={k} className="badge" style={{ background: 'var(--color-secondary)', color: 'var(--color-text)', fontSize: '10px', border: '1px solid var(--color-border)' }}>
          {labels[key]}
        </span>
      );
    }
    return null;
  });

  const hasBadges = badges.some((b) => b !== null);

  return (
    <div className="field-group" style={{ marginTop: '15px', background: 'rgba(0,0,0,0.02)', padding: '10px', borderRadius: '8px' }}>
      <span className="field-label" style={{ color: 'var(--color-primary)' }}>⚡ Análise de Complexidade</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '5px', marginBottom: '8px' }}>
        {hasBadges ? badges : <span style={{ fontSize: '11px', color: 'gray' }}>Nenhum fator crítico marcado.</span>}
      </div>
      {comp.justificativa_dificuldade && (
        <div
          className="markdown-content"
          data-raw={safe(comp.justificativa_dificuldade)}
          style={{ fontSize: '12px', fontStyle: 'italic', color: 'var(--color-text-secondary)', marginTop: '8px' }}
          dangerouslySetInnerHTML={{ __html: safe(comp.justificativa_dificuldade) }}
        />
      )}
    </div>
  );
};

export const CreditosTable: React.FC<CreditosProps> = ({ c }) => {
  if (!c) return null;
  return (
    <div className="field-group" style={{ marginTop: '15px' }}>
      <span className="field-label">Créditos & Fonte</span>
      <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse', marginTop: '5px' }}>
        <tbody>
          <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
            <td style={{ color: 'var(--color-text-secondary)', padding: '4px' }}>Instituição</td>
            <td style={{ padding: '4px' }}>{safe(c.autor_ou_instituicao || c.autorouinstituicao || '—')}</td>
          </tr>
          <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
            <td style={{ color: 'var(--color-text-secondary)', padding: '4px' }}>Material</td>
            <td style={{ padding: '4px' }}>{safe(c.material || '—')}</td>
          </tr>
          <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
            <td style={{ color: 'var(--color-text-secondary)', padding: '4px' }}>Ano</td>
            <td style={{ padding: '4px' }}>{safe(c.ano || '—')}</td>
          </tr>
          <tr>
            <td style={{ color: 'var(--color-text-secondary)', padding: '4px' }}>Origem</td>
            <td style={{ padding: '4px' }}>{c.origem_resolucao === 'extraido_do_material' ? '📄 Extraído' : '🤖 IA'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export const Tags: React.FC<TagsProps> = ({ list, className }) => {
  if (!list || list.length === 0) {
    return <span style={{ fontSize: '11px', color: 'gray', opacity: 0.7 }}>—</span>;
  }
  return (
    <>
      {list.map((i, idx) => (
        <span key={idx} className={`data-tag ${className}`}>
          {safe(i)}
        </span>
      ))}
    </>
  );
};

export const ListaAlternativas: React.FC<{ alternativas: Alternativa[] }> = ({ alternativas }) => {
  if (!alternativas || alternativas.length === 0) return null;

  return (
    <>
      {alternativas.map((alt, idx) => {
        const estrutura = Array.isArray(alt.estrutura)
          ? alt.estrutura
          : [{ tipo: 'texto', conteudo: alt.texto || '' }];

        // Mantém chamada à função legada que retorna string HTML
        const htmlAlt = renderizar_estrutura_alternativa(estrutura, alt.letra);

        return (
          <div key={idx} className="alt-row" style={{ background: 'var(--color-background)' }}>
            <span className="alt-letter">{safe(alt.letra)}</span>
            <div className="alt-content" dangerouslySetInnerHTML={{ __html: htmlAlt }} />
          </div>
        );
      })}
    </>
  );
};

export const PassosGabarito: React.FC<{ explicacaoArray: PassoExplicacao[] }> = ({ explicacaoArray }) => {
  if (!explicacaoArray || !explicacaoArray.length) return null;

  return (
    <div className="field-group" style={{ marginTop: '15px' }}>
      <span className="field-label">Resolução Detalhada</span>
      <div className="gabarito-steps" style={{ overflowY: 'auto', paddingRight: '5px' }}>
        <ol className="steps-list">
          {explicacaoArray.map((p, idx) => {
            // Acesso global mantido conforme lógica original
            const imgsPasso = (window as any).__imagensLimpas?.gabarito_passos?.[idx] || [];

            // Função legada de renderização
            const htmlPasso = renderizarEstruturaHTML(p.estrutura, imgsPasso, `final_view_gab_${idx}`);

            const isExtraido = String(p.origem || '').includes('extraido');

            return (
              <li key={idx} className="step-card">
                <div className="step-index">{idx + 1}</div>
                <div className="step-body">
                  <div className="step-content" dangerouslySetInnerHTML={{ __html: htmlPasso }} />
                  <div className="step-meta" style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px dashed var(--color-border)' }}>
                    {isExtraido ? (
                      <span className="step-chip" style={{ borderColor: 'var(--color-success)', color: 'var(--color-success)' }}>📄 Extraído</span>
                    ) : (
                      <span className="step-chip" style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}>🤖 IA</span>
                    )}
                    {p.fontematerial && <span className="step-chip step-chip--muted">📚 {safe(p.fontematerial)}</span>}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
};

export const PainelQuestao: React.FC<QuestaoProps> = ({ q, tituloMaterial, imagensFinais }) => {
  // Função legada de renderização
  const htmlEstruturaQuestao = renderizarEstruturaHTML(
    q.estrutura,
    imagensFinais.q_original,
    'final_view_q'
  );

  return (
    <div className="extraction-result" style={{ border: 'none', padding: 0, background: 'transparent' }}>
      <div className="result-header" style={{ background: 'var(--color-bg-1)', padding: '10px', borderRadius: '8px', marginBottom: '15px', border: '1px solid var(--color-primary)' }}>
        <div>
          <h3 style={{ color: 'var(--color-primary)', margin: 0, fontSize: '16px' }}>QUESTÃO</h3>
          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
            Material: <strong>{safe(tituloMaterial)}</strong>
          </div>
        </div>
        <span className="badge-success" style={{ fontSize: '12px' }}>ID: {safe(q.identificacao)}</span>
      </div>

      <ImgsLimpas lista={imagensFinais.q_suporte} titulo="Imagens de Suporte (Questão)" />

      <div className="field-group">
        <span className="field-label">Enunciado</span>
        <div
          className="data-box scrollable"
          style={{ background: 'var(--color-background)', borderColor: 'var(--color-border)', padding: '15px' }}
          dangerouslySetInnerHTML={{ __html: htmlEstruturaQuestao }}
        />
      </div>

      <div style={{ gap: '10px', marginTop: '10px' }}>
        <div className="field-group">
          <span className="field-label">Matérias</span>
          <div className="data-box">
            <Tags list={q.materias_possiveis} className="tag-subject" />
          </div>
        </div>
      </div>

      <div className="field-group" style={{ marginTop: '10px' }}>
        <span className="field-label">Palavras-Chave</span>
        <div className="tags-wrapper">
          <Tags list={q.palavras_chave} className="tag-keyword" />
        </div>
      </div>

      <div className="field-group" style={{ marginTop: '15px' }}>
        <span className="field-label">Alternativas</span>
        <div className="alts-list">
          <ListaAlternativas alternativas={q.alternativas} />
        </div>
      </div>
    </div>
  );
};

export const PainelGabarito: React.FC<GabaritoProps> = ({ g, imagensFinais, explicacaoArray }) => {
  return (
    <div className="extraction-result" style={{ border: 'none', padding: 0, background: 'transparent' }}>
      <div className="result-header" style={{ background: 'var(--color-bg-2)', padding: '10px', borderRadius: '8px', marginBottom: '15px', border: '1px solid var(--color-warning)' }}>
        <div>
          <h3 style={{ color: 'var(--color-warning)', margin: 0, fontSize: '16px' }}>GABARITO</h3>
          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
            Confiança IA: <strong>{Math.round((g.confianca || 0) * 100)}%</strong>
          </div>
        </div>
        <span className="badge" style={{ background: 'var(--color-success)', color: 'white', fontSize: '14px', padding: '4px 10px' }}>
          LETRA {safe(g.alternativa_correta)}
        </span>
      </div>

      <ImgsLimpas lista={imagensFinais.g_suporte} titulo="Imagens de Suporte (Gabarito)" />

      <div className="field-group">
        <span className="field-label">Resumo / Justificativa</span>
        <div
          className="data-box markdown-content"
          style={{ background: 'var(--color-background)', fontSize: '13px' }}
          dangerouslySetInnerHTML={{ __html: safe(g.justificativa_curta) }}
        />
      </div>

      <ComplexidadeVisual comp={g.analise_complexidade} />
      <PassosGabarito explicacaoArray={explicacaoArray} />
      <CreditosTable c={g.creditos} />
    </div>
  );
};

// --- Helper Functions for Legacy JS Support ---

export const generateImgsLimpasHtml = (lista: any, titulo: any) => {
  return renderToStaticMarkup(<ImgsLimpas lista={lista} titulo={titulo} />);
};

export const generateComplexidadeVisualHtml = (comp: any) => {
  return renderToStaticMarkup(<ComplexidadeVisual comp={comp} />);
};

export const generateCreditosTableHtml = (c: any) => {
  return renderToStaticMarkup(<CreditosTable c={c} />);
};

export const generateListaAlternativasHtml = (alternativas: any) => {
  return renderToStaticMarkup(<ListaAlternativas alternativas={alternativas} />);
};

export const generatePainelQuestaoHtml = (q: any, tituloMaterial: any, imagensFinais: any) => {
  return renderToStaticMarkup(<PainelQuestao q={q} tituloMaterial={tituloMaterial} imagensFinais={imagensFinais} />);
};

export const generatePassosGabaritoHtml = (explicacaoArray: any) => {
  return renderToStaticMarkup(<PassosGabarito explicacaoArray={explicacaoArray} />);
};

export const generatePainelGabaritoHtml = (g: any, imagensFinais: any, explicacaoArray: any) => {
  return renderToStaticMarkup(<PainelGabarito g={g} imagensFinais={imagensFinais} explicacaoArray={explicacaoArray} />);
};

export const generateTagsHtml = (list: any, className: any) => {
  return renderToStaticMarkup(<Tags list={list} className={className} />);
};