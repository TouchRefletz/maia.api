/**
 * Configuração do Sistema de Chat
 * Define modelos, modos e parâmetros gerais
 */

export const CHAT_CONFIG = {
  /**
   * Modos disponíveis de operação
   * - automatico: Router decide qual modelo usar
   * - rapido: Modelo rápido, respostas ágeis
   * - raciocinio: Modelo com raciocínio profundo
   */
  modes: {
    automatico: {
      id: "automatico",
      label: "Automático",
      description: "A IA escolhe o melhor modo para você",
      usesRouter: true,
      model: null, // decidido pelo router
    },
    rapido: {
      id: "rapido",
      label: "Rápido",
      description: "Excelente para um estudo rápido e eficaz",
      usesRouter: false,
      model: "gemini-3-flash-preview",
    },
    raciocinio: {
      id: "raciocinio",
      label: "Raciocínio",
      description: "Obtenha respostas com menos alucinações ou incoerências",
      usesRouter: false,
      model: "gemini-3-flash-preview",
    },
    scaffolding: {
      id: "scaffolding",
      label: "Scaffolding (Beta)",
      description: "Treinamento passo-a-passo com verdadeiro ou falso",
      usesRouter: false,
      model: "gemini-3-flash-preview",
    },
  },

  /**
   * Configuração do Router
   */
  routerModel: "gemini-3-flash-preview",

  /**
   * Mapeamento de Complexidade para Modos
   */
  complexityToMode: {
    BAIXA: "rapido",
    ALTA: "raciocinio",
    SCAFFOLDING: "scaffolding",
  },

  /**
   * Parâmetros de geração por modo
   */
  generationParams: {
    rapido: {
      temperature: 1,
    },
    raciocinio: {
      temperature: 1,
      // Habilita thinking para modelos que suportam
    },
    scaffolding: {
      temperature: 1,
      // Pensamentos do tutor
    },
  },

  /**
   * Timeout em ms para cada etapa
   */
  timeouts: {
    router: 10000, // 10s para classificação
    response: 60000, // 60s para resposta principal
  },
};

/**
 * Obtém configuração de um modo específico
 * @param {string} modeId - ID do modo (automatico, rapido, raciocinio)
 * @returns {object} Configuração do modo
 */
export function getModeConfig(modeId) {
  return CHAT_CONFIG.modes[modeId] || CHAT_CONFIG.modes.automatico;
}

/**
 * Obtém parâmetros de geração para um modo
 * @param {string} modeId - ID do modo
 * @returns {object} Parâmetros de geração
 */
export function getGenerationParams(modeId) {
  return (
    CHAT_CONFIG.generationParams[modeId] || CHAT_CONFIG.generationParams.rapido
  );
}

/**
 * Converte complexidade classificada para modo
 * @param {string} complexity - 'BAIXA' ou 'ALTA'
 * @returns {string} ID do modo correspondente
 */
export function complexityToMode(complexity) {
  return CHAT_CONFIG.complexityToMode[complexity] || "rapido";
}
