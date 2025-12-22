import React from 'react';
import { pick } from '../utils/pick.js';

// --- DEFINIÇÕES E TIPOS ---

type FatorKey = string;
type CategoriaKey = 'leitura' | 'conhecimento' | 'raciocinio' | 'operacional';

interface ConfigItem {
  label: string;
  color: string;
}

interface FatorDef {
  key: FatorKey;
  label: string;
  cat: CategoriaKey;
  peso: number;
}

const CFG: Record<CategoriaKey, ConfigItem> = {
  leitura: { label: 'Suporte e Leitura', color: 'var(--color-info)' },
  conhecimento: { label: 'Conhecimento Prévio', color: 'var(--color-primary)' },
  raciocinio: { label: 'Raciocínio', color: '#9333ea' },
  operacional: { label: 'Operacional', color: 'var(--color-warning)' },
};

const FATORES_DEF: FatorDef[] = [
  { key: 'texto_extenso', label: 'Texto Extenso', cat: 'leitura', peso: 1 },
  { key: 'vocabulario_complexo', label: 'Vocabulário Denso', cat: 'leitura', peso: 2 },
  { key: 'multiplas_fontes_leitura', label: 'Múltiplas Fontes', cat: 'leitura', peso: 2 },
  { key: 'interpretacao_visual', label: 'Visual Crítico', cat: 'leitura', peso: 2 },
  { key: 'dependencia_conteudo_externo', label: 'Conteúdo Prévio', cat: 'conhecimento', peso: 3 },
  { key: 'interdisciplinaridade', label: 'Interdisciplinar', cat: 'conhecimento', peso: 4 },
  { key: 'contexto_abstrato', label: 'Abstração Contextual', cat: 'conhecimento', peso: 3 },
  { key: 'raciocinio_contra_intuitivo', label: 'Contra-Intuitivo', cat: 'raciocinio', peso: 5 },
  { key: 'abstracao_teorica', label: 'Teoria Pura', cat: 'raciocinio', peso: 3 },
  { key: 'deducao_logica', label: 'Dedução Lógica', cat: 'raciocinio', peso: 3 },
  { key: 'resolucao_multiplas_etapas', label: 'Multi-etapas', cat: 'operacional', peso: 4 },
  { key: 'transformacao_informacao', label: 'Transformação Info', cat: 'operacional', peso: 3 },
  { key: 'distratores_semanticos', label: 'Distratores Fortes', cat: 'operacional', peso: 3 },
  { key: 'analise_nuance_julgamento', label: 'Julgamento/Nuance', cat: 'operacional', peso: 3 },
];

// --- LÓGICA DE NEGÓCIO (Exportada para compatibilidade) ---

export const _getComplexidadeConfig = () => ({ CFG, FATORES_DEF });

export const _calcularComplexidade = (complexidadeObj: any) => {
  if (!complexidadeObj || !complexidadeObj.fatores) return null;

  const f = complexidadeObj.fatores;
  let somaPesos = 0;
  let itensAtivos: (FatorDef & { ativo: boolean })[] = [];

  const grupos: Record<CategoriaKey, (FatorDef & { ativo: boolean })[]> = {
    leitura: [],
    conhecimento: [],
    raciocinio: [],
    operacional: [],
  };

  FATORES_DEF.forEach((item) => {
    // Suporta snake_case e camelCase
    const camelKey = item.key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    const val = !!pick(f[item.key], f[camelKey], false);

    if (val) {
      somaPesos += item.peso;
      itensAtivos.push({ ...item, ativo: true });
    }

    grupos[item.cat].push({ ...item, ativo: val });
  });

  const DENOMINADOR = 30;
  const score = Math.min(1, somaPesos / DENOMINADOR);
  const pct = Math.round(score * 100);

  let nivel = { texto: 'FÁCIL', cor: 'var(--color-success)' };
  if (score > 0.3) nivel = { texto: 'MÉDIA', cor: 'var(--color-warning)' };
  if (score > 0.6) nivel = { texto: 'DIFÍCIL', cor: 'var(--color-orange-500)' };
  if (score > 0.8) nivel = { texto: 'DESAFIO', cor: 'var(--color-error)' };

  return { score, pct, nivel, itensAtivos, grupos, CFG };
};

// --- SUB-COMPONENTES ---

const GrupoComplexidade = ({ catKey, grupos }: { catKey: CategoriaKey, grupos: any }) => {
  const itens = grupos[catKey];
  const cfg = CFG[catKey];

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 'bold', color: cfg.color, textTransform: 'uppercase', marginBottom: 4 }}>
        {cfg.label}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
        {itens.map((i: any) => (
          <div
            key={i.key}
            style={{
              fontSize: 11,
              color: i.ativo ? 'var(--color-text)' : 'var(--color-text-secondary)',
              opacity: i.ativo ? 1 : 0.6,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: i.ativo ? cfg.color : '#ddd',
              }}
            />
            {i.label}
          </div>
        ))}
      </div>
    </div>
  );
};

// --- COMPONENTE PRINCIPAL ---

export const ComplexityCard: React.FC<{ data: any }> = ({ data }) => {
  const calculations = _calcularComplexidade(data);
  if (!calculations) return null;

  const { pct, nivel, itensAtivos, grupos } = calculations;

  return (
    <div
      className="complexity-card"
      style={{
        marginTop: 15,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: 15,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
        <span className="field-label" style={{ fontSize: 11, opacity: 0.8 }}>
          NÍVEL DE DIFICULDADE
        </span>
        <span style={{ fontWeight: 900, fontSize: 14, color: nivel.cor }}>
          {nivel.texto} ({pct}%)
        </span>
      </div>

      {/* Barra de Progresso */}
      <div
        style={{
          height: 8,
          width: '100%',
          background: 'var(--color-background-progress-bar)',
          borderRadius: 99,
          overflow: 'hidden',
          marginBottom: 15,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: nivel.cor,
            borderRadius: 99,
            transition: 'width 1s ease',
          }}
        />
      </div>

      {/* Tags Ativas */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {itensAtivos.length === 0 ? (
          <span style={{ fontSize: 11, color: 'gray' }}>—</span>
        ) : (
          itensAtivos.map((item) => {
            const c = CFG[item.cat].color;
            return (
              <span
                key={item.key}
                style={{
                  fontSize: 10,
                  padding: '3px 8px',
                  borderRadius: 4,
                  fontWeight: 700,
                  border: `1px solid ${c}`,
                  color: c,
                  background: 'var(--color-surface)',
                }}
              >
                {item.label}
              </span>
            );
          })
        )}
      </div>

      {/* Justificativa */}
      {data.justificativa_dificuldade && (
        <div
          className="markdown-content"
          data-raw={data.justificativa_dificuldade}
          style={{
            fontSize: 12,
            color: 'var(--color-text-secondary)',
            background: 'var(--color-bg-1)',
            padding: 10,
            borderRadius: 'var(--radius-base)',
            fontStyle: 'italic',
            lineHeight: 1.4,
            marginBottom: 10,
          }}
        >
          {data.justificativa_dificuldade}
        </div>
      )}

      {/* Detalhes (Accordion) */}
      <details style={{ fontSize: 12, borderTop: '1px solid var(--color-border)', paddingTop: 8 }}>
        <summary style={{ cursor: 'pointer', color: 'var(--color-primary)', fontWeight: 600, fontSize: 11, outline: 'none' }}>
          VER ANÁLISE DETALHADA
        </summary>
        <div style={{ marginTop: 10, paddingLeft: 4 }}>
          <GrupoComplexidade catKey="leitura" grupos={grupos} />
          <GrupoComplexidade catKey="conhecimento" grupos={grupos} />
          <GrupoComplexidade catKey="raciocinio" grupos={grupos} />
          <GrupoComplexidade catKey="operacional" grupos={grupos} />
        </div>
      </details>
    </div>
  );
};