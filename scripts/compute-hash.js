/**
 * Node.js Script to Compute Visual Hash for PDFs
 * Uses shared logic from js/utils/shared-hash-logic.js
 *
 * Usage: node scripts/compute-hash.js [directory_path]
 */

import crypto from "crypto";
import fs from "fs";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";
import { computePdfDocHash } from "../js/utils/shared-hash-logic.js";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// CJS Dependencies
const { createCanvas } = require("@napi-rs/canvas");
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");

// --- NodeCanvasFactory Fix for pdfjs-dist + napi-rs/canvas ---
class NodeCanvasFactory {
  create(width, height) {
    if (width <= 0 || height <= 0) {
      width = 1;
      height = 1;
    }
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");
    return {
      canvas: canvas,
      context: context,
    };
  }

  reset(canvasAndContext, width, height) {
    if (!canvasAndContext.canvas) return;
    if (width <= 0 || height <= 0) {
      width = 1;
      height = 1;
    }
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }

  destroy(canvasAndContext) {
    if (!canvasAndContext.canvas) return;
    // Clearing references; avoid setting width=0 if it causes issues
    canvasAndContext.canvas.width = 1;
    canvasAndContext.canvas.height = 1;
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}
// -----------------------------------------------------------

// Adapter for shared-hash-logic
const canvasFn = (w, h) => {
  const canvas = createCanvas(w, h);
  return {
    canvas,
    context: canvas.getContext("2d"),
  };
};

const sha256Fn = async (msg) => {
  return crypto.createHash("sha256").update(msg).digest("hex");
};

export async function computeFileHash(filePath) {
  try {
    const data = new Uint8Array(fs.readFileSync(filePath));

    // Pass custom factory to getDocument to fix crashes
    const pdf = await pdfjsLib.getDocument({
      data: data,
      standardFontDataUrl: path.join(
        __dirname,
        "../node_modules/pdfjs-dist/standard_fonts/"
      ),
      canvasFactory: new NodeCanvasFactory(),
    }).promise;

    return await computePdfDocHash(pdf, canvasFn, sha256Fn);
  } catch (e) {
    console.error(`Failed to process ${filePath}:`, e.message);
    return null;
  }
}

// Main Execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  (async () => {
    // If user provides a single file path as argument (for testing), handle it
    const arg = process.argv[2];
    if (
      arg &&
      arg.toLowerCase().endsWith(".pdf") &&
      fs.statSync(arg).isFile()
    ) {
      console.log(`Hashing single file: ${arg}...`);
      console.time("Hashing");
      const hash = await computeFileHash(arg);
      console.timeEnd("Hashing");
      console.log(`Hash: ${hash}`);
      process.exit(0);
    }

    // Default Directory Mode
    const targetDir = arg;
    if (!targetDir) {
      console.error(
        "Usage: node compute-hash.js <directory_path> OR <pdf_file>"
      );
      process.exit(1);
    }

    const manifestPath = path.join(targetDir, "manifest.json");
    if (!fs.existsSync(manifestPath)) {
      console.error("Manifest not found at:", manifestPath);
      process.exit(0);
    }

    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      let items = Array.isArray(manifest) ? manifest : manifest.results || [];
      let updated = false;

      for (const item of items) {
        if (item.filename && item.filename.toLowerCase().endsWith(".pdf")) {
          // Always update/recompute to ensure consistency with new logic
          // if (item.visual_hash) continue;

          const filePath = path.join(targetDir, "files", item.filename);
          if (fs.existsSync(filePath)) {
            console.log(`Hashing: ${item.filename}...`);
            const hash = await computeFileHash(filePath);
            if (hash) {
              if (item.visual_hash !== hash) {
                console.log(`  > Updated Hash: ${hash.substring(0, 16)}...`);
                item.visual_hash = hash;
                updated = true;
              } else {
                console.log(`  > Hash verified.`);
              }
            }
          }
        }
      }

      if (updated) {
        fs.writeFileSync(manifestPath, JSON.stringify(items, null, 2));
        console.log("Manifest updated with visual hashes.");
      } else {
        console.log("No hashes changed.");
      }
    } catch (e) {
      console.error("Critical Error:", e);
      process.exit(1);
    }
  })();
}
