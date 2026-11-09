#!/usr/bin/env node

/**
 * Signature by Marvan - Camera Tethering Hot-Folder Watcher
 * Watches local camera tether folders (Sony Imaging Edge, Canon EOS Utility, Nikon NX, Lightroom)
 * and streams newly captured photos to the Live Cloud event instantly.
 */

import fs from "fs";
import path from "path";

// Parse CLI flags: --event=ID --folder=PATH --server=URL --key=KEY --photographer=NAME
const args = process.argv.slice(2);
function getArg(name, fallback = "") {
  const match = args.find((a) => a.startsWith(`--${name}=`));
  return match ? match.split("=")[1].replace(/^["']|["']$/g, "") : fallback;
}

const EVENT_ID = getArg("event", "sample2-mw80dckt");
const WATCH_DIR = getArg("folder", path.join(process.cwd(), "tether_photos"));
const SERVER_URL = getArg("server", "https://web-rho-sage-25.vercel.app").replace(/\/$/, "");
const ADMIN_KEY = getArg("key", "marvan2026");
const PHOTOGRAPHER_NAME = getArg("photographer", "Signature by Marvan");

const ALLOWED_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".arw", ".cr3", ".nef", ".raf"]);
const processedFiles = new Set();
const writingDebounce = new Map();

console.log("\x1b[33m%s\x1b[0m", `
  ╔══════════════════════════════════════════════════════════════════╗
  ║                 SIGNATURE BY MARVAN · LIVE TETHER                ║
  ║               Camera Hot-Folder Cloud Stream Daemon              ║
  ╚══════════════════════════════════════════════════════════════════╝
`);
console.log(`📡 Cloud Target:      \x1b[36m${SERVER_URL}\x1b[0m`);
console.log(`🎯 Active Event ID:   \x1b[32m${EVENT_ID}\x1b[0m`);
console.log(`📁 Watching Folder:   \x1b[35m${WATCH_DIR}\x1b[0m`);
console.log(`📸 Photographer:     \x1b[33m${PHOTOGRAPHER_NAME}\x1b[0m`);
console.log("──────────────────────────────────────────────────────────────────");

if (!fs.existsSync(WATCH_DIR)) {
  fs.mkdirSync(WATCH_DIR, { recursive: true });
  console.log(`Created watch directory: ${WATCH_DIR}`);
}

// Initial catalog of existing files
try {
  const existing = fs.readdirSync(WATCH_DIR);
  for (const file of existing) {
    processedFiles.add(file);
  }
  console.log(`Indexed ${existing.length} existing photos (watching for new shutter captures...)`);
} catch (e) {
  console.warn("Could not read directory initial state:", e.message);
}

// Upload function
async function uploadFile(filePath, filename) {
  const startTime = Date.now();
  console.log(`\x1b[33m[SHUTTER DETECTED]\x1b[0m Capturing ${filename}...`);

  try {
    const fileBuffer = fs.readFileSync(filePath);
    if (fileBuffer.length === 0) return;

    const ext = path.extname(filename).toLowerCase();
    const mimeType = ext === ".png" ? "image/png" : "image/jpeg";
    const blob = new Blob([fileBuffer], { type: mimeType });

    const formData = new FormData();
    formData.append("files", blob, filename);
    formData.append("eventId", EVENT_ID);
    formData.append("guestName", PHOTOGRAPHER_NAME);
    formData.append("caption", "Live Camera Tether Shot 📸");
    formData.append("adminKey", ADMIN_KEY);

    const uploadUrl = `${SERVER_URL}/api/photos`;
    const res = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "x-admin-key": ADMIN_KEY,
      },
      body: formData,
    });

    const elapsed = Date.now() - startTime;
    if (res.ok) {
      console.log(`\x1b[32m[✓ LIVE SYNCED]\x1b[0m ${filename} streamed in ${elapsed}ms -> Event ${EVENT_ID}`);
    } else {
      const errText = await res.text();
      console.error(`\x1b[31m[✕ FAILED]\x1b[0m ${filename}: HTTP ${res.status} - ${errText}`);
    }
  } catch (err) {
    console.error(`\x1b[31m[✕ ERROR]\x1b[0m ${filename}:`, err.message);
  }
}

// Watch directory for changes
fs.watch(WATCH_DIR, (eventType, filename) => {
  if (!filename) return;
  const ext = path.extname(filename).toLowerCase();
  if (!ALLOWED_EXTS.has(ext)) return;
  if (processedFiles.has(filename)) return;

  const fullPath = path.join(WATCH_DIR, filename);

  // Debounce check to ensure camera has finished writing the file
  if (writingDebounce.has(filename)) {
    clearTimeout(writingDebounce.get(filename));
  }

  const timer = setTimeout(() => {
    writingDebounce.delete(filename);
    try {
      if (!fs.existsSync(fullPath)) return;
      const stat = fs.statSync(fullPath);
      if (stat.size > 1024) {
        processedFiles.add(filename);
        uploadFile(fullPath, filename);
      }
    } catch (_) {}
  }, 1000);

  writingDebounce.set(filename, timer);
});

console.log("\x1b[32m✔ Camera Tethering Engine Active.\x1b[0m Take a shot on your camera to test!");
