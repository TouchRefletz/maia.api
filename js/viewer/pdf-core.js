import { viewerState } from '../main.js';
import { customAlert } from '../ui/GlobalAlertsLogic.tsx';
import { validarProgressoImagens } from '../validation/metricas-imagens.js';
import { atualizarUIViewerModo } from './viewer-template.js';

export function renderPage(num) {
  // Retorna promessa vazia se estiver ocupado ou sem PDF
  if (!viewerState.pdfDoc || viewerState.isRendering) return Promise.resolve();
  viewerState.isRendering = true;

  return viewerState.pdfDoc.getPage(num).then(function (page) {
    const canvas = document.getElementById('the-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const viewport = page.getViewport({ scale: viewerState.pdfScale });
    const outputScale = window.devicePixelRatio || 1;

    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = Math.floor(viewport.width) + 'px';
    canvas.style.height = Math.floor(viewport.height) + 'px';

    const transform =
      outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

    const renderContext = {
      canvasContext: ctx,
      viewport: viewport,
      transform: transform,
    };

    // --- AJUSTE DINÂMICO DE LIBERDADE (Dividido por 2) ---
    // Define o padding do container como metade do tamanho da página
    const container = document.getElementById('canvasContainer');
    if (container) {
      container.style.padding = `${Math.floor(viewport.height / 2)}px ${Math.floor(viewport.width / 2)}px`;
    }

    // Usa a variável global cropper
    if (typeof viewerState.cropper !== 'undefined' && viewerState.cropper) {
      viewerState.cropper.destroy();
      viewerState.cropper = null;
    }

    const renderTask = page.render(renderContext);

    return renderTask.promise.then(function () {
      viewerState.isRendering = false;
      document.getElementById('page_num').textContent =
        `Pag ${num} / ${viewerState.pdfDoc.numPages}`;
      document.getElementById('zoom_level').textContent =
        `${Math.round(viewerState.pdfScale * 100)}%`;

      const manager = document.getElementById('questionManager');
      const actions = document.querySelector('.sidebar-actions');

      // Verifica se actions existe para evitar erro
      if (
        manager &&
        !manager.classList.contains('hidden') &&
        actions &&
        actions.classList.contains('hidden')
      ) {
        iniciarCropper();
      }
    });
  });
}

/**
 * Renderiza a página em alta resolução (300 DPI) para captura.
 * Não afeta o canvas visível na tela (render off-screen).
 * Retorna uma Promise que resolve com o DataURL da imagem gerada.
 */
/**
 * Renderiza a página com a melhor qualidade possível (tentando 300 DPI).
 * Reduz a qualidade dinamicamente se o dispositivo não aguentar.
 * Retorna uma Promise que resolve com o DataURL da imagem gerada.
 */
export async function renderPageHighRes(num) {
  if (!viewerState.pdfDoc) return null;

  try {
    const page = await viewerState.pdfDoc.getPage(num);

    // Lista de qualidades para tentar (DPIs)
    // 300 é o alvo. Se falhar (memória/canvas limit), tenta menores.
    const attemptDpis = [300, 250, 200, 150, 100, 72];

    for (const dpi of attemptDpis) {
      try {
        console.log(`[HighRes] Tentando renderizar com ${dpi} DPI...`);
        const scale = dpi / 72;
        const viewport = page.getViewport({ scale: scale });

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport,
        };

        // Renderiza
        await page.render(renderContext).promise;

        // Tenta gerar o DataURL (pode falhar se canvas for gigante)
        const dataUrl = canvas.toDataURL('image/png');
        console.log(`[HighRes] Sucesso com ${dpi} DPI`);
        return dataUrl;

      } catch (innerErr) {
        console.warn(`[HighRes] Falha com ${dpi} DPI. Tentando menor...`, innerErr);
        // Continua para o próximo DPI do loop
        continue;
      }
    }

    throw new Error('Não foi possível renderizar a página em nenhuma qualidade aceitável.');

  } catch (err) {
    console.error('Erro geral em renderPageHighRes:', err);
    return null;
  }
}

export function carregarDocumentoPDF(url) {
  const loadingTask = pdfjsLib.getDocument(url);

  loadingTask.promise.then(function (pdf) {
    viewerState.pdfDoc = pdf;
    viewerState.pageNum = 1;
    viewerState.pdfScale = 1.0; // Resetar zoom para 100%

    // Renderiza a página e DEPOIS centraliza
    renderPage(viewerState.pageNum).then(() => {
      const container = document.getElementById('canvasContainer');
      if (container) {
        // Centraliza o scroll
        // ScrollTop = (ContentHeight - ViewportHeight) / 2
        container.scrollTop = (container.scrollHeight - container.clientHeight) / 2;
        container.scrollLeft = (container.scrollWidth - container.clientWidth) / 2;
      }
    });
  });
}

export function ensurePdfUrls() {
  // CORREÇÃO: Usar window.__pdfUrls (com duplo underscore)
  if (!window.__pdfUrls) window.__pdfUrls = { prova: null, gabarito: null };

  // CORREÇÃO: Usar window.__viewerArgs (com duplo underscore)
  const args = window.__viewerArgs;

  const fileProva = args?.fileProva;
  const fileGabarito = args?.fileGabarito;

  // se perdeu a URL da prova, recria
  if (!window.__pdfUrls.prova && fileProva) {
    window.__pdfUrls.prova = URL.createObjectURL(fileProva);
  }

  // se perdeu a URL do gabarito, recria (se existir)
  if (!window.__pdfUrls.gabarito && fileGabarito) {
    window.__pdfUrls.gabarito = URL.createObjectURL(fileGabarito);
  }

  return !!window.__pdfUrls.prova;
}

/**
 * Verifica todas as regras de segurança antes de permitir a troca de modo.
 * Retorna true se puder trocar, false se for bloqueado.
 */
export async function verificarBloqueiosTroca(novoModo) {
  // Validação básica de ambiente
  if (!ensurePdfUrls()) {
    console.warn(
      '[TrocarModo] Abortado: sem PDF da prova para reconstruir URL'
    );
    return false;
  }

  if (!document.getElementById('pdfViewerContainer')) {
    console.warn('[TrocarModo] Abortado: Viewer não está montado no DOM');
    return false;
  }

  // Validação: Prova -> Gabarito (Tem imagens pendentes?)
  if (window.__modo === 'prova' && novoModo === 'gabarito') {
    const podeIr = await validarProgressoImagens();
    if (!podeIr) return false;
  }

  // Validação: Indo para Gabarito (Processamento ou falta de questão)
  if (novoModo === 'gabarito') {
    if (window.__isProcessing) {
      console.warn('[TrocarModo] Bloqueado: Processamento em andamento.');
      customAlert('⏳ Aguarde Maia terminar de analisar a questão...', 3000);
      return false;
    }

    if (!window.__ultimaQuestaoExtraida) {
      console.warn('[TrocarModo] Bloqueado: Nenhuma questão extraída ainda.');
      customAlert('⚠️ Capture e processe a Questão (Prova) primeiro!', 3000);
      return false;
    }

    // Validação: Questão em modo Recitation/Manual
    // (Pede confirmação extra pois tecnicamente ela não foi "extraída")
    if (window.questaoAtual && window.questaoAtual.isRecitation) {
      const confirm = window.confirm("A QUESTÃO NÃO FOI EXTRAÍDA.\n\nVocê está prosseguindo para o Gabarito com a questão em modo manual. Deseja continuar?");
      if (!confirm) return false;
    }
  }

  // Validação de input inválido
  if (novoModo !== 'prova' && novoModo !== 'gabarito') return false;

  return true; // Passou por tudo, liberado!
}

export async function trocarModo(novoModo) {
  console.log(`[TrocarModo] Tentando ir para: ${novoModo}`);

  // 1. Pergunta para o "Guarda" se pode passar
  const permitido = await verificarBloqueiosTroca(novoModo);
  if (!permitido) return false;

  // Atualiza estados globais
  window.__modo = novoModo;
  window.modo = novoModo; // Compatibilidade

  // Limpa buffer de recortes para evitar duplicação
  window.__recortesAcumulados = [];
  window.recortesAcumulados = [];

  // Chama a função de UI refatorada (sem window)
  atualizarUIViewerModo();

  // Lógica de URL
  let url = window.__pdfUrls.prova; // Default

  if (novoModo === 'gabarito') {
    const temPdfGabarito = !!window.__pdfUrls.gabarito;
    if (temPdfGabarito) {
      window.__preferirPdfGabarito = true;
      url = window.__pdfUrls.gabarito;
    } else {
      url = window.__pdfUrls.prova;
    }
  }

  // Renderiza o PDF (Mantendo a lógica original do trecho)
  try {
    const loadingTask = pdfjsLib.getDocument(url);
    const pdf = await loadingTask.promise;

    // AQUI: Acesso direto às globais, sem window.
    viewerState.pdfDoc = pdf;
    viewerState.pageNum = 1;

    await renderPage(viewerState.pageNum);
    return true;
  } catch (err) {
    console.error('Erro ao carregar PDF do modo ' + novoModo, err);
    customAlert('Erro ao carregar o PDF.', 2000);
    return false;
  }
}

export function mudarPagina(dir) {
  if (!viewerState.pdfDoc) return;
  const newPage = viewerState.pageNum + dir;
  if (newPage >= 1 && newPage <= viewerState.pdfDoc.numPages) {
    viewerState.pageNum = newPage;
    renderPage(viewerState.pageNum);
  }
}

export function mudarZoom(delta) {
  const newScale = viewerState.pdfScale + delta;
  // Limites expandidos: 10% até 500% (0.1 a 5.0)
  // Usamos 0.05 como margem de segurança para erros de ponto flutuante
  if (newScale >= 0.05 && newScale <= 5.0001) {
    viewerState.pdfScale = newScale;
    renderPage(viewerState.pageNum);
  }
}