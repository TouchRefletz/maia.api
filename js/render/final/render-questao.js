import { _atualizarEstadoGlobal, _prepararContainerEBackups, _prepararDadosIniciais, _prepararInterfaceBasica, _processarDadosPayload } from '../../normalize/payload.js';
import { _garantirEstruturaSidebar } from '../../viewer/resizer.js';
import { mountQuestaoTabs } from '../questao-tabs.js';

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

  // GARANTIA DE EXIBIÇÃO: Se o container não estiver no DOM, inseri-lo na sidebar
  if (sidebar && !container.parentNode) {
    sidebar.innerHTML = ''; // Limpa conteúdo anterior (loaders, skeletons)
    sidebar.appendChild(container); // Adiciona o container DOM onde o React vai montar
  }

  // Mount React Component
  mountQuestaoTabs(container, questao, gabarito);
}