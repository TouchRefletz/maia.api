import { customAlert } from "../ui/GlobalAlertsLogic.tsx";
import { CropperState } from "./cropper-state.js";
// NOVO: Importa o gerenciador de overlay
import {
  extractImageFromSelection,
  initSelectionOverlay,
  removeSelectionOverlay,
} from "./selection-overlay.js";

export async function prepararImagemParaCropper() {
  // Deprecated: Não usamos mais 'imagem única'
  return null;
}

export function instanciarCropper(imageElement) {
  // Deprecated
}

export async function iniciarCropper() {
  // Feedback para o usuário
  // customAlert('✂️ Modo de Seleção Livre Ativado', 1500);

  // Inicia o overlay sobre o PDF existente (sem destruir o layout)
  initSelectionOverlay();
}

export async function obterImagemDoCropper() {
  // 1. Tenta extrair a imagem da seleção 'cross-page'
  const blobUrl = await extractImageFromSelection();

  if (!blobUrl) {
    customAlert("⚠️ Selecione uma área primeiro!", 2000);
    return null;
  }

  return blobUrl;
}

export async function restaurarVisualizacaoOriginal() {
  // Remove o overlay e limpa a seleção
  removeSelectionOverlay();

  // LIMPEZA DE RESTRIÇÃO DE PÁGINA (EMPTY STATE)
  CropperState.setPageConstraint(null);

  document.body.classList.remove("manual-crop-active");
  window.__isManualPageAdd = false;

  const container = document.getElementById("canvasContainer");
  if (container) {
    container.style.overflow = "";
    container.style.touchAction = "";
    container.style.userSelect = "";
    container.style.cursor = "grab"; // Restaura cursor de Pan
  }

  // FIX: Destranca o header explicitamente caso a classe manual-crop-active não tenha resolvido
  const header = document.getElementById("viewerHeader");
  if (header) {
    header.style.pointerEvents = "auto";
  }

  // Não precisamos mais dar 'renderAllPages' porque não destruímos o DOM,
  // apenas colocamos um div transparente por cima.
  // Mas se por acaso algo saiu do lugar, garantimos:
  // await renderAllPages();
}

export function resetarInterfaceBotoes() {
  // 1. Esconde botões flutuantes
  const floatParams = document.getElementById("floatingActionParams");
  if (floatParams) floatParams.classList.add("hidden");

  // 2. Reseta variável de estado de edição
  window.__capturandoImagemFinal = false;

  // 3. (Legacy) Botões flutuantes removidos do fluxo.

  // 4. Reativa o botão de tesoura no header
  const btnHeader = document.getElementById("btnRecortarHeader");
  if (btnHeader) {
    btnHeader.style.opacity = "1";
    btnHeader.style.pointerEvents = "auto";
  }
}

export function cancelarRecorte() {
  // Limpeza específica de modo Slot (se houver grupo temporário)
  const activeGroup = CropperState.getActiveGroup();
  if (
    activeGroup &&
    activeGroup.tags &&
    activeGroup.tags.includes("slot-mode")
  ) {
    CropperState.deleteGroup(activeGroup.id);
    console.log(
      `[CropperCore] Grupo temporário ${activeGroup.id} limpo ao cancelar.`
    );
  }

  // Limpa variáveis globais de slot, se existirem
  window.__targetSlotIndex = null;
  window.__targetSlotContext = null;

  // Chama a limpeza lógica
  restaurarVisualizacaoOriginal(); // Não precisa de await se não for bloquear nada depois

  // Chama a limpeza visual
  resetarInterfaceBotoes();

  // Re-exibe o painel se necessário (pois slot mode esconde/usa painel)
  import("../viewer/sidebar.js").then((mod) => mod.mostrarPainel());
}
