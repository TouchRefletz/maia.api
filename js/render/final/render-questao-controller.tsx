// @ts-ignore - Ignorando verificação de tipos para arquivos JS legados
import {
    _atualizarEstadoGlobal,
    _prepararContainerEBackups,
    _prepararDadosIniciais,
    _prepararInterfaceBasica,
    _processarDadosPayload
} from '../../normalize/payload.js';
// @ts-ignore
import { _garantirEstruturaSidebar } from '../../viewer/resizer.js';
// @ts-ignore
import { mountQuestaoTabs } from '../questao-tabs.js';

interface IDadosPayload {
  [key: string]: any;
}

/**
 * Controlador responsável por orquestrar a preparação do DOM e dos dados
 * antes de montar o componente React.
 * 
 * Mantém a lógica original de manipulação imperativa necessária para o
 * funcionamento dos helpers legados (_garantirEstruturaSidebar, etc).
 */
export function renderizarQuestaoController(
  dados: IDadosPayload, 
  elementoAlvo: HTMLElement | null = null
): void {
  
  // 1. Preparação de Dados
  const prepResult = _prepararDadosIniciais(dados);
  const root = prepResult.root;
  const isGabaritoData = prepResult.isGabaritoData;
  let dadosNorm = prepResult.dadosNorm;

  // 2. Processamento de Payload e Estado Global
  dadosNorm = _processarDadosPayload(root, isGabaritoData);
  _atualizarEstadoGlobal(dados, dadosNorm);

  // 3. Preparação da Interface Básica (DOM Nodes)
  const interfaceBasica = _prepararInterfaceBasica(dadosNorm);
  
  // Desestruturação segura
  const questao = interfaceBasica.questao;
  const gabarito = interfaceBasica.gabarito;
  const viewerBody = interfaceBasica.viewerBody;
  const main = interfaceBasica.main;
  let sidebar = interfaceBasica.sidebar;
  let resizer = interfaceBasica.resizer;

  // 4. Garantia da Estrutura da Sidebar (Lógica de redimensionamento legado)
  const estruturaSidebar = _garantirEstruturaSidebar(
    viewerBody,
    main,
    sidebar,
    resizer
  );

  // Atualiza referências conforme retorno da função legado
  sidebar = estruturaSidebar.sidebar;
  resizer = estruturaSidebar.resizer;

  // 5. Preparação do Container React
  const container = _prepararContainerEBackups(elementoAlvo, dados) as HTMLElement;

  // 6. GARANTIA DE EXIBIÇÃO (Manipulação DOM Imperativa)
  // Se existe sidebar mas o container ainda não está anexado a ela
  if (sidebar && container && !container.parentNode) {
    sidebar.innerHTML = ''; // Limpa loaders/skeletons
    sidebar.appendChild(container); // Anexa o container onde o React será montado
  }

  // 7. Mount React Component
  // Chama a função legada que inicia o React (ReactDOM.render ou createRoot)
  mountQuestaoTabs(container, questao, gabarito);
}