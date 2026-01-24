/**
 * Utilitário centralizado para hidratação de conteúdo do chat (Carousels, Scaffolding, Questões)
 * Evita duplicação de lógica entre telas.js e chat-debugger.js
 */

import { hydrateScaffoldingBlocks } from "../app/telas.js"; // Ou onde estiver definido
import { criarCardTecnico } from "../banco/card-template.js";
import { renderLatexIn } from "../libs/loader.tsx";
import { findBestQuestion } from "../services/question-service.js"; // Importar dependências diretas se possível
import { hydrateCarousels } from "../ui/carousel.js";

// Nota: hydrateScaffoldingBlocks e hydrateQuestionBlocks estão atualmente dentro de telas.js
// O ideal seria movê-las para cá ou para um módulo separado, mas por compatibilidade vamos importá-las ou redefini-las se necessário.
// Como hydrateScaffoldingBlocks é exportada de telas.js, podemos usá-la.
// hydrateQuestionBlocks NÃO é exportada de telas.js (é interna). Precisamos movê-la ou duplicar a lógica aqui de forma mais limpa.

/**
 * Hidrata todo o conteúdo dinâmico dentro de um container de mensagem
 */
export async function hydrateAllChatContent(container) {
  if (!container) return;

  // 1. Carousels
  hydrateCarousels(container);

  // 2. Scaffolding (Exercícios Interativos)
  // Tenta usar a importada, mas em ambiente de debug ela pode ter dependências de estado global de telas.js
  // Vamos assumir que funciona, pois o debugger já importa ela no topo
  try {
    if (typeof hydrateScaffoldingBlocks === "function") {
      hydrateScaffoldingBlocks(container);
    }
  } catch (e) {
    console.warn("Erro ao hidratar scaffolding:", e);
  }

  // 3. Questões (Busca Async)
  // Esta lógica estava dentro de telas.js e duplicada no debugger. Centralizando aqui.
  const placeholders = container.querySelectorAll(".chat-question-placeholder");

  // Processamos em paralelo para performance
  const hydrationPromises = Array.from(placeholders).map(
    async (placeholder) => {
      try {
        // Evita re-hidratação
        if (placeholder.dataset.hydrated) return;
        placeholder.dataset.hydrated = "true";

        const filterJson = placeholder.dataset.filter;
        if (!filterJson) return;

        const filterData = JSON.parse(filterJson);

        // Fallback visual enquanto carrega
        // (Já existe o spinner do HTML estático, mas podemos refinar se quiser)

        const q = await findBestQuestion(filterData);

        if (q) {
          const card = criarCardTecnico(q.id, q.fullData);
          card.classList.add("chat-embedded-card");

          // Substitui o placeholder pelo card real
          placeholder.replaceWith(card);

          // Renderiza LaTeX nas partes estáticas do card recém-criado
          const staticParts = card.querySelectorAll(
            ".q-header, .q-options, .q-footer, .static-render-target, .markdown-content",
          );
          staticParts.forEach((el) => renderLatexIn(el));
        } else {
          // Caso não encontre, mantém o placeholder ou mostra erro discreto
          placeholder.innerHTML = `<div style="padding:10px; color:var(--color-text-secondary); border:1px dashed var(--color-border); border-radius:8px; text-align:center;">
                    Questão não encontrada: "${filterData.query}"
                 </div>`;
        }
      } catch (err) {
        console.error("Erro na hidratação da questão:", err);
        placeholder.innerHTML = `<div style="color:red; font-size:12px;">Erro ao carregar questão.</div>`;
      }
    },
  );

  await Promise.all(hydrationPromises);
}
