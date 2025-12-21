// api-key-modal.js

// Importa a lógica e o componente React do novo arquivo
import {
  logicRemoverChave,
  logicSalvarChave,
  testarChaveReal as logicTestarChave,
  mountApiKeyModal
} from './ApiKeyModal.tsx'; // Verifique se o caminho está correto

/**
 * Função principal chamada pelo sistema.
 * Agora ela chama o método mount do React.
 */
export function generateAPIKeyPopUp(forceShow = true) {
  mountApiKeyModal(forceShow);
}

/**
 * Mantém a exportação original para compatibilidade.
 * Redireciona para a lógica no TSX.
 */
export function salvarChaveSessao(key) {
  logicSalvarChave(key);
}

/**
 * Mantém a exportação original para compatibilidade.
 * Redireciona para a lógica no TSX.
 */
export function removerChaveSessao(modalElement) {
  // Nota: modalElement é ignorado na versão React, pois o React gerencia o DOM,
  // mas mantemos o argumento para a assinatura da função ser idêntica.
  logicRemoverChave();
  
  // Se o modalElement for passado (legado), tentamos removê-lo manualmente apenas por garantia
  if (modalElement && modalElement.remove) {
    modalElement.remove();
  }
}

/**
 * Mantém a exportação original para compatibilidade.
 */
export async function testarChaveReal(key) {
  return await logicTestarChave(key);
}

// --- Funções Depreciadas (Stubs) ---
// Essas funções manipulavam HTML string diretamente. 
// Elas não são mais usadas internamente, mas mantemos exportadas vazias
// caso algum outro arquivo do projeto tente importá-las para evitar erros de "import not found".

export function gerarHtmlModalApiKey(isCustomKey) {
  console.warn('gerarHtmlModalApiKey foi migrado para React e não retorna mais HTML string.');
  return '';
}

export function configurarEventosModalApiKey(modal) {
  console.warn('configurarEventosModalApiKey é desnecessário com React.');
}

export function mostrarToastSucesso(mensagem) {
  // Se alguém importar isso direto, recriamos a lógica simples ou chamamos algo interno
  const toast = document.createElement('div');
  toast.innerText = mensagem;
  toast.style.cssText =
    'position:fixed; bottom:20px; right:20px; background:var(--color-success); color:white; padding:10px 20px; border-radius:4px; animation:fadeIn 0.5s; z-index:9999;';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

export function mostrarErroInput(inputElem, errorMsgElem, msg) {
  if (errorMsgElem) {
    errorMsgElem.innerText = msg;
    errorMsgElem.classList.remove('hidden');
  }
  if (inputElem) {
    inputElem.style.borderColor = 'var(--color-error)';
  }
}