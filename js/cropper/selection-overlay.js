import { viewerState } from "../main.js";
import { CropperState } from "./cropper-state.js";

/**
 * MODULE: selection-overlay.js
 * Gerencia a camada flutuante que permite selecionar áreas livres através de múltiplas páginas.
 * Versão 6.0: Persistent & Grouped State (State-Driven)
 */

let overlayElement = null;
// ActiveBox agora é apenas uma referência temporária durante o ARRASTE/CRIACAO.
// A persistência real vem do CropperState.
let draggingBox = null;
let dimmingPath = null;

// Listeners
let unsubscribe = null;
let scrollListener = null;
let resizeObserver = null;
let rafId = null;

// Enum
const DragType = {
  NONE: "none",
  CREATE: "create",
  BOX: "box",
  NW: "nw",
  NE: "ne",
  SW: "sw",
  SE: "se",
  N: "n",
  S: "s",
  W: "w",
  E: "e",
  // Adicione outros tipos se necessário
};

let currentDragType = DragType.NONE;
let dragStartX = 0;
let dragStartY = 0;
let initialBoxState = null;
let creationStartX = 0;
let creationStartY = 0;

export function initSelectionOverlay() {
  const container = document.getElementById("canvasContainer");
  if (!container) return;

  if (!overlayElement) {
    createOverlayDOM(container);
  } else {
    // Se jÃ¡ existe, garantimos que estÃ¡ anexado ao container correto (caso de re-render geral)
    if (overlayElement.parentNode !== container) {
      container.appendChild(overlayElement);
    }
  }

  // Previna mÃºltiplas subscriÃ§Ãµes
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }

  // Subscribe to changes in state to re-render
  unsubscribe = CropperState.subscribe(() => {
    refreshOverlayPosition();
    updateInteractivity();
  });

  // Atualiza altura e largura total
  updateOverlayDimensions();

  // Listeners Robustos
  // Remove anterior se existir para nÃ£o duplicar
  if (scrollListener) {
    container.removeEventListener("scroll", scrollListener);
  }

  scrollListener = () => {
    updateOverlayDimensions();
  };
  container.addEventListener("scroll", scrollListener);

  if (window.ResizeObserver) {
    if (resizeObserver) resizeObserver.disconnect();

    resizeObserver = new ResizeObserver(() => {
      updateOverlayDimensions();
    });
    resizeObserver.observe(container);
  }

  updateDimmingMask();
  updateInteractivity();
}

function updateInteractivity() {
  if (!overlayElement) return;
  const activeGroup = CropperState.getActiveGroup();
  // Se tem grupo ativo, overlay pega cliques. Se não, deixa passar (mas mostra os crops).
  // Porém, se clicarmos num crop existente em modo passivo, talvez queiramos selecionar o grupo?
  // Por simplicidade v1: Só edita se tiver grupo ativo.
  if (activeGroup) {
    overlayElement.style.display = "block";
    overlayElement.style.pointerEvents = "auto";
    overlayElement.classList.add("mode-editing");
    overlayElement.classList.remove("mode-viewing");

    // FIX: Se o grupo estiver vazio (criando nova questao), não "lockar" visualmente nem scroll
    if (activeGroup.crops.length === 0) {
      overlayElement.style.cursor = "crosshair";
      overlayElement.style.touchAction = "pan-y"; // Permite scroll vertical
      if (dimmingPath) dimmingPath.style.display = "block"; // Re-habilita fundo escuro (pedido do user)
    } else {
      overlayElement.style.cursor = "crosshair";
      overlayElement.style.touchAction = "none"; // Bloqueia scroll para precisão na edição
      if (dimmingPath) dimmingPath.style.display = "block";
    }

    // Forçar atualização de dimensões ao mostrar
    updateOverlayDimensions();
  } else {
    // Mantém VISÍVEL (block) para ver os crops, mas SEM INTERAÇÃO (none) para scrollar
    overlayElement.style.display = "block";
    overlayElement.style.pointerEvents = "none";
    overlayElement.style.cursor = "default";
    overlayElement.classList.add("mode-viewing");
    overlayElement.classList.remove("mode-editing");
    // Remove o fundo escuro
    if (dimmingPath) dimmingPath.style.display = "none";
  }
}

function updateOverlayDimensions() {
  const container = document.getElementById("canvasContainer");
  if (!container || !overlayElement) return;

  const w = Math.max(container.scrollWidth, container.clientWidth);
  const h = Math.max(container.scrollHeight, container.clientHeight);

  if (
    overlayElement.style.width === `${w}px` &&
    overlayElement.style.height === `${h}px`
  ) {
    return;
  }

  overlayElement.style.width = `${w}px`;
  overlayElement.style.height = `${h}px`;

  if (
    overlayElement.firstChild &&
    overlayElement.firstChild.tagName === "svg"
  ) {
    overlayElement.firstChild.setAttribute("width", "100%");
    overlayElement.firstChild.setAttribute("height", "100%");
    overlayElement.firstChild.setAttribute("viewBox", `0 0 ${w} ${h}`);
  }

  updateDimmingMask();
}

function createOverlayDOM(container) {
  overlayElement = document.createElement("div");
  overlayElement.id = "selection-overlay";
  overlayElement.style.position = "absolute";
  overlayElement.style.top = "0";
  overlayElement.style.left = "0";
  overlayElement.style.width = "100%";
  overlayElement.style.zIndex = "999";
  overlayElement.style.backgroundColor = "transparent";
  overlayElement.style.touchAction = "none";

  // SVG Mask Layer
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.style.position = "absolute";
  svg.style.top = "0";
  svg.style.left = "0";
  svg.style.width = "100%";
  svg.style.height = "100%";
  svg.style.pointerEvents = "none";

  dimmingPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  dimmingPath.setAttribute("fill", "rgba(0, 0, 0, 0.5)");
  dimmingPath.setAttribute("fill-rule", "evenodd");

  svg.appendChild(dimmingPath);
  overlayElement.appendChild(svg);

  container.appendChild(overlayElement);

  overlayElement.addEventListener("pointerdown", handlePointerDown);
  document.addEventListener("pointermove", handlePointerMove);
  document.addEventListener("pointerup", handlePointerUp);
}

// Helper para criar caixa DOM
function createSelectionBoxDOM(isActiveGroup) {
  const box = document.createElement("div");
  box.className = "selection-box";
  // Posicionamento absoluto é necessário para o funcionamento
  box.style.position = "absolute";

  if (isActiveGroup) {
    box.classList.add("is-active-group");

    // Criar handles apenas se for do grupo ativo
    const handles = ["nw", "ne", "sw", "se", "n", "s", "w", "e"];
    handles.forEach((h) => {
      const el = document.createElement("div");
      // As classes handle-nw, handle-n, etc já cuidam do posicionamento e cursor no CSS
      el.className = `resize-handle handle-${h}`;
      el.dataset.handle = h;
      box.appendChild(el);
    });
  } else {
    // Passivo / Outros grupos
    box.classList.add("is-inactive-group");
  }

  return box;
}

export function removeSelectionOverlay() {
  // Nós não removemos mais totalmente, apenas escondemos/desativamos
  // Mas para manter compatibilidade com limpar tudo:
  const container = document.getElementById("canvasContainer");
  if (overlayElement && container) {
    // Se quiser hard remove:
    // container.removeChild(overlayElement);
    // overlayElement = null;

    // Mas a ideia é persistir. Então vamos apenas limpar a store SE for um reset total.
    // Se for só 'fechar ferramenta', mantemos.
    // A função 'removeSelectionOverlay' é chamada em 'fecharVisualizador' que limpa tudo.
    // Então aqui Sim, removemos.
    if (overlayElement.parentNode === container) {
      container.removeChild(overlayElement);
    }
  }

  overlayElement = null;
  draggingBox = null;
  dimmingPath = null;

  // Limpar listeners
  document.removeEventListener("pointermove", handlePointerMove);
  document.removeEventListener("pointerup", handlePointerUp);

  if (container && scrollListener) {
    container.removeEventListener("scroll", scrollListener);
  }
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}

// --- DRAG AND RESIZE LOGIC ---

function handlePointerDown(e) {
  if (!overlayElement) return;

  // 0. Bloqueio se não tiver grupo ativo
  if (!CropperState.getActiveGroup()) {
    // Talvez piscar a sidebar?
    return;
  }

  const target = e.target;
  const activeGroup = CropperState.getActiveGroup();

  // Coordinates relative to overlay
  const rect = overlayElement.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // 1. Clicked resize handle?
  if (target.classList.contains("resize-handle")) {
    const box = target.parentElement;

    // Check ownership (safety)
    if (!box.classList.contains("is-active-group")) return;

    draggingBox = box;
    currentDragType = target.dataset.handle;
    e.preventDefault();

    initialBoxState = { ...box.__selectionRect };
    dragStartX = e.clientX;
    dragStartY = e.clientY;

    refreshBoxConstraint(box);
  }
  // 2. Clicked existing selection box of ACTIVE group?
  else if (
    (target.classList.contains("selection-box") &&
      target.classList.contains("is-active-group")) ||
    target.closest(".selection-box.is-active-group")
  ) {
    const box = target.classList.contains("selection-box")
      ? target
      : target.closest(".selection-box");

    draggingBox = box;
    currentDragType = DragType.BOX;
    e.preventDefault();

    initialBoxState = { ...box.__selectionRect };
    dragStartX = e.clientX;
    dragStartY = e.clientY;

    refreshBoxConstraint(box);
  }
  // 3. Clicked empty space -> Create new box
  else {
    // 3a. CHECK: Start strictly inside a page?
    const elements = document.elementsFromPoint(e.clientX, e.clientY);
    const pageEl = elements.find((el) => el.classList.contains("pdf-page"));

    if (!pageEl) return;

    // CHECK CONSTRAINT
    if (CropperState.pageConstraint) {
      const clickedPageNum = parseInt(pageEl.dataset.pageNum);
      if (clickedPageNum !== CropperState.pageConstraint.pageNum) {
        // Feedback visual (shake? alert?)
        // Por enquanto, apenas bloqueia
        return;
      }
    }

    currentDragType = DragType.CREATE;
    e.preventDefault();

    creationStartX = x;
    creationStartY = y;

    // Criar caixa temporária
    const newBox = createSelectionBoxDOM(true); // true = active
    overlayElement.appendChild(newBox);
    draggingBox = newBox;

    const pRect = pageEl.getBoundingClientRect();
    const oRect = overlayElement.getBoundingClientRect();
    newBox.__constraint = {
      left: pRect.left - oRect.left,
      top: pRect.top - oRect.top,
      right: pRect.right - oRect.left,
      bottom: pRect.bottom - oRect.top,
      width: pRect.width,
      height: pRect.height,
    };

    updateSelectionBox(newBox, creationStartX, creationStartY, 0, 0);
  }

  overlayElement.setPointerCapture(e.pointerId);
  updateDimmingMask();
}

function refreshBoxConstraint(box) {
  if (!box || !box.__selectionRect) return;
  // Find page based on center of box
  const boxRect = box.getBoundingClientRect();
  const centerX = boxRect.left + boxRect.width / 2;
  const centerY = boxRect.top + boxRect.height / 2;

  const elements = document.elementsFromPoint(centerX, centerY);
  const pageEl = elements.find((el) => el.classList.contains("pdf-page"));

  if (pageEl && overlayElement) {
    const pRect = pageEl.getBoundingClientRect();
    const oRect = overlayElement.getBoundingClientRect();
    box.__constraint = {
      left: pRect.left - oRect.left,
      top: pRect.top - oRect.top,
      right: pRect.right - oRect.left,
      bottom: pRect.bottom - oRect.top,
      width: pRect.width,
      height: pRect.height,
    };
  }
}

function handlePointerMove(e) {
  if (currentDragType === DragType.NONE || !overlayElement) return;

  if (rafId) return;

  rafId = requestAnimationFrame(() => {
    rafId = null;
    if (!overlayElement) return;

    const rect = overlayElement.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (currentDragType === DragType.CREATE) {
      if (!draggingBox) return;

      let left = Math.min(mouseX, creationStartX);
      let top = Math.min(mouseY, creationStartY);
      let width = Math.abs(mouseX - creationStartX);
      let height = Math.abs(mouseY - creationStartY);

      if (draggingBox.__constraint) {
        const c = draggingBox.__constraint;
        let curX = mouseX;
        let curY = mouseY;
        if (curX < c.left) curX = c.left;
        if (curX > c.right) curX = c.right;
        if (curY < c.top) curY = c.top;
        if (curY > c.bottom) curY = c.bottom;

        left = Math.min(curX, creationStartX);
        top = Math.min(curY, creationStartY);
        width = Math.abs(curX - creationStartX);
        height = Math.abs(curY - creationStartY);
      }

      updateSelectionBox(draggingBox, left, top, width, height);
    } else {
      if (!initialBoxState || !draggingBox) return;

      const deltaX = e.clientX - dragStartX;
      const deltaY = e.clientY - dragStartY;

      let newLeft = initialBoxState.left;
      let newTop = initialBoxState.top;
      let newWidth = initialBoxState.width;
      let newHeight = initialBoxState.height;

      if (currentDragType === DragType.BOX) {
        newLeft += deltaX;
        newTop += deltaY;
      } else {
        const type = currentDragType;
        if (type.includes("e")) newWidth += deltaX;
        if (type.includes("w")) {
          newLeft += deltaX;
          newWidth -= deltaX;
        }
        if (type.includes("s")) newHeight += deltaY;
        if (type.includes("n")) {
          newTop += deltaY;
          newHeight -= deltaY;
        }
      }

      if (newWidth < 10) newWidth = 10;
      if (newHeight < 10) newHeight = 10;

      // --- CONSTRAINT APPLICATION ---
      if (draggingBox && draggingBox.__constraint) {
        const c = draggingBox.__constraint;
        if (newLeft < c.left) newLeft = c.left;
        if (newTop < c.top) newTop = c.top;

        if (newLeft + newWidth > c.right) {
          if (currentDragType === DragType.BOX) {
            newLeft = c.right - newWidth;
            if (newLeft < c.left) {
              newLeft = c.left;
              newWidth = c.right - c.left;
            }
          } else {
            newWidth = c.right - newLeft;
          }
        }

        if (newTop + newHeight > c.bottom) {
          if (currentDragType === DragType.BOX) {
            newTop = c.bottom - newHeight;
            if (newTop < c.top) {
              newTop = c.top;
              newHeight = c.bottom - c.top;
            }
          } else {
            newHeight = c.bottom - newTop;
          }
        }
      }

      updateSelectionBox(draggingBox, newLeft, newTop, newWidth, newHeight);
    }
    updateDimmingMask();
  });
}

function handlePointerUp(e) {
  if (currentDragType !== DragType.NONE) {
    // CRIACAO NOVO CROP
    if (currentDragType === DragType.CREATE && draggingBox) {
      const rect = draggingBox.__selectionRect;
      if (!rect || rect.width < 5 || rect.height < 5) {
        draggingBox.remove();
        draggingBox = null;
      } else {
        // SALVAR NO ESTADO
        const anchorData = calculateAnchor(draggingBox, rect);
        if (anchorData) {
          // Adiciona ao estado (que vai disparar refreshOverlayPosition e recriar o box corretamente)
          CropperState.addCropToActiveGroup({ anchorData });

          // Remove o DOM temporário (o refresh o trará de volta como permanente)
          draggingBox.remove();
        } else {
          draggingBox.remove();
        }
      }
    }
    // EDICAO DE EXISTENTE
    else if (draggingBox) {
      // Se tem cropId (veio do render ou já persistido), atualizamos
      const cropId = draggingBox.dataset.cropId;
      const rect = draggingBox.__selectionRect;

      if (cropId && rect) {
        // Precisamos recalcular o anchorData
        const anchorData = calculateAnchor(draggingBox, rect);
        if (anchorData) {
          // Converte string para number se necessário, dependendo de como foi salvo
          // Date.now() + Math.random() cria number, mas dataset vira string.
          // Vamos tratar comparar frouxamente ou converter.
          // Melhor passar como está e o findIndex lidar (mas dataset é string).
          // No addCrop fizemos: cropData.id = ... (number)
          // Então:
          const idNum = parseFloat(cropId);
          CropperState.updateCrop(idNum, anchorData);
        }
      }

      draggingBox.remove();
    }

    currentDragType = DragType.NONE;
    initialBoxState = null;
    draggingBox = null;

    if (overlayElement) overlayElement.releasePointerCapture(e.pointerId);

    // Força refresh para garantir sincronia
    updateDimmingMask();
  }
}

function updateSelectionBox(box, left, top, w, h) {
  if (!box) return;
  box.style.left = `${left}px`;
  box.style.top = `${top}px`;
  box.style.width = `${w}px`;
  box.style.height = `${h}px`;
  box.__selectionRect = { left, top, width: w, height: h };
}

// --- CALCULO ANCORA ---

function calculateAnchor(box, currentRect) {
  const container = document.getElementById("canvasContainer");
  const boxLeft = currentRect.left;
  const boxTop = currentRect.top;
  const boxCX = boxLeft + currentRect.width / 2;
  const boxCY = boxTop + currentRect.height / 2;

  const pages = Array.from(container.querySelectorAll(".pdf-page"));
  let bestPage = null;

  for (const page of pages) {
    const pTop = page.offsetTop;
    const pHeight = page.offsetHeight;
    const pBottom = pTop + pHeight;

    if (boxCY >= pTop && boxCY <= pBottom) {
      bestPage = page;
      break;
    }
  }

  if (!bestPage) return null;

  const currentScale = viewerState.pdfScale;
  const relativeTop = (boxTop - bestPage.offsetTop) / currentScale;
  const relativeLeft = (boxLeft - bestPage.offsetLeft) / currentScale;
  const unscaledW = currentRect.width / currentScale;
  const unscaledH = currentRect.height / currentScale;

  return {
    anchorPageNum: parseInt(bestPage.dataset.pageNum),
    relativeTop,
    relativeLeft,
    unscaledW,
    unscaledH,
  };
}

// --- RENDERIZADOR PRINCIPAL ---

export function refreshOverlayPosition() {
  const container = document.getElementById("canvasContainer");
  if (!overlayElement || !viewerState.pdfDoc || !container) return;

  if (overlayElement.parentNode !== container) {
    container.appendChild(overlayElement);
  }

  updateOverlayDimensions();

  // 1. Limpar boxes existentes do DOM
  const existingBoxes = Array.from(
    overlayElement.querySelectorAll(".selection-box")
  );
  existingBoxes.forEach((b) => {
    // Se for o que estamos arrastando agora, NÃO REMOVE
    // (Para permitir update suave enquanto o subscribe é chamado)
    if (b !== draggingBox) {
      b.remove();
    }
  });

  // 2. Pegar estado
  const allCrops = CropperState.getAllCrops();
  const currentScale = viewerState.pdfScale;

  allCrops.forEach((crop) => {
    // Se for o crop que estamos criando/arrastando ID match?
    // Não temos match de ID ainda no draggingBox.
    // Simplesmente renderiza todos que estão no STORE. O draggingBox temporário é extra-store.

    const anchorData = crop.anchorData;
    const anchorPage = document.getElementById(
      `page-wrapper-${anchorData.anchorPageNum}`
    );
    if (!anchorPage) return; // Pagina não renderizada

    const newLeft =
      anchorPage.offsetLeft + anchorData.relativeLeft * currentScale;
    const newTop = anchorPage.offsetTop + anchorData.relativeTop * currentScale;
    const newWidth = anchorData.unscaledW * currentScale;
    const newHeight = anchorData.unscaledH * currentScale;

    if (newHeight < 1 || newWidth < 1) return;

    const box = createSelectionBoxDOM(crop.isActiveGroup);
    updateSelectionBox(box, newLeft, newTop, newWidth, newHeight);

    // Add status class
    if (crop.status === "verified") {
      box.classList.add("status-verified");
    } else if (crop.status === "draft") {
      // box.classList.add("status-draft"); // Optional, default is ok
    }

    // Armazena ID para futuro (edição)
    box.dataset.cropId = crop.id;
    box.dataset.groupId = crop.groupId;

    overlayElement.appendChild(box);
  });

  updateDimmingMask();
}

/**
 * Updates the SVG path
 */
function updateDimmingMask() {
  if (!dimmingPath || !overlayElement) return;

  const w = Math.max(overlayElement.offsetWidth, 100);
  const h = Math.max(overlayElement.offsetHeight, 100);

  // Outer rectangle
  let d = `M 0 0 h ${w} v ${h} h -${w} Z `;

  // Create holes
  // Usa o DOM atual (incluindo draggingBox e renderizados)
  const boxes = overlayElement.querySelectorAll(".selection-box");
  boxes.forEach((box) => {
    if (box.style.display === "none") return;
    const bx = parseFloat(box.style.left) || 0;
    const by = parseFloat(box.style.top) || 0;
    const bw = parseFloat(box.style.width) || 0;
    const bh = parseFloat(box.style.height) || 0;

    if (bw > 0 && bh > 0) {
      d += `M ${bx} ${by} h ${bw} v ${bh} h -${bw} Z `;
    }
  });

  dimmingPath.setAttribute("d", d);
}

// Função legada/compatibilidade para pegar a imagem 'atual' (última do grupo ativo)
export async function extractImageFromSelection() {
  const activeGroup = CropperState.getActiveGroup();
  if (!activeGroup || activeGroup.crops.length === 0) {
    return null;
  }
  // Pega o último crop adicionado (suposição de fluxo linear de recorte único por vez no botão de confirmar)
  const lastCrop = activeGroup.crops[activeGroup.crops.length - 1];
  return await extractImageFromCropData(lastCrop.anchorData);
}

// Necessário para exportar porem usar lógica nova (extração baseada em crop data)
export async function extractImageFromCropData(anchorData) {
  const container = document.getElementById("canvasContainer");
  const currentScale = viewerState.pdfScale;

  // Reconstruir coordenadas atuais
  const anchorPage = document.getElementById(
    `page-wrapper-${anchorData.anchorPageNum}`
  );
  if (!anchorPage) return null; // Pagina nao visivel

  const x = anchorPage.offsetLeft + anchorData.relativeLeft * currentScale;
  const y = anchorPage.offsetTop + anchorData.relativeTop * currentScale;
  const width = anchorData.unscaledW * currentScale;
  const height = anchorData.unscaledH * currentScale;

  // Lógica de canvas drawImage
  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = width;
  finalCanvas.height = height;
  const ctx = finalCanvas.getContext("2d");
  const pages = Array.from(container.querySelectorAll(".pdf-page"));

  // Mesma lógica de interseção de extractImageFromSelection original
  for (const pageWrapper of pages) {
    const pLeft = pageWrapper.offsetLeft;
    const pTop = pageWrapper.offsetTop;
    const pWidth = pageWrapper.offsetWidth;
    const pHeight = pageWrapper.offsetHeight;

    const x_overlap = Math.max(
      0,
      Math.min(x + width, pLeft + pWidth) - Math.max(x, pLeft)
    );
    const y_overlap = Math.max(
      0,
      Math.min(y + height, pTop + pHeight) - Math.max(y, pTop)
    );

    if (x_overlap > 0 && y_overlap > 0) {
      const sourceX = Math.max(0, x - pLeft);
      const sourceY = Math.max(0, y - pTop);
      const destX = Math.max(0, pLeft - x);
      const destY = Math.max(0, pTop - y);
      const drawW = Math.min(width - destX, pWidth - sourceX);
      const drawH = Math.min(height - destY, pHeight - sourceY);

      try {
        const pageNum = parseInt(pageWrapper.dataset.pageNum);
        const pageCanvasOnScreen = document.getElementById(
          `page-canvas-${pageNum}`
        );
        if (pageCanvasOnScreen) {
          const pRatio =
            pageCanvasOnScreen.width / pageCanvasOnScreen.clientWidth;
          ctx.drawImage(
            pageCanvasOnScreen,
            sourceX * pRatio,
            sourceY * pRatio,
            drawW * pRatio,
            drawH * pRatio,
            destX,
            destY,
            drawW,
            drawH
          );
        }
      } catch (err) {}
    }
  }

  return new Promise((resolve) => {
    finalCanvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      resolve(url);
    }, "image/png");
  });
}
