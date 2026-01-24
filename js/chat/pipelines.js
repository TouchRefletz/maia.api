import { gerarConteudoEmJSONComImagemStream } from "../api/worker.js";
import * as MemoryService from "../services/memory-service.js"; // Import MemoryService
import { findBestQuestion } from "../services/question-service.js"; // Import question service
import { fileToBase64 } from "../utils/file-utils.js";
import { parseStreamedJSON } from "../utils/json-stream-parser.js";
import { getGenerationParams, getModeConfig } from "./config.js";
import {
  getSystemPromptRaciocinio,
  getSystemPromptRapido,
  getSystemPromptScaffolding,
} from "./prompts/chat-system-prompt.js";
import { determineFinalMode } from "./router.js";
import { CHAT_RESPONSE_SCHEMA, SCAFFOLDING_STEP_SCHEMA } from "./schemas.js"; // Import schema
import { ScaffoldingService } from "./services/scaffolding-service.js"; // Import ScaffoldingService
import { ChatStorageService } from "../services/chat-storage.js"; // Import Persistence Service

/**
 * Pipeline principal - escolhe e executa o pipeline correto
 */
export async function runChatPipeline(
  selectedMode,
  message,
  attachments = [],
  context = {},
) {
  // 1. === PERSISTENCE & INIT ===
  // Gerencia criação de chat se não existir ID
  let chatId = context.chatId;
  let isNewChat = false;

  if (!chatId) {
    try {
      const newChat = await ChatStorageService.createNewChat(
        message,
        attachments,
      );
      chatId = newChat.id;
      context.chatId = chatId; // Atualiza contexto
      isNewChat = true;

      // Notifica UI sobre novo chat
      if (context.onChatCreated) context.onChatCreated(newChat);
    } catch (err) {
      console.warn("[Pipeline] Falha ao criar chat no storage:", err);
    }
  } else {
    // Persiste mensagem do usuário em chat existente
    try {
      await ChatStorageService.addMessage(chatId, "user", message, attachments);
    } catch (err) {
      console.warn("[Pipeline] Falha ao salvar mensagem do user:", err);
    }
  }

  // 2. === MEMORY SYSTEM INTEGRATION (PRE-ROUTING) ===
  // Buscamos memória ANTES do router para dar contexto à decisão
  let additionalContextMessage = "";
  let memoryContextForRouter = "";

  try {
    console.log("[Pipeline] 🧠 Consultando Memória Contextual...");
    // Update UI: "Recuperando informações..."
    if (context.onProcessingStatus) {
      context.onProcessingStatus("loading", "Recuperando informações");
    }

    const memoryFacts = await MemoryService.queryContext(message);

    console.log("[Pipeline] 🧠 Memória Contextual encontrada:", memoryFacts);

    if (memoryFacts.length > 0) {
      // Síntese de contexto via LLM para gerar diretivas comportamentais
      const contextString = await MemoryService.synthesizeContext(
        memoryFacts,
        message,
        context.apiKey,
        attachments,
        { signal: context.signal }, // Pass signal
      );

      if (contextString) {
        additionalContextMessage += `\n\n${contextString}\n`;
        // Contexto limpo para o router (sem quebras excessivas)
        memoryContextForRouter = contextString;

        console.log(
          "[Pipeline] 🧠 Diretivas de memória injetadas:",
          contextString,
        );
        // Update UI: "Memórias recuperadas!" (System Message + Status)
        if (context.onProcessingStatus) {
          // Check abort before updating UI
          if (context.signal?.aborted)
            throw new DOMException("Aborted", "AbortError");

          context.onProcessingStatus("loading", "Escolhendo modo de execução");
          // Passamos o objeto completo de detalhes para a UI renderizar o bloco expansível
          const memoryContent = {
            title: "Memórias recuperadas",
            facts: memoryFacts,
            summary: contextString,
          };
          context.onProcessingStatus("memory_found", memoryContent);

          // [PERSISTENCE] Salvar evento de memória no histórico
          if (chatId) {
            ChatStorageService.addMessage(chatId, "system", {
              type: "memory_found",
              ...memoryContent,
            }).catch((err) =>
              console.warn("[Pipeline] Erro ao salvar memória:", err),
            );
          }
        }
      }
    }
  } catch (err) {
    if (err.name === "AbortError") throw err; // Propagate abort
    console.warn("[Pipeline] ⚠️ Erro no sistema de memória:", err);
  }

  // 2. Determina o modo final (Agora com CONTEXTO de memória)
  // Check abort
  if (context.signal?.aborted) throw new DOMException("Aborted", "AbortError");

  // Inicializa conjunto de queries se não existir
  if (!context.previousQueries) {
    context.previousQueries = [];
  }

  const { finalMode, wasRouted, routerResult } = await determineFinalMode(
    selectedMode,
    message,
    attachments,
    memoryContextForRouter,
    {
      previousQueries: context.previousQueries,
      signal: context.signal, // Pass signal to router
      apiKey: context.apiKey,
    },
  );

  // LOGICA SCAFFOLDING
  if (finalMode === "scaffolding") {
    const decision = ScaffoldingService.decidirProximoStatus();

    // Tenta extrair dados do contexto ou mensagem
    // Se for o PRIMEIRO passo gerado pelo chat normal, não temos histórico ainda,
    // mas o ScaffoldingService lida com isso.
    const questaoAlvo = {
      questao: message, // Assume que a msg do user é o tópico/questão
      resposta_correta: "Não definido",
    };

    // Gera o prompt usando a nova lógica robusta
    const promptRefinado = ScaffoldingService.generateStepPrompt(
      questaoAlvo,
      decision,
      [], // Começa sem histórico linear no chat principal (o loop slide cuida do resto)
    );

    // Substitui a mensagem original pelo prompt estruturado para garantir o JSON correto
    // OU apenas apenda as instruções. O prompt refinado já é completo ("Você é um tutor..."),
    // então idealmente ele substitui ou domina o contexto.
    additionalContextMessage += "\n\n" + promptRefinado;

    console.log(
      `[Pipeline] 🏗️ Scaffolding: Decisão System=${decision ? "V" : "F"}, Prompt Refinado Injected.`,
    );
  }

  // Verifica tb se precisa buscar questão (AGORA RODA JUNTO COM SCAFFOLDING SE NECESSÁRIO)
  if (wasRouted && routerResult?.busca_questao) {
    console.log(
      "[Pipeline] 🔎 Router solicitou busca de questão:",
      routerResult.busca_questao,
    );
    try {
      const questionData = await findBestQuestion({
        query: routerResult.busca_questao.conteudo,
        ...routerResult.busca_questao.props,
      });

      if (questionData) {
        console.log(
          "[Pipeline] ✅ Questão encontrada e injetada no contexto:",
          questionData.id,
        );

        // REGISTRA QUERY USADA PARA NÃO REPETIR
        context.previousQueries.push(routerResult.busca_questao.conteudo);

        // Injeta a questão no fluxo como um SYSTEM MESSAGE disfarçado ou append no user message
        // Para garantir que o modelo use, vamos adicionar explicitamente
        additionalContextMessage += `\n\n[SISTEMA - DADOS INJETADOS]: O usuário solicitou uma questão. Use os dados abaixo para gerar o bloco 'questao' na resposta. Não invente, use estes dados:\n${JSON.stringify(questionData.fullData)}`;

        // Opcional: Forçar modo raciocínio se a questão for complexa? O router já deve ter decidido ALTA complexidade.
      }
    } catch (err) {
      console.warn(
        "[Pipeline] ⚠️ Falha ao buscar questão sugerida pelo router:",
        err,
      );
    }
  }

  const finalMessage = message + additionalContextMessage;

  // Notifica sobre mudança de modo (se foi roteado)
  if (wasRouted && context.onModeDecided) {
    const modeData = {
      mode: finalMode,
      reason: routerResult?.reason,
      confidence: routerResult?.confidence,
      routerResult: routerResult, // Envia tudo explicito
    };

    context.onModeDecided(modeData);

    // [PERSISTENCE] Salvar evento de decisão de modo
    if (chatId) {
      ChatStorageService.addMessage(chatId, "system", {
        type: "mode_selected",
        ...modeData,
      }).catch((err) => console.warn("[Pipeline] Erro ao salvar modo:", err));
    }
  }

  // Executa pipeline específico
  let systemPrompt;
  let configMode;

  if (finalMode === "scaffolding") {
    systemPrompt = getSystemPromptScaffolding();
    configMode = "scaffolding";
  } else if (finalMode === "raciocinio") {
    systemPrompt = getSystemPromptRaciocinio();
    configMode = "raciocinio";
  } else {
    systemPrompt = getSystemPromptRapido();
    configMode = "rapido";
  }

  console.log(`[Pipeline] 🚀 Executando modo ${finalMode.toUpperCase()}`);

  if (context.onStart) {
    context.onStart({ mode: finalMode });
  }

  try {
    // Acumulador de pensamentos para persistência
    let accumulatedThoughts = [];

    const fullResponse = await generateChatStreamed({
      model: getModeConfig(configMode).model,
      generationConfig: getGenerationParams(configMode),
      systemPrompt,

      userMessage: finalMessage, // Usa a mensagem com contexto injetado
      attachments,
      onStream: context.onStream, // Callback recebe o objeto estruturado em progresso
      onThought: (thought) => {
        accumulatedThoughts.push(thought);
        if (context.onThought) context.onThought(thought);
      },
      apiKey: context.apiKey,
      chatMode: context.chatMode,
      history: context.history,
      signal: context.signal,
    });

    // A resposta final agora é o objeto estruturado completo ({ layout, conteudo })
    const finalContent = fullResponse || {};

    // [PERSISTENCE] Anexar pensamentos acumulados ao conteúdo final para salvar
    if (accumulatedThoughts.length > 0) {
      finalContent._thoughts = accumulatedThoughts;
    }

    if (context.onComplete) {
      context.onComplete({ mode: finalMode, response: finalContent });
    }

    // === PERSISTENCE: SAVE AI RESPONSE ===
    if (chatId) {
      ChatStorageService.addMessage(chatId, "model", finalContent).catch(
        (err) => console.warn("[Pipeline] Erro ao salvar resposta da IA:", err),
      );

      // === AUTO-TITLE GENERATION (If New Chat) ===
      if (isNewChat) {
        generateChatTitleData(message, finalContent, context.apiKey)
          .then((title) => {
            if (title) {
              console.log("[Pipeline] Título gerado:", title);
              ChatStorageService.updateTitle(chatId, title);
              if (context.onTitleUpdated) context.onTitleUpdated(chatId, title);
            }
          })
          .catch((err) =>
            console.warn("[Pipeline] Erro ao gerar título:", err),
          );
      }
    }

    // === MEMORY EXTRACTION (ASYNC) ===
    // Não aguardamos para não travar a resposta da UI
    setTimeout(() => {
      MemoryService.extractAndSaveNarrative(
        message,
        fullResponse,
        context.apiKey,
        attachments,
      )
        .then(() => console.log("[Pipeline] 🧠 Ciclo de memória concluído."))
        .catch((err) =>
          console.error("[Pipeline] ⚠️ Erro no ciclo de memória:", err),
        );
    }, 100);

    return { success: true, mode: finalMode, response: finalContent };
  } catch (error) {
    // [FIX] Tratamento específico para cancelamento (Stop Generation)
    if (error.name === "AbortError" || error.message?.includes("aborted")) {
      console.log("[Pipeline] 🛑 Execução interrompida pelo usuário.");
      // Repassa o erro de abort para a UI atualizar o estado (botão voltar ao normal)
      if (context.onError) context.onError(error);
      return { success: false, mode: finalMode, aborted: true };
    }

    console.error("[Pipeline] Erro:", error);
    if (context.onError) context.onError(error);
    return { success: false, mode: finalMode, error: error.message };
  }
}

// Stub para manter compatibilidade se algo importar diretamente (não deveria)
export async function runRapidoPipeline(message, attachments, context) {
  return runChatPipeline("rapido", message, attachments, context);
}

export async function runRaciocinioPipeline(message, attachments, context) {
  return runChatPipeline("raciocinio", message, attachments, context);
}

/**
 * Gera um passo de scaffolding silenciosamente (sem atualizar UI principal).
 * Usado para o fluxo de "Slides" do Scaffolding.
 */
export async function generateSilentScaffoldingStep(
  prompt,
  apiKey,
  attachments = [],
) {
  console.log("[Pipeline] 🤫 Gerando passo de scaffolding silencioso...");

  /*
   Reutilizamos generateChatStreamed mas sem callbacks de UI (onStream)
   e com chatMode=false para garantir geração stateless pura baseada no prompt montado.
  */
  const response = await generateChatStreamed({
    model: "gemini-3-flash-preview", // Modelo rápido para scaffolding
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: SCAFFOLDING_STEP_SCHEMA,
    },
    systemPrompt:
      "You are a helpful assistant. Output ONLY valid JSON matching the schema. Do not output multiple JSON objects.", // Strict instruction
    userMessage: prompt,
    attachments,
    onStream: null, // Silencioso
    onThought: null,
    apiKey,
    chatMode: false,
    history: [], // Sem histórico do servidor, gerenciado manualmente no prompt
  });

  return response;
}

/**
 * Gera resposta usando /generate com streaming e JSON estruturado
 */
async function generateChatStreamed(params) {
  const {
    model,
    generationConfig,
    systemPrompt,
    userMessage,
    attachments = [],
    onStream,
    onThought,
    apiKey,
    chatMode,
    history,
    signal, // Receive signal
  } = params;

  // Monta o prompt combinando system + user com ênfase no user
  const currentDateTime = new Date().toLocaleString("pt-BR", {
    dateStyle: "full",
    timeStyle: "short",
  });
  const timeContext = `\n[SISTEMA - DATA/HORA ATUAL: ${currentDateTime}]`;

  const fullPrompt = `${systemPrompt}${timeContext}\n\n---\n\n=== PROMPT DO USUÁRIO (PRIORIDADE MÁXIMA) ===\nUsuário: ${userMessage}\n=== FIM DO PROMPT ===`;

  // Converte anexos (imagens ou arquivos) para base64
  const arquivosProcessados = [];
  // mimeType padrão caso seja só 1 arquivo de imagem (mantendo lógica antiga se necessário, mas agora passamos explicito no objeto)
  let mimeType = "image/jpeg";

  for (const file of attachments) {
    const base64 = await fileToBase64(file);
    arquivosProcessados.push({
      data: base64,
      mimeType: file.type || "application/octet-stream",
    });
    // Se for o primeiro, define o mimeType "principal" (apenas para compatibilidade de assinatura, embora o worker agora use o array de files)
    if (arquivosProcessados.length === 1) {
      mimeType = file.type;
    }
  }

  // Estado local para controle do streaming JSON
  let jsonBuffer = "";
  let lastParsedJson = null;

  // Handlers para o worker
  const handlers = {
    onStatus: (status) => console.log(`[Worker Status] ${status}`),
    onThought: (thought) => {
      if (onThought) onThought(thought);
    },
    onAnswerDelta: (delta) => {
      jsonBuffer += delta;

      // Tenta parsear o que temos até agora (best effort)
      const currentParsedAnswer = parseStreamedJSON(jsonBuffer);

      // Se conseguiu extrair um objeto válido (mesmo que parcial)
      if (currentParsedAnswer) {
        // Envia o objeto COMPLETO para a UI a cada update
        // (UI deve ser reativa e redesenhar baseada no estado atual)
        if (onStream) onStream(currentParsedAnswer);
        lastParsedJson = currentParsedAnswer;
      }
    },
    signal, // Pass signal to worker handlers
  };

  const options = {
    model,
    generationConfig,
    chatMode,
    history,
    systemInstruction: chatMode ? systemPrompt : undefined, // In Chat Mode, separate system instruction
  };

  console.log("[Generate] 🚀 Iniciando geração JSON Estruturado Streamed...");

  // Chama a função do worker
  // Ela retorna o JSON final parseado quando terminar (ou lança erro)
  const finalJSON = await gerarConteudoEmJSONComImagemStream(
    fullPrompt,
    generationConfig?.responseSchema || CHAT_RESPONSE_SCHEMA,
    arquivosProcessados, // Agora passamos lista de objetos {data, mimeType}
    mimeType,
    handlers,
    options,
  );

  return finalJSON;
}

// fileToBase64 imported from utils

export async function generateChatTitleData(userMsg, aiContent, apiKey) {
  try {
    const aiText =
      typeof aiContent === "string"
        ? aiContent
        : aiContent.conteudo || JSON.stringify(aiContent);

    // Prompt simples e direto para texto puro
    // IMPORTANTE: Gemma NÃO pode usar sections, JSON, markdown ou qualquer formatação
    const prompt = `
Você é um assistente simples. Sua ÚNICA tarefa é gerar um título curto para esta conversa.

REGRAS CRÍTICAS:
- Retorne APENAS o título, nada mais
- NÃO use JSON, sections, markdown, aspas ou qualquer formatação
- NÃO escreva "Título:", "Title:", ou prefixos
- NÃO use estruturas como { } ou [ ]
- O título deve ter entre 3 a 6 palavras em português

EXEMPLOS DE BONS RESULTADOS:
- "Análise de Funções Quadráticas"
- "Estrutura do DNA Celular"
- "Revolução Industrial Brasileira"
- "Cálculo de Derivadas Parciais"
- "Fotossíntese e Respiração Celular"

DADOS DA CONVERSA:
Usuário disse: "${userMsg.substring(0, 200)}"
IA respondeu sobre: "${aiText.substring(0, 200)}"

RESPOSTA (apenas o título, texto puro):`;

    // Usa gerarConteudoEmJSONComImagemStream com modelo Gemma e sem JSON mode forçado
    // Necessário adaptar a chamada pois ela espera schemas/attachments
    // Assinatura: (texto, schema, attachments, mimeType, handlers, options)
    let titleAccumulator = "";

    await gerarConteudoEmJSONComImagemStream(
      prompt,
      null, // Schema null
      [], // Attachments empty
      "image/jpeg", // mimeType placeholder
      {
        onAnswerDelta: (text) => {
          titleAccumulator += text;
        },
      },
      {
        model: "gemma-3-27b-it", // Modelo solicitado pelo usuário (Gemma)
        generationConfig: { responseMimeType: "text/plain" }, // Força texto plano
      },
    );

    let title = titleAccumulator;

    // Limpeza garantida
    if (typeof title !== "string") {
      title = JSON.stringify(title);
    }

    // Remove aspas extras e quebras de linha que o modelo possa ter colocado
    title = title
      .replace(/^["']|["']$/g, "")
      .replace(/\n/g, " ")
      .trim();

    // Remove prefixos comuns se houver
    title = title.replace(/^Título:\s*/i, "");
    title = title.replace(/^Title:\s*/i, "");

    // Se o modelo gerou JSON apesar das instruções, tenta extrair o título
    if (title.startsWith("{") || title.startsWith("[")) {
      try {
        const parsed = JSON.parse(title);
        // Tenta extrair título de estruturas comuns
        title =
          parsed.title ||
          parsed.titulo ||
          parsed.name ||
          parsed.sections?.[0]?.title ||
          JSON.stringify(parsed).substring(0, 50);
      } catch {
        // Se não for JSON válido, pega apenas os primeiros 50 chars
        title = title.replace(/[{}\[\]]/g, "").substring(0, 50);
      }
    }

    // Remove qualquer markdown restante
    title = title.replace(/[#*_`]/g, "").trim();

    return title || "Nova Conversa";
  } catch (e) {
    console.warn("Erro no gerador de títulos:", e);
    return null;
  }
}
