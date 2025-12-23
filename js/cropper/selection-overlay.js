import { viewerState } from "../main.js";

/**
 * MODULE: selection-overlay.js
 * Gerencia a camada flutuante que permite selecionar áreas livres através de múltiplas páginas.
 * Versão 4.0: Page-Anchored Positioning (Fix Zoom Issues)
 */

let overlayElement = null;
let selectionBox = null;
let currentSelectionRect = null; // { top, left, width, height } em PIXELS RELATIVOS AO OVERLAY
let storedSelectionData = null;  // Persistence

// Listeners
let resizeObserver = null;
let scrollListener = null;

// Enum
const DragType = {
    NONE: 'none',
    CREATE: 'create',
    BOX: 'box',
    NW: 'nw', NE: 'ne', SW: 'sw', SE: 'se',
    N: 'n', S: 's', W: 'w', E: 'e'
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

    // Atualiza altura e largura total (fix overflow horizontal)
    updateOverlayDimensions();

    // Listeners Robustos (Scroll e Resize)
    scrollListener = () => {
        updateOverlayDimensions();
    };
    container.addEventListener('scroll', scrollListener);

    if (window.ResizeObserver) {
        resizeObserver = new ResizeObserver(() => {
            updateOverlayDimensions();
        });
        resizeObserver.observe(container);
    }

    // RESET STATE
    selectionBox.style.display = 'none';
    overlayElement.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';

    // Limpa seleção anterior
    currentSelectionRect = null;
    storedSelectionData = null;
}

function updateOverlayDimensions() {
    const container = document.getElementById("canvasContainer");
    if (!container || !overlayElement) return;

    const nav = document.getElementById('viewerSidebar');
    // Pequeno hack: garante que pegamos o maior valor possível para cobrir tudo
    const w = Math.max(container.scrollWidth, container.clientWidth);
    const h = Math.max(container.scrollHeight, container.clientHeight);

    overlayElement.style.width = `${w}px`;
    overlayElement.style.height = `${h}px`;
}

function createOverlayDOM(container) {
    overlayElement = document.createElement("div");
    overlayElement.id = "selection-overlay";
    overlayElement.style.position = "absolute";
    overlayElement.style.top = "0";
    overlayElement.style.left = "0";
    overlayElement.style.width = "100%";
    overlayElement.style.zIndex = "999";
    overlayElement.style.backgroundColor = "rgba(0,0,0,0.5)";
    overlayElement.style.touchAction = "none";
    overlayElement.style.cursor = "crosshair";

    selectionBox = document.createElement("div");
    selectionBox.id = "selection-box";
    selectionBox.style.position = "absolute";
    selectionBox.style.display = "none";

    // VISUAL CLÁSSICO
    selectionBox.style.boxShadow = "0 0 0 9999px rgba(0, 0, 0, 0.5)";
    selectionBox.style.border = "1px solid #39f";
    selectionBox.style.cursor = "move";

    const handles = ['nw', 'ne', 'sw', 'se', 'n', 's', 'w', 'e'];
    handles.forEach(h => {
        const el = document.createElement('div');
        el.className = `resize-handle handle-${h}`;
        el.dataset.handle = h;
        el.style.position = "absolute";
        el.style.width = "6px";
        el.style.height = "6px";
        el.style.backgroundColor = "#39f";
        el.style.zIndex = "10";

        if (h.includes('n')) el.style.top = "-3px";
        if (h.includes('s')) el.style.bottom = "-3px";
        if (h.includes('w')) el.style.left = "-3px";
        if (h.includes('e')) el.style.right = "-3px";
        if (h === 'n' || h === 's') el.style.left = "50%", el.style.marginLeft = "-3px";
        if (h === 'w' || h === 'e') el.style.top = "50%", el.style.marginTop = "-3px";

        selectionBox.appendChild(el);
    });

    overlayElement.appendChild(selectionBox);
    container.appendChild(overlayElement);

    overlayElement.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
}

export function removeSelectionOverlay() {
    const container = document.getElementById("canvasContainer");
    if (overlayElement && container) {
        if (overlayElement.parentNode === container) {
            container.removeChild(overlayElement);
        }
    }

    overlayElement = null;
    selectionBox = null;
    currentSelectionRect = null;
    storedSelectionData = null;

    document.removeEventListener('pointermove', handlePointerMove);
    document.removeEventListener('pointerup', handlePointerUp);

    if (container && scrollListener) {
        container.removeEventListener('scroll', scrollListener);
    }
    if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
    }
}

// --- LÓGICA DE DRAG E RESIZE ---

function handlePointerDown(e) {
    if (!overlayElement) return;

    const target = e.target;
    const rect = overlayElement.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (target.classList.contains('resize-handle')) {
        if (selectionBox.style.display === 'none') return;
        currentDragType = target.dataset.handle;
        e.preventDefault();

        initialBoxState = { ...currentSelectionRect };
        dragStartX = e.clientX;
        dragStartY = e.clientY;

    } else if (target === selectionBox || selectionBox.contains(target)) {
        currentDragType = DragType.BOX;
        e.preventDefault();

        initialBoxState = { ...currentSelectionRect };
        dragStartX = e.clientX;
        dragStartY = e.clientY;

    } else {
        // CREATE
        currentDragType = DragType.CREATE;
        e.preventDefault();

        creationStartX = x;
        creationStartY = y;

        overlayElement.style.backgroundColor = 'transparent';
        selectionBox.style.display = 'block';
        updateSelectionBox(creationStartX, creationStartY, 0, 0);
    }

    overlayElement.setPointerCapture(e.pointerId);
}

function handlePointerMove(e) {
    if (currentDragType === DragType.NONE || !overlayElement) return;

    const rect = overlayElement.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (currentDragType === DragType.CREATE) {
        const width = Math.abs(mouseX - creationStartX);
        const height = Math.abs(mouseY - creationStartY);
        const left = Math.min(mouseX, creationStartX);
        const top = Math.min(mouseY, creationStartY);

        updateSelectionBox(left, top, width, height);

    } else {
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
            if (type.includes('e')) newWidth += deltaX;
            if (type.includes('w')) { newLeft += deltaX; newWidth -= deltaX; }
            if (type.includes('s')) newHeight += deltaY;
            if (type.includes('n')) { newTop += deltaY; newHeight -= deltaY; }
        }

        if (newWidth < 10) newWidth = 10;
        if (newHeight < 10) newHeight = 10;

        const containerW = overlayElement.clientWidth;
        if (newLeft < 0) newLeft = 0;
        if (newTop < 0) newTop = 0;
        if (newLeft + newWidth > containerW) {
            if (currentDragType === DragType.BOX) newLeft = containerW - newWidth;
            else newWidth = containerW - newLeft;
        }

        updateSelectionBox(newLeft, newTop, newWidth, newHeight);
    }
}

function handlePointerUp(e) {
    if (currentDragType !== DragType.NONE) {
        if (currentDragType === DragType.CREATE) {
            if (currentSelectionRect.width < 5 || currentSelectionRect.height < 5) {
                selectionBox.style.display = 'none';
                overlayElement.style.backgroundColor = 'rgba(0,0,0,0.5)';
                currentSelectionRect = null;
            }
        }

        currentDragType = DragType.NONE;
        saveSelectionState(); // MODIFICADO: Salva ancorado na página
        if (overlayElement) overlayElement.releasePointerCapture(e.pointerId);
    }
}

function updateSelectionBox(left, top, w, h) {
    if (!selectionBox) return;
    selectionBox.style.left = `${left}px`;
    selectionBox.style.top = `${top}px`;
    selectionBox.style.width = `${w}px`;
    selectionBox.style.height = `${h}px`;

    currentSelectionRect = { left, top, width: w, height: h };
}

// --- PERSISTÊNCIA ANCORADA EM PÁGINA (ZOOM FIX) ---

function saveSelectionState() {
    if (!currentSelectionRect || !overlayElement || selectionBox.style.display === 'none') return;

    // Encontra qual página está "embaixo" do topo da seleção
    const container = document.getElementById("canvasContainer");

    // Coordenada Y absoluta dentro do container.
    // currentSelectionRect.top é relativo ao overlay (que tem height = scrollHeight)
    // Então Y real da seleção = currentSelectionRect.top
    const selectionRealY = currentSelectionRect.top;
    const selectionRealX = currentSelectionRect.left;

    // Acha a página mais próxima
    const pages = Array.from(container.querySelectorAll('.pdf-page'));
    let anchorPage = null;

    // Procuramos a primeira página cujo 'bottom' é maior que o 'top' da seleção
    // Isso significa que a seleção começa dentro ou depois dessa página
    for (const page of pages) {
        // offsetTop é relativo ao container
        if (selectionRealY >= page.offsetTop && selectionRealY < (page.offsetTop + page.offsetHeight)) {
            anchorPage = page;
            break;
        }
        // Se a seleção começa antes da página (no gap?), pega a anterior ou essa mesmo
    }

    if (!anchorPage && pages.length > 0) {
        // Fallback: Se não achou (ex: clicou no gap), pega a página mais próxima pelo topo
        anchorPage = pages.find(p => p.offsetTop > selectionRealY) || pages[pages.length - 1];
    }

    if (!anchorPage) return; // Não tem página, abortar persistência

    // Calcula coordenadas relativas à PÁGINA ANCORA, e desnormalizadas da escala
    const currentScale = viewerState.pdfScale;

    // Distância do topo da seleção para o topo da página âncora
    const relativeTop = (selectionRealY - anchorPage.offsetTop) / currentScale;

    // Distância da esquerda da seleção para a esquerda da página (margem?) ou esquerda do container?
    // As páginas estão centralizadas margin: 0 auto.
    // rect.left do pageWrapper varia se resize window.
    // offsetLeft do pageWrapper varia.
    // Então devemos guardar relativo ao offsetLeft da página.
    const relativeLeft = (selectionRealX - anchorPage.offsetLeft) / currentScale;

    // Largura e altura desnormalizadas
    const unscaledW = currentSelectionRect.width / currentScale;
    const unscaledH = currentSelectionRect.height / currentScale;

    storedSelectionData = {
        anchorPageNum: parseInt(anchorPage.dataset.pageNum),
        relativeTop,
        relativeLeft,
        unscaledW,
        unscaledH
    };
}

export function refreshOverlayPosition() {
    const container = document.getElementById("canvasContainer");
    if (!overlayElement || !viewerState.pdfDoc || !container) return;

    // Reinsere overlay se necessário
    if (overlayElement.parentNode !== container) {
        if (selectionBox.style.display !== 'none') {
            container.appendChild(overlayElement);
        } else {
            return;
        }
    }

    updateOverlayDimensions(); // Usa a nova função centralizada

    if (!storedSelectionData || selectionBox.style.display === 'none') return;

    // Recupera página âncora
    const anchorPage = document.getElementById(`page-wrapper-${storedSelectionData.anchorPageNum}`);
    if (!anchorPage) return; // Página não existe (ainda?), abortar

    const currentScale = viewerState.pdfScale;

    // Recalcula posição absoluta baseada na nova posição da página
    const newLeft = anchorPage.offsetLeft + (storedSelectionData.relativeLeft * currentScale);
    const newTop = anchorPage.offsetTop + (storedSelectionData.relativeTop * currentScale);
    const newWidth = storedSelectionData.unscaledW * currentScale;
    const newHeight = storedSelectionData.unscaledH * currentScale;

    updateSelectionBox(newLeft, newTop, newWidth, newHeight);

    // Restaura opacidade (Sync com layout frame)
    requestAnimationFrame(() => {
        if (selectionBox) selectionBox.style.opacity = '1';
        overlayElement.style.opacity = '1';
    });
}

export function hideOverlayDuringRender() {
    // MODIFICADO: Não esconde o overlay (fundo escuro), apenas a caixa de seleção para evitar "pulos"
    if (selectionBox) selectionBox.style.opacity = '0';
}


/**
 * Capture Logic - Mantém a mesma
 */
export async function extractImageFromSelection() {
    if (!currentSelectionRect || selectionBox.style.display === 'none') return null;

    const container = document.getElementById("canvasContainer");
    const { left: x, top: y, width, height } = currentSelectionRect;

    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = width;
    finalCanvas.height = height;
    const ctx = finalCanvas.getContext('2d');
    const pages = Array.from(container.querySelectorAll('.pdf-page'));
    let intersected = false;

    for (const pageWrapper of pages) {
        const pLeft = pageWrapper.offsetLeft;
        const pTop = pageWrapper.offsetTop;
        const pWidth = pageWrapper.offsetWidth;
        const pHeight = pageWrapper.offsetHeight;

        const x_overlap = Math.max(0, Math.min(x + width, pLeft + pWidth) - Math.max(x, pLeft));
        const y_overlap = Math.max(0, Math.min(y + height, pTop + pHeight) - Math.max(y, pTop));

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
                const pageCanvasOnScreen = document.getElementById(`page-canvas-${pageNum}`);
                if (pageCanvasOnScreen) {
                    const pRatio = pageCanvasOnScreen.width / pageCanvasOnScreen.clientWidth;
                    ctx.drawImage(
                        pageCanvasOnScreen,
                        sourceX * pRatio, sourceY * pRatio, drawW * pRatio, drawH * pRatio,
                        destX, destY, drawW, drawH
                    );
                }
            } catch (err) { }
        }
    }

    if (!intersected) return null;
    return new Promise(resolve => {
        finalCanvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            resolve(url);
        }, 'image/png');
    });
}
