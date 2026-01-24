/**
 * Esquemas JSON para respostas estruturadas do Chat IA
 */

export const CONTENT_BLOCK_TYPE = [
  "texto",
  "imagem",
  "citacao",
  "titulo",
  "subtitulo",
  "lista",
  "equacao",
  "codigo",
  "destaque",
  "separador",
  "fonte",
  "tabela",
  "questao",
  "scaffolding",
];

export const LAYOUT_TYPE = [
  "two_column",
  "split_screen",
  "asymmetrical",
  "f_shape",
  "z_shape",
  "card_block",
  "featured_media",
  "masonry",
  "magazine",
  "interactive_carousel",
  "linear",
  "three_column",
];

export const LAYOUT_SLOTS = {
  linear: ["content"],
  two_column: ["sidebar", "main"],
  split_screen: ["left", "right"],
  three_column: ["col1", "col2", "col3"],
  asymmetrical: ["main", "aside"],
  f_shape: ["header", "sidebar", "content"],
  z_shape: ["step_1", "step_2", "step_3"],
  card_block: ["content"],
  featured_media: ["media", "content"],
  masonry: ["content"],
  magazine: ["headline", "featured", "sidebar", "feed"],
  interactive_carousel: ["slides"],
};

export const LAYOUTS_INFO = [
  {
    id: "two_column",
    name: "Two-Column Layout",
    description:
      "Estrutura clássica com barra lateral e conteúdo principal. Ideal para 'Menu de Aulas + Conteúdo' ou 'Ferramentas + Workspace'.",
  },
  {
    id: "split_screen",
    name: "Split Screen Layout",
    description:
      "Divisão 50/50 exata. Essencial para 'Editor de Código' na esquerda e 'Terminal/Preview' na direita.",
  },
  {
    id: "asymmetrical",
    name: "Asymmetrical Layout",
    description:
      "Grid não uniforme (ex: 70/30). Foca no conteúdo principal mas mantém widgets de contexto ou notas visíveis ao lado.",
  },
  {
    id: "f_shape",
    name: "F-Shape Layout",
    description:
      "Segue o padrão de leitura. Topo denso + Coluna esquerda. Ideal para Dashboards complexos com muita informação hierárquica.",
  },
  {
    id: "z_shape",
    name: "Z-Shape (Zig-Zag) Layout",
    description:
      "Alterna visual/texto em zigue-zague. Perfeito para Storytelling educacional ou explicar uma jornada passo-a-passo.",
  },
  {
    id: "card_block",
    name: "Card or Block Layout",
    description:
      "Grid uniforme de blocos. Uso obrigatório para mostrar opções de múltipla escolha, catálogo de módulos ou flashcards.",
  },
  {
    id: "featured_media",
    name: "Featured Image/Video Layout",
    description:
      "Um bloco de mídia dominante com texto de apoio. O padrão para Videoaulas ou análise de gráficos/imagens.",
  },
  {
    id: "masonry",
    name: "Masonry Layout",
    description:
      "Blocos com alturas variadas que se encaixam (estilo Pinterest). Útil para mostrar anotações do aluno ou referências mistas.",
  },
  {
    id: "magazine",
    name: "Magazine Layout",
    description:
      "Layout editorial complexo com múltiplas colunas e destaques. Bom para um 'Resumo Semanal' ou relatório de desempenho.",
  },
  {
    id: "interactive_carousel",
    name: "Interactive Layout",
    description:
      "Bloco central com controles de navegação (setas). Ideal para Wizards (passo-a-passo linear) ou revisão de questões.",
  },
  {
    id: "linear",
    name: "Standard Linear Chat",
    description:
      "Fluxo padrão de chat (um bloco após o outro). Use para respostas simples ou conversacionais.",
  },
  {
    id: "three_column",
    name: "Three Column Grid",
    description:
      "Três colunas de largura igual. Perfeito para comparar 3 opções ou mostrar 3 métricas.",
  },
];

export const CHAT_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    sections: {
      type: "array",
      items: { $ref: "#/definitions/layout_structure" },
      description: "Lista de seções de layout que compõem a resposta.",
    },
  },
  required: ["sections"],
  additionalProperties: false,
  definitions: {
    layout_structure: {
      type: "object",
      properties: {
        layout: { $ref: "#/definitions/layout_config" },
        slots: {
          type: "object",
          description:
            "Map de slots para layouts estruturados (ex: split_screen).",
          additionalProperties: {
            type: "array",
            items: { $ref: "#/definitions/block" },
          },
        },
        conteudo: {
          type: "array",
          description:
            "Lista linear de blocos. Usado primariamente pelo layout 'linear'.",
          items: { $ref: "#/definitions/block" },
        },
      },
      required: ["layout"],
      additionalProperties: false,
    },
    layout_config: {
      type: "object",
      properties: {
        id: {
          type: "string",
          enum: LAYOUT_TYPE,
          description: "O ID do layout escolhido para esta seção.",
        },
        params: {
          type: "object",
          description: "Parâmetros opcionais específicos do layout.",
          additionalProperties: true,
        },
      },
      required: ["id"],
      additionalProperties: false,
    },
    block: {
      type: "object",
      oneOf: [
        { $ref: "#/definitions/block_standard" },
        { $ref: "#/definitions/block_question" },
        { $ref: "#/definitions/block_slide" },
        { $ref: "#/definitions/block_scaffolding" },
      ],
    },
    block_standard: {
      // Bloco de Conteúdo Padrão
      properties: {
        tipo: {
          type: "string",
          enum: CONTENT_BLOCK_TYPE.filter(
            (t) => t !== "questao" && t !== "scaffolding",
          ),
          description: "O tipo de conteúdo deste bloco.",
        },
        conteudo: {
          type: "string",
          description:
            "Conteúdo do bloco conforme o tipo: (texto/citacao/destaque) texto literal em parágrafos; (titulo/subtitulo) cabeçalho interno do conteúdo; (lista) itens em linhas separadas; (equacao) somente expressão em LaTeX; (codigo) somente o código; (imagem) descrição visual curta (alt-text) sem OCR; (separador) pode ser vazio; (fonte) créditos/referência exibível (ex: 'Fonte: ...', 'Adaptado de ...', autor/obra/URL); (tabela) USE FORMATO MARKDOWN TABLE.",
        },
        props: {
          type: "object",
          description: "Propriedades extras opcionais para o bloco.",
          additionalProperties: true,
        },
      },
      required: ["tipo", "conteudo"],
      additionalProperties: false,
    },
    block_question: {
      // Bloco de Questão (Busca Dinâmica) - ESTRUTURA ESTRITA
      properties: {
        tipo: {
          type: "string",
          const: "questao",
          description: "Bloco para exibir a questão fornecida pelo sistema.",
        },
        conteudo: {
          type: "string",
          maxLength: 100,
          pattern: "^[a-zA-Z0-9_\\-\\s\\.]+$",
          description:
            "ID da questão (ex: 'ENEM_2021_Q45'). OBRIGATÓRIO: Apenas string simples. PROIBIDO: Objetos, JSON ou Arrays.",
        },
        props: { $ref: "#/definitions/props_question" },
      },
      required: ["tipo", "conteudo"],
      additionalProperties: false,
    },
    props_question: {
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
      additionalProperties: false,
    },
    block_slide: {
      // Bloco Container de Slide (para Carousel)
      properties: {
        content: {
          type: "array",
          description: "Lista de blocos de conteúdo dentro de um único slide.",
          items: { $ref: "#/definitions/block" },
        },
      },
      required: ["content"],
      additionalProperties: false,
    },
    block_scaffolding: {
      // Bloco de Scaffolding (Verdadeiro/Falso) - ESTRUTURA ESTRITA
      properties: {
        tipo: {
          type: "string",
          const: "scaffolding",
          description: "Bloco para interação de Verdadeiro ou Falso.",
        },
        raciocinio_adaptativo: {
          type: "string",
          description:
            "Raciocínio sobre o desempenho anterior e escolha deste passo.",
        },
        status: {
          type: "string",
          enum: ["em_progresso", "concluido"],
          description: "Status do processo de scaffolding.",
        },
        tipo_pergunta: {
          type: "string",
          enum: ["verdadeiro_ou_falso"],
          description: "Tipo do exercício.",
        },
        enunciado: {
          type: "string",
          description: "A afirmação que o usuário deve julgar.",
        },
        resposta_correta: {
          type: "string",
          enum: ["Verdadeiro", "Falso"],
          description: "A resposta correta da afirmação.",
        },
        feedback_v: {
          type: "string",
          description: "Feedback se o usuário responder Verdadeiro.",
        },
        feedback_f: {
          type: "string",
          description: "Feedback se o usuário responder Falso.",
        },
        dica: {
          type: "string",
          description: "Uma dica útil para ajudar o usuário.",
        },
      },
      required: [
        "tipo",
        "status",
        "tipo_pergunta",
        "enunciado",
        "resposta_correta",
        "feedback_v",
        "feedback_f",
      ],
      additionalProperties: false,
    },
  },
};

export const SCAFFOLDING_STEP_SCHEMA = {
  type: "object",
  properties: {
    raciocinio_adaptativo: {
      type: "string",
      description:
        "Raciocínio sobre o desempenho anterior e escolha deste passo.",
    },
    status: {
      type: "string",
      enum: ["em_progresso", "concluido"],
      description: "Status do processo de scaffolding.",
    },
    tipo_pergunta: {
      type: "string",
      enum: ["verdadeiro_ou_falso"],
      description: "Tipo do exercício.",
    },
    enunciado: {
      type: "string",
      description: "A afirmação que o usuário deve julgar.",
    },
    resposta_correta: {
      type: "string",
      enum: ["Verdadeiro", "Falso"],
      description: "A resposta correta da afirmação.",
    },
    feedback_v: {
      type: "string",
      description: "Feedback se o usuário responder Verdadeiro.",
    },
    feedback_f: {
      type: "string",
      description: "Feedback se o usuário responder Falso.",
    },
    dica: {
      type: "string",
      description: "Uma dica útil para ajudar o usuário.",
    },
  },
  required: [
    "status",
    "tipo_pergunta",
    "enunciado",
    "resposta_correta",
    "feedback_v",
    "feedback_f",
  ],
  additionalProperties: false,
};

console.log(CHAT_RESPONSE_SCHEMA);
