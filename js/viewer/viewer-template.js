
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
            <button class="mobile-menu-item" id="optMobileModo">Alternar Modo</button>
            <button class="mobile-menu-item" id="optMobileNav">Navegação</button>
            <button class="mobile-menu-item" id="optMobileZoom">Zoom</button>
            <button class="mobile-menu-item" id="optMobileRecortar">Recortar</button>
            <button class="mobile-menu-item" id="optMobileFechar">✕ Fechar PDF</button>
        </div>

        <!-- FLOATING CONTROL PANELS (Initially Hidden) -->
        
        <!-- 1. MODE TOGGLE PANEL -->
        <div id="mobileModePanel" class="floating-glass-panel hidden">
            <div class="mode-toggle mobile-mode-toggle">
                <button type="button" id="btnModoProvaMobile" class="mode-toggle__btn is-active">Prova</button>
                <button type="button" id="btnModoGabaritoMobile" class="mode-toggle__btn">Gabarito</button>
            </div>
            <button class="panel-close-btn" onclick="this.parentElement.classList.add('hidden')">✕</button>
        </div>

        <!-- 2. NAVIGATION PANEL -->
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
            <main id="viewerMain">
                <section class="pdf-panel" id="panelProva">
                    <div class="panel-label">
                        <div id="modeToggle" class="mode-toggle" role="tablist" aria-label="Alternar PDF">
                            <button type="button" id="btnModoProva" class="mode-toggle__btn is-active">Prova</button>
                            <button type="button" id="btnModoGabarito" class="mode-toggle__btn">Gabarito</button>
                        </div>

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
                        <button id="btnRecortarHeader">
                            <img src="capture.png">
                        </button>
                    </div>
                    <div id="canvasContainer" class="canvas-wrapper">
                        <!-- Canvas das páginas serão inseridos via JS (renderAllPages) -->
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

/**
 * Atualiza a interface (botões, avisos) baseada no modo atual (Prova vs Gabarito).
 * Pode ser chamada sempre que houver troca de modo.
 */
export function atualizarUIViewerModo() {
    // Ainda acessamos a variável global por enquanto, para não quebrar a lógica
    const isGabaritoMode = window.__modo === 'gabarito';

    // 1. Botões do Topo (Abas do PDF)
    document
        .getElementById('btnModoProva')
        ?.classList.toggle('is-active', !isGabaritoMode);
    document
        .getElementById('btnModoGabarito')
        ?.classList.toggle('is-active', isGabaritoMode);

    // Mobile Sync
    document.getElementById('btnModoProvaMobile')?.classList.toggle('is-active', !isGabaritoMode);
    document.getElementById('btnModoGabaritoMobile')?.classList.toggle('is-active', isGabaritoMode);

    // 2. Controle dos Botões de Imagem
    const btnQuestao = document.getElementById('btnImgQuestao');
    const msgQuestao = document.getElementById('msgAvisoModo_quest');

    if (btnQuestao) {
        btnQuestao.disabled = isGabaritoMode;
        btnQuestao.style.opacity = isGabaritoMode ? '0.5' : '1';
        btnQuestao.style.cursor = isGabaritoMode ? 'not-allowed' : 'pointer';
        if (msgQuestao)
            msgQuestao.style.display = isGabaritoMode ? 'block' : 'none';
    }

    const btnGabarito = document.getElementById('btnImgGabarito');
    const msgGabarito = document.getElementById('msgAvisoModo_gab');

    if (btnGabarito) {
        btnGabarito.disabled = !isGabaritoMode;
        btnGabarito.style.opacity = !isGabaritoMode ? '0.5' : '1';
        btnGabarito.style.cursor = !isGabaritoMode ? 'not-allowed' : 'pointer';
        if (msgGabarito)
            msgGabarito.style.display = !isGabaritoMode ? 'block' : 'none';
    }

    // 3. Botão de Confirmar (Só na Prova)
    const btnConfirmar = document.getElementById('btnConfirmarQuestao');
    if (btnConfirmar) {
        btnConfirmar.style.display = isGabaritoMode ? 'none' : 'block';
    }
}