import { gerarVisualizadorPDF } from "../viewer/events.js";

/**
 * 3. LÓGICA DO FORMULÁRIO
 * Lida com preenchimento inicial, checkbox e submit.
 */
export function setupFormLogic(elements, initialData) {
  const {
    titleInput,
    yearInput,
    gabaritoCheck,
    gabaritoGroup,
    gabaritoInput,
    form,
    pdfInput,
  } = elements;

  // A. Lógica de Checkbox (Esconder/Mostrar Gabarito)
  const toggleGabarito = () => {
    if (gabaritoCheck.checked) {
      gabaritoGroup.style.display = "none";
      gabaritoInput.value = "";
      gabaritoInput.required = false;
    } else {
      gabaritoGroup.style.display = "block";
      gabaritoInput.required = true;
    }
  };
  gabaritoCheck.addEventListener("change", toggleGabarito);

  // B. Preenchimento de Dados Iniciais (Se houver)
  if (initialData) {
    titleInput.value = initialData.rawTitle || "";
    gabaritoCheck.checked = initialData.gabaritoNaProva;
    toggleGabarito(); // Aplica o estado visual

    const fileNameDisplay = document.getElementById("fileName");
    fileNameDisplay.textContent =
      "⚠️ Por favor, selecione o arquivo novamente.";
    fileNameDisplay.style.color = "var(--color-warning)";
  }

  // C. Submit do Formulário
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const fileProva = pdfInput.files[0];
    const fileGabarito = gabaritoInput.files[0];

    if (!fileProva) {
      alert("Selecione a prova.");
      return;
    }

    // 1. INSTANT VIEW: Load local file immediately for UX
    console.log("[Manual] Opening local viewer immediately...");

    // We pass the File object directly. Viewer needs to handle File or URL.
    // If viewer only takes URL, we create Blob URL.
    const localPdfUrl = URL.createObjectURL(fileProva);
    const localGabUrl = fileGabarito ? URL.createObjectURL(fileGabarito) : null;

    gerarVisualizadorPDF({
      title: `(Local) ${titleInput.value}`,
      rawTitle: titleInput.value,
      fileProva: localPdfUrl, // Pass Blob URL
      fileGabarito: localGabUrl, // Pass Blob URL
      gabaritoNaProva: gabaritoCheck.checked,
      isManualLocal: true, // Flag to show "Syncing..." UI in Viewer if possible
    });

    // 2. BACKGROUND UPLOADS
    // We don't await this to block the UI, but we should notify the user.
    // Ideally, we'd use a toaster. For now, let's log and maybe trigger a "Syncing" toast if available.

    try {
      const instVal = document.getElementById("institutionInput").value;
      const phaseVal = document.getElementById("phaseInput").value;
      const srcProvaVal = document.getElementById("sourceUrlProva").value;
      const srcGabVal = document.getElementById("sourceUrlGabarito").value;

      if (!instVal || !phaseVal) {
        alert("Por favor, preencha Instituição e Fase.");
        return;
      }

      const formData = new FormData();
      formData.append("title", titleInput.value);
      formData.append("year", yearInput.value);
      formData.append("institution", instVal);
      formData.append("phase", phaseVal);
      if (srcProvaVal) formData.append("source_url_prova", srcProvaVal);
      if (srcGabVal) formData.append("source_url_gabarito", srcGabVal);

      formData.append("fileProva", fileProva);
      if (fileGabarito) formData.append("fileGabarito", fileGabarito);

      // Get Worker URL from config or environment (hardcoded or global for now)
      const WORKER_URL =
        "https://maia-api-worker.willian-campos-ismart.workers.dev";

      // Assuming there's a global toaster or we just fire and forget for this MVP
      if (window.SearchToaster) {
        window.SearchToaster.add(
          "info",
          "Iniciando sincronização com a nuvem...",
          5000
        );
      }

      fetch(`${WORKER_URL}/manual-upload`, {
        method: "POST",
        body: formData,
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            console.log("[Manual] Sync started:", data);
            if (window.SearchToaster) {
              window.SearchToaster.add(
                "success",
                "Sincronização iniciada! O link será permanente em breve.",
                5000
              );
            }
          } else {
            console.error("[Manual] Sync failed:", data);
            if (window.SearchToaster)
              window.SearchToaster.add(
                "error",
                "Falha ao sincronizar: " + (data.error || "Erro desconhecido")
              );
          }
        })
        .catch((err) => {
          console.error("[Manual] Network error:", err);
          if (window.SearchToaster)
            window.SearchToaster.add(
              "error",
              "Erro de conexão na sincronização."
            );
        });
    } catch (e) {
      console.error("[Manual] Error triggering upload:", e);
    }
  });
}
