import { getProxyPdfUrl } from "../api/worker.js";

export function setupSearchLogic() {
  const btnSearch = document.getElementById("btnSearch");
  const searchInput = document.getElementById("searchInput");
  const searchResults = document.getElementById("searchResults");
  const btnShowUpload = document.getElementById("btnShowUpload");
  const btnBackToSearch = document.getElementById("btnBackToSearch");

  const searchContainer = document.getElementById("searchContainer");
  const manualUploadContainer = document.getElementById(
    "manualUploadContainer"
  );

  // --- Toggles de Interface ---
  if (btnShowUpload) {
    btnShowUpload.addEventListener("click", () => {
      searchContainer.classList.add("hidden");
      searchContainer.style.display = "none";

      manualUploadContainer.classList.remove("hidden");
      manualUploadContainer.style.display = "flex";
      manualUploadContainer.classList.add("fade-in-centralized");
    });
  }

  if (btnBackToSearch) {
    btnBackToSearch.addEventListener("click", () => {
      manualUploadContainer.classList.add("hidden");
      manualUploadContainer.style.display = "none";

      searchContainer.classList.remove("hidden");
      searchContainer.style.display = "flex";
      searchContainer.classList.add("fade-in-centralized");
    });
  }

  // --- Lógica de Pesquisa (DEEP SEARCH - OpenHands) ---
  const doSearch = async () => {
    const query = searchInput.value.trim();
    if (!query) return;

    searchResults.innerHTML = "";
    const thoughtsContainer = document.createElement("div");
    thoughtsContainer.style.width = "100%";
    thoughtsContainer.style.maxWidth = "800px";
    thoughtsContainer.style.marginBottom = "30px";
    searchResults.appendChild(thoughtsContainer);

    // UI de Terminal (Logs)
    const terminal = document.createElement("div");
    terminal.style.background = "#0d1117"; // Monitor style
    terminal.style.color = "#c9d1d9";
    terminal.style.padding = "15px";
    terminal.style.borderRadius = "8px";
    terminal.style.fontFamily = "monospace";
    terminal.style.fontSize = "0.9rem";
    terminal.style.whiteSpace = "pre-wrap";
    terminal.style.height = "300px";
    terminal.style.overflowY = "auto";
    terminal.style.border = "1px solid #30363d";
    terminal.style.marginBottom = "20px";
    terminal.innerHTML =
      '<span style="color:#58a6ff;">$ initializing deep search agent...</span>\n';
    searchResults.appendChild(terminal);

    const log = (msg, color = null) => {
      const span = document.createElement("span");
      span.textContent = `> ${msg}\n`;
      if (color) span.style.color = color;
      terminal.appendChild(span);
      terminal.scrollTop = terminal.scrollHeight;
    };

    try {
      // 1. Trigger
      log("Sending command to GitHub Actions...", "#8b949e");
      const { triggerDeepSearch, pollDeepSearch } =
        await import("../api/worker.js");

      const triggerRes = await triggerDeepSearch(query);
      if (triggerRes.success) {
        log("Workflow triggered successfully!", "#238636");
        log("Waiting for runner allocation...", "#8b949e");
      } else {
        throw new Error("Failed to trigger workflow");
      }

      // 2. Poll Loop
      let runId = null;
      let polling = true;
      let attempts = 0;

      while (polling && attempts < 60) {
        // Timeout ~5 min
        await new Promise((pkg) => setTimeout(pkg, 5000)); // 5s poll
        attempts++;

        const statusRes = await pollDeepSearch(runId);

        if (statusRes.status === "not_found") {
          log("Waiting for run to appear...", "#8b949e");
          continue;
        }

        if (!runId && statusRes.id) {
          runId = statusRes.id;
          log(`Run ID detected: ${runId}`, "#58a6ff");
          log(`View on GitHub: ${statusRes.html_url}`, "#58a6ff");
        }

        if (statusRes.status === "queued") {
          log("Status: Queued...", "#d29922");
        } else if (statusRes.status === "in_progress") {
          log("Status: In Progress (Running OpenHands Docker)...", "#238636");
          // Here we would ideally stream real-time logs if we had them.
          // mocking activity to show user something is happening
          if (Math.random() > 0.7)
            log("Thinking... processing search results...", "#79c0ff");
        } else if (statusRes.status === "completed") {
          log("Status: Completed!", "#238636");
          polling = false;

          if (statusRes.conclusion === "success") {
            log("Downloading results artifact...", "#a5d6ff");
            // TODO: Fetch artifact content or parsed output
            // Since we cannot easily fetch artifact content via simple API call without auth proxy downloading zip,
            // we might stop here or ask user to view on GH.
            // Or, we assume the Worker could fetch it.

            searchResults.innerHTML += `
                            <div style="padding:20px; background:var(--color-surface); border-radius:12px; text-align:center;">
                                <h3>Pesquisa Concluída</h3>
                                <p>O agente OpenHands finalizou a busca.</p>
                                <a href="${statusRes.html_url}" target="_blank" class="btn btn--primary">Ver Resultados no GitHub</a>
                            </div>
                         `;
          } else {
            log(
              `Workflow failed with conclusion: ${statusRes.conclusion}`,
              "#f85149"
            );
          }
        }
      }
    } catch (e) {
      console.error(e);
      log(`Error: ${e.message}`, "#f85149");
    }
  };

  if (btnSearch) {
    btnSearch.addEventListener("click", doSearch);
  }

  if (searchInput) {
    searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") doSearch();
    });
    setTimeout(() => searchInput.focus(), 100);
  }
}

async function generateThumbnail(url, canvas, loader) {
  if (!url) return;
  try {
    const finalUrl = getProxyPdfUrl(url);

    if (
      typeof pdfjsLib !== "undefined" &&
      !pdfjsLib.GlobalWorkerOptions.workerSrc
    ) {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    }

    // Limit to page 1, distinct intent
    const loadingTask = pdfjsLib.getDocument(finalUrl);
    const pdfDoc = await loadingTask.promise;
    const page = await pdfDoc.getPage(1);

    const viewport = page.getViewport({ scale: 0.6 }); // Small thumbnail
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext("2d");
    await page.render({ canvasContext: ctx, viewport: viewport }).promise;

    // Show canvas, hide loader
    canvas.style.display = "block";
    if (loader) loader.style.display = "none";
  } catch (err) {
    // Silent fail for thumbnail
    console.warn("Thumb fail:", err);
    if (loader)
      loader.innerHTML = '<span style="font-size:2rem; opacity:0.2;">📄</span>';
  }
}
