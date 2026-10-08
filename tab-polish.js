const psTabDeleteMarkup = `
  <div class="editor-backdrop hidden" id="tabDeleteBackdrop">
    <div class="editor-sheet tab-delete-sheet">
      <div class="grabber"></div>
      <div class="editor-head">
        <div>
          <p class="eyebrow">DELETE SHEET</p>
          <h2 id="tabDeleteTitle">Delete sheet?</h2>
        </div>
        <button class="icon-btn" id="closeTabDelete" aria-label="Close">✕</button>
      </div>
      <p class="tab-delete-copy" id="tabDeleteCopy">This removes the selected sheet from this PocketSheet workbook.</p>
      <div class="tab-delete-actions">
        <button type="button" class="tab-delete-cancel" id="cancelTabDelete">Cancel</button>
        <button type="button" class="tab-delete-confirm" id="confirmTabDelete">Delete sheet</button>
      </div>
    </div>
  </div>`;

document.body.insertAdjacentHTML("beforeend", psTabDeleteMarkup);

const psTabDeleteBackdrop = document.getElementById("tabDeleteBackdrop");
const psTabDeleteTitle = document.getElementById("tabDeleteTitle");
const psTabDeleteCopy = document.getElementById("tabDeleteCopy");
const psCloseTabDelete = document.getElementById("closeTabDelete");
const psCancelTabDelete = document.getElementById("cancelTabDelete");
const psConfirmTabDelete = document.getElementById("confirmTabDelete");
let psPendingDeleteSheetId = null;

function psSheetRecordById(id) {
  return psWorkbook.sheets.find(sheet => sheet.id === id) || null;
}

function psOpenTabDelete(id) {
  if (psWorkbook.sheets.length <= 1) return;
  const record = psSheetRecordById(id);
  if (!record) return;
  psPendingDeleteSheetId = id;
  const title = record.data.title || "Sheet";
  psTabDeleteTitle.textContent = `Delete “${title}”?`;
  psTabDeleteCopy.textContent = "This removes the entire sheet from this PocketSheet workbook. Your other tabs are not affected.";
  psTabDeleteBackdrop.classList.remove("hidden");
}

function psCloseTabDeleteSheet() {
  psPendingDeleteSheetId = null;
  psTabDeleteBackdrop.classList.add("hidden");
}

function psDeleteSheetById(id) {
  if (!id || psWorkbook.sheets.length <= 1) return;
  const index = psWorkbook.sheets.findIndex(sheet => sheet.id === id);
  if (index < 0) return;

  const deletingActive = psWorkbook.activeId === id;
  psWorkbook.sheets.splice(index, 1);

  if (deletingActive) {
    const nextIndex = Math.max(0, Math.min(index - 1, psWorkbook.sheets.length - 1));
    const next = psWorkbook.sheets[nextIndex];
    psWorkbook.activeId = next.id;
    psPersistWorkbook();
    psActivateSheetData(next);
  } else {
    psPersistWorkbook();
  }

  if (typeof psUpdateWorkbookControls === "function") psUpdateWorkbookControls();
  psRenderSheetTabs();
}

psCloseTabDelete.addEventListener("click", psCloseTabDeleteSheet);
psCancelTabDelete.addEventListener("click", psCloseTabDeleteSheet);
psConfirmTabDelete.addEventListener("click", () => {
  const id = psPendingDeleteSheetId;
  psCloseTabDeleteSheet();
  psDeleteSheetById(id);
});
psTabDeleteBackdrop.addEventListener("click", event => {
  if (event.target === psTabDeleteBackdrop) psCloseTabDeleteSheet();
});

const psRenderSheetTabsBeforeDelete = psRenderSheetTabs;
psRenderSheetTabs = function psRenderSheetTabsWithDelete() {
  psSheetTabs.innerHTML = "";

  psWorkbook.sheets.forEach(sheet => {
    const wrap = document.createElement("div");
    wrap.className = "sheet-tab-wrap";
    wrap.classList.toggle("active", sheet.id === psWorkbook.activeId);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "sheet-tab";
    button.classList.toggle("active", sheet.id === psWorkbook.activeId);
    button.textContent = sheet.data.title || "Sheet";
    button.title = sheet.data.title || "Sheet";
    button.addEventListener("click", () => psSwitchSheet(sheet.id));

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "sheet-tab-delete";
    remove.textContent = "×";
    remove.title = `Delete ${sheet.data.title || "sheet"}`;
    remove.setAttribute("aria-label", `Delete ${sheet.data.title || "sheet"}`);
    remove.disabled = psWorkbook.sheets.length <= 1;
    remove.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      psOpenTabDelete(sheet.id);
    });

    wrap.appendChild(button);
    wrap.appendChild(remove);
    psSheetTabs.appendChild(wrap);
  });

  const add = document.createElement("button");
  add.type = "button";
  add.className = "sheet-add-tab";
  add.textContent = "＋";
  add.setAttribute("aria-label", "Add sheet");
  add.disabled = psWorkbook.sheets.length >= PS_MAX_SHEETS;
  add.addEventListener("click", () => psAddWorkbookSheet());
  psSheetTabs.appendChild(add);

  requestAnimationFrame(() => {
    const active = psSheetTabs.querySelector(".sheet-tab-wrap.active");
    if (active) active.scrollIntoView({ block: "nearest", inline: "nearest" });
  });
};

// ---------- Save state ----------
const psSaveState = document.createElement("div");
psSaveState.className = "save-state";
psSaveState.innerHTML = `<span class="save-state-dot"></span><span id="saveStateText">Saved</span>`;
document.body.appendChild(psSaveState);
const psSaveStateText = document.getElementById("saveStateText");
let psSaveStateTimer = null;

function psShowSaveState(message = "Saved on this device", hold = 1300) {
  if (!psSaveState || !psSaveStateText) return;
  psSaveStateText.textContent = message;
  psSaveState.classList.add("show");
  clearTimeout(psSaveStateTimer);
  psSaveStateTimer = setTimeout(() => psSaveState.classList.remove("show"), hold);
}

const psSaveDataBeforeState = saveData;
saveData = function saveDataWithState() {
  psSaveDataBeforeState();
  psShowSaveState(navigator.onLine ? "Saved" : "Saved offline");
};

const psPersistWorkbookBeforeState = psPersistWorkbook;
psPersistWorkbook = function psPersistWorkbookWithState() {
  psPersistWorkbookBeforeState();
  psShowSaveState(navigator.onLine ? "Saved" : "Saved offline");
};

window.addEventListener("offline", () => psShowSaveState("Offline · changes stay on device", 2400));
window.addEventListener("online", () => psShowSaveState("Back online", 1600));

// ---------- Offline app shell ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(error => {
      console.warn("PocketSheet offline registration failed", error);
    });
  });
}

psRenderSheetTabs();
