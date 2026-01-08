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
// @ts-ignore
import { getActiveTab, updateTabStatus } from '../../ui/sidebar-tabs.js';

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
  
  // 0. AUTO-DETECÇÃO DE ABA (Hack para sistema legado que não passa alvo)
  if (!elementoAlvo) {
    const tabsContent = document.getElementById("sidebar-tabs-content");
    // Só usamos a aba como alvo se ela estiver visível/ativa no DOM
    if (tabsContent && tabsContent.offsetParent !== null) {
      elementoAlvo = tabsContent;
      console.log("Renderizando questão dentro da aba ativa.");
    }
  }

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
  // Se passamos elementoAlvo (aba), o helper deve usá-lo ou retornar um container pronto.
  const container = _prepararContainerEBackups(elementoAlvo, dados) as HTMLElement;

  // 6. GARANTIA DE EXIBIÇÃO (Manipulação DOM Imperativa)
  // Se existe sidebar mas o container ainda não está anexado a ela
  if (sidebar && container && !container.parentNode) {
    if (elementoAlvo) {
      // Se temos um alvo específico (aba), limpamos ele e anexamos o container
      elementoAlvo.innerHTML = '';
      elementoAlvo.appendChild(container);
    } else {
      // Comportamento Legado: Substitui todo content da Sidebar
      sidebar.innerHTML = ''; 
      sidebar.appendChild(container); 
    }
  }

  // 7. Mount React Component
  // Chama a função legada que inicia o React (ReactDOM.render ou createRoot)
  mountQuestaoTabs(container, questao, gabarito);

  // 8. PERSISTÊNCIA NA ABA (NOVO)
  // Se renderizamos dentro de uma aba, precisamos salvar os dados nela
  // para que, se o usuário trocar de aba e voltar, o conteúdo seja restaurado.
  // @ts-ignore
  if (elementoAlvo && elementoAlvo.id === 'sidebar-tabs-content') {
       // @ts-ignore
       const activeTab = getActiveTab();
       if (activeTab) {
           // @ts-ignore
           updateTabStatus(activeTab.id, {
               status: 'complete',
               response: dados
           }, { suppressRender: true });
       }
  }
}