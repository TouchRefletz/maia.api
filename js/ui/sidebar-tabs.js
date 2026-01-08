/**
 * Gerenciador de Abas da Sidebar
 * Permite múltiplas abas para questões em processamento
 */

// Estado global das abas
const tabsState = {
  tabs: [{ id: "hub", type: "hub", label: "Questões", closable: false }],
  activeTabId: "hub",
  tabIdCounter: 0,
};

// Callbacks para renderização externa
let hubRenderCallback = null;

// Import helpers for rich cards
import {
  construirSkeletonLoader,
  criarElementoCardPensamento,
  splitThought,
} from "../sidebar/thoughts-base.js";

/**
 * Inicializa o sistema de abas na sidebar
 */
export function initSidebarTabs() {
  const sidebar = document.getElementById("viewerSidebar");
  if (!sidebar) return;

  // Criar container do header de abas se não existir
  let tabsHeader = document.getElementById("sidebar-tabs-header");
  if (!tabsHeader) {
    tabsHeader = document.createElement("div");
    tabsHeader.id = "sidebar-tabs-header";
    tabsHeader.className = "sidebar-tabs-header";
    // FIX: Garantir que o header fique sobre o conteúdo (questão pode ter z-index alto)
    tabsHeader.style.position = "relative";
    tabsHeader.style.zIndex = "100";
    sidebar.prepend(tabsHeader);
  }

  // Criar container do conteúdo de abas se não existir
  let tabsContent = document.getElementById("sidebar-tabs-content");
  if (!tabsContent) {
    tabsContent = document.createElement("div");
    tabsContent.id = "sidebar-tabs-content";
    tabsContent.className = "sidebar-tabs-content";

    // Inserir após o header de abas
    tabsHeader.insertAdjacentElement("afterend", tabsContent);
  }

  renderTabs();
  renderActiveTabContent();
}

/**
 * Define o callback para renderizar o conteúdo do Hub
 * @param {Function} callback - Função que renderiza o hub no container fornecido
 */
export function setHubRenderCallback(callback) {
  hubRenderCallback = callback;
}

/**
 * Cria uma nova aba para uma questão em processamento
 * @param {string} groupId - ID do grupo da questão
 * @param {string} label - Label da questão (ex: "Questão 01")
 * @returns {string} ID da nova aba
 */
export function createQuestionTab(groupId, label) {
  tabsState.tabIdCounter++;
  const tabId = `question-${tabsState.tabIdCounter}`;

  const newTab = {
    id: tabId,
    type: "question",
    label: label || `Questão ${tabsState.tabIdCounter}`,
    groupId: groupId,
    closable: true,
    status: "processing", // processing, complete, error
    progress: 0,
  };

  tabsState.tabs.push(newTab);
  setActiveTab(tabId);

  return tabId;
}

/**
 * Remove uma aba pelo ID
 * @param {string} tabId - ID da aba a remover
 */
export function removeTab(tabId) {
  const index = tabsState.tabs.findIndex((t) => t.id === tabId);
  if (index === -1) return;

  const tab = tabsState.tabs[index];
  if (!tab.closable) return; // Não pode fechar a aba Hub

  tabsState.tabs.splice(index, 1);

  // Remove o container DOM associado para liberar memória
  const tabContainerId = `tab-content-${tabId}`;
  const container = document.getElementById(tabContainerId);
  if (container) container.remove();

  // Se a aba ativa foi removida, volta para o Hub
  if (tabsState.activeTabId === tabId) {
    setActiveTab("hub");
  } else {
    renderTabs();
  }
}

/**
 * Define a aba ativa
 * @param {string} tabId - ID da aba a ativar
 */
export function setActiveTab(tabId) {
  const tab = tabsState.tabs.find((t) => t.id === tabId);
  if (!tab) return;

  tabsState.activeTabId = tabId;
  renderTabs();
  renderActiveTabContent();
}

/**
 * Força o recarregamento do conteúdo da aba ativa
 */
export function reloadTab(tabId) {
  const tab = tabsState.tabs.find((t) => t.id === tabId);
  if (!tab) return;

  // Remove o container existente
  const tabContainerId = `tab-content-${tabId}`;
  const container = document.getElementById(tabContainerId);
  if (container) {
    container.innerHTML = ""; // Limpa conteúdo
    container.remove(); // Remove do DOM para forçar recriação
  }

  // Re-renderiza
  if (tabsState.activeTabId === tabId) {
    renderActiveTabContent();
  } else {
    // Se recarregar uma aba background, ela será recriada quando ativada
    // Mas se quiser recriar agora? Não precisamos, lazy load é melhor.
  }
}

/**
 * Obtém a aba ativa atual
 * @returns {Object} A aba ativa
 */
export function getActiveTab() {
  return tabsState.tabs.find((t) => t.id === tabsState.activeTabId);
}

/**
 * Atualiza o status/progresso de uma aba de questão
 * @param {string} tabId - ID da aba
 * @param {Object} updates - { status?, progress?, label? }
 */
export function updateTabStatus(tabId, updates, options = {}) {
  const tab = tabsState.tabs.find((t) => t.id === tabId);
  if (!tab) return;

  if (updates.status !== undefined) tab.status = updates.status;
  if (updates.progress !== undefined) tab.progress = updates.progress;
  if (updates.label !== undefined) tab.label = updates.label;
  if (updates.response !== undefined) tab.response = updates.response;

  renderTabs();

  if (options.suppressRender) return;

  // Se for a aba ativa e houve update de response, e o container JÁ existe
  // Podemos querer atualizar o conteúdo.
  // Mas cuidado: se atualizarmos innerHTML perdemos scroll.
  // Idealmente, a atualização deve ser pontual.
  // Para 'response' (finalização), geralmente substitui tudo, então OK.

  if (tab.id === tabsState.activeTabId && updates.response) {
    // Força reload do container para mostrar a resposta final
    reloadTab(tabId);
  } else {
    // Para updates parciais (logs, progress), o renderQuestionTabContent
    // sabe lidar com append se o container já existir?
    // Nesse refactor, logs são adicionados via addLogToQuestionTab diretamente no DOM.
    // Então aqui só precisamos mudar o status visual do header.
  }
}

/**
 * Renderiza a barra de abas
 */
function renderTabs() {
  const tabsHeader = document.getElementById("sidebar-tabs-header");
  if (!tabsHeader) return;

  tabsHeader.innerHTML = "";

  // Wrapper para conter abas + botão fechar
  const headerWrapper = document.createElement("div");
  headerWrapper.className = "sidebar-tabs-header-wrapper";

  const tabsBar = document.createElement("div");
  tabsBar.className = "sidebar-tabs-bar";

  tabsState.tabs.forEach((tab) => {
    const isActive = tab.id === tabsState.activeTabId;
    const tabBtn = document.createElement("button");
    tabBtn.className = `sidebar-tab ${isActive ? "active" : ""}`;
    tabBtn.dataset.tabId = tab.id;

    // Ícone baseado no tipo
    let icon = "📋";
    if (tab.type === "hub") {
      icon = "🏠";
    } else if (tab.type === "question") {
      if (tab.status === "processing") icon = "⏳";
      else if (tab.status === "complete") icon = "✅";
      else if (tab.status === "error") icon = "❌";
    }

    // Label com ícone
    const labelSpan = document.createElement("span");
    labelSpan.className = "sidebar-tab-label";
    labelSpan.innerHTML = `<span class="tab-icon">${icon}</span> ${tab.label}`;
    tabBtn.appendChild(labelSpan);

    // Botão de fechar (apenas para abas fecháveis)
    if (tab.closable) {
      const closeBtn = document.createElement("span");
      closeBtn.className = "sidebar-tab-close";
      closeBtn.innerHTML = "×";
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        removeTab(tab.id);
      };
      tabBtn.appendChild(closeBtn);
    }

    tabBtn.onclick = () => setActiveTab(tab.id);
    tabsBar.appendChild(tabBtn);
  });

  headerWrapper.appendChild(tabsBar);

  // Botão de fechar sidebar
  const closeSidebarBtn = document.createElement("button");
  closeSidebarBtn.className = "sidebar-close-btn";
  closeSidebarBtn.innerHTML = "×";
  closeSidebarBtn.title = "Fechar Sidebar";
  closeSidebarBtn.onclick = () => {
    esconderPainel();
  };
  headerWrapper.appendChild(closeSidebarBtn);

  tabsHeader.appendChild(headerWrapper);
}

/**
 * Renderiza o conteúdo da aba ativa (PERSISTENTE)
 */
function renderActiveTabContent() {
  const tabsContent = document.getElementById("sidebar-tabs-content");
  if (!tabsContent) return;

  const activeTab = getActiveTab();
  if (!activeTab) return;

  // 1. Esconder TODOS os containers de abas (Preservando Scroll)
  const allContainers = tabsContent.querySelectorAll(".tab-content-container");
  allContainers.forEach((el) => {
    // Usamos visibility + position absolute para manter o elemento renderizado
    // e preservar o scroll, mas tirá-lo do fluxo visual.
    el.style.position = "absolute";
    el.style.visibility = "hidden";
    el.style.opacity = "0";
    el.style.pointerEvents = "none";
    el.style.top = "0";
    el.style.left = "0";
    el.style.width = "100%";
    el.style.zIndex = "-1";
  });

  // 2. Verifica se já existe container para a aba ativa
  const tabContainerId = `tab-content-${activeTab.id}`;
  let activeContainer = document.getElementById(tabContainerId);

  // Se não existe, cria
  if (!activeContainer) {
    activeContainer = document.createElement("div");
    activeContainer.id = tabContainerId;
    activeContainer.className = "tab-content-container";
    activeContainer.style.height = "100%"; // Ocupar altura total
    activeContainer.style.overflowY = "auto"; // Scroll interno se necessário
    tabsContent.appendChild(activeContainer);

    // Renderiza o conteúdo INICIALMENTE
    renderTabInnerContent(activeContainer, activeTab);
  }

  // 3. Mostra o container ativo
  activeContainer.style.position = "relative";
  activeContainer.style.visibility = "visible";
  activeContainer.style.opacity = "1";
  activeContainer.style.pointerEvents = "auto";
  activeContainer.style.zIndex = "1";
  // Remove styles de ocultação que podem ter sobrado
  activeContainer.style.top = "";
  activeContainer.style.left = "";
}

/**
 * Preenche o conteúdo de um container de aba recém-criado
 */
function renderTabInnerContent(container, tab) {
  if (tab.type === "hub") {
    // Renderizar o Hub (lista de questões por página)
    if (hubRenderCallback) {
      hubRenderCallback(container);
    } else {
      // Fallback - criar containers esperados pelo sistema existente
      const pagesContainer = document.createElement("div");
      pagesContainer.id = "sidebar-pages-container";
      pagesContainer.className = "sidebar-pages-container";
      container.appendChild(pagesContainer);

      // O footer de ações também precisa existir
      const actionsFooter = document.createElement("div");
      actionsFooter.id = "sidebar-actions-footer";
      actionsFooter.style.padding = "10px";
      actionsFooter.style.borderTop = "1px solid var(--border-color)";
      container.appendChild(actionsFooter);
    }
  } else if (tab.type === "question") {
    // Se já tiver uma resposta final processada, renderiza o formulário final
    if (tab.response) {
      import("../render/final/render-questao.js")
        .then((mod) => {
          mod.renderizarQuestaoFinal(tab.response, container);
        })
        .catch((err) => {
          console.error("Erro ao carregar renderizador final:", err);
          container.innerHTML = `<div class="error-msg">Erro ao carregar visualização.</div>`;
        });
    } else {
      // Caso contrário, renderiza status de processamento/erro padrão
      renderQuestionTabContent(container, tab);
    }
  }
}

/**
 * Renderiza o conteúdo de uma aba de questão
 */
function renderQuestionTabContent(container, tab) {
  // Limpa o container para garantir
  container.innerHTML = "";

  // 1. Usa o Skeleton Loader oficial (Design do Usuário)
  // construirSkeletonLoader espera um container pai ("sidebar"), mas aqui
  // estamos renderizando DENTRO de "container" (que é o tabsContent).
  // A função construirSkeletonLoader anexa ao container passado.
  const refs = construirSkeletonLoader(container);

  if (!refs) {
    // Fallback error
    container.innerHTML = `<div class="error-msg">Erro ao carregar layout.</div>`;
    return;
  }

  const { thoughtListEl, textElement, loadingContainer } = refs;

  // Ajuste fino: O Skeleton Loader pode ter estilos que esperam estar direto no body
  // mas vamos garantir que ele ocupe o espaço correto
  loadingContainer.style.marginTop = "0";
  loadingContainer.style.borderTop = "none";
  loadingContainer.style.height = "100%";
  loadingContainer.style.display = "flex";
  loadingContainer.style.flexDirection = "column";

  // Identifica este container de logs especificamente para o addLogToQuestionTab
  // Como addLogToQuestionTab busca por ID "maiaThoughts", e agora temos múltiplos (um por aba invisível),
  // precisamos garantir que o ID seja ÚNICO ou que a função de log saiba buscar no contexto certo.
  // PROBLEMA: "maiaThoughts" é um ID fixo usado no thoughts-base.js?
  // Se for ID, teremos duplicidade no DOM (inválido).
  // SOLUÇÃO: Mudar ID para class ou ID dinâmico.
  // Vamos ver addLogToQuestionTab abaixo.

  // Precisamos alterar o ID para ser único por aba, senão getElementById pega o primeiro.
  thoughtListEl.id = `maiaThoughts-${tab.id}`;
  // Mas o thoughts-base pode depender de classes também.
  // Vamos atualizar addLogToQuestionTab para buscar por este ID dinâmico.

  // 2. Restaura Logs/Pensamentos Anteriores
  if (tab.logs && tab.logs.length > 0) {
    tab.logs.forEach((msg) => {
      const { title, body } = splitThought(msg);
      const card = criarElementoCardPensamento(title, body);

      // Insere ANTES do skeleton final (se existir) para manter o efeito de "pensando..."
      const skeletonCard = thoughtListEl.querySelector(
        ".maia-thought-card--skeleton"
      );
      if (skeletonCard) {
        thoughtListEl.insertBefore(card, skeletonCard);
      } else {
        thoughtListEl.appendChild(card);
      }
    });

    // Scroll para o fim logic
    setTimeout(() => {
      if (thoughtListEl) thoughtListEl.scrollTop = thoughtListEl.scrollHeight;
    }, 50);
  }
}

/**
 * Adiciona uma entrada de log à aba de questão
 */
export function addLogToQuestionTab(tabId, message) {
  // 1. Persistência de Estado
  const tab = tabsState.tabs.find((t) => t.id === tabId);
  if (tab) {
    if (!tab.logs) tab.logs = [];
    tab.logs.push(message);
  }

  // 2. Atualização Visual (se o container da aba existir)
  const tabLogListId = `maiaThoughts-${tabId}`;
  const thoughtListEl = document.getElementById(tabLogListId);

  // Se não achou (aba ainda não renderizada), tudo bem, persistimos no passo 1.
  if (!thoughtListEl) return;

  // Renderização Rica
  const { title, body } = splitThought(message);
  const card = criarElementoCardPensamento(title, body);

  // Insere ANTES do skeleton (efeito "pensando..." continua no final)
  const skeletonCard = thoughtListEl.querySelector(
    ".maia-thought-card--skeleton"
  );
  if (skeletonCard) {
    thoughtListEl.insertBefore(card, skeletonCard);
  } else {
    thoughtListEl.appendChild(card);
  }

  // Smart Scroll - scroll em múltiplos níveis para garantir visualização
  thoughtListEl.scrollTop = thoughtListEl.scrollHeight;

  // Também scroll no container da aba para garantir que o conteúdo seja visível
  const tabContainer = document.getElementById(`tab-content-${tabId}`);
  if (tabContainer) {
    tabContainer.scrollTop = tabContainer.scrollHeight;
  }
}

/**
 * Verifica se o sistema de abas está ativo (Hub visível)
 */
export function isHubActive() {
  return tabsState.activeTabId === "hub";
}

/**
 * Força re-renderização do conteúdo da aba ativa
 * (Usado para updates live pequenos, se necessário)
 */
export function refreshActiveTab() {
  // Com o sistema persistente, refreshActiveTab geralmente não é chamado
  // para re-criar tudo, apenas para updates pontuais.
  // Se precisarmos re-criar, usamos reloadTab.
}

function getStatusLabel(status) {
  switch (status) {
    case "processing":
      return "Processando...";
    case "complete":
      return "Concluído";
    case "error":
      return "Erro";
    default:
      return status;
  }
}

// Exportar estado para debug se necessário
export function getTabsState() {
  return { ...tabsState };
}
