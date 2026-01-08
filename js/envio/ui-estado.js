import {
  gerarConteudoEmJSONComImagemStream,
  gerarGabaritoComPesquisa,
} from "../api/worker.js";
import { obterConfiguracaoIA } from "../ia/config.js";
import { renderizarQuestaoFinal } from "../render/final/render-questao.js";
import {
  prepararAreaDeResposta,
  pushThought,
} from "../sidebar/thoughts-scroll.js";
import { customAlert } from "../ui/GlobalAlertsLogic.tsx";
import {
  coletarESalvarImagensParaEnvio,
  prepararImagensParaEnvio,
} from "./imagens.js";

export function iniciarEstadoProcessamento() {
  // 1. Verificação de Segurança
  if (window.__isProcessing) return null; // Retorna null para sinalizar ABORTO

  // 2. Injeção de CSS (REMOVIDO: O scroll agora é gerenciado pelo container de abas)
  /*
  var styleviewerSidebar = document.createElement('style');
  styleviewerSidebar.innerHTML = `
    #viewerSidebar {
        overflow-y: scroll;
    }
    `;
  document.body.appendChild(styleviewerSidebar);
  */

  // 3. Definição de Estado
  window.__isProcessing = true;
  window.__userInterruptedScroll = false; // Reset smart scroll flag

  // Retorna objeto compatível com a API anterior (que esperava um elemento style)
  return { remove: () => {} };
}

export function setarEstadoLoadingModal() {
  const btnProcessar = document.querySelector(
    "#cropConfirmModal .btn--primary"
  );
  const btnVoltar = document.querySelector("#cropConfirmModal .btn--secondary");

  // Segurança: se não achar o botão principal, nem segue.
  if (!btnProcessar) return null;

  const originalText = btnProcessar.innerText;

  // Aplica as mudanças visuais
  btnProcessar.innerText = "Iniciando...";
  btnProcessar.disabled = true;
  if (btnVoltar) btnVoltar.disabled = true;

  // Retorna um "pacote" com tudo que precisamos para restaurar depois
  return {
    btnProcessar,
    btnVoltar,
    originalText,
  };
}

export async function inicializarEnvioCompleto() {
  // 1. Inicia CSS e Flags de Processamento
  const styleviewerSidebar = iniciarEstadoProcessamento();
  if (!styleviewerSidebar) return null; // Já estava processando

  // 2. Coleta as imagens cruas e salva backups
  const { imagensAtuais, imagensSuporteQuestao } =
    coletarESalvarImagensParaEnvio();

  // 3. Processa/Carimba as imagens (pode demorar um pouco)
  const listaImagens = await prepararImagensParaEnvio(
    imagensAtuais,
    imagensSuporteQuestao
  );

  // Se falhar no processamento, limpamos o passo 1
  if (!listaImagens) {
    window.__isProcessing = false;
    styleviewerSidebar.remove();
    return null;
  }

  // 4. Trava a UI (Botões do Modal)
  const uiState = setarEstadoLoadingModal();

  // Se falhar na UI, limpamos passo 1
  if (!uiState) {
    window.__isProcessing = false;
    styleviewerSidebar.remove();
    return null;
  }

  // Retorna o pacote completo para a função principal trabalhar
  return {
    styleviewerSidebar,
    listaImagens,
    uiState,
  };
}

export function finalizarProcessamentoVisual() {
  // Desliga flags de processamento
  window.__isProcessing = false;

  // Remove efeitos visuais (se houver)
  const reopenBtn = document.getElementById("reopenSidebarBtn");
  if (reopenBtn) reopenBtn.remove();
}

export function addGlowEffect(targetEl) {
  if (!targetEl) return;

  targetEl.classList.add("glow-on-change");

  const removeGlow = () => {
    targetEl.classList.remove("glow-on-change");
  };

  // Remove após 4s de timeout OU se o usuário interagir
  setTimeout(removeGlow, 4000);
  if (typeof targetEl.addEventListener === "function") {
    targetEl.addEventListener("click", removeGlow, { once: true });
  }
}

export function finalizarInterfacePosSucesso(styleviewerSidebar, uiState) {
  // 1. Limpeza Visual
  if (styleviewerSidebar) styleviewerSidebar.remove();
  const btnResume = document.getElementById("resumeScrollBtn");
  if (btnResume) btnResume.remove();

  // 2. Feedback ao Usuário
  customAlert("✅ Questão e gabarito processados com sucesso!", 3000);

  restaurarEstadoBotoes(uiState);
}

export function restaurarEstadoBotoes(uiState) {
  if (!uiState) return;

  const { btnProcessar, btnVoltar, originalText } = uiState;

  if (btnProcessar) {
    btnProcessar.innerText = originalText;
    btnProcessar.disabled = false;
  }

  if (btnVoltar) {
    btnVoltar.disabled = false;
  }
}

export function tratarErroEnvio(error, uiState, refsLoader) {
  console.error("Erro no processamento:", error);

  // 1. Reset Global
  window.__isProcessing = false;

  // 2. Remove o Loader (se ele existir)
  if (refsLoader && refsLoader.loadingContainer) {
    refsLoader.loadingContainer.remove();
  }

  // 3. Feedback Visual e Reabertura do Modal
  customAlert("❌ Erro ao processar. Tente novamente.", 3000);

  const modal = document.getElementById("cropConfirmModal");
  if (modal) modal.classList.add("visible");

  // 4. Restaura os botões (Reutilizando a lógica)
  restaurarEstadoBotoes(uiState);
}

/**
 * Fluxo Unificado: Extrai questão E busca gabarito automaticamente
 */
export async function confirmarEnvioIA(tabId = null) {
  // --- PASSO 1: PREPARAÇÃO DE DADOS E ESTADO ---
  const dadosIniciais = await inicializarEnvioCompleto();
  if (!dadosIniciais) return;
  const { styleviewerSidebar, listaImagens, uiState } = dadosIniciais;

  // --- PASSO 2: PREPARAÇÃO VISUAL (SIDEBAR E LOADER) ---
  let setStatus;
  let refsLoader = null;

  if (tabId) {
    const { addLogToQuestionTab } = await import("../ui/sidebar-tabs.js");
    setStatus = (s) => {
      if (s) addLogToQuestionTab(tabId, `[STATUS] ${s}`);
    };
  } else {
    const uiTools = prepararAreaDeResposta();
    if (!uiTools) return;
    setStatus = uiTools.setStatus;
    refsLoader = uiTools.refsLoader;
  }

  try {
    // ============================================================
    // FASE 1: EXTRAÇÃO DA QUESTÃO
    // ============================================================
    setStatus("📝 [QUESTÃO] Enviando imagens para IA...");

    const { promptDaIA: promptQuestao, JSONEsperado: JSONQuestao } =
      obterConfiguracaoIA("prova");

    setStatus(`📝 [QUESTÃO] Analisando ${listaImagens.length} imagem(ns)...`);

    const respostaQuestao = await gerarConteudoEmJSONComImagemStream(
      promptQuestao,
      JSONQuestao,
      listaImagens,
      "image/jpeg",
      {
        onStatus: (s) => setStatus(`📝 [QUESTÃO] ${s}`),
        onThought: (t) => pushThought(`📝 ${t}`, tabId),
        onAnswerDelta: () => setStatus("📝 [QUESTÃO] Gerando JSON..."),
      }
    );

    console.log("Resposta QUESTÃO recebida:", respostaQuestao);

    // Anexa imagens locais à questão
    enriquecerRespostaComImagensLocais(respostaQuestao);

    // Salva questão no global (mas não renderiza ainda!)
    window.__ultimaQuestaoExtraida = respostaQuestao;
    window.questaoAtual = respostaQuestao;

    // ============================================================
    // FASE 2: BUSCA DO GABARITO VIA PESQUISA
    // ============================================================
    setStatus("🔍 [GABARITO] Iniciando pesquisa de resposta...");

    const { promptDaIA: promptGabarito, JSONEsperado: JSONGabarito } =
      obterConfiguracaoIA("gabarito");

    // Prepara texto da questão para ajudar na pesquisa
    const textoQuestao = JSON.stringify(respostaQuestao);

    const respostaGabarito = await gerarGabaritoComPesquisa(
      promptGabarito,
      JSONGabarito,
      listaImagens,
      "image/jpeg",
      {
        onStatus: (s) => setStatus(`🔍 [GABARITO] ${s}`),
        onThought: (t) => pushThought(`🔍 ${t}`, tabId),
        onAnswerDelta: () => setStatus("🔍 [GABARITO] Gerando JSON..."),
      },
      listaImagens, // Usa as mesmas imagens para pesquisa
      textoQuestao // Passa o texto da questão para ajudar na busca
    );

    console.log("Resposta GABARITO recebida:", respostaGabarito);

    // Salva gabarito no global
    window.__ultimoGabaritoExtraido = respostaGabarito;

    // ============================================================
    // FASE 3: FINALIZAÇÃO E RENDERIZAÇÃO
    // ============================================================
    finalizarProcessamentoVisual();

    // Limpa recortes temporários
    window.__recortesAcumulados = [];

    // Renderiza o resultado FINAL (questão + gabarito)
    if (tabId) {
      import("../ui/sidebar-tabs.js").then(({ updateTabStatus }) => {
        updateTabStatus(tabId, {
          status: "complete",
          response: respostaQuestao, // Passa a questão, o render vai pegar o gabarito do global
        });
      });
    } else {
      renderizarQuestaoFinal(respostaQuestao);
    }

    // Limpa a bagunça e avisa o usuário
    finalizarInterfacePosSucesso(styleviewerSidebar, uiState);
  } catch (error) {
    if (error.message === "RECITATION_ERROR") {
      handleRecitationError(
        uiState,
        refsLoader,
        dadosIniciais.styleviewerSidebar
      );
    } else {
      tratarErroEnvio(error, uiState, refsLoader);
    }
  }
}

export function enriquecerRespostaComImagensLocais(resposta) {
  const imagens = window.__imagensLimpas || {};

  // Modo Questão: Anexa suporte e scan original
  resposta.imagens_suporte = imagens.questao_suporte || [];

  // Salva o scan original (a imagem grandona)
  if (imagens.questao_original && imagens.questao_original.length > 0) {
    resposta.scan_original = imagens.questao_original[0];
  }

  // Importante: Limpa a lista de originais para os próximos slots nascerem vazios
  imagens.questao_original = [];

  return resposta;
}

export function salvarResultadoNoGlobal(resposta) {
  window.__ultimaQuestaoExtraida = resposta;
  window.questaoAtual = resposta;

  // Limpa a lista de recortes temporários
  window.__recortesAcumulados = [];
}

export function handleRecitationError(uiState, refsLoader, styleviewerSidebar) {
  // 1. Limpa Estado de Processamento
  window.__isProcessing = false;
  if (refsLoader && refsLoader.loadingContainer) {
    refsLoader.loadingContainer.remove();
  }
  if (styleviewerSidebar) styleviewerSidebar.remove();

  // 2. Feedback
  customAlert(
    "⚠️ Conteúdo identificado, mas não estruturado (RECITAÇÃO). Por favor, edite manualmente.",
    5000
  );

  // 3. Cria Skeleton
  const recitationSkeleton = {
    identificacao: "⚠️ Questão não extraída",
    conteudo: "", // Deixa vazio para não aparecer texto feio no card
    estrutura: [
      {
        tipo: "texto",
        conteudo:
          '⚠️ HOUVE UM ERRO DE RECITAÇÃO. Clique em "Editar Conteúdo" para transcrever a questão manualmente.',
      },
    ],
    alternativas: [],
    materias_possiveis: [],
    palavras_chave: [],
    isRecitation: true,
  };

  // 4. Salva e Renderiza (como se fosse sucesso)
  enriquecerRespostaComImagensLocais(recitationSkeleton);
  salvarResultadoNoGlobal(recitationSkeleton);
  renderizarQuestaoFinal(recitationSkeleton);

  // 5. Finalização Visual
  finalizarProcessamentoVisual();
  restaurarEstadoBotoes(uiState);

  // Fecha o modal de crop se estiver aberto (já que fomos para a tela de edição)
  const modal = document.getElementById("cropConfirmModal");
  if (modal) modal.classList.remove("visible");
}
