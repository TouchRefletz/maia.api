/**
 * Prompt do Router - gemma-3-27b-it
 * Classifica a complexidade da tarefa do usuário para escolher o modelo adequado
 */

export const ROUTER_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    complexidade: {
      type: "string",
      enum: ["BAIXA", "ALTA"],
      description: "Classificação da complexidade da tarefa",
    },
    motivo: {
      type: "string",
      description: "Breve justificativa da classificação (1-2 frases)",
    },
    confianca: {
      type: "number",
      minimum: 0,
      maximum: 1,
      description: "Confiança na classificação (0 a 1)",
    },
    // NOVO: Detecção de Scaffolding
    scaffolding_detected: {
      type: "boolean",
      description:
        "True se o usuário pedir treino interativo, verdadeiro ou falso, ou aprendizagem passo-a-passo.",
    },
    // NOVO: Detecção de intrnção de busca de questão
    busca_questao: {
      type: "object",
      description:
        "Preencher SOMENTE se o usuário pedir explicitamente para resolver ou buscar uma questão/exercício do banco de dados.",
      properties: {
        tipo: {
          type: "string",
          const: "questao",
        },
        conteudo: {
          type: "string",
          description:
            "Uma query de busca concisa (MAX 100 caracteres). Use APENAS PALAVRAS-CHAVE. NÃO copie a pergunta inteira. Ex: 'Leis de Newton', 'História do Brasil', 'Função Segundo Grau'.",
          maxLength: 150,
        },
        props: {
          type: "object",
          properties: {
            institution: {
              type: "string",
              description: "Filtro opcional: Instituição (ex: 'ENEM').",
            },
            year: {
              type: "string",
              description: "Filtro opcional: Ano (ex: '2021').",
            },
            subject: {
              type: "string",
              description: "Filtro opcional: Matéria (ex: 'Física').",
            },
          },
          additionalProperties: false, // ESTRITO: Nada além disso
        },
      },
      required: ["tipo", "conteudo"],
      additionalProperties: false,
    },
  },
  required: ["complexidade", "motivo", "confianca"],
};

export const ROUTER_SYSTEM_PROMPT = `Você é um classificador de complexidade de tarefas. 
Sua função é analisar a mensagem do usuário e determinar se a tarefa exige POUCO ou MUITO esforço cognitivo.

CLASSIFICAÇÃO:
- BAIXA: Perguntas simples, factuais, conversas casuais, traduções simples, definições
- ALTA: Problemas matemáticos, raciocínio lógico, análise de textos, interpretação, questões de vestibular
- SCAFFOLDING: Intenções de "treino", "aprender passo a passo", "brincar de verdadeiro ou falso" - CRIE O CAMPO 'json_mode_scaffolding': true NO JSON DE RETORNO SE DETECTAR ISSO.

EXEMPLOS BAIXA:
- "Qual a capital do Brasil?"
- "O que significa homeostase?"
- "Traduza 'hello' para português"
- "Me conta uma piada"

EXEMPLOS ALTA:
- "Resolva esta integral: ∫x²dx"
- "Analise este texto e identifique as figuras de linguagem"
- "Explique a relação entre a Revolução Francesa e o Iluminismo"
- "Me ajude a resolver esta questão do ENEM"
- "Quero praticar estequiometria" (Aqui você DEVE preencher 'busca_questao')
- Qualquer coisa que contenha imagens de questões/exercícios

EXEMPLOS SCAFFOLDING:
- "Vamos brincar de verdadeiro ou falso sobre Mitocôndrias"
- "Me ensine Logaritmos passo a passo com perguntas"
- "Quero treinar meu conhecimento em História"

REGRAS DE BUSCA (CRÍTICO):
1. **NÃO REPETIR**: Se o usuário NÃO pedir explicitamente para repetir, você DEVE gerar uma query diferente das usadas anteriormente.
2. **QUERY LIMPA**: O campo 'conteudo' da busca deve conter APENAS PALAVRAS-CHAVE (Ex: "Ondulatória", "Função Afim"). NUNCA coloque a pergunta inteira ou frases longas.
3. **FILTROS**: Use Apenas 'institution', 'year', 'subject' se o usuário especificar.

REGRAS GERAIS:
1. Se houver anexos de imagem/PDF, sempre classifique como ALTA
2. Se mencionar "questão", "exercício", "prova", "vestibular", classifique como ALTA
3. Se pedido explícito de "Verdadeiro ou Falso" ou "Treino interativo", classifique como ALTA mas adicione a flag: "scaffolding_detected": true
4. Na dúvida, classifique como ALTA (melhor ser conservador)

FORMATO DE RESPOSTA (OBRIGATÓRIO):
Responda APENAS com um JSON válido seguindo este schema, sem markdown ou explicações adicionais fora do JSON:
${JSON.stringify(ROUTER_RESPONSE_SCHEMA, null, 2)}`;

/**
 * Gera o prompt para classificação
 * @param {string} userMessage - Mensagem do usuário
 * @param {boolean} hasAttachments - Se há anexos (imagens, PDFs, etc)
 * @param {string} memoryContext - Contexto de memória (opcional)
 * @param {Array<string>} previousQueries - Lista de queries já usadas na sessão
 * @returns {string} Prompt formatado
 */
export function buildRouterPrompt(
  userMessage,
  hasAttachments = false,
  memoryContext = "",
  previousQueries = [],
) {
  let prompt = `Analise a seguinte mensagem e classifique sua complexidade:

"${userMessage}"`;

  if (hasAttachments) {
    prompt += `

[NOTA: O usuário enviou arquivos anexos junto com a mensagem]`;
  }

  if (memoryContext) {
    prompt += `

[CONTEXTO DE MEMÓRIA (Use para desambiguação)]:
${memoryContext}`;
  }

  // INJEÇÃO ANTI-REPETIÇÃO
  if (previousQueries && previousQueries.length > 0) {
    prompt += `

[🚫 HISTÓRICO DE BUSCAS JÁ FEITAS (PROIBIDO REPETIR ESTES TERMOS EXATOS, A MENOS QUE O USUÁRIO PEÇA 'REPETIR')]:
${previousQueries.map((q) => `- "${q}"`).join("\n")}
Se o usuário pediu "mais uma" ou "outra", busque algo NOVO ou uma variação.`;
  }

  prompt += `

Responda com a classificação de complexidade.`;

  return prompt;
}
