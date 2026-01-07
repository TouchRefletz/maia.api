import { viewerState } from "../main.js";
import { renderizarQuestaoFinal } from "../render/final/render-questao.js";
import { customAlert } from "../ui/GlobalAlertsLogic.tsx";
import { irParaPagina } from "../viewer/pdf-core.js";
import { mostrarPainel } from "../viewer/sidebar.js";
import { iniciarCropper } from "./cropper-core.js";
import { CropperState } from "./cropper-state.js";

export function ativarModoRecorte() {
  if (viewerState.cropper) return;

  // No novo fluxo, a sidebar deve ESTAR ABERTA para controlar os grupos
  mostrarPainel();

  iniciarCropper();

  // Desativa botão do header para feedback visual
  const btnHeader = document.getElementById("btnRecortarHeader");
  if (btnHeader) {
    btnHeader.style.opacity = "0.5";
    btnHeader.style.pointerEvents = "none";
  }
}

/**
 * Inicia o modo de recorte especificamente para preencher um slot vazio na estrutura.
 */
export function iniciarCapturaParaSlot(index, contexto) {
  console.log(`Iniciando captura para slot ${index} do contexto ${contexto}`);

  // Define o alvo globalmente
  window.__targetSlotIndex = index;
  window.__targetSlotContext = contexto; // 'questao' ou 'gabarito'

  // Muda visualmente o botão flutuante para o usuário entender o que está fazendo
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

  // Limpa targets de slot/OCR para garantir que não salvamos no lugar errado
  window.__targetSlotIndex = null;
  window.__targetSlotContext = null;

  ativarModoRecorte();

  // Feedback visual no botão flutuante
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

// Atualiza a função de clique para funcionar em ambos os modos
export function onClickImagemFinal() {
  // Agora permitimos nos dois modos!
  iniciarCapturaImagemQuestao();
}

export function removerImagemFinal(index, tipo) {
  // Tipo: 'questao' ou 'gabarito'
  if (tipo === "gabarito") {
    if (window.__ultimoGabaritoExtraido?.imagens_suporte) {
      window.__ultimoGabaritoExtraido.imagens_suporte.splice(index, 1);
      window.__imagensLimpas.gabarito_suporte.splice(index, 1); // Mantém sincronia
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
  // 1. Navegar para a pÃ¡gina alvo
  irParaPagina(pageNum);

  // 2. Travar o viewer apÃ³s a animaÃ§Ã£o de scroll (aprox 600ms)
  setTimeout(() => {
    const container = document.getElementById("canvasContainer");
    if (container) {
      // Nova classe para controle global de UI (Header disabled, etc)
      document.body.classList.add("manual-crop-active");
      window.__isManualPageAdd = true;

      container.style.overflow = "hidden";
      // container.style.touchAction = "none"; // Removido para evitar bloqueio de seleção
    }

    // 3. Aplicar constraint
    CropperState.setPageConstraint(pageNum);

    // 4. Iniciar visualmente o cropper
    // 4. Iniciar visualmente o cropper
    ativarModoRecorte();
    CropperState.createGroup({ tags: ["manual"] });

    // 5. Ajustar feedback visual especÃ­fico
    customAlert(`🔒 Modo de Adição Manual: Página ${pageNum}`, 3000);

    const btnConfirm = document.querySelector(
      "#floatingActionParams .btn--success"
    );
    if (btnConfirm) {
      // Se estamos em modo restrito, talvez o texto deva ser "Salvar QuestÃ£o Manual"
      btnConfirm.innerText = "💾 Salvar Questão Manual";
    }
  }, 700);
}
