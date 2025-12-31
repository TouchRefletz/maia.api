export class SearchToaster {
  static element = null;
  static timeoutId = null;

  static init() {
    if (this.element) return;

    // Create container
    this.element = document.createElement("div");
    this.element.className = "undo-toast"; // Reuse undo-toast styles (top center, nice look)
    this.element.style.display = "none";
    this.element.style.transition = "opacity 0.3s ease, transform 0.3s ease";
    this.element.style.opacity = "0";
    this.element.style.transform = "translate(-50%, -20px)"; // Start slightly above

    // Inner HTML structure
    this.element.innerHTML = `
      <div class="spinner" style="
          width: 16px; 
          height: 16px; 
          border: 2px solid var(--color-text-secondary); 
          border-top-color: var(--color-primary); 
          border-radius: 50%; 
          animation: spin 1s linear infinite;
          margin-right: 8px;
          display: none;
      "></div>
      <span class="undo-msg" style="font-weight: 500;"></span>
      <span class="toaster-detail" style="
          margin-left: 8px; 
          font-size: 0.85em; 
          color: var(--color-text-secondary); 
          border-left: 1px solid var(--color-border);
          padding-left: 8px;
          display: none;
      "></span>
    `;

    // Inject checkmark icon style for success state if needed, or just use text/emoji
    // Ensuring 'spin' keyframes exist in global CSS (animations.css usually has it).
    // If not, we can assume it exists or the spinner will just be static which is fine for now.

    const style = document.createElement("style");
    style.innerHTML = `
      @keyframes spin { to { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);

    document.body.appendChild(this.element);
  }

  /**
   * Updates the state of the toaster
   * @param {string} status - 'loading', 'success', 'error', 'idle'
   * @param {string} message - Main text
   * @param {string} detail - Secondary text (optional)
   */
  static updateState(status = "loading", message, detail) {
    if (!this.element) this.init();

    const spinner = this.element.querySelector(".spinner");
    const msgEl = this.element.querySelector(".undo-msg");
    const detailEl = this.element.querySelector(".toaster-detail");

    // Show/Hide Spinner based on status
    if (status === "loading") {
      spinner.style.display = "block";
      spinner.style.borderColor = "var(--color-text-secondary)";
      spinner.style.borderTopColor = "var(--color-primary)";
    } else if (status === "success") {
      spinner.style.display = "block";
      spinner.style.borderColor = "var(--color-success)"; // Green ring
      spinner.style.borderTopColor = "var(--color-success)";
      spinner.style.animation = "none"; // Stop spinning
    } else {
      spinner.style.display = "none";
    }

    if (message) {
      msgEl.innerText = message;
    } else if (!msgEl.innerText.trim()) {
      msgEl.innerText = "Processando...";
    }

    if (detail) {
      detailEl.innerText = detail;
      detailEl.style.display = "inline-block";
    } else {
      detailEl.style.display = "none";
    }

    this.show();

    // Auto-hide if not loading
    if (status !== "loading") {
      if (this.timeoutId) clearTimeout(this.timeoutId);
      this.timeoutId = setTimeout(() => {
        this.hide();
      }, 4000);
    }
  }

  static show() {
    if (!this.element) this.init();
    this.element.style.display = "flex";
    // Trigger reflow
    void this.element.offsetWidth;
    this.element.style.opacity = "1";
    this.element.style.transform = "translate(-50%, 0)";
  }

  static hide() {
    if (!this.element) return;
    this.element.style.opacity = "0";
    this.element.style.transform = "translate(-50%, -20px)";

    setTimeout(() => {
      if (this.element.style.opacity === "0") {
        this.element.style.display = "none";
      }
    }, 300);
  }
}
