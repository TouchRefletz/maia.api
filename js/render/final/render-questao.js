import { configurarNavegacaoEdicao, initBotaoSalvarGabarito } from '../../editor/gabarito-save.js';
import { configurarBotoesControleQuestao, initBotaoSalvarQuestao } from '../../editor/questao-save.js';
import { _atualizarEstadoGlobal, _prepararContainerEBackups, _prepararDadosIniciais, _prepararInterfaceBasica, _processarDadosPayload } from '../../normalize/payload.js';
import { _garantirEstruturaSidebar } from '../../viewer/resizer.js';
import { _gerarHtmlAbaQuestao, _gerarHtmlAbas, _gerarHtmlEditorEstrutura, _gerarHtmlQuestao, aplicarAlteracoesNaTela, configurarEventosAuxiliares, configurarInteratividadeGeral, initBotaoAdicionarAlternativa } from '../questao-tabs.js';

/**
 * Renderiza os dados finais da Questão na Sidebar.
 */
export function renderizarQuestaoFinal(dados, elementoAlvo = null) {
  var { root, isGabaritoData, dadosNorm } = _prepararDadosIniciais(dados);

  dadosNorm = _processarDadosPayload(root, isGabaritoData);

  _atualizarEstadoGlobal(dados, dadosNorm);

  let { questao, gabarito, viewerBody, main, sidebar, resizer } =
    _prepararInterfaceBasica(dadosNorm);

  // Atualizamos as variáveis sidebar e resizer com o resultado da função
  ({ sidebar, resizer } = _garantirEstruturaSidebar(
    viewerBody,
    main,
    sidebar,
    resizer
  ));

  let container = _prepararContainerEBackups(elementoAlvo, dados);

  let { htmlAbas, displayQuestao, displayGabarito } = _gerarHtmlAbas(gabarito);

  const { htmlEstruturaVisual, blocosHtml } = _gerarHtmlQuestao(questao);

  const htmlEstruturaEdit = _gerarHtmlEditorEstrutura(blocosHtml);

  const htmlQuestao = _gerarHtmlAbaQuestao(
    questao,
    displayQuestao,
    htmlEstruturaVisual,
    htmlEstruturaEdit,
    gabarito
  );

  aplicarAlteracoesNaTela(
    sidebar, // Sidebar onde vai entrar
    container, // O container criado em memória
    questao, // Dados
    gabarito, // Dados
    htmlAbas, // String HTML
    htmlQuestao, // String HTML
    displayGabarito // "block" ou "none"
  );

  configurarEventosAuxiliares(container);

  configurarInteratividadeGeral(container);

  initBotaoAdicionarAlternativa(container);

  configurarNavegacaoEdicao(container, gabarito);

  initBotaoSalvarGabarito(container, questao);

  configurarBotoesControleQuestao(container);

  initBotaoSalvarQuestao(container);

  // configurarTabs(container, gabarito); // REMOVIDO: A lógica de abas agora é gerenciada pelo React Component (QuestaoTabs)
}