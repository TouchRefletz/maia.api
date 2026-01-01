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

    // 1. CLOUD-FIRST FLOW: Show Progress & Upload
    console.log("[Manual] Starting Cloud-First Upload Flow...");

    // Create/Show Progress Modal
    const showProgressModal = (initialStatus) => {
      let modal = document.getElementById("upload-progress-modal");
      if (!modal) {
        modal = document.createElement("div");
        modal.id = "upload-progress-modal";
        Object.assign(modal.style, {
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.85)",
          zIndex: 12000,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backdropFilter: "blur(5px)",
          color: "white",
          fontFamily: "var(--font-primary)",
        });
        document.body.appendChild(modal);
      }

      modal.innerHTML = `
        <div style="background:var(--color-surface); padding:40px; border-radius:16px; width:90%; max-width:400px; text-align:center; box-shadow:0 10px 40px rgba(0,0,0,0.5); border:1px solid var(--color-border);">
            <div class="spinner" style="margin:0 auto 20px; width:40px; height:40px; border:4px solid var(--color-border); border-top-color:var(--color-primary); border-radius:50%; animation:spin 1s linear infinite;"></div>
            <h3 style="margin-bottom:10px; color:var(--color-text);">Processando</h3>
            <p id="upload-status-text" style="color:var(--color-text-secondary); margin-bottom:0;">${initialStatus}</p>
        </div>
        <style>@keyframes spin { 100% { transform: rotate(360deg); } }</style>
      `;
      return {
        update: (text) => {
          const el = document.getElementById("upload-status-text");
          if (el) el.innerText = text;
        },
        close: () => {
          if (modal && modal.parentNode) modal.parentNode.removeChild(modal);
        },
      };
    };

    const progress = showProgressModal(
      "Calculando identidade visual do arquivo..."
    );

    // Reusable Polling Function (Moved Up)
    const startPollingAndOpenViewer = (hfUrl, slug, aiData) => {
      progress.update("Upload iniciado! Sincronizando com a Nuvem...");
      console.log(`[Manual] Polling HF for: ${hfUrl}`);

      const WORKER_URL =
        "https://maia-api-worker.willian-campos-ismart.workers.dev"; // Re-declaration access

      const checkHgUrl = async () => {
        try {
          const response = await fetch(hfUrl, { method: "HEAD" });
          if (response.status === 200) {
            const type = response.headers.get("content-type");
            if (type && type.includes("text/html")) return false;
            return true;
          }
          return false;
        } catch (e) {
          return false;
        }
      };

      let attempts = 0;
      const maxAttempts = 30; // 60s

      const pollInterval = setInterval(async () => {
        attempts++;
        progress.update(`Sincronizando... (${attempts}/${maxAttempts})`);

        try {
          const exists = await checkHgUrl();
          if (exists) {
            clearInterval(pollInterval);
            progress.update("Concluído! Abrindo visualizador...");

            setTimeout(() => {
              try {
                const modalEl = document.getElementById(
                  "upload-progress-modal"
                );
                if (modalEl) modalEl.remove();
              } catch (e) {}

              // USE PROXY
              const proxyUrl = `${WORKER_URL}/proxy-pdf?url=${encodeURIComponent(hfUrl)}`;
              gerarVisualizadorPDF({
                title: aiData?.institution
                  ? `${aiData.institution} ${aiData.year}`
                  : titleInput.value,
                rawTitle: titleInput.value,
                fileProva: proxyUrl,
                fileGabarito: aiData?.gabarito_url || null,
                gabaritoNaProva: gabaritoCheck.checked,
                isManualLocal: false,
                slug: slug,
              });
            }, 1000);
          } else if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            progress.close();
            alert("O arquivo demorou muito... Verifique o terminal.");
          }
        } catch (e) {
          console.warn("Polling error", e);
        }
      }, 2000);
    };

    try {
      // 1. Calculate Visual Hash Local
      let localHash = null;
      try {
        // Import dynamic to avoid top-level await issues if bundle not ready
        const { computePdfHash } = await import("../utils/pdf-hash.js");
        localHash = await computePdfHash(fileProva, (status) => {
          progress.update(status);
        });
        console.log("[Manual] Local Visual Hash:", localHash);
      } catch (err) {
        console.warn("[Manual] Failed to compute hash:", err);
        progress.update("Erro no hash. Prosseguindo...");
      }

      progress.update("Enviando para análise...");

      const srcProvaVal = document.getElementById("sourceUrlProva").value;
      const srcGabVal = document.getElementById("sourceUrlGabarito").value;

      const formData = new FormData();
      formData.append("title", titleInput.value);
      if (srcProvaVal) formData.append("source_url_prova", srcProvaVal);
      if (srcGabVal) formData.append("source_url_gabarito", srcGabVal);

      formData.append("fileProva", fileProva);
      if (fileGabarito) formData.append("fileGabarito", fileGabarito);

      if (localHash) formData.append("visual_hash", localHash);

      const WORKER_URL =
        "https://maia-api-worker.willian-campos-ismart.workers.dev";

      const res = await fetch(`${WORKER_URL}/manual-upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.status === "conflict") {
        // --- VISUAL HASH AUTO-RESOLUTION ---
        console.warn("[Manual] Conflict detected!", data);

        let matchFound = null;
        if (localHash && data.remote_manifest) {
          const items = Array.isArray(data.remote_manifest)
            ? data.remote_manifest
            : data.remote_manifest.results || data.remote_manifest.files || [];

          matchFound = items.find((item) => item.visual_hash === localHash);
        }

        if (matchFound) {
          console.log(
            "[Manual] Visual Match Found! Auto-resolving using remote file.",
            matchFound
          );
          progress.update(
            "Match visual encontrado! Usando arquivo existente..."
          );

          // Wait brief moment for UX
          setTimeout(() => {
            // Determine remote URL
            let remoteUrl = matchFound.url;
            if (!remoteUrl) {
              // Metadata fallback logic (same as search-logic normalize)
              let path = matchFound.path || matchFound.filename;
              if (path && !path.startsWith("http")) {
                if (path.startsWith("files/"))
                  path = path.replace("files/", "");
                remoteUrl = `https://huggingface.co/datasets/toquereflexo/maia-deep-search/resolve/main/output/${data.slug}/files/${path}`;
              }
            }

            // Close modal and open viewer
            progress.close();
            // Pass ai_data from conflict if available, or construct partial
            startPollingAndOpenViewer(
              remoteUrl,
              data.slug,
              data.ai_data || {
                institution: matchFound.instituicao || matchFound.institution,
                year: matchFound.ano || matchFound.year,
              }
            );
          }, 1000);
          return;
        }

        // If NO MATCH -> Show Modal (OR Auto-Merge if user implies "se não tiver igual tu posta")
        // The user said: "se não tiver igual tu posta na nuvem"
        // This implies skipping the modal entirely?
        // But the modal lets them choose to MERGE as a new file ("Seu Upload").
        // If we skip the modal, we default to "Overwrite" or "Update"?
        // "Posta na nuvem" implies we KEEP the local file.
        // If the slug matches (conflict), we must be in UPDATE mode to avoid overwrite error if filename matches?
        // Wait, if filename matches strictly, backend threw conflict.
        // If we want to post "na nuvem", we need to override.
        // Let's keep the modal for NON-MATCHES for safety unless user insists on full automation.
        // User text: "essa tela não é pra aparecer ... se tiver igual usa back ... se não igual posta nuvem".
        // This strongly suggests handling the "não igual" case automatically too.
        // Automatic "Post to Cloud" = Override/Merge.

        console.log(
          "[Manual] No hash match. Auto-posting to cloud as per user preference (Force Update)."
        );

        // AUTO-MERGE LOGIC (Skip Modal)
        import("./search-logic.js").then((module) => {
          // We don't need module.showConflictResolutionModal anymore if we auto-merge.
          // We just proceed to the Override Request.

          progress.update("Arquivo novo detectado. Atualizando nuvem...");

          const newFormData = new FormData();
          newFormData.append("title", titleInput.value);
          if (srcProvaVal) newFormData.append("source_url_prova", srcProvaVal);
          if (srcGabVal) newFormData.append("source_url_gabarito", srcGabVal);

          // Crucial: We need to re-send the files because the worker is stateless?
          // Or does the worker keep temp files?
          // The worker `manual-upload` usually expects files in body.
          // But for override, we might need to send them again OR pass the temp URL if worker supports it.
          // Looking at previous code, `showConflictResolutionModal` passed `temp_pdf_url`.
          // But `newFormData` in previous implementation didn't append `fileProva` again!
          // It used `pdf_url_override` with `data.temp_pdf_url`.

          // Let's use the temp URL provided by the conflict response.
          const tempPdf = data.temp_pdf_url;
          const tempGab = data.temp_gabarito_url;

          if (tempPdf) newFormData.append("pdf_url_override", tempPdf);
          if (tempGab) newFormData.append("gabarito_url_override", tempGab);

          newFormData.append("confirm_override", "true");
          newFormData.append("mode", "update"); // Use Update to merge, not overwrite/fail

          fetch(`${WORKER_URL}/manual-upload`, {
            method: "POST",
            body: newFormData,
          })
            .then((r) => r.json())
            .then((d) => {
              if (d.success) {
                startPollingAndOpenViewer(d.hf_url_preview, d.slug, d.ai_data);
              } else {
                progress.close();
                alert("Erro ao realizar fusão automática: " + d.error);
              }
            })
            .catch((err) => {
              progress.close();
              alert("Erro de fusão automática: " + err.message);
            });
        });

        return;
      }

      if (!data.success) {
        throw new Error(data.error || "Erro desconhecido no upload.");
      }

      // SUCCESS START
      const hfUrl = data.hf_url_preview;
      const slug = data.slug;
      startPollingAndOpenViewer(data.hf_url_preview, data.slug, data.ai_data);
    } catch (e) {
      if (progress && progress.close) progress.close();
      console.error("[Manual] Error triggering upload:", e);
      alert("Erro no upload: " + e.message);
    }
  });
}
