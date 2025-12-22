// --- AlternativasRender.tsx ---
import React from 'react';
import { AlternativeStructure } from './StructureRender';

interface EstruturaItem {
  tipo: string;
  conteudo: string;
}

interface Alternativa {
  letra?: string;
  estrutura?: EstruturaItem[];
  texto?: string;
}

interface AlternativasProps {
  alts?: Alternativa[];
}

export const Alternativas: React.FC<AlternativasProps> = ({ alts }) => {
  if (!alts || alts.length === 0) {
    return <div className="data-box">Sem alternativas</div>;
  }

  return (
    <>
      {alts.map((a, index) => {
        const letra = String(a?.letra ?? '')
          .trim()
          .toUpperCase();

        const estrutura = Array.isArray(a?.estrutura)
          ? a.estrutura
          : [{ tipo: 'texto', conteudo: String(a?.texto ?? '') }];

        return (
          <div className="alt-row" key={`${letra}-${index}`}>
            <span className="alt-letter">{letra}</span>
            <div className="alt-content">
              <AlternativeStructure
                estrutura={estrutura}
                letra={letra}
                imagensExternas={[]}
                contexto="questao"
              />
            </div>
          </div>
        );
      })}
    </>
  );
};
