import { renderizarQuestaoController } from './render-questao-controller.tsx';
// OBS: Dependendo do seu bundler (Webpack/Vite), talvez não precise da extensão .tsx no import

/**
 * Renderiza os dados finais da Questão na Sidebar.
 * 
 * @deprecated A lógica foi migrada para 'render-questao-controller.tsx'. 
 * Mantenha este arquivo apenas para compatibilidade retroativa.
 */
export function renderizarQuestaoFinal(dados, elementoAlvo = null) {
  // Redireciona a chamada para o novo controlador em TypeScript
  return renderizarQuestaoController(dados, elementoAlvo);
}