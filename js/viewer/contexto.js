/**
 * Prepara o ambiente: configura worker, limpa tela anterior,
 * define estados globais e gera as URLs dos blobs.
 */
export function inicializarContextoViewer(args) {
  // 1. Configuração do Worker (só se não tiver)
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }

  // 2. Remove a tela de Upload anterior
  const uploadContainer = document.getElementById("pdfUploadContainer");
  if (uploadContainer) uploadContainer.remove();

  // 3. Define Estado Global Inicial
  window.__viewerArgs = args;

  // 4. Gerenciamento de URLs (Limpa antigas e cria novas)
  // Garante que o objeto existe antes de tentar acessar
  if (!window.__pdfUrls) window.__pdfUrls = {};

  if (window.__pdfUrls.prova) URL.revokeObjectURL(window.__pdfUrls.prova);

  // Helper simples para lidar com File/Blob vs String URL
  const getUrl = (fileOrUrl) => {
    if (!fileOrUrl) return null;
    if (typeof fileOrUrl === "string") {
      // PROXY LOGIC: Se for URL externa (HuggingFace, etc), usa o proxy para evitar CORS/CORB
      // Ignora localhost ou blobs
      if (
        fileOrUrl.startsWith("http") &&
        !fileOrUrl.includes("localhost") &&
        !fileOrUrl.includes("127.0.0.1") &&
        !fileOrUrl.includes("/proxy-pdf")
      ) {
        const workerUrl =
          "https://maia-api-worker.willian-campos-ismart.workers.dev";
        const encodedTarget = encodeURIComponent(fileOrUrl);
        return `${workerUrl}/proxy-pdf?url=${encodedTarget}`;
      }
      return fileOrUrl;
    }
    return URL.createObjectURL(fileOrUrl);
  };

  window.__pdfUrls.prova = getUrl(args.fileProva);

  // Retorna a URL inicial para quem chamou usar
  return window.__pdfUrls.prova;
}
