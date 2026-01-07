import { cancelarRecorte } from "../cropper/cropper-core.js";
import { fecharModalConfirmacao } from "../cropper/gallery.js";
import { loadSelectionsFromJson } from "../cropper/json-loader.js";
import { ativarModoRecorte } from "../cropper/mode.js";
import { salvarQuestao } from "../cropper/save-handlers.js";
import { confirmarEnvioIA } from "../envio/ui-estado.js";
import { viewerState } from "../main.js";
import { AiScanner } from "../services/ai-scanner.js";
import { showConfirmModal } from "../ui/modal-confirm.js";
import { inicializarContextoViewer } from "./contexto.js";
import {
  carregarDocumentoPDF,
  mudarPagina,
  mudarZoom,
  trocarModo,
} from "./pdf-core.js";
import { configurarResizerSidebar } from "./resizer.js";
import {
  atualizarUIViewerModo,
  montarTemplateViewer,
} from "./viewer-template.js";

// Expose for external usage
window.MaiaPlugin = window.MaiaPlugin || {};
window.MaiaPlugin.loadSelections = loadSelectionsFromJson;

/**
 * Configura todos os listeners de clique da interface do visualizador.
 * (Atualizado para garantir importações corretas)
 */
export function configurarEventosViewer() {
  // Helper para encurtar o código e evitar erros se o botão não existir
  const aoClicar = (id, callback) => {
    const elemento = document.getElementById(id);
    if (elemento) {
      elemento.addEventListener("click", callback);
    } else {
      console.warn(`Botão não encontrado: #${id}`);
    }
  };

  // --- Controles Básicos ---
  aoClicar("btnFecharViewer", fecharVisualizador);

  // --- Navegação ---
  aoClicar("btn-prev", () => mudarPagina(-1));
  aoClicar("btn-next", () => mudarPagina(1));

  // --- Zoom ---
  aoClicar("btnZoomOut", () => mudarZoom(-0.1));
  aoClicar("btnZoomIn", () => mudarZoom(0.1));

  // --- Modos de Visualização ---
  aoClicar("btnModoProva", () => trocarModo("prova"));
  aoClicar("btnModoGabarito", () => trocarModo("gabarito"));

  // --- Mobile Menu & Controls ---
  aoClicar("btnMobileMenu", () => {
    const menu = document.getElementById("mobileMenuOptions");
    menu.classList.toggle("hidden");
  });

  // Helper to toggle panels
  const toggleMobilePanel = (id) => {
    document
      .querySelectorAll(".floating-glass-panel")
      .forEach((p) => p.classList.add("hidden"));
    document.getElementById("mobileMenuOptions").classList.add("hidden"); // Close menu
    const target = document.getElementById(id);
    if (target) target.classList.remove("hidden");
  };

  aoClicar("optMobileModo", () => toggleMobilePanel("mobileModePanel"));
  aoClicar("optMobileNav", () => toggleMobilePanel("mobileNavPanel"));
  aoClicar("optMobileZoom", () => toggleMobilePanel("mobileZoomPanel"));

  // Direct Action for Crop
  aoClicar("optMobileRecortar", () => {
    document.getElementById("mobileMenuOptions").classList.add("hidden"); // Close menu
    ativarModoRecorte();
  });

  aoClicar("optMobileFechar", fecharVisualizador);

  // Mobile Control binding
  aoClicar("btnModoProvaMobile", () => trocarModo("prova"));
  aoClicar("btnModoGabaritoMobile", () => trocarModo("gabarito"));
  aoClicar("btnPrevMobile", () => mudarPagina(-1));
  aoClicar("btnNextMobile", () => mudarPagina(1));
  aoClicar("btnZoomOutMobile", () => mudarZoom(-0.1));
  aoClicar("btnZoomInMobile", () => mudarZoom(0.1));

  // --- Ações Flutuantes (Durante o Recorte) ---
  aoClicar("btnConfirmarRecorte", salvarQuestao);
  aoClicar("btnCancelarRecorte", cancelarRecorte);

  // --- Modal de Confirmação ---
  aoClicar("btnModalMaisRecorte", fecharModalConfirmacao);
  aoClicar("btnModalProcessar", confirmarEnvioIA);
  aoClicar("btnModalCancelarTudo", fecharModalConfirmacao);

  // --- NOVO: Click & Drag (Pan) para Desktop ---
  // Imita o comportamento de arrastar do celular no PC
  const container = document.getElementById("canvasContainer");
  if (container) {
    let isDown = false;
    let startX, startY, scrollLeft, scrollTop;

    // Define cursor inicial como "grab" (mãozinha aberta)
    container.style.cursor = "grab";

    container.addEventListener("mousedown", (e) => {
      // 1. Bloqueia se estiver em modo de recorte (verifica overlay)
      // 1. Bloqueia se estiver em modo de recorte (verifica se está editando)
      const overlay = document.getElementById("selection-overlay");
      if (overlay && overlay.classList.contains("mode-editing")) return;

      // 2. Bloqueia se clicar em algum botão ou controle dentro do container (se houver)
      if (e.target.closest("button, .resizer")) return;

      isDown = true;
      container.classList.add("is-dragging"); // Opcional, para CSS extra se precisar
      container.style.cursor = "grabbing";

      // Previne seleção de texto durante o arrasto
      container.style.userSelect = "none";

      startX = e.pageX - container.offsetLeft;
      startY = e.pageY - container.offsetTop;
      scrollLeft = container.scrollLeft;
      scrollTop = container.scrollTop;
    });

    const stopDrag = () => {
      isDown = false;
      container.classList.remove("is-dragging");
      if (!document.getElementById("selection-overlay")) {
        container.style.cursor = "grab";
      }
      container.style.removeProperty("user-select");
    };

    container.addEventListener("mouseleave", stopDrag);
    container.addEventListener("mouseup", stopDrag);

    container.addEventListener("mousemove", (e) => {
      if (!isDown) return;
      e.preventDefault(); // Impede comportamento padrão de seleção

      const x = e.pageX - container.offsetLeft;
      const y = e.pageY - container.offsetTop;

      // Multiplicador de velocidade (1 = 1:1 com mouse)
      const walkX = (x - startX) * 1;
      const walkY = (y - startY) * 1;

      container.scrollLeft = scrollLeft - walkX;
      container.scrollTop = scrollTop - walkY;
    });
  }
}

export function realizarLimpezaCompleta() {
  // 1. Encerra cropper com segurança (Se houver resquício)
  try {
    import("../cropper/selection-overlay.js").then((module) => {
      module.removeSelectionOverlay();
    });
  } catch (_) {}

  try {
    if (typeof viewerState.cropper !== "undefined" && viewerState.cropper) {
      viewerState.cropper.destroy();
      viewerState.cropper = null;
    }
  } catch (_) {}

  // 2. Limpeza do DOM (Visual)
  const idsParaRemover = [
    "pdfViewerContainer",
    "sidebarResizer",
    "viewerSidebar",
    "reopenSidebarBtn",
    "finalModal",
  ];

  idsParaRemover.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });

  // Esconde/Reseta elementos persistentes
  document.getElementById("cropConfirmModal")?.classList.remove("visible");
  document.getElementById("floatingActionParams")?.classList.add("hidden");

  // 3. Gestão de Memória (URLs)
  try {
    if (window.__pdfUrls?.prova) URL.revokeObjectURL(window.__pdfUrls.prova);
    if (window.__pdfUrls?.gabarito)
      URL.revokeObjectURL(window.__pdfUrls.gabarito);
  } catch (_) {}

  // 4. Reset das Variáveis Globais (Estado)
  window.__pdfUrls = { prova: null, gabarito: null };
  window.__fileGabarito = null;
  window.__viewerArgs = null;
  window.__modo = "prova";
  window.modo = "prova";
  window.__isProcessing = false;
  window.__capturandoImagemFinal = false;

  window.__ultimaQuestaoExtraida = null;
  window.__ultimoGabaritoExtraido = null;
  window.questaoAtual = {};

  window.__recortesAcumulados = [];
  window.recortesAcumulados = [];

  window.__imagensLimpas = {
    questao_original: [],
    questao_suporte: [],
    gabarito_original: [],
    gabarito_suporte: [],
  };
}

export async function fecharVisualizador() {
  // 1. Pergunta de Segurança
  const msg = "Todo o progresso não salvo desta questão será perdido.";

  const confirmou = await showConfirmModal(
    "Voltar ao início?",
    msg,
    "Sair",
    "Cancelar"
  );

  if (!confirmou) {
    return;
  }

  // 2. Chama a Limpeza Pesada
  realizarLimpezaCompleta();

  // 3. Redireciona/Recarrega a Interface de Upload
  if (typeof generatePDFUploadInterface === "function") {
    generatePDFUploadInterface(null); // Null garante form limpo
  }
}

/**
 * Renderiza a interface de visualização de PDF e anexa os eventos.
 */
export async function gerarVisualizadorPDF(args) {
  // FASE 1: Preparação
  const urlProva = inicializarContextoViewer(args);

  // FASE 2: Injeção do HTML no DOM
  const viewerHTML = montarTemplateViewer(args);
  document.body.insertAdjacentHTML("beforeend", viewerHTML);

  // FASE 3: Eventos (Toda a mágica em uma linha)
  configurarEventosViewer();

  // Configurações finais (resize, etc)
  configurarResizerSidebar();

  atualizarUIViewerModo();

  // INICIALIZA A SIDEBAR NOVA (Cropper UI)
  import("./sidebar.js").then((mod) => {
    if (mod.inicializarSidebarCompleta) mod.inicializarSidebarCompleta();
  });

  // Tenta carregar. Se der sucesso, fecha qualquer modal de conflito que ainda esteja na tela
  // (Caso o usuário tenha vindo do conflito e o modal ficou aberto por algum motivo, ou "Processing" toaster)
  const carregou = await carregarDocumentoPDF(urlProva);

  if (carregou) {
    // --- 1. INICIALIZA PÁGINAS DA SIDEBAR AGORA ---
    // User Request: "muda aqui pra ter página 3,4,5 e etc, todas do pdf, existindo no primeiro segundo"
    if (viewerState.pdfDoc) {
      import("../ui/sidebar-page-manager.js").then((mod) => {
        mod.SidebarPageManager.init(viewerState.pdfDoc.numPages);
      });
    }

    const modalConflict = document.getElementById("unified-decision-modal");
    if (modalConflict) modalConflict.remove();

    // Também fecha o toaster de processamento se houver
    const toasterContainer = document.getElementById(
      "search-toaster-container"
    );
    if (toasterContainer) toasterContainer.innerHTML = "";

    // --- AI AUTO-SCANNER TRIGGER ---
    console.log("🚀 Iniciando AI Scanner...");
    setTimeout(() => {
      if (viewerState.pdfDoc) {
        AiScanner.start(viewerState.pdfDoc);
      }
    }, 200); // Pequeno delay pra UI estabilizar
  }

  try {
    const modalEl = document.getElementById("upload-progress-modal");
    if (modalEl) modalEl.remove();
  } catch (e) {}
}
