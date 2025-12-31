/**
 * SearchPersistence
 * Gerencia o estado da busca no localStorage (Logs, Tarefas, Status)
 */
export const SearchPersistence = {
  KEY: "maia_deep_search_session",

  // Limpa sessão anterior ao iniciar nova busca
  clearSession() {
    localStorage.removeItem(this.KEY);
  },

  // Inicializa estrutura se não existir
  _init() {
    if (!localStorage.getItem(this.KEY)) {
      const initial = {
        isActive: false,
        slug: null,
        logs: [],
        tasks: [],
        status: "BOOT", // BOOT, EXEC, VERIFY, DONE, FAILED
        progress: 0,
        startTime: Date.now(),
        lastUpdate: Date.now(),
      };
      localStorage.setItem(this.KEY, JSON.stringify(initial));
    }
  },

  // Retorna sessão completa
  getSession() {
    try {
      const raw = localStorage.getItem(this.KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  },

  // Inicia sessão ativa
  startSession(slug) {
    const session = {
      isActive: true,
      slug: slug,
      logs: [],
      tasks: [],
      status: "BOOT",
      progress: 0,
      startTime: Date.now(),
      lastUpdate: Date.now(),
    };
    localStorage.setItem(this.KEY, JSON.stringify(session));
  },

  // Salva log incremental
  saveLog(logText, type = "info") {
    const session = this.getSession();
    if (session && session.isActive) {
      session.logs.push({ text: logText, type, time: Date.now() });
      session.lastUpdate = Date.now();
      localStorage.setItem(this.KEY, JSON.stringify(session));
    }
  },

  // Atualiza lista completa de tarefas
  saveTasks(taskList) {
    const session = this.getSession();
    if (session && session.isActive) {
      session.tasks = taskList;
      session.lastUpdate = Date.now();
      localStorage.setItem(this.KEY, JSON.stringify(session));
    }
  },

  // Atualiza progresso e status geral
  updateState(progress, status) {
    const session = this.getSession();
    if (session && session.isActive) {
      if (progress !== undefined) session.progress = progress;
      if (status !== undefined) session.status = status;
      session.lastUpdate = Date.now();
      localStorage.setItem(this.KEY, JSON.stringify(session));
    }
  },

  // Marca como finalizado (mas mantém persistência até usuário fechar ou iniciar nova)
  finishSession(isSuccess = true) {
    const session = this.getSession();
    if (session) {
      session.isActive = false; // Não é mais "ativa" no sentido de rodando, mas existe
      session.status = isSuccess ? "DONE" : "FAILED";
      session.progress = isSuccess ? 100 : session.progress;
      localStorage.setItem(this.KEY, JSON.stringify(session));
    }
  },

  isActive() {
    const s = this.getSession();
    return s && s.isActive;
  },
};
