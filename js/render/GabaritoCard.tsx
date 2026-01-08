import React from 'react';
import { criarHtmlBlocoEditor } from '../editor/structure-editor.js';
import { normalizeAlternativasAnalisadas } from '../normalize/alternativas.js';
import { normCreditos } from '../normalize/creditos.js';
import { normalizeExplicacao } from '../normalize/explicacao.js';
import { asStringArray, safe, safeMarkdown } from '../normalize/primitives.js';
import { pick } from '../utils/pick';
// @ts-ignore - Importação legado pode não ter tipos
import { renderComplexidade as renderComplexidadeLegado } from './complexidade.js';
import { renderizarEstruturaHTML } from './structure.js';

// --- Tipagens ---

interface GabaritoRaw {
  alternativa_correta?: any;
  resposta?: any;
  explicacao?: any;
  resolucao?: any;
  alternativas_analisadas?: any[];
  justificativa_curta?: any;
  justificativa?: any;
  possui_imagem?: any;
  possuiimagem?: any;
  confianca?: any;
  coerencia?: any;
  observacoes?: any;
  creditos?: any;
  alertas_credito?: any;
  analise_complexidade?: any;
  analiseComplexidade?: any;
  fontes_externas?: Array<{ uri: string; title: string }>; // New field
  texto_referencia?: string; // Relatório da pesquisa
}

interface CreditosData {
  origemresolucao?: string;
  materialidentificado?: boolean;
  confiancaidentificacao?: number | null;
  material?: string;
  autorouinstituicao?: string;
  ano?: string;
  precisacreditogenerico?: boolean;
  comoidentificou?: string;
  textocreditosugerido?: string;
}

interface GabaritoData {
  respostaLetra: string;
  justificativaCurta: string;
  possuiImagem: boolean;
  confianca: number | null;
  coerencia: any;
  observacoes: string[];
  creditosRaw: any;
  creditos: CreditosData | null;
  alertasCredito: string[];
  explicacaoArray: any[];
  alternativasAnalisadas: any[];
  complexidadeRaw: any;
  externas: Array<{ uri: string; title: string }>; // Normalized field
  textoReferencia: string;
  questao: any;
}

// --- Lógica de Negócio (Preparação) ---

export function prepararDadosGabarito(gabarito: GabaritoRaw, questao: any): GabaritoData {
  const respostaLetra = String(
    pick(gabarito.alternativa_correta, gabarito.resposta, '')
  )
    .trim()
    .toUpperCase();

  // Normalização da explicação usando helper global
  const explicacaoArray = normalizeExplicacao(
    pick(gabarito.explicacao, gabarito.resolucao, [])
  );

  // Normalização das alternativas analisadas
  const alternativasAnalisadas = normalizeAlternativasAnalisadas(
    pick(gabarito.alternativas_analisadas, []),
    respostaLetra
  );

  return {
    respostaLetra,
    justificativaCurta: pick(
      gabarito.justificativa_curta,
      gabarito.justificativa,
      ''
    ),
    possuiImagem: !!pick(gabarito.possui_imagem, gabarito.possuiimagem, false),
    confianca: pick(gabarito.confianca, null),
    coerencia: pick(gabarito.coerencia, {}),
    observacoes: asStringArray(pick(gabarito.observacoes, [])),
    creditosRaw: pick(gabarito.creditos, {}),
    creditos: normCreditos(pick(gabarito.creditos, {})),
    alertasCredito: asStringArray(pick(gabarito.alertas_credito, [])),
    explicacaoArray,
    alternativasAnalisadas,
    complexidadeRaw: pick(
      gabarito.analise_complexidade,
      gabarito.analiseComplexidade,
      null
    ),
    externas: (pick(gabarito.fontes_externas, []) as any[]),
    textoReferencia: (pick(gabarito.texto_referencia, '') as string),
    questao: questao,
  };
}

// --- Componentes Visuais (Renderização) ---

const RawHTML = ({ html, className = '', style = {} }: { html: string, className?: string, style?: React.CSSProperties }) => {
  if (!html) return null;
  return <div className={className} style={style} dangerouslySetInnerHTML={{ __html: html }} />;
};

const SafeText = ({ text }: { text: any }) => <>{safe(text)}</>;

const SafeMarkdown = ({ text }: { text: any }) => (
  <div className="markdown-content" dangerouslySetInnerHTML={{ __html: safeMarkdown(text) }} />
);

// Sub-componente: Meta Gabarito (Chips e Barra de Confiança)
export const MetaGabarito: React.FC<{ confianca: number | null, creditos: CreditosData | null }> = ({ confianca, creditos }) => {
  const clamp01 = (n: any) => Math.max(0, Math.min(1, Number(n)));
  const fmtPct = (n: any) => `${Math.round(clamp01(n) * 100)}%`;

  const hasConfianca = confianca !== null && confianca !== undefined && !Number.isNaN(Number(confianca));
  const hasOrigem = !!creditos?.origemresolucao;

  if (!hasConfianca && !hasOrigem) return null;

  const fill = hasConfianca ? fmtPct(confianca) : '0%';

  return (
    <div className="gabarito-meta">
      <div className="gabarito-meta__row">
        {hasConfianca && (
          <div className="gabarito-chip gabarito-chip--info">
            <span className="gabarito-chip__k">Confiança</span>
            <span className="gabarito-chip__v"><SafeText text={fmtPct(confianca)} /></span>
          </div>
        )}
        {hasOrigem && (
          <div className="gabarito-chip gabarito-chip--muted">
            <span className="gabarito-chip__k">Origem</span>
            <span className="gabarito-chip__v"><SafeText text={creditos?.origemresolucao} /></span>
          </div>
        )}
      </div>
      {hasConfianca && (
        <div className="gabarito-confbar" style={{ '--fill-width': safe(fill) } as React.CSSProperties}>
          <div className="gabarito-confbar__label">Confiança visual</div>
          <div className="gabarito-confbar__track">
            <div className="gabarito-confbar__fill"></div>
          </div>
        </div>
      )}
    </div>
  );
};

// Sub-componente: Opções (Alternativas)
export const OpcoesGabarito: React.FC<{ questao: any, respostaLetra: string, alternativasAnalisadas: any[] }> = ({ questao, respostaLetra, alternativasAnalisadas }) => {
  const alts = Array.isArray(questao?.alternativas) ? questao.alternativas : [];
  if (!alts.length) return null;

  const normLetra = (v: any) => String(v ?? '').trim().toUpperCase();
  const correta = normLetra(respostaLetra);

  return (
    <div className="answerOptions gabarito-options">
      {alts.map((alt: any, idx: number) => {
        const letra = normLetra(alt?.letra);
        const isCorrect = letra && correta && letra === correta;
        const analise = (alternativasAnalisadas || []).find((a) => normLetra(a?.letra) === letra);

        return (
          <div key={idx} className={`answerOption ${isCorrect ? 'correct' : ''}`}>
            <span className="option-letter"><SafeText text={letra} /></span>
            <div className="option-text">
              <SafeMarkdown text={alt?.texto} />
              {analise?.motivo && <div className="option-reason"><SafeMarkdown text={analise.motivo} /></div>}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Sub-componente: Passos Explicação
export const PassosExplicacao: React.FC<{ explicacaoArray: any[] }> = ({ explicacaoArray }) => {
  if (!explicacaoArray.length) return null;

  return (
    <div className="passo gabarito-steps">
      <div className="passoText"><p><strong>Explicação (passo a passo)</strong></p></div>
      <div className="explicacao">
        <ol className="steps-list">
          {explicacaoArray.map((p, idx) => {
            // Lógica de side-effect window.__imagensLimpas mantida do original
            if (!(window as any).__imagensLimpas) (window as any).__imagensLimpas = {};
            if (!(window as any).__imagensLimpas.gabarito_passos) (window as any).__imagensLimpas.gabarito_passos = {};

            const imagensDestePasso = (window as any).__imagensLimpas.gabarito_passos[idx] || [];

            // Renderiza estrutura usando função legada (retorna string HTML)
            const htmlConteudo = renderizarEstruturaHTML(
              p.estrutura,
              imagensDestePasso,
              `gabarito_passo_${idx}`
            );

            const origemRaw = String(p?.origem || '').toLowerCase().replace(/_/g, '');
            const isExtraido = origemRaw.includes('extraido');

            return (
              <li key={idx} className="step-card">
                <div className="step-index">{idx + 1}</div>
                <div className="step-body">
                  <div className="step-content">
                    <RawHTML html={htmlConteudo} />
                  </div>
                  <div className="step-meta" style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed var(--color-border)', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {isExtraido ? (
                      <span className="step-chip" style={{ background: 'var(--color-bg-2)', color: 'var(--color-success)', border: '1px solid var(--color-success)', fontWeight: 600 }}>📄 Extraído</span>
                    ) : (
                      <span className="step-chip" style={{ background: 'rgba(59, 130, 246, 0.08)', color: '#2563eb', border: '1px solid rgba(59, 130, 246, 0.3)', fontWeight: 600 }}>🤖 IA</span>
                    )}

                    {p?.fontematerial && (
                      <span className="step-chip step-chip--muted" title={`Fonte/Material: ${safe(p.fontematerial)}`}>
                        📚 <SafeText text={p.fontematerial} />
                      </span>
                    )}
                    {p?.evidencia && (
                      <span className="step-chip step-chip--muted" title={`Evidência Visual: ${safe(p.evidencia)}`} style={{ borderStyle: 'dashed' }}>
                        👁️ <SafeText text={p.evidencia} />
                      </span>
                    )}
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

// Sub-componente: Fontes de Pesquisa
export const FontesPesquisa: React.FC<{ fontes: Array<{ uri: string; title: string }> }> = ({ fontes }) => {
  if (!fontes || !fontes.length) return null;

  return (
    <div className="gabarito-sources" style={{ margin: '15px 0', padding: '12px', border: '1px solid var(--color-border)', borderRadius: '8px', background: 'var(--color-bg-2)' }}>
      <p style={{ fontWeight: 600, fontSize: '13px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text)' }}>
        <span>📚</span> Referências Bibliográficas
      </p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {fontes.map((fonte, idx) => (
          <li key={idx}>
            <a
              href={fonte.uri}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: '12px', color: 'var(--color-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
              title={fonte.title}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                {fonte.title || fonte.uri}
              </span>
              <span style={{ fontSize: '10px', opacity: 0.7 }}>↗</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};

// Sub-componente: Detalhes Técnicos
export const DetalhesTecnicos: React.FC<{ dados: GabaritoData }> = ({ dados }) => {
  const { creditos, alertasCredito, observacoes, coerencia } = dados;
  if (!creditos && !alertasCredito.length && !observacoes.length && !coerencia) return null;

  const Chip = ({ label, ok, okTxt = 'OK', badTxt = 'Atenção' }: any) => (
    <div className={`coerencia-chip ${ok ? 'coerencia-chip--ok' : 'coerencia-chip--bad'}`}>
      <span className="coerencia-chip-k"><SafeText text={label} /></span>
      <span className="coerencia-chip-v"><SafeText text={ok ? okTxt : badTxt} /></span>
    </div>
  );

  const ChipKV = ({ k, v, cls = '' }: any) => (
    <div className={`coerencia-chip ${cls}`}>
      <span className="coerencia-chip-k"><SafeText text={k} /></span>
      <span className="coerencia-chip-v"><SafeText text={v ?? '—'} /></span>
    </div>
  );

  const toPct = (n: any) => !Number.isNaN(Number(n)) ? `${Math.round(Math.max(0, Math.min(1, Number(n))) * 100)}%` : null;

  const coerenciaObs = Array.isArray(coerencia?.observacoes) ? coerencia.observacoes : [];

  return (
    <details className="gabarito-extra">
      <summary>Detalhes técnicos</summary>

      {/* Coerência */}
      {coerencia && (
        <div className="field-group">
          <span className="field-label">Coerência (checagens)</span>
          <div className="coerencia-grid">
            <Chip label="Alternativa correta existe" ok={!!(coerencia.alternativa_correta_existe ?? coerencia.alternativaCorretaExiste)} />
            <Chip label="Análise para todas" ok={!!(coerencia.tem_analise_para_todas ?? coerencia.temAnaliseParaTodas)} />
            <Chip label="Observações" ok={coerenciaObs.length === 0} okTxt="Nenhuma" badTxt="Há itens" />
          </div>
          {coerenciaObs.length ? (
            <div className="coerencia-obs">
              <div className="coerencia-obs-title">Observações</div>
              <ul>{coerenciaObs.map((o: string, i: number) => <li key={i}><SafeText text={o} /></li>)}</ul>
            </div>
          ) : (
            <div className="coerencia-obs coerencia-obs--empty">Sem observações.</div>
          )}
        </div>
      )}

      {/* Observações Gerais */}
      {observacoes.length > 0 && (
        <div className="field-group">
          <span className="field-label">Observações</span>
          <div className="data-box scrollable">
            <ul>{observacoes.map((o, i) => <li key={i}><SafeText text={o} /></li>)}</ul>
          </div>
        </div>
      )}

      {/* Créditos */}
      {creditos && (
        <div className="field-group">
          <span className="field-label">Créditos / Fonte</span>
          <div className="coerencia-grid">
            <ChipKV k="Origem" v={creditos.origemresolucao} />
            <ChipKV k="Material identificado" v={creditos.materialidentificado ? 'Sim' : 'Não'} cls={creditos.materialidentificado ? 'coerencia-chip--ok' : 'coerencia-chip--bad'} />
            {creditos.confiancaidentificacao != null && <ChipKV k="Confiança ident." v={toPct(creditos.confiancaidentificacao)} />}
            {creditos.material && <ChipKV k="Material" v={creditos.material} />}
            {creditos.autorouinstituicao && <ChipKV k="Autor/Instituição" v={creditos.autorouinstituicao} />}
            {creditos.ano && <ChipKV k="Ano" v={creditos.ano} />}
            <ChipKV k="Precisa crédito genérico" v={creditos.precisacreditogenerico ? 'Sim' : 'Não'} cls={creditos.precisacreditogenerico ? 'coerencia-chip--bad' : 'coerencia-chip--ok'} />
          </div>
          {creditos.comoidentificou ? (
            <div className="coerencia-obs">
              <div className="coerencia-obs-title">Evidência</div>
              <div><SafeText text={creditos.comoidentificou} /></div>
            </div>
          ) : (
            <div className="coerencia-obs coerencia-obs--empty">Sem evidência registrada.</div>
          )}
          {creditos.textocreditosugerido && (
            <div className="coerencia-obs" style={{ marginTop: '8px' }}>
              <div className="coerencia-obs-title">Crédito sugerido</div>
              <div><SafeText text={creditos.textocreditosugerido} /></div>
            </div>
          )}
        </div>
      )}

      {/* Alertas */}
      {alertasCredito.length > 0 && (
        <div className="field-group">
          <span className="field-label">Alertas de crédito</span>
          <div className="data-box scrollable">
            <ul>{alertasCredito.map((a, i) => <li key={i}><SafeText text={a} /></li>)}</ul>
          </div>
        </div>
      )}
    </details>
  );
};

// --- Componentes Principais (Views) ---

export const GabaritoCardView: React.FC<{ dados: GabaritoData }> = ({ dados }) => {
  const {
    respostaLetra,
    justificativaCurta,
    complexidadeRaw,
    confianca,
    creditos,
    questao,
    alternativasAnalisadas,
    explicacaoArray,
  } = dados;

  // Renderização condicional segura para complexidade (se a função legado existir)
  const complexidadeHtml = typeof renderComplexidadeLegado !== 'undefined'
    ? renderComplexidadeLegado(complexidadeRaw)
    : '';

  return (
    <>
      <div className="question gabarito-card">
        <div className="result-header">
          <h3>Gabarito</h3>
          <span className="badge-success">Ok</span>
        </div>

        <div className="questionText gabarito-head">
          <p><strong>Alternativa correta:</strong> <SafeText text={respostaLetra} /></p>
          {justificativaCurta && (
            <div className="gabarito-just markdown-content"><SafeMarkdown text={justificativaCurta} /></div>
          )}
        </div>

        <RawHTML html={complexidadeHtml} />
        <MetaGabarito confianca={confianca} creditos={creditos} />
        <OpcoesGabarito questao={questao} respostaLetra={respostaLetra} alternativasAnalisadas={alternativasAnalisadas} />
      </div>

      <PassosExplicacao explicacaoArray={explicacaoArray} />
      <FontesPesquisa fontes={dados.externas} />
      <details className="gabarito-extra" open={!dados.textoReferencia}>
        <summary>
          📄 Relatório Técnico
        </summary>
        <div
          className="markdown-content relatorio-content"
          data-raw={dados.textoReferencia || ''}
          style={{
            marginTop: '10px',
            overflowY: 'auto',
            padding: '5px'
          }}
        >
          {dados.textoReferencia ? <SafeText text={dados.textoReferencia} /> : <em>Relatório de pesquisa não disponível.</em>}
        </div>
      </details>

      <DetalhesTecnicos dados={dados} />
    </>
  );
};

export const AcoesGabaritoView: React.FC<{ onEdit: () => void, onFinish: () => void }> = ({ onEdit, onFinish }) => {
  return (
    <div className="result-actions" id="actionsLeituraGabarito" style={{ marginTop: '15px' }}>
      <button type="button" className="btn btn--secondary btn--full-width" id="btnEditarGabarito" onClick={onEdit}>
        Editar gabarito
      </button>
      <button type="button" className="btn btn--success btn--full-width" id="btnFinalizarTudo" onClick={onFinish} style={{ marginTop: '10px', fontWeight: 'bold', border: '1px solid rgba(0,0,0,0.1)' }}>
        ✨ Finalizar Questão
      </button>
    </div>
  );
};

// --- Componentes do Editor ---

const EditorPassos: React.FC<{ explicacaoArray: any[] }> = ({ explicacaoArray }) => {
  return (
    <div className="field-group">
      <span className="field-label">Explicação (passos)</span>
      <div id="editGabaritoPassos">
        {(explicacaoArray || []).map((p, idx) => {
          const blocosHtml = (p.estrutura || [])
            .map((b: any) => criarHtmlBlocoEditor(b.tipo, b.conteudo))
            .join('');

          const origemRaw = String(p.origem || '').toLowerCase().replace(/_/g, '');
          const isExtraido = origemRaw.includes('extraido');
          const isIA = !isExtraido;

          return (
            <div key={idx} className="step-edit-row" data-step-index={idx} style={{ border: '1px solid var(--color-border)', padding: '15px', borderRadius: '8px', marginBottom: '15px', background: 'var(--color-bg-1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center' }}>
                <strong style={{ color: 'var(--color-primary)' }}>Passo {idx + 1}</strong>
                <button type="button" className="btn btn--sm btn--outline btn-remove-step" style={{ color: 'var(--color-error)', borderColor: 'var(--color-error)', fontSize: '11px' }}>✕ Remover Passo</button>
              </div>
              <div className="structure-editor-wrapper">
                <div className="structure-editor-container step-drag-container" style={{ minHeight: '50px', background: 'var(--color-background)' }}>
                  <RawHTML html={blocosHtml} />
                </div>
                <div className="structure-toolbar step-add-toolbar" style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--color-border)', position: 'relative' }}>
                  <button type="button" className="btn btn--sm btn--secondary btn--full-width btn-toggle-step-add" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px', background: 'var(--color-bg-2)' }}>
                    <span>+ Adicionar Bloco de Conteúdo</span><span style={{ fontSize: '10px', opacity: 0.7 }}>▼</span>
                  </button>
                  <div className="step-menu-content hidden" style={{ position: 'absolute', top: '100%', left: 0, width: '100%', zIndex: 100, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '5px', padding: '10px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.15)', marginTop: '5px' }}>
                    {['texto', 'imagem', 'equacao', 'lista', 'destaque', 'citacao', 'codigo', 'titulo', 'subtitulo', 'fonte', 'separador'].map(type => (
                      <button key={type} type="button" className="btn btn--sm btn--outline btn-add-step-item" data-type={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '15px', background: 'rgba(0,0,0,0.03)', padding: '10px', borderRadius: '6px' }}>
                <div style={{ flex: 1 }}>
                  <span className="field-label" style={{ fontSize: '10px', marginBottom: '2px', display: 'block', color: 'var(--color-text-secondary)' }}>Origem do Conteúdo</span>
                  <select className="form-control passo-origem" style={{ width: '100%' }} defaultValue={isExtraido ? "extraido_do_material" : "gerado_pela_ia"}>
                    <option value="extraido_do_material">📄 Extraído do Material</option>
                    <option value="gerado_pela_ia">🤖 Gerado pela IA</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <span className="field-label" style={{ fontSize: '10px', marginBottom: '2px', display: 'block', color: 'var(--color-text-secondary)' }}>Fonte / Material</span>
                  <input className="form-control passo-fonte" placeholder="Ex: Página 32..." defaultValue={safe(p.fontematerial || '')} style={{ width: '100%' }} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <span className="field-label" style={{ fontSize: '10px', marginBottom: '2px', display: 'block', color: 'var(--color-text-secondary)' }}>Evidência Visual (se houver)</span>
                  <input className="form-control passo-evidencia" placeholder="Ex: Gráfico azul, segundo parágrafo..." defaultValue={safe(p.evidencia || '')} style={{ width: '100%' }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <button type="button" className="btn btn--secondary btn--full-width" id="btnAddPassoGabarito" style={{ marginTop: '6px' }}>
        + Adicionar Novo Passo
      </button>
    </div>
  );
};

const EditorComplexidade: React.FC<{ complexidadeRaw: any }> = ({ complexidadeRaw }) => {
  const cFatores = complexidadeRaw?.fatores || {};
  const chk = (key: string, label: string) => {
    const val = !!pick(cFatores[key], cFatores[key.replace(/_([a-z])/g, (_, x) => x.toUpperCase())], false);
    return (
      <label style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px', cursor: 'pointer' }}>
        <input type="checkbox" className="chk-complexidade" data-key={key} defaultChecked={val} />
        <span style={{ fontSize: '12px' }}>{label}</span>
      </label>
    );
  };

  return (
    <div className="field-group" style={{ border: '1px solid var(--color-border)', padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.02)' }}>
      <span className="field-label" style={{ color: 'var(--color-primary)', marginBottom: '8px', display: 'block' }}>Matriz de Complexidade</span>
      <div style={{ fontSize: '11px', color: 'gray', marginBottom: '10px' }}>Marque os fatores determinantes para a dificuldade.</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
        <div>
          <strong style={{ fontSize: '10px', textTransform: 'uppercase', color: 'gray', display: 'block', marginBottom: '4px' }}>Leitura</strong>
          {chk('texto_extenso', 'Texto Extenso')}
          {chk('vocabulario_complexo', 'Vocabulário Denso')}
          {chk('multiplas_fontes_leitura', 'Múltiplas Fontes')}
          {chk('interpretacao_visual', 'Interp. Visual')}

          <strong style={{ fontSize: '10px', textTransform: 'uppercase', color: 'gray', display: 'block', marginBottom: '4px', marginTop: '8px' }}>Conhecimento</strong>
          {chk('dependencia_conteudo_externo', 'Conteúdo Prévio')}
          {chk('interdisciplinaridade', 'Interdisciplinar')}
          {chk('contexto_abstrato', 'Contexto Abstrato')}
        </div>
        <div>
          <strong style={{ fontSize: '10px', textTransform: 'uppercase', color: 'gray', display: 'block', marginBottom: '4px' }}>Raciocínio</strong>
          {chk('raciocinio_contra_intuitivo', 'Contra-Intuitivo')}
          {chk('abstracao_teorica', 'Teoria Pura')}
          {chk('deducao_logica', 'Dedução Lógica')}

          <strong style={{ fontSize: '10px', textTransform: 'uppercase', color: 'gray', display: 'block', marginBottom: '4px', marginTop: '8px' }}>Operacional</strong>
          {chk('resolucao_multiplas_etapas', 'Multi-etapas')}
          {chk('transformacao_informacao', 'Transformação Info')}
          {chk('distratores_semanticos', 'Distratores Fortes')}
          {chk('analise_nuance_julgamento', 'Julgamento')}
        </div>
      </div>
      <div style={{ marginTop: '10px' }}>
        <span className="field-label">Justificativa da Dificuldade</span>
        <textarea id="editComplexidadeJust" className="form-control" rows={2} placeholder="Explique por que é difícil..." defaultValue={safe(complexidadeRaw?.justificativa_dificuldade || '')}></textarea>
      </div>
    </div>
  );
};

export const GabaritoEditorView: React.FC<{ dados: GabaritoData; onSave: () => void; onCancel: () => void }> = ({ dados, onSave, onCancel }) => {
  const {
    respostaLetra,
    justificativaCurta,
    confianca,
    explicacaoArray,
    questao,
    alternativasAnalisadas,
    coerencia,
    complexidadeRaw,
    creditos: creditosNull,
    alertasCredito,
    observacoes,
  } = dados;

  const creditos = creditosNull || {} as CreditosData;

  return (
    <form id="gabaritoEdit">
      <div className="field-group">
        <span className="field-label">Alternativa correta</span>
        <input id="editGabaritoResposta" className="form-control" type="text" defaultValue={safe(respostaLetra)} placeholder="Ex.: A" />
      </div>
      <div className="field-group">
        <span className="field-label">Justificativa curta</span>
        <textarea id="editGabaritoJust" className="form-control" rows={3} placeholder="1–2 frases" defaultValue={safe(justificativaCurta || '')}></textarea>
      </div>
      <div className="field-group">
        <span className="field-label">Confiança (0–1)</span>
        <input id="editGabaritoConfianca" className="form-control" type="number" min={0} max={1} step={0.01} defaultValue={confianca ?? ''} placeholder="0.85" />
      </div>

      {/* Editor Passos */}
      <EditorPassos explicacaoArray={explicacaoArray} />

      {/* Editor Análise Alternativas */}
      <div className="field-group">
        <span className="field-label">Análise por alternativa</span>
        <div id="editGabaritoAnalises" className="alts-list">
          {(Array.isArray(questao?.alternativas) ? questao.alternativas : []).map((alt: any, i: number) => {
            const letra = String(alt?.letra || '').trim().toUpperCase();
            const analise = (alternativasAnalisadas || []).find((a) => String(a?.letra || '').trim().toUpperCase() === letra);
            return (
              <div key={i} className="alt-row alt-edit-row" style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', marginBottom: '6px' }}>
                <input className="form-control" style={{ width: '60px', textAlign: 'center' }} value={safe(letra)} disabled />
                <textarea className="form-control gabarito-motivo" data-letra={safe(letra)} rows={2} placeholder="Motivo (correta/errada)" defaultValue={safe(analise?.motivo || '')}></textarea>
              </div>
            );
          })}
        </div>
      </div>

      {/* Editor Coerência */}
      <div className="field-group">
        <span className="field-label">Coerência (checagens internas)</span>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input id="editCoerenciaAltExiste" type="checkbox" defaultChecked={!!(coerencia?.alternativa_correta_existe ?? coerencia?.alternativaCorretaExiste)} />
            <span style={{ fontSize: '12px' }}>Alternativa correta existe</span>
          </label>
          <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input id="editCoerenciaTodasAnalise" type="checkbox" defaultChecked={!!(coerencia?.tem_analise_para_todas ?? coerencia?.temAnaliseParaTodas)} />
            <span style={{ fontSize: '12px' }}>Tem análise para todas</span>
          </label>
        </div>
        <textarea id="editCoerenciaObs" className="form-control" rows={3} placeholder="Observações de consistência" defaultValue={safe((Array.isArray(coerencia?.observacoes) ? coerencia.observacoes : []).join('\n'))}></textarea>
      </div>

      {/* Editor Complexidade */}
      <EditorComplexidade complexidadeRaw={complexidadeRaw} />

      {/* Editor Créditos */}
      <div className="field-group">
        <span className="field-label">Créditos / Fonte</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ flex: 1, minWidth: '160px' }}>
            <span className="field-label">Origem da resolução</span>
            <input id="editCredOrigem" className="form-control" type="text" defaultValue={safe(creditos.origemresolucao || '')} placeholder="extraidodomaterial / geradopelaia" />
          </div>
          <div style={{ flex: 1, minWidth: '160px' }}>
            <span className="field-label">Material</span>
            <input id="editCredMaterial" className="form-control" type="text" defaultValue={safe(creditos.material || '')} placeholder="Ex.: FUVEST 2023" />
          </div>
          <div style={{ flex: 1, minWidth: '160px' }}>
            <span className="field-label">Autor/Instituição</span>
            <input id="editCredAutor" className="form-control" type="text" defaultValue={safe(creditos.autorouinstituicao || '')} placeholder="Banca, escola, editora..." />
          </div>
          <div style={{ flex: '0 0 100px' }}>
            <span className="field-label">Ano</span>
            <input id="editCredAno" className="form-control" type="text" defaultValue={safe(creditos.ano || '')} placeholder="2024" />
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '8px' }}>
          <div style={{ flex: '0 0 140px' }}>
            <span className="field-label">Mat. identificado?</span>
            <label style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px' }}>
              <input id="editCredMatIdentificado" type="checkbox" defaultChecked={creditos.materialidentificado} />
              <span style={{ fontSize: '12px' }}>Sim</span>
            </label>
          </div>
          <div style={{ flex: '0 0 170px' }}>
            <span className="field-label">Precisa crédito genérico?</span>
            <label style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px' }}>
              <input id="editCredPrecisaGenerico" type="checkbox" defaultChecked={creditos.precisacreditogenerico} />
              <span style={{ fontSize: '12px' }}>Sim</span>
            </label>
          </div>
          <div style={{ flex: 1, minWidth: '160px' }}>
            <span className="field-label">Confiança identificação (0–1)</span>
            <input id="editCredConfId" className="form-control" type="number" min={0} max={1} step={0.01} defaultValue={creditos.confiancaidentificacao ?? ''} />
          </div>
        </div>
        <div style={{ marginTop: '8px' }}>
          <span className="field-label">Como identificou</span>
          <textarea id="editCredComo" className="form-control" rows={2} placeholder="Cabeçalho, rodapé, diagramação..." defaultValue={safe(creditos.comoidentificou || '')}></textarea>
        </div>
        <div style={{ marginTop: '8px' }}>
          <span className="field-label">Crédito sugerido (texto)</span>
          <textarea id="editCredTextoSugerido" className="form-control" rows={2} placeholder="Texto pronto para mostrar como crédito." defaultValue={safe(creditos.textocreditosugerido || '')}></textarea>
        </div>
      </div>

      {/* Alertas e Observações Finais */}
      <div className="field-group">
        <span className="field-label">Alertas de crédito (1 por linha)</span>
        <textarea id="editGabaritoAlertas" className="form-control" rows={3} defaultValue={safe(alertasCredito.join('\n'))}></textarea>
      </div>
      <div className="field-group">
        <span className="field-label">Observações gerais (1 por linha)</span>
        <textarea id="editGabaritoObs" className="form-control" rows={3} defaultValue={safe(observacoes.join('\n'))}></textarea>
      </div>

      <button type="button" className="btn btn--primary btn--full-width" id="btnSalvarEdicaoGabarito" style={{ marginTop: '12px' }} onClick={onSave}>Salvar alterações (gabarito)</button>
      <button type="button" className="btn btn--secondary btn--full-width" id="btnCancelarEdicaoGabarito" style={{ marginTop: '8px' }} onClick={onCancel}>Cancelar</button>
    </form>
  );
};