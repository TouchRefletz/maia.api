import { gerarEmbedding, upsertPineconeWorker } from "../api/worker.js";
import { customAlert } from "../ui/GlobalAlertsLogic.tsx";
import { construirTextoSemantico } from "./envio-textos.js";

export async function processarEmbeddingSemantico(
  btnEnviar,
  questaoFinal,
  gabaritoLimpo,
) {
  if (btnEnviar) btnEnviar.innerText = "🧠 Criando Cérebro...";

  let textoParaVetorizar = construirTextoSemantico(
    questaoFinal.dados_questao || questaoFinal,
    gabaritoLimpo,
  );

  textoParaVetorizar = textoParaVetorizar
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 8000);

  console.log("📝 Texto Semântico para Embedding:", textoParaVetorizar);

  let vetorEmbedding = null;

  if (textoParaVetorizar.length > 20) {
    try {
      vetorEmbedding = await gerarEmbedding(textoParaVetorizar);
    } catch (errEmbed) {
      console.warn("⚠️ Falha ao gerar embedding:", errEmbed);
    }
  }

  // CORREÇÃO: Retorna um objeto com o vetor E o texto
  return { vetorEmbedding, textoParaVetorizar };
}

export async function indexarNoPinecone(
  btnEnviar,
  vetorEmbedding,
  idPinecone,
  chaveProva,
  textoParaVetorizar,
  payloadCompleto,
) {
  // Só executa se tiver vetor gerado
  if (vetorEmbedding) {
    // 1. Feedback Visual
    if (btnEnviar) btnEnviar.innerText = "🌲 Indexando no Pinecone...";

    try {
      // 2. Extração de Metadados para Filtro
      // Tenta ser resiliente a falta de dados
      const inst =
        payloadCompleto?.dados_gabarito?.creditos?.autor_ou_instituicao ||
        payloadCompleto?.dados_questao?.institution ||
        payloadCompleto?.dados_questao?.vestibular ||
        "Desconhecida";
      const ano =
        payloadCompleto?.dados_gabarito?.creditos?.ano ||
        payloadCompleto?.dados_questao?.year ||
        payloadCompleto?.dados_questao?.ano ||
        "0000";
      // 1. Tenta pegar o valor (seja lista ou item único)
      const valorBruto =
        payloadCompleto?.dados_questao?.materias_possiveis ||
        payloadCompleto?.dados_questao?.materia ||
        payloadCompleto?.dados_questao?.disciplina ||
        "Geral";

      // 2. Normaliza: Se for um item único, transforma numa lista. Se já for lista, mantém.
      const materia = Array.isArray(valorBruto) ? valorBruto : [valorBruto];

      // Serializa o JSON completo
      const jsonString = JSON.stringify(payloadCompleto || {});
      const jsonSizeKB = new TextEncoder().encode(jsonString).length / 1024;

      console.log(`📦 Pinecone Payload Size: ${jsonSizeKB.toFixed(2)} KB`);

      const metadata = {
        prova: chaveProva,
        texto_preview: textoParaVetorizar.substring(0, 300), // Aumentei um pouco
        institution: String(inst),
        year: String(ano),
        subject: materia,
        // Campos extras úteis
        has_full_json: true,
      };

      // Limite do Pinecone é 40KB para metadata. Deixamos uma margem de segurança (38KB).
      if (jsonSizeKB < 38) {
        metadata.full_json = jsonString;
      } else {
        console.warn(
          "⚠️ Payload muito grande para Pinecone (>38KB). Salvando sem full_json.",
        );
        metadata.has_full_json = false;
        metadata.error_size = "Payload exceeded 40KB limit";
      }

      // 3. Monta o objeto final
      const vectorItem = {
        id: idPinecone,
        values: vetorEmbedding,
        metadata: metadata,
      };

      // 4. Envio via Worker
      await upsertPineconeWorker([vectorItem]);
      console.log("✅ Vector salvo no Pinecone (Worker):", idPinecone);
    } catch (errPine) {
      // 5. Tratamento de Erro (Não bloqueia o salvamento no Firebase)
      console.error("❌ Erro Pinecone Worker:", errPine);
      customAlert("⚠️ Aviso: Indexação falhou, mas questão será salva.");
    }
  }
}
