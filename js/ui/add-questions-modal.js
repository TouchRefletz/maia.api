/**
 * Modal para adicionar questões ao chat
 * Permite buscar provas e selecionar questões com preview
 */

import {
  endAt,
  get,
  limitToFirst,
  orderByKey,
  query,
  ref,
  startAt,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";
import { criarCardTecnico } from "../banco/card-template.js";
import { renderLatexIn } from "../libs/loader.tsx";
import { db } from "../main.js";

// Estado do modal
let selectedQuestions = new Map();
let expandedExam = null;
let modalOverlay = null;
let previewOverlay = null;

/**
 * Abre o modal de adicionar questões
 */
export function openAddQuestionsModal() {
  // Remove modal existente se houver
  closeAddQuestionsModal();

  // Cria overlay principal
  modalOverlay = document.createElement("div");
  modalOverlay.id = "addQuestionsModal";
  modalOverlay.className = "final-modal-overlay visible";
  modalOverlay.innerHTML = generateModalHTML();

  document.body.appendChild(modalOverlay);

  // Setup event listeners
  setupModalListeners();

  // Carrega provas iniciais
  loadInitialExams();
}

/**
 * Fecha o modal
 */
export function closeAddQuestionsModal() {
  if (modalOverlay) {
    modalOverlay.remove();
    modalOverlay = null;
  }
  if (previewOverlay) {
    previewOverlay.remove();
    previewOverlay = null;
  }
  selectedQuestions.clear();
  expandedExam = null;
}

/**
 * Gera HTML do modal principal
 */
function generateModalHTML() {
  return `
    <div class="add-questions-content">
      <!-- Header -->
      <div class="add-questions-header">
        <h2>📚 Adicionar Questões</h2>
        <div class="add-questions-search-wrapper">
          <input 
            type="text" 
            id="addQuestionsSearch" 
            placeholder="Buscar prova (ex: ENEM, FUVEST, ETEC...)" 
            autocomplete="off"
          >
          <span class="search-icon">🔍</span>
        </div>
        <button class="add-questions-close-btn" id="closeAddQuestionsModal">✕</button>
      </div>

      <!-- Body - Lista de Provas -->
      <div class="add-questions-body" id="addQuestionsBody">
        <div class="add-questions-loading" id="addQuestionsLoading">
          <div class="spinner"></div>
          <p>Carregando provas...</p>
        </div>
        <div class="add-questions-list" id="addQuestionsList"></div>
      </div>

      <!-- Footer -->
      <div class="add-questions-footer">
        <div class="add-questions-counter" id="addQuestionsCounter">
          <span id="selectedCount">0</span> questão(ões) selecionada(s)
        </div>
        <div class="add-questions-actions">
          <button class="btn btn--outline" id="cancelAddQuestions">Cancelar</button>
          <button class="btn btn--primary" id="confirmAddQuestions" disabled>
            Adicionar Selecionadas
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Configura listeners do modal
 */
function setupModalListeners() {
  // Fechar com X ou clique no overlay
  document
    .getElementById("closeAddQuestionsModal")
    ?.addEventListener("click", closeAddQuestionsModal);
  document
    .getElementById("cancelAddQuestions")
    ?.addEventListener("click", closeAddQuestionsModal);

  modalOverlay?.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeAddQuestionsModal();
  });

  // Confirmar seleção
  document
    .getElementById("confirmAddQuestions")
    ?.addEventListener("click", confirmSelection);

  // Busca com debounce
  const searchInput = document.getElementById("addQuestionsSearch");
  let debounceTimer;

  searchInput?.addEventListener("input", (e) => {
    const term = e.target.value.trim();
    clearTimeout(debounceTimer);

    debounceTimer = setTimeout(() => {
      if (term.length > 0) {
        searchExams(term);
      } else {
        loadInitialExams();
      }
    }, 400);
  });

  // ESC para fechar
  document.addEventListener("keydown", handleEscKey);
}

function handleEscKey(e) {
  if (e.key === "Escape") {
    if (previewOverlay) {
      closePreview();
    } else if (modalOverlay) {
      closeAddQuestionsModal();
    }
    document.removeEventListener("keydown", handleEscKey);
  }
}

/**
 * Carrega provas iniciais (lista de chaves em questoes/)
 */
async function loadInitialExams() {
  const listContainer = document.getElementById("addQuestionsList");
  const loading = document.getElementById("addQuestionsLoading");

  if (!listContainer || !loading) return;

  loading.style.display = "flex";
  listContainer.innerHTML = "";

  try {
    const dbRef = ref(db, "questoes");
    const consulta = query(dbRef, orderByKey(), limitToFirst(50));
    const snapshot = await get(consulta);

    loading.style.display = "none";

    if (snapshot.exists()) {
      const data = snapshot.val();
      const provas = Object.keys(data).sort();

      provas.forEach((nomeProva) => {
        const questoes = data[nomeProva];
        const qtd = questoes ? Object.keys(questoes).length : 0;
        listContainer.appendChild(createExamCard(nomeProva, qtd));
      });
    } else {
      listContainer.innerHTML = `<p class="add-questions-empty">Nenhuma prova encontrada.</p>`;
    }
  } catch (e) {
    console.error("Erro ao carregar provas:", e);
    loading.style.display = "none";
    listContainer.innerHTML = `<p class="add-questions-error">Erro ao carregar: ${e.message}</p>`;
  }
}

/**
 * Smart Search - busca com variações de case
 */
async function searchExams(termo) {
  const listContainer = document.getElementById("addQuestionsList");
  const loading = document.getElementById("addQuestionsLoading");

  if (!listContainer || !loading) return;

  loading.style.display = "flex";
  listContainer.innerHTML = "";

  try {
    // Variações de case: exato, UPPERCASE, lowercase, Capitalized
    const variacoes = new Set();
    variacoes.add(termo);
    variacoes.add(termo.toUpperCase());
    variacoes.add(termo.toLowerCase());
    if (termo.length > 0) {
      variacoes.add(
        termo.charAt(0).toUpperCase() + termo.slice(1).toLowerCase(),
      );
    }

    const dbRef = ref(db, "questoes");

    // Buscas paralelas
    const promessas = Array.from(variacoes).map(async (termoBusca) => {
      const consulta = query(
        dbRef,
        orderByKey(),
        startAt(termoBusca),
        endAt(termoBusca + "\uf8ff"),
        limitToFirst(20),
      );
      return get(consulta);
    });

    const snapshots = await Promise.all(promessas);

    // Agrega resultados únicos
    const resultados = new Map();
    snapshots.forEach((snapshot) => {
      if (snapshot.exists()) {
        Object.entries(snapshot.val()).forEach(([key, value]) => {
          resultados.set(key, value);
        });
      }
    });

    loading.style.display = "none";

    if (resultados.size > 0) {
      const listaOrdenada = Array.from(resultados.entries()).sort((a, b) =>
        a[0].localeCompare(b[0]),
      );

      listaOrdenada.forEach(([nomeProva, questoes]) => {
        const qtd = questoes ? Object.keys(questoes).length : 0;
        listContainer.appendChild(createExamCard(nomeProva, qtd));
      });
    } else {
      listContainer.innerHTML = `<p class="add-questions-empty">Nenhum resultado para "${termo}"</p>`;
    }
  } catch (e) {
    console.error("Erro na busca:", e);
    loading.style.display = "none";
    listContainer.innerHTML = `<p class="add-questions-error">Erro: ${e.message}</p>`;
  }
}

/**
 * Cria card de prova (accordion)
 */
function createExamCard(nomeProva, qtdQuestoes) {
  const card = document.createElement("div");
  card.className = "exam-card";
  card.dataset.exam = nomeProva;

  const nomeFormatado = nomeProva.replace(/_/g, " ");

  card.innerHTML = `
    <div class="exam-card-header">
      <div class="exam-card-info">
        <span class="exam-card-name">${nomeFormatado}</span>
        <span class="exam-card-badge">${qtdQuestoes} questões</span>
      </div>
      <span class="exam-card-chevron">▼</span>
    </div>
    <div class="exam-card-body" style="display: none;">
      <div class="exam-questions-loading">
        <div class="spinner-sm"></div>
        Carregando questões...
      </div>
      <div class="exam-questions-list"></div>
    </div>
  `;

  // Toggle accordion
  card.querySelector(".exam-card-header")?.addEventListener("click", () => {
    toggleExamCard(card, nomeProva);
  });

  return card;
}

/**
 * Toggle do accordion
 */
async function toggleExamCard(card, nomeProva) {
  const body = card.querySelector(".exam-card-body");
  const chevron = card.querySelector(".exam-card-chevron");
  const isExpanded = body.style.display !== "none";

  // Fecha todos os outros
  document.querySelectorAll(".exam-card-body").forEach((b) => {
    b.style.display = "none";
  });
  document.querySelectorAll(".exam-card-chevron").forEach((c) => {
    c.textContent = "▼";
    c.style.transform = "rotate(0deg)";
  });

  if (isExpanded) {
    body.style.display = "none";
    chevron.style.transform = "rotate(0deg)";
    expandedExam = null;
  } else {
    body.style.display = "block";
    chevron.style.transform = "rotate(180deg)";
    expandedExam = nomeProva;
    await loadExamQuestions(card, nomeProva);
  }
}

/**
 * Carrega questões de uma prova específica
 */
async function loadExamQuestions(card, nomeProva) {
  const loading = card.querySelector(".exam-questions-loading");
  const listContainer = card.querySelector(".exam-questions-list");

  loading.style.display = "flex";
  listContainer.innerHTML = "";

  try {
    const dbRef = ref(db, `questoes/${nomeProva}`);
    const snapshot = await get(dbRef);

    loading.style.display = "none";

    if (snapshot.exists()) {
      const questoes = snapshot.val();

      Object.entries(questoes).forEach(([idQuestao, fullData]) => {
        if (!fullData.dados_questao) return;

        const questionItem = createQuestionItem(idQuestao, fullData, nomeProva);
        listContainer.appendChild(questionItem);
      });
    } else {
      listContainer.innerHTML = `<p class="add-questions-empty">Sem questões</p>`;
    }
  } catch (e) {
    console.error("Erro ao carregar questões:", e);
    loading.style.display = "none";
    listContainer.innerHTML = `<p class="add-questions-error">Erro: ${e.message}</p>`;
  }
}

/**
 * Cria item de questão
 */
function createQuestionItem(idQuestao, fullData, nomeProva) {
  const q = fullData.dados_questao || {};
  const materias = (q.materias_possiveis || []).slice(0, 2).join(", ");

  // Extrai texto do enunciado para preview curto
  let previewText = "";
  if (q.estrutura && q.estrutura.length > 0) {
    for (const bloco of q.estrutura) {
      if (bloco.tipo === "texto" && bloco.conteudo) {
        previewText =
          bloco.conteudo.slice(0, 80) +
          (bloco.conteudo.length > 80 ? "..." : "");
        break;
      }
    }
  } else if (q.enunciado) {
    previewText =
      q.enunciado.slice(0, 80) + (q.enunciado.length > 80 ? "..." : "");
  }

  const questionKey = `${nomeProva}::${idQuestao}`;
  const isSelected = selectedQuestions.has(questionKey);

  const item = document.createElement("div");
  item.className = `question-item ${isSelected ? "selected" : ""}`;
  item.dataset.key = questionKey;

  item.innerHTML = `
    <label class="question-checkbox-wrapper">
      <input type="checkbox" class="question-checkbox" ${isSelected ? "checked" : ""}>
      <span class="question-checkmark"></span>
    </label>
    <div class="question-item-info">
      <div class="question-item-header">
        <span class="question-item-id">${idQuestao}</span>
        ${materias ? `<span class="question-item-tags">${materias}</span>` : ""}
      </div>
      <p class="question-item-preview">${previewText || "Sem texto de preview"}</p>
    </div>
    <button class="question-preview-btn" title="Ver questão completa">
      👁️
    </button>
  `;

  // Checkbox handler
  const checkbox = item.querySelector(".question-checkbox");
  checkbox?.addEventListener("change", (e) => {
    e.stopPropagation();
    if (e.target.checked) {
      selectedQuestions.set(questionKey, {
        id: idQuestao,
        prova: nomeProva,
        fullData,
      });
      item.classList.add("selected");
    } else {
      selectedQuestions.delete(questionKey);
      item.classList.remove("selected");
    }
    updateCounter();
  });

  // Preview handler
  const previewBtn = item.querySelector(".question-preview-btn");
  previewBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    openQuestionPreview(idQuestao, fullData, nomeProva);
  });

  // Click no item também marca checkbox
  item.addEventListener("click", (e) => {
    if (
      e.target !== checkbox &&
      e.target !== previewBtn &&
      !previewBtn?.contains(e.target)
    ) {
      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });

  return item;
}

/**
 * Abre preview da questão (modal secundário) usando o card do banco
 */
function openQuestionPreview(idQuestao, fullData, nomeProva) {
  closePreview();

  // Injeta meta se não existir
  if (!fullData.meta) fullData.meta = {};
  if (!fullData.meta.material_origem) {
    fullData.meta.material_origem = nomeProva.replace(/_/g, " ");
  }

  previewOverlay = document.createElement("div");
  previewOverlay.id = "questionPreviewOverlay";
  previewOverlay.className = "question-preview-overlay";

  // Cria container do modal
  const modalContent = document.createElement("div");
  modalContent.className = "question-preview-content question-preview-card";

  // Header com botão fechar
  const header = document.createElement("div");
  header.className = "question-preview-header";
  header.innerHTML = `
    <h3>${nomeProva.replace(/_/g, " ")} - ${idQuestao}</h3>
    <button class="preview-close-btn" id="closeQuestionPreview">✕</button>
  `;
  modalContent.appendChild(header);

  // Body com o card do banco
  const body = document.createElement("div");
  body.className = "question-preview-body";

  // Usa criarCardTecnico do banco de questões
  const card = criarCardTecnico(idQuestao, fullData);
  body.appendChild(card);
  modalContent.appendChild(body);

  previewOverlay.appendChild(modalContent);
  document.body.appendChild(previewOverlay);

  // Renderiza LaTeX
  if (typeof renderLatexIn === "function") {
    renderLatexIn(card);
  }

  // Fecha ao clicar no X ou no overlay
  document
    .getElementById("closeQuestionPreview")
    ?.addEventListener("click", closePreview);
  previewOverlay.addEventListener("click", (e) => {
    if (e.target === previewOverlay) closePreview();
  });

  // Anima entrada
  requestAnimationFrame(() => {
    previewOverlay.classList.add("visible");
  });
}

/**
 * Fecha preview
 */
function closePreview() {
  if (previewOverlay) {
    previewOverlay.classList.remove("visible");
    setTimeout(() => {
      previewOverlay?.remove();
      previewOverlay = null;
    }, 200);
  }
}

/**
 * Atualiza contador de selecionados
 */
function updateCounter() {
  const countEl = document.getElementById("selectedCount");
  const confirmBtn = document.getElementById("confirmAddQuestions");

  if (countEl) countEl.textContent = selectedQuestions.size;
  if (confirmBtn) confirmBtn.disabled = selectedQuestions.size === 0;
}

/**
 * Confirma seleção e retorna questões
 */
function confirmSelection() {
  if (selectedQuestions.size === 0) return;

  const questoesArray = Array.from(selectedQuestions.values());

  // Dispara evento customizado
  window.dispatchEvent(
    new CustomEvent("questions-selected", {
      detail: { questions: questoesArray },
    }),
  );

  closeAddQuestionsModal();
}
