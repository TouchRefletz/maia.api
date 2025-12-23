import { customAlert } from '../ui/GlobalAlertsLogic.tsx';
// NOVO: Importa o gerenciador de overlay
import { extractImageFromSelection, initSelectionOverlay, removeSelectionOverlay } from './selection-overlay.js';

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
    customAlert('⚠️ Selecione uma área primeiro!', 2000);
    return null;
  }

  return blobUrl;
}

export async function restaurarVisualizacaoOriginal() {
  // Remove o overlay e limpa a seleção
  removeSelectionOverlay();

  // Não precisamos mais dar 'renderAllPages' porque não destruímos o DOM,
  // apenas colocamos um div transparente por cima.
  // Mas se por acaso algo saiu do lugar, garantimos:
  // await renderAllPages(); 
}

export function resetarInterfaceBotoes() {
  // 1. Esconde botões flutuantes
  const floatParams = document.getElementById('floatingActionParams');
  if (floatParams) floatParams.classList.add('hidden');

  // 2. Reseta variável de estado de edição
  window.__capturandoImagemFinal = false;

  // 3. Reseta aparência do botão (de "Editar" para "Confirmar")
  const btnConfirm = document.querySelector(
    '#floatingActionParams .btn--warning'
  );
  const btnSuccess = document.querySelector(
    '#floatingActionParams .flyingBtn:first-child'
  );
  const btn = btnConfirm || btnSuccess;

  if (btn) {
    btn.innerText = '✅ Confirmar Seleção';
    btn.classList.remove('btn--warning');
    btn.classList.add('btn--success');
  }

  // 4. Reativa o botão de tesoura no header
  const btnHeader = document.getElementById('btnRecortarHeader');
  if (btnHeader) {
    btnHeader.style.opacity = '1';
    btnHeader.style.pointerEvents = 'auto';
  }
}

export function cancelarRecorte() {
  // Chama a limpeza lógica
  restaurarVisualizacaoOriginal(); // Não precisa de await se não for bloquear nada depois

  // Chama a limpeza visual
  resetarInterfaceBotoes();
}