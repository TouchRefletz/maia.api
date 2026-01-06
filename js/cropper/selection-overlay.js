import { viewerState } from "../main.js";

/**
 * MODULE: selection-overlay.js
 * Gerencia a camada flutuante que permite selecionar áreas livres através de múltiplas páginas.
 * Versão 5.0: Multiple Selections Support
 */

let overlayElement = null;
let activeSelectionBox = null;
// Removed singleton selectionBox, currentSelectionRect, storedSelectionData
// State is now managed within each selection box DOM element

// Listeners
let resizeObserver = null;
let scrollListener = null;
let rafId = null; // Throttling for pointer move
let dimmingPath = null; // SVG Path element

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
  }

  // Atualiza altura e largura total
  updateOverlayDimensions();

  // Listeners Robustos
  scrollListener = () => {
    updateOverlayDimensions();
  };
  container.addEventListener("scroll", scrollListener);

  if (window.ResizeObserver) {
    resizeObserver = new ResizeObserver(() => {
      updateOverlayDimensions();
    });
    resizeObserver.observe(container);
  }

  // RESET STATE
  // overlayElement.style.backgroundColor = "rgba(0, 0, 0, 0.5)"; // REMOVED: Using SVG now
  updateDimmingMask();
  activeSelectionBox = null;
}

function updateOverlayDimensions() {
  const container = document.getElementById("canvasContainer");
  if (!container || !overlayElement) return;

  // Pequeno hack: garante que pegamos o maior valor possível para cobrir tudo
  const w = Math.max(container.scrollWidth, container.clientWidth);
  const h = Math.max(container.scrollHeight, container.clientHeight);

  // LOOP PROTECTION: Only update if changed
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
  overlayElement.style.backgroundColor = "transparent"; // Changed for SVG approach
  overlayElement.style.touchAction = "none";
  overlayElement.style.cursor = "crosshair";

  // SVG Mask Layer
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.style.position = "absolute";
  svg.style.top = "0";
  svg.style.left = "0";
  svg.style.width = "100%";
  svg.style.height = "100%";
  svg.style.pointerEvents = "none"; // Let clicks pass through to div/boxes

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

function createSelectionBoxDOM() {
  const box = document.createElement("div");
  box.className = "selection-box";
  box.style.position = "absolute";

  // VISUAL: Multi-selection friendly (no giant box-shadow)
  box.style.border = "2px solid #39f";
  box.style.cursor = "move";
  box.style.backgroundColor = "rgba(51, 153, 255, 0.1)"; // Slight blue tint

  const handles = ["nw", "ne", "sw", "se", "n", "s", "w", "e"];
  handles.forEach((h) => {
    const el = document.createElement("div");
    el.className = `resize-handle handle-${h}`;
    el.dataset.handle = h;
    el.style.position = "absolute";
    el.style.width = "8px";
    el.style.height = "8px";
    el.style.backgroundColor = "#39f";
    el.style.zIndex = "10";

    if (h.includes("n")) el.style.top = "-5px";
    if (h.includes("s")) el.style.bottom = "-5px";
    if (h.includes("w")) el.style.left = "-5px";
    if (h.includes("e")) el.style.right = "-5px";
    if (h === "n" || h === "s")
      ((el.style.left = "50%"), (el.style.marginLeft = "-4px"));
    if (h === "w" || h === "e")
      ((el.style.top = "50%"), (el.style.marginTop = "-4px"));

    // Specific cursor for each handle to avoid confusion with move or create
    let cursorStyle = "pointer";
    if (h === "nw" || h === "se") cursorStyle = "nwse-resize";
    else if (h === "ne" || h === "sw") cursorStyle = "nesw-resize";
    else if (h === "n" || h === "s") cursorStyle = "ns-resize";
    else if (h === "w" || h === "e") cursorStyle = "ew-resize";

    el.style.cursor = cursorStyle;

    box.appendChild(el);
  });

  return box;
}

export function removeSelectionOverlay() {
  const container = document.getElementById("canvasContainer");
  if (overlayElement && container) {
    if (overlayElement.parentNode === container) {
      container.removeChild(overlayElement);
    }
  }

  overlayElement = null;
  activeSelectionBox = null;
  dimmingPath = null;
  // Cleared implicitly by removing overlayElement

  document.removeEventListener("pointermove", handlePointerMove);
  document.removeEventListener("pointerup", handlePointerUp);

  if (container && scrollListener) {
    container.removeEventListener("scroll", scrollListener);
  }
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
}

// --- DRAG AND RESIZE LOGIC ---

function handlePointerDown(e) {
  if (!overlayElement) return;

  const target = e.target;
  // Coordinates relative to overlay
  const rect = overlayElement.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // 1. Clicked resize handle?
  if (target.classList.contains("resize-handle")) {
    const box = target.parentElement;
    setActiveBox(box);

    currentDragType = target.dataset.handle;
    e.preventDefault();

    initialBoxState = { ...box.__selectionRect };
    dragStartX = e.clientX;
    dragStartY = e.clientY;

    refreshBoxConstraint(box);
  }
  // 2. Clicked existing selection box?
  else if (
    target.classList.contains("selection-box") ||
    target.closest(".selection-box")
  ) {
    const box = target.classList.contains("selection-box")
      ? target
      : target.closest(".selection-box");
    setActiveBox(box);

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

    if (!pageEl) {
      // Clicked outside any page (gap or margin) -> Ignore
      return;
    }

    currentDragType = DragType.CREATE;
    e.preventDefault();

    creationStartX = x;
    creationStartY = y;

    // Make overlay transparent as soon as we start creating boxes
    overlayElement.style.backgroundColor = "transparent";

    const newBox = createSelectionBoxDOM();
    overlayElement.appendChild(newBox);
    setActiveBox(newBox);

    // STORE CONSTRAINT (Page Bounds relative to Overlay)
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

    // Initial update
    updateSelectionBox(newBox, creationStartX, creationStartY, 0, 0);
  }

  overlayElement.setPointerCapture(e.pointerId);
  updateDimmingMask(); // Force update on click
}

function setActiveBox(box) {
  activeSelectionBox = box;
  // Bring to front
  if (box.parentElement) {
    box.parentElement.appendChild(box);
  }
}

// Helper to refresh constraint for existing boxes (in case page moved or just to be safe)
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

  // THROTTLING to prevent softlock/performance issues
  if (rafId) return;

  rafId = requestAnimationFrame(() => {
    rafId = null;

    // Safety check if overlay was removed in between frames
    if (!overlayElement) return;

    const rect = overlayElement.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (currentDragType === DragType.CREATE) {
      if (!activeSelectionBox) return;

      let left = Math.min(mouseX, creationStartX);
      let top = Math.min(mouseY, creationStartY);
      let width = Math.abs(mouseX - creationStartX);
      let height = Math.abs(mouseY - creationStartY);

      // CONSTRAINT FOR CREATION
      if (activeSelectionBox.__constraint) {
        const c = activeSelectionBox.__constraint;

        // Clamp "start" logic is tricky because startX/Y might be valid,
        // but mouseX might be out of bounds.

        // Clamp current mouse position first
        let curX = mouseX;
        let curY = mouseY;

        if (curX < c.left) curX = c.left;
        if (curX > c.right) curX = c.right;
        if (curY < c.top) curY = c.top;
        if (curY > c.bottom) curY = c.bottom;

        // Re-calculate rect from clamped mouse to original start
        // Note: creationStartX/Y should be inside because we checked on PointerDown

        left = Math.min(curX, creationStartX);
        top = Math.min(curY, creationStartY);
        width = Math.abs(curX - creationStartX);
        height = Math.abs(curY - creationStartY);
      }

      updateSelectionBox(activeSelectionBox, left, top, width, height);
    } else {
      if (!initialBoxState || !activeSelectionBox) return;

      // Calculate logic identical to before
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
      if (activeSelectionBox && activeSelectionBox.__constraint) {
        const c = activeSelectionBox.__constraint;

        // Clamp to Page Bounds
        // 1. Clamp Left/Top
        if (newLeft < c.left) newLeft = c.left;
        if (newTop < c.top) newTop = c.top;

        // 2. Clamp Right/Bottom (adjust width/height based on clamped top/left)
        if (newLeft + newWidth > c.right) {
          // If we are moving (BOX), prevent moving past right edge
          if (currentDragType === DragType.BOX) {
            newLeft = c.right - newWidth;
            // Double check left
            if (newLeft < c.left) {
              newLeft = c.left;
              newWidth = c.right - c.left; // Shrink if bigger than page (unlikely)
            }
          } else {
            // Resizing
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
      } else {
        // Fallback safety (Viewport/Container bounds)
        if (newLeft < 0) newLeft = 0;
        if (newTop < 0) newTop = 0;
      }

      updateSelectionBox(
        activeSelectionBox,
        newLeft,
        newTop,
        newWidth,
        newHeight
      );
    }

    // Always update mask during drag
    updateDimmingMask();
  });
}

function handlePointerUp(e) {
  if (currentDragType !== DragType.NONE) {
    if (currentDragType === DragType.CREATE && activeSelectionBox) {
      const rect = activeSelectionBox.__selectionRect;
      // Remove if too small (accidental click)
      if (!rect || rect.width < 5 || rect.height < 5) {
        activeSelectionBox.remove();
        activeSelectionBox = null;

        // If no boxes left, restore dark background
        if (overlayElement.children.length === 0) {
          // No need to set background color, mask handles it
        }
      }
      updateDimmingMask();
    }

    currentDragType = DragType.NONE;

    if (activeSelectionBox) {
      saveSelectionState(activeSelectionBox);
    }

    if (overlayElement) overlayElement.releasePointerCapture(e.pointerId);
  }
}

function updateSelectionBox(box, left, top, w, h) {
  if (!box) return;
  box.style.left = `${left}px`;
  box.style.top = `${top}px`;
  box.style.width = `${w}px`;
  box.style.height = `${h}px`;

  // Store rect state on the DOM element
  box.__selectionRect = { left, top, width: w, height: h };
  // Visual update of mask
  // We don't call updateDimmingMask here to avoid thrashing during simple programmatic updates if not needed,
  // but for drag it is needed. rely on caller or add it here?
  // safer to add it here but debounce? For now direct call is fine with RAF in move handler.
}

// --- PERSISTENCE & ZOOM FIX ---

function saveSelectionState(box) {
  if (!box || !box.__selectionRect) return;

  const currentRect = box.__selectionRect;
  const container = document.getElementById("canvasContainer");

  // Coordenadas absolutas da seleção dentro do container
  const boxLeft = currentRect.left;
  const boxTop = currentRect.top;
  const boxRight = boxLeft + currentRect.width;
  const boxBottom = boxTop + currentRect.height;
  const boxCX = boxLeft + currentRect.width / 2;
  const boxCY = boxTop + currentRect.height / 2;

  const pages = Array.from(container.querySelectorAll(".pdf-page"));
  let bestPage = null;
  let maxIntersectionArea = -1;
  let minDistance = Infinity;
  let fallbackPage = null;

  // 1. Encontrar página âncora baseada no CENTRO do recorte
  // Isso é muito mais estável do que interseção de área para prevenir "pulos" para a página de cima.
  for (const page of pages) {
    const pTop = page.offsetTop;
    const pHeight = page.offsetHeight;
    const pBottom = pTop + pHeight;

    // A página contém o centro Y do recorte?
    // Usamos uma margem de segurança pequena (e.g. 1px) se necessário, mas direto costuma funcionar bem.
    if (boxCY >= pTop && boxCY <= pBottom) {
      bestPage = page;
      break; // Encontrou o dono soberano!
    }

    // Fallback: Distância do centro (caso esteja no gap entre páginas)
    const pCY = pTop + pHeight / 2;
    // Distância vertical apenas é o mais crítico aqui
    const distY = Math.abs(boxCY - pCY);

    if (distY < minDistance) {
      minDistance = distY;
      fallbackPage = page;
    }
  }

  const anchorPage = bestPage || fallbackPage;

  if (!anchorPage) return;

  const currentScale = viewerState.pdfScale;

  // IMPORTANTE: Coordenadas relativas à página âncora
  const relativeTop = (boxTop - anchorPage.offsetTop) / currentScale;
  const relativeLeft = (boxLeft - anchorPage.offsetLeft) / currentScale;
  const unscaledW = currentRect.width / currentScale;
  const unscaledH = currentRect.height / currentScale;

  box.__anchorData = {
    anchorPageNum: parseInt(anchorPage.dataset.pageNum),
    relativeTop,
    relativeLeft,
    unscaledW,
    unscaledH,
  };
}

export function refreshOverlayPosition() {
  const container = document.getElementById("canvasContainer");
  if (!overlayElement || !viewerState.pdfDoc || !container) return;

  if (overlayElement.parentNode !== container) {
    container.appendChild(overlayElement);
  }

  updateOverlayDimensions();

  const boxes = Array.from(overlayElement.querySelectorAll(".selection-box"));
  const currentScale = viewerState.pdfScale;

  if (boxes.length === 0) {
    // handled by updateDimmingMask
  } else {
    overlayElement.style.backgroundColor = "transparent";
  }

  boxes.forEach((box) => {
    // FIX: Se estiver arrastando ESTE box agora, não reposicione ele baseado em dados antigos!
    // Isso evita que ele "pule" de volta para a posição original se um refresh ocorrer durante o arraste.
    if (currentDragType !== DragType.NONE && activeSelectionBox === box) {
      return;
    }

    const data = box.__anchorData;
    if (!data) {
      // Se falta âncora (ex: criado programaticamente sem save), tentamos salvar agora
      saveSelectionState(box);
      if (!box.__anchorData) return; // Se falhou, ignora
    }

    const anchorPage = document.getElementById(
      `page-wrapper-${box.__anchorData.anchorPageNum}`
    );

    // Safety check: Se a página âncora sumiu (ex: filtro de páginas?), mantenha onde está
    if (!anchorPage) return;

    const newLeft =
      anchorPage.offsetLeft + box.__anchorData.relativeLeft * currentScale;
    const newTop =
      anchorPage.offsetTop + box.__anchorData.relativeTop * currentScale;
    const newWidth = box.__anchorData.unscaledW * currentScale;
    const newHeight = box.__anchorData.unscaledH * currentScale;

    // SANITY CHECK: Evita distorções de "linha"
    // Se a altura ficou < 0 ???
    if (newHeight < 1 || newWidth < 1) return;

    updateSelectionBox(box, newLeft, newTop, newWidth, newHeight);
    box.style.opacity = "1";
  });

  overlayElement.style.opacity = "1";
  updateDimmingMask();
}

/**
 * Updates the SVG path to create a dark overlay with "holes" for selection boxes
 */
function updateDimmingMask() {
  if (!dimmingPath || !overlayElement) return;

  const w = Math.max(overlayElement.offsetWidth, 100);
  const h = Math.max(overlayElement.offsetHeight, 100);

  // Outer rectangle (covers entire scrollable area)
  let d = `M 0 0 h ${w} v ${h} h -${w} Z `;

  // Create holes for each box
  const boxes = overlayElement.querySelectorAll(".selection-box");
  boxes.forEach((box) => {
    if (box.style.display === "none") return;

    // We rely on the DOM style for current visual position
    // parsing string "10px" -> 10
    const bx = parseFloat(box.style.left) || 0;
    const by = parseFloat(box.style.top) || 0;
    const bw = parseFloat(box.style.width) || 0;
    const bh = parseFloat(box.style.height) || 0;

    if (bw > 0 && bh > 0) {
      // Inner rectangle (hole)
      // Direction doesn't matter much for 'evenodd', but standard is typically same direction with evenodd
      d += `M ${bx} ${by} h ${bw} v ${bh} h -${bw} Z `;
    }
  });

  dimmingPath.setAttribute("d", d);
}

export function hideOverlayDuringRender() {
  if (!overlayElement) return;
  const boxes = overlayElement.querySelectorAll(".selection-box");
  boxes.forEach((b) => (b.style.opacity = "0"));
}

/**
 * Capture Logic
 */
export async function extractImageFromSelection() {
  // Uses activeSelectionBox, or falls back to last created
  let targetBox = activeSelectionBox;

  if (!targetBox && overlayElement) {
    const boxes = overlayElement.querySelectorAll(".selection-box");
    if (boxes.length > 0) {
      targetBox = boxes[boxes.length - 1];
    }
  }

  if (!targetBox || !targetBox.__selectionRect) return null;

  const container = document.getElementById("canvasContainer");
  const { left: x, top: y, width, height } = targetBox.__selectionRect;

  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = width;
  finalCanvas.height = height;
  const ctx = finalCanvas.getContext("2d");
  const pages = Array.from(container.querySelectorAll(".pdf-page"));
  let intersected = false;

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
      intersected = true;
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

  if (!intersected) return null;
  return new Promise((resolve) => {
    finalCanvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      resolve(url);
    }, "image/png");
  });
}
