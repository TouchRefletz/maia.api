console.log("[DEBUG] Loading updated alternativas.js");
import { criarHtmlBlocoEditor } from "./structure-editor.js";

/**
 * Retorna apenas a string HTML da estrutura da alternativa.
 */
export const gerarHtmlTemplateAlternativa = (blocoInicialHtml) => {
  return `
        <div style="display:flex;gap:5px;align-items:center;">
            <input class="form-control alt-letter" style="width:60px;text-align:center;" value="" placeholder="Letra">
            <button type="button" class="btn btn--sm btn--outline btn-remove-alt" style="color:var(--color-error);border-color:var(--color-error);min-width:30px;" title="Remover alternativa">✕</button>
        </div>
        <div class="alt-editor">
            <div class="structure-editor-wrapper">
                <div class="structure-editor-container alt-drag-container">
                    ${blocoInicialHtml}
                </div>
                <div class="structure-toolbar alt-add-buttons" style="margin-top:6px;position:relative;">
                    <button type="button" class="btn btn--sm btn--secondary btn-alt-toggle-menu" style="width:100%;display:flex;justify-content:center;gap:5px;align-items:center;">
                        <span>+</span> <span>Adicionar Conteúdo</span>
                    </button>
                    <div class="alt-add-menu hidden" style="position:absolute;top:100%;left:0;right:0;background:var(--color-surface);border:1px solid var(--color-border);box-shadow:0 4px 12px rgba(0,0,0,0.15);border-radius:6px;padding:8px;z-index:999;flex-direction:column;gap:4px;margin-top:5px;display:none;">
                        <button type="button" class="btn btn--sm btn--text btn-alt-add" style="justify-content:flex-start;text-align:left;width:100%;" data-add-type="texto">📄 Texto</button>
                        <button type="button" class="btn btn--sm btn--text btn-alt-add" style="justify-content:flex-start;text-align:left;width:100%;" data-add-type="equacao">∑ Equação</button>
                        <button type="button" class="btn btn--sm btn--text btn-alt-add" style="justify-content:flex-start;text-align:left;width:100%;" data-add-type="imagem">📷 Imagem</button>
                        <div style="height:1px;background:var(--color-border);margin:4px 0;"></div>
                        <button type="button" class="btn btn--sm btn--text btn-alt-add" style="justify-content:flex-start;text-align:left;width:100%;" data-add-type="lista">≡ Lista</button>
                        <button type="button" class="btn btn--sm btn--text btn-alt-add" style="justify-content:flex-start;text-align:left;width:100%;" data-add-type="tabela">▦ Tabela</button>
                        <button type="button" class="btn btn--sm btn--text btn-alt-add" style="justify-content:flex-start;text-align:left;width:100%;" data-add-type="codigo">{ } Código</button>
                        <button type="button" class="btn btn--sm btn--text btn-alt-add" style="justify-content:flex-start;text-align:left;width:100%;" data-add-type="citacao">“ Citação</button>
                        <button type="button" class="btn btn--sm btn--text btn-alt-add" style="justify-content:flex-start;text-align:left;width:100%;" data-add-type="destaque">★ Destaque</button>
                        <div style="height:1px;background:var(--color-border);margin:4px 0;"></div>
                        <button type="button" class="btn btn--sm btn--text btn-alt-add" style="justify-content:flex-start;text-align:left;width:100%;" data-add-type="titulo">H1 Título</button>
                        <button type="button" class="btn btn--sm btn--text btn-alt-add" style="justify-content:flex-start;text-align:left;width:100%;" data-add-type="subtitulo">H2 Subtítulo</button>
                        <button type="button" class="btn btn--sm btn--text btn-alt-add" style="justify-content:flex-start;text-align:left;width:100%;" data-add-type="separador">__ Separador</button>
                        <button type="button" class="btn btn--sm btn--text btn-alt-add" style="justify-content:flex-start;text-align:left;width:100%;" data-add-type="fonte">© Fonte</button>
                    </div>
                </div>
            </div>
        </div>
    `;
};

/**
 * Liga os eventos (click) nos elementos recém-criados daquela linha.
 */
export const configurarEventosNovaAlternativa = (linhaElemento) => {
  // 1. Configura os botões de adicionar blocos (Texto, Equação, Imagem)
  linhaElemento.querySelectorAll(".btn-alt-add").forEach((btn) => {
    btn.onclick = () => {
      const tipo = btn.dataset.addType;
      const html = criarHtmlBlocoEditor(tipo, "");

      const temp = document.createElement("div");
      temp.innerHTML = html.trim();

      // Encontra o container de drag ESPECÍFICO desta linha e adiciona
      const dragContainer = linhaElemento.querySelector(".alt-drag-container");
      if (dragContainer) {
        dragContainer.appendChild(temp.firstChild);
      }
    };
  });

  // 2. Configura o botão de remover a própria linha
  const btnRemove = linhaElemento.querySelector(".btn-remove-alt");
  if (btnRemove) {
    btnRemove.onclick = function () {
      linhaElemento.remove();
    };
  }
};

/**
 * Cria o elemento DOM da alternativa, preenche o HTML e liga os eventos.
 */
export const criarEAnexarAlternativa = (containerDestino) => {
  const nova = document.createElement("div");
  nova.className = "alt-row alt-edit-row";
  nova.style.cssText =
    "display:flex;flex-direction:column;gap:8px;margin-bottom:10px";

  // Gera o conteúdo visual
  const blocoInicial = criarHtmlBlocoEditor("texto", "");
  nova.innerHTML = gerarTemplateAlternativaSimples(blocoInicial);

  // Liga os eventos (Remover e Adicionar Bloco)
  configurarEventosAlternativa(nova);

  // Adiciona na tela
  containerDestino.appendChild(nova);
};

/**
 * Retorna o HTML da alternativa (Visual)
 */
export const gerarTemplateAlternativaSimples = (blocoInicial) => {
  return `
        <div style="display:flex;gap:5px;align-items:center">
          <input class="form-control alt-letter" style="width:60px;text-align:center" value="" placeholder="Letra">
          <button type="button" class="btn btn--sm btn--outline btn-remove-alt"
            style="color:var(--color-error);border-color:var(--color-error);min-width:30px" title="Remover alternativa">-</button>
        </div>

        <div class="alt-editor">
          <div class="structure-editor-wrapper">
            <div class="structure-editor-container alt-drag-container">${blocoInicial}</div>
            <div class="structure-toolbar alt-add-buttons" style="margin-top:6px;position:relative;">
                <button type="button" class="btn btn--sm btn--secondary btn-alt-toggle-menu" style="width:100%;display:flex;justify-content:center;gap:5px;align-items:center;">
                    <span>+</span> <span>Adicionar Conteúdo</span>
                </button>
                <div class="alt-add-menu hidden" style="position:absolute;top:100%;left:0;right:0;background:var(--color-surface);border:1px solid var(--color-border);box-shadow:0 4px 12px rgba(0,0,0,0.15);border-radius:6px;padding:8px;z-index:999;flex-direction:column;gap:4px;margin-top:5px;display:none;">
                    <button type="button" class="btn btn--sm btn--text btn-alt-add" style="justify-content:flex-start;text-align:left;width:100%;" data-add-type="texto">📄 Texto</button>
                    <button type="button" class="btn btn--sm btn--text btn-alt-add" style="justify-content:flex-start;text-align:left;width:100%;" data-add-type="equacao">∑ Equação</button>
                    <button type="button" class="btn btn--sm btn--text btn-alt-add" style="justify-content:flex-start;text-align:left;width:100%;" data-add-type="imagem">📷 Imagem</button>
                    <div style="height:1px;background:var(--color-border);margin:4px 0;"></div>
                    <button type="button" class="btn btn--sm btn--text btn-alt-add" style="justify-content:flex-start;text-align:left;width:100%;" data-add-type="lista">≡ Lista</button>
                    <button type="button" class="btn btn--sm btn--text btn-alt-add" style="justify-content:flex-start;text-align:left;width:100%;" data-add-type="tabela">▦ Tabela</button>
                    <button type="button" class="btn btn--sm btn--text btn-alt-add" style="justify-content:flex-start;text-align:left;width:100%;" data-add-type="codigo">{ } Código</button>
                    <button type="button" class="btn btn--sm btn--text btn-alt-add" style="justify-content:flex-start;text-align:left;width:100%;" data-add-type="citacao">“ Citação</button>
                    <button type="button" class="btn btn--sm btn--text btn-alt-add" style="justify-content:flex-start;text-align:left;width:100%;" data-add-type="destaque">★ Destaque</button>
                    <div style="height:1px;background:var(--color-border);margin:4px 0;"></div>
                    <button type="button" class="btn btn--sm btn--text btn-alt-add" style="justify-content:flex-start;text-align:left;width:100%;" data-add-type="titulo">H1 Título</button>
                    <button type="button" class="btn btn--sm btn--text btn-alt-add" style="justify-content:flex-start;text-align:left;width:100%;" data-add-type="subtitulo">H2 Subtítulo</button>
                    <button type="button" class="btn btn--sm btn--text btn-alt-add" style="justify-content:flex-start;text-align:left;width:100%;" data-add-type="separador">__ Separador</button>
                    <button type="button" class="btn btn--sm btn--text btn-alt-add" style="justify-content:flex-start;text-align:left;width:100%;" data-add-type="fonte">© Fonte</button>
                </div>
            </div>
          </div>
        </div>
    `;
};

/**
 * Liga os cliques dos botões internos da alternativa.
 */
export const configurarEventosAlternativa = (linhaElemento) => {
  // Botão Remover Linha
  const btnRemove = linhaElemento.querySelector(".btn-remove-alt");
  if (btnRemove) {
    btnRemove.onclick = () => linhaElemento.remove();
  }

  // --- LÓGICA DO MENU DROPDOWN ---
  const toggleBtn = linhaElemento.querySelector(".btn-alt-toggle-menu");
  const menu = linhaElemento.querySelector(".alt-add-menu");

  if (toggleBtn && menu) {
    toggleBtn.onclick = (e) => {
      e.stopPropagation();
      // Fecha outros menus abertos para não poluir
      document.querySelectorAll(".alt-add-menu").forEach((m) => {
        if (m !== menu) {
          m.classList.add("hidden");
          m.style.display = "none";
        }
      });

      const isHidden = menu.classList.contains("hidden");
      if (isHidden) {
        menu.classList.remove("hidden");
        menu.style.display = "flex";
      } else {
        menu.classList.add("hidden");
        menu.style.display = "none";
      }
    };
  }

  // Botões Adicionar Bloco
  linhaElemento.querySelectorAll(".btn-alt-add").forEach((btn) => {
    btn.onclick = () => {
      const tipo = btn.dataset.addType;
      const html = criarHtmlBlocoEditor(tipo, "");

      const temp = document.createElement("div");
      temp.innerHTML = html.trim();

      const dragContainer = linhaElemento.querySelector(".alt-drag-container");
      if (dragContainer) dragContainer.appendChild(temp.firstChild);

      // Fecha o menu após adicionar
      if (menu) {
        menu.classList.add("hidden");
        menu.style.display = "none";
      }
    };
  });
};
