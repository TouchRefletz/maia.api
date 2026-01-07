import { viewerState } from "../main.js";
import { CropperState } from "./cropper-state.js";

export function loadSelectionsFromJson(
  jsonInput,
  targetPageNum = 2,
  options = {}
) {
  console.log("📥 Loading selections from JSON...", jsonInput);

  let data = jsonInput;
  if (typeof jsonInput === "string") {
    try {
      data = JSON.parse(jsonInput);
    } catch (e) {
      console.error("❌ Invalid JSON format", e);
      return;
    }
  }

  if (!data.regions || !Array.isArray(data.regions)) {
    console.error("❌ No regions found in JSON");
    return;
  }

  // Determine coordinate system
  const isY1X1 = data.coordinateSystem === "normalized_0_1000_y1x1y2x2";

  data.regions.forEach((region) => {
    // Tenta encontrar grupo existente para fazer merging (caso seja split question)
    const questionId = region.questionId;
    let group = null;
    let isMerge = false;

    if (questionId && CropperState.findGroupByExternalId) {
      const existingGroup = CropperState.findGroupByExternalId(questionId);
      if (existingGroup) {
        // Lógica de merging refinada:
        // Só une se pelo menos um dos lados for "parte_questao".
        // Isso evita unir duas "questão completa" por engano (duplicatas),
        // mas permite unir "Parte + Parte", "Parte + Completa" ou "Completa + Parte".
        const isExistingPart = existingGroup.tipo === "parte_questao";
        const isNewPart = region.tipo === "parte_questao";

        if (isExistingPart || isNewPart) {
          group = existingGroup;
          isMerge = true;
          console.log(
            `🔄 Merging question ${questionId} (Existing: ${existingGroup.tipo}, New: ${region.tipo})`
          );
          // Opcional: Atualizar status do grupo se necessÃ¡rio
          if (options.status && existingGroup.status !== options.status) {
            existingGroup.status = options.status;
          }
        } else {
          console.warn(
            `⚠️ Collision detected for Question ${questionId}. Both are 'questao_completa'. Creating duplicate.`
          );
        }
      }
    }

    if (!group) {
      // Pass externalId so it can be found later
      const newOptions = {
        ...options,
        externalId: questionId,
        tipo: region.tipo || "questao_completa",
        status: options.status || "sent", // Default to sent if not provided
      };
      group = CropperState.createGroup(newOptions);
    }

    // Calculate functionality
    let [c1, c2, c3, c4] = region.box;
    let top, left, bottom, right;

    if (isY1X1) {
      // [y1, x1, y2, x2]
      top = c1;
      left = c2;
      bottom = c3;
      right = c4;
    } else {
      // Assume [x1, y1, x2, y2] or similar default
      left = c1;
      top = c2;
      right = c3;
      bottom = c4;
    }

    // Convert normalized 0-1000 to relative 0-1
    const relTop = top / 1000;
    const relLeft = left / 1000;
    const relBottom = bottom / 1000;
    const relRight = right / 1000;

    const relWidth = relRight - relLeft;
    const relHeight = relBottom - relTop;

    // Note: The system needs 'unscaledW' which is pixel width relative to original PDF size?
    // Let's check selection-overlay.js logic again.
    // It uses: newLeft = anchorPage.offsetLeft + anchorData.relativeLeft * currentScale
    // So relativeLeft is fraction * pageDimension? NO.
    // In selection-overlay.js:
    // relativeLeft = (boxLeft - bestPage.offsetLeft) / currentScale;
    // relativeLeft IS PIXELS (unscaled).
    // Wait, if scale is 1.0, relativeLeft is pixels from left.

    // We need the PAGE DIMENSIONS to convert normalized -> unscaled pixels.
    const pageContainer = document.getElementById(
      `page-wrapper-${targetPageNum}`
    );
    if (!pageContainer) {
      console.warn(`⚠️ Page ${targetPageNum} not found/rendered yet.`);
      return;
    }

    // We can get the original unscaled dimensions from the viewport if stored,
    // OR we just reverse calc from current DOM dimensions.
    // viewerState.pdfScale is the current scale.
    // pageContainer.offsetWidth is scaled width.
    // originalWidth = pageContainer.offsetWidth / viewerState.pdfScale

    const currentW = pageContainer.offsetWidth;
    const currentH = pageContainer.offsetHeight;

    // Unscaled dimensions (the "100%" size of the page in PDF coordinate terms)
    // Actually, CropperState seems to store 'unscaledW' and 'relativeLeft' (unscaled pixels).

    const unscaledPageW = currentW / viewerState.pdfScale;
    const unscaledPageH = currentH / viewerState.pdfScale;

    const anchorData = {
      anchorPageNum: targetPageNum,
      // Convert 0-1 fraction to unscaled pixels
      relativeLeft: relLeft * unscaledPageW,
      relativeTop: relTop * unscaledPageH,
      unscaledW: relWidth * unscaledPageW,
      unscaledH: relHeight * unscaledPageH,
    };

    if (isMerge) {
      CropperState.addCropToGroup(group.id, { anchorData });
    } else {
      CropperState.addCropToActiveGroup({ anchorData });
      // Mantém o status passado nas opções (created with specific status e.g. 'draft', 'verified')
      // Se não houver opção, o default já foi setado na criação do grupo
      if (options.status) {
        group.status = options.status;
      }
    }
    CropperState.notify();
  });

  // Força o fim da edição (fecha o painel de edição e mostra a lista)
  CropperState.setActiveGroup(null);

  console.log("✅ Selections loaded successfully!");
}
