import React from 'react';
import { createRoot } from 'react-dom/client';
import QuestaoTabs from './QuestaoTabs.tsx';

/**
 * Finaliza o processo: Renderiza o Componente React na Sidebar.
 * Esta função é chamada pelos módulos externos (ex: main.js, loader.js).
 */
export function aplicarAlteracoesNaTela(
  sidebar,
  container,
  questao,
  gabarito,
  // Os argumentos abaixo (htmlAbas, etc) são ignorados pois o React gera tudo do zero
  htmlAbas,
  htmlQuestao,
  displayGabarito
) {
  // 1. Limpeza da área anterior
  const oldResult = sidebar.querySelector('.extraction-result');
  if (oldResult) oldResult.remove();

  // 2. Adiciona o container limpo à Sidebar
  // O container deve estar na DOM antes do React renderizar para que useEffects funcionem
  sidebar.appendChild(container);

  // 3. Renderiza o Componente React
  // Passamos o próprio container como ref para que o React possa passar 
  // para os scripts legados que precisam de um elemento raiz.
  const root = createRoot(container);
  root.render(
    React.createElement(QuestaoTabs, {
      questao,
      gabarito,
      containerRef: container
    })
  );
}

// Funções exportadas mas que agora são "no-op" (sem operação) ou proxies,
// caso algum arquivo externo tente importá-las diretamente.
// Se seu projeto não importa essas funções em outros lugares além daqui mesmo,
// você pode removê-las.
export const _gerarHtmlAbas = () => ({ htmlAbas: '', displayQuestao: '', displayGabarito: '' });
export const _gerarHtmlQuestao = () => ({ htmlEstruturaVisual: '', blocosHtml: '' });
export const _gerarHtmlEditorEstrutura = () => '';
export const _gerarHtmlVisualizacaoQuestao = () => '';
export const _gerarHtmlEdicaoQuestao = () => '';
export const _gerarHtmlAbaQuestao = () => '';
export const atualizarInterfaceQuestao = () => { };
export const configurarEventosAuxiliares = () => { };
export const configurarInteratividadeGeral = () => { };
export const initBotaoAdicionarAlternativa = () => { };
export const adicionarNovaAlternativa = () => { };