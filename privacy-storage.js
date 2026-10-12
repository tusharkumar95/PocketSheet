// PocketSheet storage, backup and privacy information.

const psPrivacySection = document.createElement("section");
psPrivacySection.className = "file-tools-section";
psPrivacySection.innerHTML = `
  <p class="file-tools-label">PRIVACY & STORAGE</p>
  <button type="button" class="privacy-storage-btn" id="privacyStorageBtn">
    Storage & privacy
    <small>See device storage use, backup options and current protection</small>
  </button>`;

if (typeof psFileToolsNote !== "undefined" && psFileToolsNote?.parentNode) {
  psFileToolsNote.parentNode.insertBefore(psPrivacySection, psFileToolsNote);
}

const psPrivacyMarkup = `
<div class="editor-backdrop hidden" id="privacyBackdrop">
  <div class="editor-sheet privacy-sheet">
    <div class="grabber"></div>
    <div class="editor-head">
      <div><p class="eyebrow">POCKETSHEET</p><h2>Storage & privacy</h2></div>
      <button class="icon-btn" id="closePrivacy" aria-label="Close">✕</button>
    </div>

    <section class="privacy-card">
      <div class="privacy-status local">● Stored locally</div>
      <p class="privacy-copy">Your workbook data is stored in this browser/PWA on this device. PocketSheet does not upload workbook contents to GitHub.</p>
    </section>

    <section class="privacy-card">
      <h3>Storage</h3>
      <div class="privacy-metric"><span>Current workbook</span><strong id="privacyCurrentBook">—</strong></div>
      <div class="privacy-metric"><span>All PocketSheet saved data</span><strong id="privacyAllData">—</strong></div>
      <div class="privacy-metric"><span>Workbooks</span><strong id="privacyBookCount">—</strong></div>
      <div class="privacy-metric"><span>Browser-origin storage</span><strong id="privacyOriginUsage">—</strong></div>
      <p class="privacy-note">Browser-origin usage can include PocketSheet's offline cache and other projects served from the same GitHub Pages origin.</p>
    </section>

    <section class="privacy-card">
      <div class="privacy-status warning">Current status: not app-encrypted</div>
      <p class="privacy-copy">Your device and browser protect site storage, but PocketSheet currently stores workbook JSON in readable local browser storage. Do not treat this as strong protection for highly sensitive personal information yet.</p>
      <ul class="privacy-security-list">
        <li>No workbook data is intentionally sent to a server.</li>
        <li>CSV exports and current full backups are plaintext files.</li>
        <li>Clearing website/PWA data can remove local workbooks unless you have a backup.</li>
      </ul>
    </section>

    <section class="privacy-card">
      <h3>Full PocketSheet backup</h3>
      <div class="privacy-actions">
        <button type="button" class="primary" id="exportPocketBackup">Export backup</button>
        <button type="button" id="restorePocketBackup">Restore backup</button>
      </div>
      <input type="file" class="hidden" id="pocketBackupInput" accept=".json,.pocketsheet,application/json" />
      <p class="privacy-note" id="privacyBackupNote">This backup preserves workbooks, sheets, formulas and formatting. It is currently unencrypted, so store it somewhere you trust.</p>
    </section>
  </div>
</div>`;
document.body.insertAdjacentHTML("beforeend", psPrivacyMarkup);

const psPrivacyBtn = document.getElementById("privacyStorageBtn");
const psPrivacyBackdrop = document.getElementById("privacyBackdrop");
const psClosePrivacy = document.getElementById("closePrivacy");
const psPrivacyCurrentBook = document.getElementById("privacyCurrentBook");
const psPrivacyAllData = document.getElementById("privacyAllData");
const psPrivacyBookCount = document.getElementById("privacyBookCount");
const psPrivacyOriginUsage = document.getElementById("privacyOriginUsage");
const psExportPocketBackup = document.getElementById("exportPocketBackup");
const psRestorePocketBackup = document.getElementById("restorePocketBackup");
const psPocketBackupInput = document.getElementById("pocketBackupInput");
const psPrivacyBackupNote = document.getElementById("privacyBackupNote");

function psUtf8Bytes(value) {
  return new TextEncoder().encode(String(value ?? "")).byteLength;
}

function psFormatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(value < 10 * 1024 ? 1 : 0)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function psPocketSheetLocalStorageBytes() {
  let total = 0;
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);
    if (!key || !key.startsWith("pocketsheet")) continue;
    total += psUtf8Bytes(key) + psUtf8Bytes(localStorage.getItem(key));
  }
  return total;
}

function psCurrentWorkbookBytes() {
  try {
    if (typeof psV2SyncLibrary === "function") psV2SyncLibrary();
    return psUtf8Bytes(JSON.stringify(psWorkbook || {}));
  } catch (_) {
    return 0;
  }
}

async function psRefreshPrivacyStorage() {
  psPrivacyCurrentBook.textContent = psFormatBytes(psCurrentWorkbookBytes());
  psPrivacyAllData.textContent = psFormatBytes(psPocketSheetLocalStorageBytes());

  let count = 1;
  try {
    const library = JSON.parse(localStorage.getItem("pocketsheet-workbook-library-v1") || "[]");
    if (Array.isArray(library) && library.length) count = library.length;
  } catch (_) {}
  psPrivacyBookCount.textContent = String(count);

  psPrivacyOriginUsage.textContent = "Not available";
  if (navigator.storage?.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      if (typeof estimate.usage === "number") {
        const quotaText = typeof estimate.quota === "number" ? ` of ${psFormatBytes(estimate.quota)}` : "";
        psPrivacyOriginUsage.textContent = `${psFormatBytes(estimate.usage)}${quotaText}`;
      }
    } catch (_) {}
  }
}

function psOpenPrivacy() {
  if (typeof psCloseFileToolsSheet === "function") psCloseFileToolsSheet();
  psPrivacyBackdrop.classList.remove("hidden");
  psRefreshPrivacyStorage();
}
function psClosePrivacySheet() { psPrivacyBackdrop.classList.add("hidden"); }

function psBuildFullBackup() {
  if (typeof psV2SyncLibrary === "function") psV2SyncLibrary();
  const libraryKey = "pocketsheet-workbook-library-v1";
  const activeBookKey = "pocketsheet-active-workbook-id";
  let library = [];
  try { library = JSON.parse(localStorage.getItem(libraryKey) || "[]"); } catch (_) {}
  return {
    kind: "PocketSheetBackup",
    version: 1,
    exportedAt: new Date().toISOString(),
    activeWorkbookId: localStorage.getItem(activeBookKey) || null,
    library: Array.isArray(library) ? library : [],
    activeWorkbook: typeof psWorkbook !== "undefined" ? psWorkbook : null
  };
}

async function psExportFullBackup() {
  const payload = psBuildFullBackup();
  const text = JSON.stringify(payload, null, 2);
  const stamp = new Date().toISOString().slice(0, 10);
  const file = new File([text], `PocketSheet-backup-${stamp}.pocketsheet.json`, { type: "application/json" });

  try {
    if (navigator.canShare?.({ files: [file] }) && navigator.share) {
      await navigator.share({ files: [file], title: "PocketSheet backup" });
      psPrivacyBackupNote.textContent = "Backup created. It is unencrypted; keep it in a trusted location.";
      return;
    }
  } catch (error) {
    if (error?.name === "AbortError") return;
  }

  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  psPrivacyBackupNote.textContent = "Backup downloaded. It is unencrypted; keep it in a trusted location.";
}

async function psRestoreFullBackup(file) {
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    if (payload?.kind !== "PocketSheetBackup" || payload?.version !== 1 || !Array.isArray(payload.library)) {
      throw new Error("Invalid PocketSheet backup");
    }
    if (!window.confirm("Restore this PocketSheet backup? This will replace the local workbook library on this device.")) return;

    localStorage.setItem("pocketsheet-workbook-library-v1", JSON.stringify(payload.library));
    const activeId = payload.activeWorkbookId && payload.library.some(book => book.id === payload.activeWorkbookId)
      ? payload.activeWorkbookId
      : payload.library[0]?.id;
    if (activeId) localStorage.setItem("pocketsheet-active-workbook-id", activeId);

    const activeRecord = payload.library.find(book => book.id === activeId) || payload.library[0];
    if (activeRecord?.workbook) {
      localStorage.setItem("pocketsheet-workbook-v1", JSON.stringify(activeRecord.workbook));
      const activeSheet = activeRecord.workbook.sheets?.find(sheet => sheet.id === activeRecord.workbook.activeId) || activeRecord.workbook.sheets?.[0];
      if (activeSheet?.data) localStorage.setItem("pocketsheet-data", JSON.stringify(activeSheet.data));
    }
    window.location.reload();
  } catch (error) {
    console.error("PocketSheet restore failed", error);
    psPrivacyBackupNote.textContent = "That file is not a valid PocketSheet backup.";
  } finally {
    psPocketBackupInput.value = "";
  }
}

psPrivacyBtn?.addEventListener("click", psOpenPrivacy);
psClosePrivacy.addEventListener("click", psClosePrivacySheet);
psPrivacyBackdrop.addEventListener("click", event => { if (event.target === psPrivacyBackdrop) psClosePrivacySheet(); });
psExportPocketBackup.addEventListener("click", psExportFullBackup);
psRestorePocketBackup.addEventListener("click", () => psPocketBackupInput.click());
psPocketBackupInput.addEventListener("change", () => psRestoreFullBackup(psPocketBackupInput.files?.[0]));
