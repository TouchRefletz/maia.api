import { viewerState } from "../main.js";
import { renderizarQuestaoFinal } from "../render/final/render-questao.js";
import { customAlert } from "../ui/GlobalAlertsLogic.tsx";
import { irParaPagina } from "../viewer/pdf-core.js";
import { mostrarPainel } from "../viewer/sidebar.js";
import { iniciarCropper } from "./cropper-core.js";
import { CropperState } from "./cropper-state.js";
import {
  extractImageFromCropData,
  refreshOverlayPosition,
} from "./selection-overlay.js";

// Internal State Tracking
let __targetSlotIndex = null;
let __editingGroupId = null;

export function ativarModoRecorte() {
  if (viewerState.cropper) return;
  mostrarPainel();
  iniciarCropper();
  const btnHeader = document.getElementById("btnRecortarHeader");
  if (btnHeader) {
    btnHeader.style.opacity = "0.5";
    btnHeader.style.pointerEvents = "none";
  }
}

export function iniciarCapturaParaSlot(index, contexto) {
  console.log(`Iniciando captura para slot ${index} do contexto ${contexto}`);
  window.__targetSlotIndex = index;
  window.__targetSlotContext = contexto;
  ativarModoRecorte();
  const btnConfirm = document.querySelector(
    "#floatingActionParams .btn--success"
  );
  if (btnConfirm) {
    btnConfirm.innerText = "📍 Preencher Espaço";
    btnConfirm.classList.remove("btn--success");
    btnConfirm.classList.add("btn--primary");
  }
}

export function iniciarCapturaImagemQuestao() {
  window.__capturandoImagemFinal = true;
  window.__targetSlotIndex = null;
  window.__targetSlotContext = null;
  ativarModoRecorte();
  const btnConfirm = document.querySelector(
    "#floatingActionParams .btn--success"
  );
  if (btnConfirm) {
    const destino = window.modo === "gabarito" ? "Gabarito" : "Questão";
    btnConfirm.innerText = `💾 Salvar Figura (${destino})`;
    btnConfirm.classList.remove("btn--success");
    btnConfirm.classList.add("btn--warning");
  }
}

export function onClickImagemFinal() {
  iniciarCapturaImagemQuestao();
}

export function removerImagemFinal(index, tipo) {
  if (tipo === "gabarito") {
    if (window.__ultimoGabaritoExtraido?.imagens_suporte) {
      window.__ultimoGabaritoExtraido.imagens_suporte.splice(index, 1);
      window.__imagensLimpas.gabarito_suporte.splice(index, 1);
      renderizarQuestaoFinal(window.__ultimoGabaritoExtraido);
    }
  } else {
    if (window.__ultimaQuestaoExtraida?.imagens_suporte) {
      window.__ultimaQuestaoExtraida.imagens_suporte.splice(index, 1);
      window.__imagensLimpas.questao_suporte.splice(index, 1);
      renderizarQuestaoFinal(window.__ultimaQuestaoExtraida);
    }
  }
}

export function iniciarCapturaDeQuestaoRestrita(pageNum) {
  irParaPagina(pageNum);
  setTimeout(() => {
    const container = document.getElementById("canvasContainer");
    if (container) {
      document.body.classList.add("manual-crop-active");
      window.__isManualPageAdd = true;
      container.style.overflow = "hidden";
    }
    CropperState.setPageConstraint(pageNum);
    ativarModoRecorte();
    CropperState.createGroup({ tags: ["manual"] });
    customAlert(`🔒 Modo de Adição Manual: Página ${pageNum}`, 3000);
    const btnConfirm = document.querySelector(
      "#floatingActionParams .btn--success"
    );
    if (btnConfirm) {
      btnConfirm.innerText = "💾 Salvar Questão Manual";
    }
  }, 700);
}

// --- NEW SLOT MODE LOGIC ---

export function startImageSlotMode(slotIndex) {
  console.log(`[SlotMode] Iniciando captura para slot: ${slotIndex}`);

  __targetSlotIndex = Number(slotIndex);
  window.__targetSlotIndex = __targetSlotIndex; // Sync global
  window.__targetSlotContext = "image-slot";

  mostrarPainel();
  iniciarCropper();

  // Create a new temporary group for this slot
  // If createTemporaryGroup doesn't exist, we fallback to createGroup
  const tempGroup = CropperState.createTemporaryGroup
    ? CropperState.createTemporaryGroup()
    : CropperState.createGroup({ tags: ["slot-mode"], label: "Novo Slot" });

  // Ensure tags are set correctly
  if (!tempGroup.tags.includes("slot-mode")) {
    tempGroup.tags.push("slot-mode");
  }
  // Tag with the slot ID so we can find it later for editing
  tempGroup.metadata = { slotId: slotIndex };

  CropperState.setActiveGroup(tempGroup.id);

  refreshOverlayPosition();

  // Dispatch event for React UI to update to 'capturing' state
  window.dispatchEvent(
    new CustomEvent("image-slot-mode-change", {
      detail: { slotId: slotIndex, mode: "capturing" },
    })
  );
}

export function editImageSlotMode(slotId) {
  __targetSlotIndex = Number(slotId);
  window.__targetSlotIndex = __targetSlotIndex;
  window.__targetSlotContext = "image-slot";

  mostrarPainel();
  iniciarCropper();

  // Find the existing group for this slot
  const groups = CropperState.groups || [];

  const existingGroup = groups.find(
    (g) =>
      g.tags &&
      g.tags.includes("slot-mode") &&
      g.metadata &&
      g.metadata.slotId == slotId // Weak equality for safety
  );

  if (existingGroup) {
    __editingGroupId = existingGroup.id;
    CropperState.setActiveGroup(existingGroup.id);

    refreshOverlayPosition();

    // Dispatch event for React UI to update to 'capturing' (editing) state
    window.dispatchEvent(
      new CustomEvent("image-slot-mode-change", {
        detail: { slotId: slotId, mode: "capturing" },
      })
    );
  } else {
    console.warn(
      `[SlotMode] Grupo de edição não encontrado para slot ${slotId}. Iniciando novo.`
    );
    startImageSlotMode(slotId);
  }
}

export function deleteImageSlot(slotId) {
  console.log(`[SlotMode] Deletando slot: ${slotId}`);

  const groups = CropperState.groups || [];
  const groupToRemove = groups.find(
    (g) =>
      g.tags &&
      g.tags.includes("slot-mode") &&
      g.metadata &&
      g.metadata.slotId == slotId
  );

  if (groupToRemove) {
    CropperState.deleteGroup(groupToRemove.id);
  }

  // Update React UI
  window.dispatchEvent(
    new CustomEvent("image-slot-action-complete", {
      detail: {
        slotId: slotId,
        action: "cleared",
      },
    })
  );

  // Also dispatch the old style event if legacy code needs it
  window.dispatchEvent(
    new CustomEvent("slot-update", {
      detail: { slotId, action: "cleared" },
    })
  );
}

export async function confirmSlotMode() {
  const activeGroup = CropperState.getActiveGroup();
  if (!activeGroup) return;

  if (activeGroup.crops.length === 0) {
    customAlert("⚠️ Selecione uma área na imagem!", 2000);
    return;
  }

  const lastCrop = activeGroup.crops[activeGroup.crops.length - 1];

  // We utilize the helper from existing mode logic or import it
  const result = await extractImageFromCropData(lastCrop.anchorData);

  if (!result || !result.blobUrl) {
    customAlert("Erro ao extrair imagem.", 2000);
    return;
  }

  const { blobUrl, base64 } = result;

  // Update group metadata securely
  activeGroup.metadata = { slotId: __targetSlotIndex };
  // Set status to verified?
  activeGroup.status = "verified";

  // Dispatch Event
  window.dispatchEvent(
    new CustomEvent("slot-update", {
      detail: {
        slotId: __targetSlotIndex,
        action: "filled",
        previewUrl: blobUrl, // Blob URL for preview
        base64: base64, // Real Base64 data
        timestamp: activeGroup.id,
      },
    })
  );

  // Exit mode but KEEP the group (persist)
  // Removed showSlotControls(false)
  CropperState.setActiveGroup(null);
  refreshOverlayPosition();
  customAlert("Imagem atualizada!", 1500);

  // Signal React to go to 'filled' or 'idle' state (handled by slot-update usually, but strictly ensuring)
  window.dispatchEvent(
    new CustomEvent("image-slot-mode-change", {
      detail: { slotId: __targetSlotIndex, mode: "filled" },
    })
  );
}

export function cancelSlotMode() {
  // If was creating new (no params passed to distinguish yet, relying on side effects)
  if (CropperState.revert) {
    CropperState.revert();
  }

  // If it was a NEW group that was just created and we cancel, we should delete it.
  if (__editingGroupId === null) {
    const activeGroup = CropperState.getActiveGroup();
    if (activeGroup) CropperState.deleteGroup(activeGroup.id);
  }

  // Removed showSlotControls(false)
  CropperState.setActiveGroup(null);
  refreshOverlayPosition();

  // Dispatch 'cancel' state to UI
  window.dispatchEvent(
    new CustomEvent("image-slot-mode-change", {
      detail: { slotId: __targetSlotIndex, mode: "idle" }, // Or whatever previous state was, usually idle/empty
    })
  );
}

// Exports
export {
  cancelSlotMode as cancelImageSlotMode,
  confirmSlotMode as confirmImageSlotMode,
};
