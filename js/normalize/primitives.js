// --- 1. NORMALIZAÇÃO DOS DADOS ---f
export const joinLines = (arr) =>
  Array.isArray(arr) ? arr.join("\n") : arr || "";

// --- ADICIONE ESTA LINHA AQUI ---
export const safe = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
// --------------------------------
// helper: sempre devolve array (ou [])
export const asArray = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);

// helper: converte string/array/objeto em array de strings (para alertas/observações etc.)
export const asStringArray = (v) => {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map((x) => String(x));
  if (typeof v === "string")
    return v
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  if (typeof v === "object") return Object.values(v).map((x) => String(x));
  return [String(v)];
};

export const safeClone = (obj) => {
  try {
    return structuredClone(obj);
  } catch (e) {
    return JSON.parse(JSON.stringify(obj));
  }
};

export const escapeHTML = (s) =>
  String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export function sanitizeInlineMarkdown(s) {
  return String(s || "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .trim();
}

/**
 * Decodifica HTML entities de volta para caracteres normais
 * Útil quando texto vem da IA com &quot; ao invés de "
 */
export const decodeEntities = (s) =>
  String(s ?? "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");

/**
 * Renderiza texto como markdown seguro, decodificando entities primeiro
 * Usa marked para converter markdown para HTML
 */
export const safeMarkdown = (s) => {
  // Primeiro decodifica entities
  const decoded = decodeEntities(s);

  // Se não tiver markdown (sem * nem _ nem `), retorna escapado simples
  if (!/[*_`#\[\]()]/.test(decoded)) {
    return safe(decoded);
  }

  // Se tiver marked disponível globalmente, usa
  if (typeof window !== "undefined" && window.marked) {
    try {
      return window.marked.parse(decoded);
    } catch (e) {
      console.warn("Erro ao parsear markdown:", e);
    }
  }

  // Fallback: converte markdown básico manualmente
  return decoded
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br>");
};
