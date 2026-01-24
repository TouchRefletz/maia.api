import { EntityDB } from "@babycommando/entity-db";
import {
  gerarConteudoEmJSONComImagemStream,
  gerarEmbedding,
  upsertPineconeWorker,
  queryPineconeWorker,
} from "../api/worker.js";
import {
  PROMPT_NARRADOR_MEMORIA,
  PROMPT_SINTETIZADOR_CONTEXTO,
} from "../chat/prompts/memory-prompts.js";
import { auth } from "../firebase/init.js";

const DB_NAME = "maia_memory";
const MIN_SCORE = 0.6; // Local
const MIN_SCORE_CLOUD = 0.7; // Pinecone (Mais rigoroso)
const LOCAL_EXPIRATION_TIME = 30 * 60 * 1000; // 30 mins

let dbInstance = null;

/**
 * Initializes the EntityDB instance.
 */
async function getDb() {
  if (dbInstance) return dbInstance;

  dbInstance = new EntityDB({
    vectorPath: "vector",
  });
  return dbInstance;
}

/**
 * Verifica e deleta itens expirados locais.
 * (EntityDB não tem expiração nativa eficiente por query,
 *  teríamos que iterar tudo ou confiar no filtro de query.
 *  Vamos implementar um "lazy cleanup" na query e um "add" com validade).
 */

/**
 * Adds a new fact to the memory.
 * Strategies:
 * - Always save Local (with expiresAt)
 * - If Logged In: Save to Pinecone (Target: 'maia-memory', Namespace: uid)
 */
export async function addFact(fact) {
  try {
    console.log("[MemoryService] addFact chamado com:", fact);
    const db = await getDb();

    // Gera embedding
    const textoParaEmbedding = fact.conteudo || fact.fatos_atomicos;
    if (!textoParaEmbedding) return;

    const vectorData = await gerarEmbedding(textoParaEmbedding);
    const vector = Array.isArray(vectorData)
      ? vectorData
      : vectorData.embedding || vectorData.values;

    if (!vector) return;

    const timestamp = Date.now();
    const expiresAt = timestamp + LOCAL_EXPIRATION_TIME;

    // Metadata payload
    const metadata = {
      dominio: fact.categoria,
      categoria: fact.categoria,
      confianca: fact.confianca,
      evidencia: fact.evidencia,
      timestamp: timestamp,
      expiresAt: expiresAt, // NEW: Expiration
      text: textoParaEmbedding,
      ...fact,
    };

    // 1. Save Local
    const payload = {
      text: textoParaEmbedding,
      vector: vector,
      metadata: metadata,
    };
    await db.insertManualVectors(payload);
    console.log("[MemoryService] Fato salvo localmente.");

    // 2. Save Cloud (Pinecone) if Logged In and not Anonymous
    const user = auth.currentUser;
    if (user && !user.isAnonymous) {
      console.log("[MemoryService] Enviando fato para Pinecone...");
      const pineconeVector = {
        id: crypto.randomUUID(),
        values: vector,
        metadata: {
          ...metadata,
          text: textoParaEmbedding, // Pinecone precisa explícito no metadata para recuperar
        },
      };

      await upsertPineconeWorker(
        [pineconeVector],
        user.uid, // Namespace = UID
        "maia-memory", // Target Index Name (Assumes worker routes this correctly)
      );
      console.log("[MemoryService] Fato sincronizado no Pinecone.");
    }
  } catch (error) {
    console.error("[MemoryService] Erro ao salvar fato:", error);
  }
}

/**
 * Remove itens expirados do EntityDB local.
 * Como o EntityDB não tem delete por query range nativo eficiente,
 * precisamos iterar (ou limpar tudo se muito velho, mas range é melhor).
 * Solução: Buscar TUDO, filtrar expirados e deletar um a um (ou recriar DB).
 * Para performance, vamos apenas deletar se encontrar expirados em queries
 * OU rodar uma limpeza full apenas no boot.
 */
// Função auxiliar para obter a conexão bruta com IDB se a lib não expor
function openRawDB(dbName, version) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, version);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Remove itens expirados do EntityDB local.
 * Refatorado para usar Cursor do IndexedDB diretamente para garantir
 * acesso às chaves (IDs) e varredura completa independente de vetores.
 */
export async function cleanupExpired() {
  try {
    // Garante init da lib (embora vamos usar raw access, isso configura paths se precisar)
    await getDb();

    console.log(
      "[MemoryService] Iniciando limpeza via varredura direta (Cursor)...",
    );

    // Tenta acessar via prop da lib ou abre conexão manual com o nome padrão "EntityDB"
    // O screenshot mostra que o banco chama "EntityDB".
    // A lib babycommando/entity-db usa "EntityDB" por padrão.
    let rawDb = dbInstance?.db;

    if (!rawDb) {
      try {
        rawDb = await openRawDB("EntityDB"); // Try default
      } catch (e) {
        console.warn("[MemoryService] Falha ao abrir EntityDB raw:", e);
        return [];
      }
    }

    // [FIX] Detect valid store name (vector vs vectors)
    let storeName = "vectors"; // Default guess
    if (rawDb.objectStoreNames.contains("vector")) {
      storeName = "vector";
    } else if (rawDb.objectStoreNames.contains("vectors")) {
      storeName = "vectors";
    } else if (rawDb.objectStoreNames.length > 0) {
      storeName = rawDb.objectStoreNames[0]; // Fallback to first store
    } else {
      console.error(
        "[MemoryService] Cleanup aborted: No object stores found in DB.",
      );
      return [];
    }

    const tx = rawDb.transaction([storeName], "readwrite");
    const store = tx.objectStore(storeName);

    let deletedCount = 0;
    const now = Date.now();
    const validItems = [];

    // [FIX] Two-pass Strategy: Collect -> Sync -> Delete
    // Pass 1: Collect expired keys & items
    const expiredItems = [];

    await new Promise((resolve, reject) => {
      const request = store.openCursor();
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const item = cursor.value;
          const meta = item.metadata || {};

          let isExpired = false;
          if (meta.expiresAt) {
            if (meta.expiresAt <= now) isExpired = true;
          } else if (meta.timestamp) {
            // Legacy check
            if (meta.timestamp + LOCAL_EXPIRATION_TIME <= now) isExpired = true;
          }

          if (isExpired) {
            expiredItems.push({
              key: cursor.key,
              value: item,
            });
          } else {
            validItems.push(item);
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = reject;
    });

    if (expiredItems.length > 0) {
      console.log(
        `[MemoryService] Found ${expiredItems.length} expired items. Syncing before delete...`,
      );

      // Pass 2: Sync to Cloud (if logged in)
      const user = auth.currentUser;
      if (user) {
        const vectorsToUpsert = expiredItems.map((wrapper) => {
          const p = wrapper.value;
          return {
            id:
              typeof wrapper.key === "string"
                ? wrapper.key
                : crypto.randomUUID(),
            values: p.vector || p.values,
            metadata: {
              ...(p.metadata || {}),
              text: p.text || p.metadata?.text,
              origem_cleanup: true,
            },
          };
        });

        try {
          await upsertPineconeWorker(vectorsToUpsert, user.uid, "maia-memory");
          console.log("[MemoryService] Sync successful. Proceeding to delete.");
        } catch (e) {
          console.warn(
            "[MemoryService] Sync failed. ABORTING DELETION to prevent data loss.",
            e,
          );
          // If sync fails, we DO NOT DELETE.
          return validItems;
        }
      }

      // Pass 3: Delete from Local (New Transaction to be safe/clean)
      // Re-open transaction because cursor transaction might have autocommitted or timed out during async sync
      const txDelete = rawDb.transaction([storeName], "readwrite");
      const storeDelete = txDelete.objectStore(storeName);

      const deletePromises = expiredItems.map((item) => {
        return new Promise((resolve, reject) => {
          const req = storeDelete.delete(item.key);
          req.onsuccess = () => {
            deletedCount++;
            resolve();
          };
          req.onerror = reject;
        });
      });

      await Promise.all(deletePromises);
      console.log(
        `[MemoryService] Successfully deleted ${deletedCount} local items.`,
      );
    } else {
      console.log("[MemoryService] No expired items to clean.");
    }

    return validItems;
  } catch (e) {
    console.warn("[MemoryService] Erro crítico no cleanup:", e);
    return [];
  }
}

// Auto-cleanup interval (every 5 mins)
setInterval(
  () => {
    cleanupExpired().catch(console.error);
  },
  5 * 60 * 1000,
);

/**
 * Sincroniza memórias locais pendentes para Pinecone.
 */
export async function syncPendingToCloud() {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return;

  try {
    console.log("[MemoryService] Sincronizando memórias para nuvem...");
    const validItems = await cleanupExpired(); // Reusa scan

    if (validItems.length === 0) return;

    // Converte para formato Pinecone
    const vectorsToUpsert = validItems.map((item) => ({
      id: crypto.randomUUID(), // Gera novo ID ou usa existente se tiver (EntityDB pode não retornar ID estável)
      values: item.vector || item.embedding, // Confere formato
      metadata: {
        ...item.metadata,
        text: item.text || item.metadata?.text,
      },
    }));

    // Batch upsert (limit chunks if needed)
    await upsertPineconeWorker(vectorsToUpsert, user.uid, "maia-memory");
    console.log(
      `[MemoryService] ${vectorsToUpsert.length} memórias sincronizadas.`,
    );
  } catch (e) {
    console.error("[MemoryService] Sync failed:", e);
  }
}

/**
 * Queries the memory for relevant context.
 * Hybrid: Local (EntityDB) + Cloud (Pinecone).
 */
export async function queryContext(query, limit = 10) {
  try {
    const db = await getDb();
    const user = auth.currentUser;

    // Gera embedding da query
    const vectorData = await gerarEmbedding(query);
    const queryVector = Array.isArray(vectorData)
      ? vectorData
      : vectorData.embedding || vectorData.values;

    if (!queryVector) return [];

    const now = Date.now();

    // --- 1. LOCAL QUERY ---
    const localPromise = db
      .queryManualVectors(queryVector, { limit: limit })
      .then((results) => {
        // Filter Score & Expiration
        return results
          .filter(
            (r) =>
              r.similarity >= MIN_SCORE &&
              (r.metadata?.expiresAt ? r.metadata.expiresAt > now : false), // Ignora se sem expiresAt ou vencido
          )
          .map((r) => ({
            conteudo: r.text || r.metadata?.conteudo,
            ...r.metadata,
            score: r.similarity,
            source: "local",
          }));
      })
      .catch((e) => {
        console.warn("[Memory] Local query failed:", e);
        return [];
      });

    // --- 2. CLOUD QUERY (Pinecone) ---
    let cloudPromise = Promise.resolve([]);
    if (user && !user.isAnonymous) {
      cloudPromise = queryPineconeWorker(
        queryVector,
        limit,
        {}, // filters
        "maia-memory", // Target Index Name
        user.uid, // Namespace
      )
        .then((result) => {
          if (!result || !result.matches) return [];
          // Mapeia matches do Pinecone
          return result.matches
            .filter((match) => match.score >= MIN_SCORE_CLOUD) // Mais rigoroso
            .map((match) => ({
              conteudo: match.metadata?.text || match.metadata?.conteudo,
              ...match.metadata,
              score: match.score,
              source: "cloud",
            }));
        })
        .catch((e) => {
          console.warn("[Memory] Cloud query failed:", e);
          return [];
        });
    }

    // Wait for both
    const [localResults, cloudResults] = await Promise.all([
      localPromise,
      cloudPromise,
    ]);

    console.log(
      `[Memory] Results - Local: ${localResults.length}, Cloud: ${cloudResults.length}`,
    );

    // Merge & Deduplicate
    // Dedup approach: Use text content similarity or exact match?
    // Simple Dedup: Exact content string match. Prioritize Cloud info (freshness)?
    // Or just concatenate all unique contents.
    const allResults = [...cloudResults, ...localResults];
    const uniqueMap = new Map();

    allResults.forEach((item) => {
      const key = item.conteudo || "";
      if (key && !uniqueMap.has(key)) {
        uniqueMap.set(key, item);
      }
    });

    return Array.from(uniqueMap.values()).slice(0, limit);
  } catch (error) {
    console.error("[MemoryService] Erro ao buscar contexto:", error);
    return [];
  }
}

/**
 * Synthesizes actionable directives from retrieved facts using an LLM.
 * @param {Array} facts - The list of retrieved facts.
 * @param {string} currentMessage - The current user message to filter scope.
 * @param {string} apiKey - API Key for the LLM.
 * @returns {Promise<string>} - Actionable directives for the AI.
 */
export async function synthesizeContext(
  facts,
  currentMessage,
  apiKey,
  attachments = [],
  options = {}, // Receive options with signal
) {
  if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
  if (!facts || facts.length === 0) return "";

  try {
    const sortedFacts = [...facts].sort((a, b) => b.timestamp - a.timestamp);

    // Format facts for the synthesizer prompt
    const factsList = sortedFacts
      .map((f) => {
        const date = new Date(f.timestamp).toLocaleDateString();
        // Incluindo confianca e categoria no texto para o modelo julgar
        return `- [${date}] [${f.categoria}] (Conf: ${f.confianca}): ${f.conteudo || f.fatos_atomicos} (Evidência: "${f.evidencia || ""}")`;
      })
      .join("\n");

    // Prompt já importado no topo
    const fullPrompt = `${PROMPT_SINTETIZADOR_CONTEXTO}\n\n---\nMENSAGEM ATUAL DO USUÁRIO: "${currentMessage}"\n\nLISTA DE FATOS RECUPERADOS:\n${factsList}`;

    // Opções para geração rápida (Flash)
    const options = {
      model: "gemini-3-flash-preview", // Usar modelo rápido se disponivel
    };

    // Handlers vazios pois não precisamos de stream visual aqui
    const handlers = {
      onStatus: () => {},
      onThought: () => {},
      onAnswerDelta: () => {},
      signal: options.signal, // Pass signal
    };

    // Usamos a função de stream mas pegamos o resultado final.
    // OBS: A função worker espera retorno JSON se schema for passado, mas aqui queremos TEXTO LIVRE.
    // Se passarmos schema null, ela deve retornar texto?
    // Verificando worker.js: Se schema for fornecido, usa json mode. Se não, texto.
    // Vamos usar null para schema.

    const finalApiKey =
      apiKey ||
      (typeof sessionStorage !== "undefined"
        ? sessionStorage.getItem("GOOGLE_GENAI_API_KEY")
        : undefined);

    // Precisamos de uma funçao que retorne texto puro. A `gerarConteudoEmJSONComImagemStream` foca em JSON.
    // Se passarmos schema null, o worker tenta fazer parse?
    // Vamos checar worker.js depois. Por segurança, vou pedir JSON com um campo "diretivas".

    const synthesisSchema = {
      type: "object",
      properties: {
        diretivas: {
          type: "string",
          description: "O texto completo das diretivas formatado com hífens.",
        },
      },
      required: ["diretivas"],
    };

    // Processa anexos
    let processedFiles = [];
    if (attachments && attachments.length > 0) {
      try {
        processedFiles = await Promise.all(
          attachments.map(async (file) => {
            const base64 = await fileToBase64(file);
            return {
              data: base64,
              mimeType: file.type || "application/octet-stream",
            };
          }),
        );
      } catch (e) {
        console.warn(
          "[MemoryService] Erro ao processar anexos para síntese:",
          e,
        );
      }
    }

    const result = await gerarConteudoEmJSONComImagemStream(
      fullPrompt,
      synthesisSchema,
      processedFiles,
      "",
      handlers,
      options,
      finalApiKey,
    );

    if (result && result.diretivas) {
      return result.diretivas;
    }

    return ""; // Fallback
  } catch (error) {
    console.warn("[MemoryService] Falha na síntese de contexto:", error);
    // Fallback para formatação simples em caso de erro
    return formatFactsForSynthesis(facts);
  }
}

/**
 * Fallback simples
 */
export function formatFactsForSynthesis(facts) {
  if (!facts || facts.length === 0) return "";
  const sortedFacts = [...facts].sort((a, b) => b.timestamp - a.timestamp);
  return sortedFacts
    .map((f) => {
      const txt = f.conteudo || f.fatos_atomicos;
      return `- ${txt}`;
    })
    .join("\n");
}

/**
 * Extracts facts from the interaction and saves them.
 * @param {string} userMessage
 * @param {Object} aiResponse
 * @param {string} apiKey
 */
export async function extractAndSaveNarrative(
  userMessage,
  aiResponse,
  apiKey,
  attachments = [],
) {
  // A API Key pode vir do backend (secrets) se não estiver no cliente.
  // Não bloqueamos mais a execução se não houver chave no cliente.
  try {
    const finalApiKey =
      apiKey ||
      (typeof sessionStorage !== "undefined"
        ? sessionStorage.getItem("GOOGLE_GENAI_API_KEY")
        : undefined);

    console.log("[MemoryService] Iniciando extração de narrativa...");

    // Adaptação para passar o JSON completo, pois a estrutura pode ser complexa (sections/layout) e o prompt precisa de tudo
    let aiText = "";
    if (aiResponse) {
      aiText = JSON.stringify(aiResponse);
    }

    let prompt = `${PROMPT_NARRADOR_MEMORIA}\n\n---\nINTERAÇÃO RECENTE:\nUSUÁRIO: ${userMessage}\nIA (JSON): ${aiText}`;

    if (attachments && attachments.length > 0) {
      prompt += `\n[NOTA: O usuário enviou ${attachments.length} arquivo(s) anexo(s). Considere o conteúdo visual se relevante para os fatos.]`;
    }

    // Schema simplificado para a extração
    // Schema atualizado para fatos atômicos
    const extractionSchema = {
      type: "object",
      properties: {
        fatos: {
          type: "array",
          items: {
            type: "object",
            properties: {
              fatos_atomicos: { type: "string" },
              categoria: {
                type: "string",
                enum: [
                  "PERFIL",
                  "HABILIDADE",
                  "LACUNA",
                  "PREFERENCIA",
                  "ESTADO_COGNITIVO",
                  "EVENTO",
                ],
              },
              confianca: { type: "number" },
              evidencia: { type: "string" },
              validade: { type: "string", enum: ["PERMANENTE", "TEMPORARIO"] },
            },
            required: ["fatos_atomicos", "categoria", "confianca", "validade"],
          },
        },
      },
      required: ["fatos"],
    };

    // Chama worker (sem streaming, ou fingindo stream com onAnswerDelta ignorado se possível,
    // mas a função é `gerarConteudoEmJSONComImagemStream`, então vamos usar dummy handlers)
    let jsonBuffer = "";
    const handlers = {
      onStatus: () => {},
      onThought: () => {},
      onAnswerDelta: (delta) => {
        jsonBuffer += delta;
      },
    };

    // Usa modelo Rápido/Flash idealmente, mas aqui usamos o config default
    // Assumindo que o worker lida com isso.
    // Precisamos mockar generationConfig se não tivermos acesso fácil aqui
    // Processa anexos
    let processedFiles = [];
    if (attachments && attachments.length > 0) {
      try {
        processedFiles = await Promise.all(
          attachments.map(async (file) => {
            const base64 = await fileToBase64(file);
            return {
              data: base64,
              mimeType: file.type || "application/octet-stream",
            };
          }),
        );
      } catch (e) {
        console.warn(
          "[MemoryService] Erro ao processar anexos para memória:",
          e,
        );
      }
    }

    const options = {
      model: "gemini-3-flash-preview", // Tenta usar flash para isso ser rápido
      generationConfig: {
        response_mime_type: "application/json",
      },
    };

    const result = await gerarConteudoEmJSONComImagemStream(
      prompt,
      extractionSchema,
      processedFiles, // Passa os arquivos processados
      "", // mimetype (ignorado quando files são passados como objects)
      handlers,
      options,
      finalApiKey,
    );

    // Parse final
    if (result) {
      try {
        if (result.fatos && Array.isArray(result.fatos)) {
          if (result.fatos.length > 0) {
            console.log("[MemoryService] 🧠 Fatos extraídos:", result.fatos);
          }
          for (const fato of result.fatos) {
            await addFact(fato);
          }
          console.log("[MemoryService] Processamento de fatos concluído.");
        } else {
          console.log(
            "[MemoryService] Nenhum fato encontrado no JSON extraído.",
          );
        }
      } catch (e) {
        console.error("[MemoryService] Erro ao parsear JSON de extração:", e);
      }
    }
  } catch (error) {
    console.error("[MemoryService] Falha na extração de narrativa:", error);
  }
}
