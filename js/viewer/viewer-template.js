/**
 * Retorna a string HTML completa do visualizador.
 * Recebe 'args' para preencher dados dinâmicos como o título.
 * NOTA: Todos os onclicks foram removidos e substituídos por IDs.
 */
export function montarTemplateViewer(args) {
  return `
    <div id="pdfViewerContainer" class="fade-in">
        <header id="viewerHeader">
            <div class="header-left">
                <img src="logo.png" class="header-logo" alt="Logo">
                <span class="header-title">Maia.api - ${args.rawTitle}</span>
            </div>

            <div class="header-actions">
                <button id="btnFecharViewer" class="btn btn--sm btn--secondary">✕ Fechar</button>
            </div>
        </header>

        <!-- MOBILE MENU BUTTON (Visible only on <= 900px) -->
        <div id="mobileHeaderContainer" class="mobile-only">
             <button id="btnMobileMenu" class="mobile-fab-menu">☰</button>
        </div>

        <!-- MOBILE DROPDOWN OPTIONS -->
        <div id="mobileMenuOptions" class="mobile-dropdown hidden">
            <button class="mobile-menu-item" id="optMobileNav">Navegação</button>
            <button class="mobile-menu-item" id="optMobileZoom">Zoom</button>
            <button class="mobile-menu-item" id="optMobileRecortar">Recortar</button>
            <button class="mobile-menu-item" id="optMobileFechar">✕ Fechar PDF</button>
        </div>

        <!-- FLOATING CONTROL PANELS (Initially Hidden) -->
        
        <!-- NAVIGATION PANEL -->
        <div id="mobileNavPanel" class="floating-glass-panel hidden">
             <div class="control-row mobile-control-row">
                <button id="btnPrevMobile" class="btn-icon">◀</button>
                <span id="pageNumMobile">Pag 1</span>
                <button id="btnNextMobile" class="btn-icon">▶</button>
             </div>
             <button class="panel-close-btn" onclick="this.parentElement.classList.add('hidden')">✕</button>
        </div>

        <!-- 3. ZOOM PANEL (Separated) -->
        <div id="mobileZoomPanel" class="floating-glass-panel hidden">
             <div class="control-row mobile-control-row">
                <button id="btnZoomOutMobile" class="btn-icon">-</button>
                <span id="zoomLevelMobile">100%</span>
                <button id="btnZoomInMobile" class="btn-icon">+</button>
             </div>
             <button class="panel-close-btn" onclick="this.parentElement.classList.add('hidden')">✕</button>
        </div>


        <div id="viewerBody">
            <!-- SIDEBAR (Panel) -->
            <aside id="viewerSidebar">
                <!-- Conteúdo será injetado via JS (sidebar-cropper.js) -->
            </aside>
            
            <!-- RESIZER HANDLE -->
            <div id="sidebarResizer"></div>

            <main id="viewerMain">
                <section class="pdf-panel" id="panelProva">
                    <div class="panel-label">
                        <div class="pdf-controls-box">
                            <label class="control-label">Navegação</label>
                            <div class="control-row">
                                <button id="btn-prev" class="btn-icon">◀</button>
                                <span id="page_num">Pag 1</span>
                                <button id="btn-next" class="btn-icon">▶</button>
                            </div>
                        </div>
                        <div class="pdf-controls-box">
                            <label class="control-label">Zoom</label>
                            <div class="control-row">
                                <button id="btnZoomOut" class="btn-icon">-</button>
                                <span id="zoom_level">100%</span>
                                <button id="btnZoomIn" class="btn-icon">+</button>
                            </div>
                        </div>
                    </div>

                    <div class="viewer-viewport-wrapper" style="position: relative; flex: 1; overflow: hidden; display: flex; flex-direction: column;">
                        <div id="ai-glow-overlay" class="viewer-glow-overlay"></div>
                        <div id="canvasContainer" class="canvas-wrapper">
                            <!-- Canvas das páginas serão inseridos via JS (renderAllPages) -->
                        </div>
                    </div>
                </section>
            </main>
        </div>

        <div id="floatingActionParams" class="hidden">
            <button id="btnConfirmarRecorte" class="flyingBtn btn--success">✅ Confirmar Seleção</button>
            <button id="btnCancelarRecorte" class="flyingBtn btn--danger">✕ Cancelar</button>
        </div>

        <div id="cropConfirmModal" class="custom-modal-overlay">
            <div class="custom-modal-content">
                <h3 style="margin:0; color: var(--color-text)">Imagens Selecionadas (<span id="countImagens">0</span>)</h3>
                <p style="color: var(--color-text-secondary); font-size: 0.9em;">Revise os recortes antes de enviar.</p>
                
                <div id="cropPreviewGallery" class="crop-preview-gallery">
                </div>

                <div style="display: flex; gap: 10px; margin-top: 10px;">
                    <button id="btnModalMaisRecorte" class="btn btn--secondary" style="flex: 1;">➕ Recortar Outra Parte</button>
                    <button id="btnModalProcessar" class="btn btn--primary" style="flex: 1;">🚀 Processar Tudo</button>
                </div>
                <button id="btnModalCancelarTudo" class="btn btn--sm btn--outline" style="margin-top:10px; border:none; color:#aaa">Cancelar tudo</button>
            </div>
        </div>
    </div>
    `;
}
