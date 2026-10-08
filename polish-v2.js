// PocketSheet polish v2: tab actions, range copy/paste, and local workbook home.

// ---------- Tab quick actions ----------
const psTabActionMarkup = `
  <div class="editor-backdrop hidden" id="tabActionBackdrop">
    <div class="editor-sheet tab-action-sheet">
      <div class="grabber"></div>
      <div class="editor-head">
        <div>
          <p class="eyebrow">SHEET TAB</p>
          <h2 id="tabActionTitle">Sheet</h2>
        </div>
        <button class="icon-btn" id="closeTabAction" aria-label="Close">✕</button>
      </div>
      <input class="tab-action-name" id="tabActionName" maxlength="40" autocomplete="off" />
      <button type="button" class="tab-action-primary" id="tabRenameBtn">Rename sheet</button>
      <div class="tab-action-grid">
        <button type="button" id="tabDuplicateBtn">Duplicate</button>
        <button type="button" id="tabMoveLeftBtn">← Move left</button>
        <button type="button" id="tabMoveRightBtn">Move right →</button>
        <button type="button" id="tabOpenBtn">Open sheet</button>
      </div>
      <button type="button" class="tab-action-delete" id="tabActionDeleteBtn">Delete sheet</button>
    </div>
  </div>`;
document.body.insertAdjacentHTML("beforeend", psTabActionMarkup);

const psTabActionBackdrop = document.getElementById("tabActionBackdrop");
const psTabActionTitle = document.getElementById("tabActionTitle");
const psTabActionName = document.getElementById("tabActionName");
const psCloseTabAction = document.getElementById("closeTabAction");
const psTabRenameBtn = document.getElementById("tabRenameBtn");
const psTabDuplicateBtn = document.getElementById("tabDuplicateBtn");
const psTabMoveLeftBtn = document.getElementById("tabMoveLeftBtn");
const psTabMoveRightBtn = document.getElementById("tabMoveRightBtn");
const psTabOpenBtn = document.getElementById("tabOpenBtn");
const psTabActionDeleteBtn = document.getElementById("tabActionDeleteBtn");
let psTabActionId = null;

function psUniqueSheetTitle(base) {
  const root = String(base || "Sheet").trim() || "Sheet";
  const used = new Set(psWorkbook.sheets.map(sheet => String(sheet.data.title || "").toLocaleLowerCase()));
  if (!used.has(root.toLocaleLowerCase())) return root;
  let index = 2;
  let candidate = `${root} ${index}`;
  while (used.has(candidate.toLocaleLowerCase())) {
    index += 1;
    candidate = `${root} ${index}`;
  }
  return candidate;
}

function psOpenTabActions(id) {
  const record = psSheetRecordById(id);
  if (!record) return;
  psTabActionId = id;
  const title = record.data.title || "Sheet";
  psTabActionTitle.textContent = title;
  psTabActionName.value = title;
  const index = psWorkbook.sheets.findIndex(sheet => sheet.id === id);
  psTabMoveLeftBtn.disabled = index <= 0;
  psTabMoveRightBtn.disabled = index < 0 || index >= psWorkbook.sheets.length - 1;
  psTabDuplicateBtn.disabled = psWorkbook.sheets.length >= PS_MAX_SHEETS;
  psTabActionDeleteBtn.disabled = psWorkbook.sheets.length <= 1;
  psTabActionBackdrop.classList.remove("hidden");
}

function psCloseTabActions() {
  psTabActionId = null;
  psTabActionBackdrop.classList.add("hidden");
  psTabActionName.blur();
}

function psRenameSheetById(id, nextTitle) {
  const record = psSheetRecordById(id);
  if (!record) return;
  const title = String(nextTitle || "").trim() || "Sheet";
  record.data.title = title;
  if (psWorkbook.activeId === id) {
    data.title = title;
    localStorage.setItem("pocketsheet-data", JSON.stringify(data));
    const heading = document.getElementById("sheetTitle");
    if (heading) heading.textContent = title;
  }
  psPersistWorkbook();
  psRenderSheetTabs();
  if (typeof psShowSaveState === "function") psShowSaveState("Sheet renamed");
}

function psDuplicateSheetById(id) {
  if (psWorkbook.sheets.length >= PS_MAX_SHEETS) return;
  const index = psWorkbook.sheets.findIndex(sheet => sheet.id === id);
  if (index < 0) return;
  const source = psWorkbook.sheets[index];
  const copyData = psDeepClone(source.data);
  copyData.title = psUniqueSheetTitle(`${source.data.title || "Sheet"} Copy`);
  const record = { id: psWorkbookId(), data: psNormalizeSheetData(copyData, copyData.title) };
  psWorkbook.sheets.splice(index + 1, 0, record);
  psWorkbook.activeId = record.id;
  psPersistWorkbook();
  psActivateSheetData(record);
  psRenderSheetTabs();
}

function psMoveSheetById(id, delta) {
  const index = psWorkbook.sheets.findIndex(sheet => sheet.id === id);
  const nextIndex = index + delta;
  if (index < 0 || nextIndex < 0 || nextIndex >= psWorkbook.sheets.length) return;
  const [record] = psWorkbook.sheets.splice(index, 1);
  psWorkbook.sheets.splice(nextIndex, 0, record);
  psPersistWorkbook();
  psRenderSheetTabs();
  psOpenTabActions(id);
}

psCloseTabAction.addEventListener("click", psCloseTabActions);
psTabActionBackdrop.addEventListener("click", event => {
  if (event.target === psTabActionBackdrop) psCloseTabActions();
});
psTabRenameBtn.addEventListener("click", () => {
  if (!psTabActionId) return;
  psRenameSheetById(psTabActionId, psTabActionName.value);
  psCloseTabActions();
});
psTabActionName.addEventListener("keydown", event => {
  if (event.key === "Enter") psTabRenameBtn.click();
});
psTabDuplicateBtn.addEventListener("click", () => {
  const id = psTabActionId;
  psCloseTabActions();
  psDuplicateSheetById(id);
});
psTabMoveLeftBtn.addEventListener("click", () => {
  if (psTabActionId) psMoveSheetById(psTabActionId, -1);
});
psTabMoveRightBtn.addEventListener("click", () => {
  if (psTabActionId) psMoveSheetById(psTabActionId, 1);
});
psTabOpenBtn.addEventListener("click", () => {
  const id = psTabActionId;
  psCloseTabActions();
  if (id) psSwitchSheet(id);
});
psTabActionDeleteBtn.addEventListener("click", () => {
  const id = psTabActionId;
  psCloseTabActions();
  if (id) psOpenTabDelete(id);
});

const psRenderSheetTabsBeforeV2 = psRenderSheetTabs;
psRenderSheetTabs = function psRenderSheetTabsV2() {
  psRenderSheetTabsBeforeV2();
  const wraps = Array.from(psSheetTabs.querySelectorAll(".sheet-tab-wrap"));
  wraps.forEach((wrap, index) => {
    const record = psWorkbook.sheets[index];
    if (!record) return;
    const more = document.createElement("button");
    more.type = "button";
    more.className = "sheet-tab-more";
    more.textContent = "•••";
    more.setAttribute("aria-label", `Sheet options for ${record.data.title || "sheet"}`);
    more.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      psOpenTabActions(record.id);
    });
    const remove = wrap.querySelector(".sheet-tab-delete");
    if (remove) wrap.insertBefore(more, remove);
    else wrap.appendChild(more);
  });
};

// ---------- Multi-cell range copy/paste ----------
let psRangeClipboard = null;
let psRangePickStart = null;
let psRangePickMode = false;
let psRangeHighlight = null;

const psRangeCopyBtn = document.createElement("button");
psRangeCopyBtn.type = "button";
psRangeCopyBtn.id = "copyRangeBtn";
psRangeCopyBtn.className = "cell-action-btn";
psRangeCopyBtn.innerHTML = "<strong>Copy range</strong><small>Pick the opposite corner of a block</small>";

const psRangePasteBtn = document.createElement("button");
psRangePasteBtn.type = "button";
psRangePasteBtn.id = "pasteRangeBtn";
psRangePasteBtn.className = "cell-action-btn";
psRangePasteBtn.innerHTML = "<strong>Paste range</strong><small>Paste block from selected top-left cell</small>";
psRangePasteBtn.disabled = true;

const psActionsGridForRange = document.querySelector(".cell-actions-grid");
if (psActionsGridForRange) {
  psActionsGridForRange.appendChild(psRangeCopyBtn);
  psActionsGridForRange.appendChild(psRangePasteBtn);
}

function psRangeBounds(firstRef, secondRef) {
  const first = psRefPartsAny(firstRef);
  const second = psRefPartsAny(secondRef);
  if (!first || !second) return null;
  return {
    minRow: Math.min(first.row, second.row),
    maxRow: Math.max(first.row, second.row),
    minCol: Math.min(first.colIndex, second.colIndex),
    maxCol: Math.max(first.colIndex, second.colIndex)
  };
}

function psRangeLabel(bounds) {
  if (!bounds) return "";
  return `${psRefFromParts(bounds.minCol, bounds.minRow)}:${psRefFromParts(bounds.maxCol, bounds.maxRow)}`;
}

function psCaptureRange(startRef, endRef) {
  const bounds = psRangeBounds(startRef, endRef);
  if (!bounds) return null;
  const entries = [];
  const textRows = [];
  for (let row = bounds.minRow; row <= bounds.maxRow; row++) {
    const textRow = [];
    for (let col = bounds.minCol; col <= bounds.maxCol; col++) {
      const ref = psRefFromParts(col, row);
      entries.push({
        sourceRef: ref,
        rowOffset: row - bounds.minRow,
        colOffset: col - bounds.minCol,
        hasCell: Object.prototype.hasOwnProperty.call(data.cells || {}, ref),
        cell: Object.prototype.hasOwnProperty.call(data.cells || {}, ref) ? data.cells[ref] : null,
        formula: psDeepClone((data.formulas || {})[ref] || null),
        format: psDeepClone((data.formats || {})[ref] || null)
      });
      textRow.push(String(evaluateCell(ref).display ?? ""));
    }
    textRows.push(textRow.join("\t"));
  }
  return {
    bounds,
    rows: bounds.maxRow - bounds.minRow + 1,
    cols: bounds.maxCol - bounds.minCol + 1,
    entries,
    text: textRows.join("\n")
  };
}

function psStartRangeCopy() {
  if (!selectedRef) return;
  psRangePickStart = selectedRef;
  psRangePickMode = true;
  psCloseCellActionsSheet();
  pickBanner.classList.remove("hidden");
  pickTitle.textContent = "Copy range to…";
  pickHint.textContent = `Start is ${selectedRef}. Tap the opposite corner.`;
  renderSheet();
}

function psFinishRangeCopy(endRef) {
  psRangeClipboard = psCaptureRange(psRangePickStart, endRef);
  psRangePickMode = false;
  pickBanner.classList.add("hidden");
  if (!psRangeClipboard) return;
  psRangeHighlight = psRangeClipboard.bounds;
  psRangePasteBtn.disabled = false;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(psRangeClipboard.text).catch(() => {});
  }
  renderSheet();
  selectCell(psRefFromParts(psRangeClipboard.bounds.minCol, psRangeClipboard.bounds.minRow));
  if (typeof psShowSaveState === "function") psShowSaveState(`Copied ${psRangeLabel(psRangeClipboard.bounds)}`, 1700);
}

function psPasteRange() {
  if (!selectedRef || !psRangeClipboard) return;
  const target = psRefPartsAny(selectedRef);
  if (!target) return;
  const finalRow = target.row + psRangeClipboard.rows - 1;
  const finalCol = target.colIndex + psRangeClipboard.cols - 1;
  const maxCols = typeof PS_MAX_COLUMNS === "number" ? PS_MAX_COLUMNS : 52;
  if (finalRow > 1000 || finalCol >= maxCols) {
    psCellActionsNote.textContent = "That range would exceed PocketSheet's current 1,000-row or 52-column limit.";
    return;
  }

  if (finalRow > data.rows) data.rows = finalRow;
  if (finalCol >= COLS.length) psSetColumnCount(finalCol + 1);

  psRangeClipboard.entries.forEach(entry => {
    const targetRef = psRefFromParts(target.colIndex + entry.colOffset, target.row + entry.rowOffset);
    const source = psRefPartsAny(entry.sourceRef);
    const targetParts = psRefPartsAny(targetRef);
    const rowDelta = targetParts.row - source.row;
    const colDelta = targetParts.colIndex - source.colIndex;

    if (entry.formula) {
      data.formulas[targetRef] = psShiftFormula2D(entry.formula, rowDelta, colDelta);
      delete data.cells[targetRef];
    } else if (entry.hasCell) {
      data.cells[targetRef] = entry.cell;
      delete data.formulas[targetRef];
    } else {
      delete data.cells[targetRef];
      delete data.formulas[targetRef];
    }

    if (entry.format) data.formats[targetRef] = psDeepClone(entry.format);
    else delete data.formats[targetRef];
  });

  psRangeHighlight = {
    minRow: target.row,
    maxRow: finalRow,
    minCol: target.colIndex,
    maxCol: finalCol
  };
  saveData();
  psCloseCellActionsSheet();
  selectCell(selectedRef);
  renderSheet();
  if (typeof psUpdateColumnTools === "function") psUpdateColumnTools();
}

psRangeCopyBtn.addEventListener("click", psStartRangeCopy);
psRangePasteBtn.addEventListener("click", psPasteRange);
psCellActionsBtn.addEventListener("click", () => {
  psRangePasteBtn.disabled = !psRangeClipboard;
});

const psHandleCellTapBeforeRange = handleCellTap;
handleCellTap = function handleCellTapWithRange(ref) {
  if (psRangePickMode) {
    psFinishRangeCopy(ref);
    return;
  }
  psHandleCellTapBeforeRange(ref);
};

cancelPickBtn.addEventListener("click", event => {
  if (!psRangePickMode) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  psRangePickMode = false;
  psRangePickStart = null;
  pickBanner.classList.add("hidden");
  renderSheet();
}, true);

function psApplyRangeHighlight() {
  if (!psRangeHighlight) return;
  document.querySelectorAll(".data-cell[data-ref]").forEach(cell => {
    const parts = psRefPartsAny(cell.dataset.ref);
    if (!parts) return;
    const inside = parts.row >= psRangeHighlight.minRow && parts.row <= psRangeHighlight.maxRow &&
      parts.colIndex >= psRangeHighlight.minCol && parts.colIndex <= psRangeHighlight.maxCol;
    cell.classList.toggle("range-highlight", inside);
    const corner = inside && parts.row === psRangeHighlight.minRow && parts.colIndex === psRangeHighlight.minCol;
    cell.classList.toggle("range-corner", corner);
  });
}

const psRenderSheetBeforeRange = renderSheet;
renderSheet = function renderSheetWithRange() {
  psRenderSheetBeforeRange();
  psApplyRangeHighlight();
};

// ---------- Local workbook library / Home ----------
const PS_LIBRARY_KEY = "pocketsheet-workbook-library-v1";
const PS_ACTIVE_BOOK_KEY = "pocketsheet-active-workbook-id";
const PS_MAX_WORKBOOKS = 10;

function psWorkbookLibraryId() {
  return `book-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function psLoadLibrary() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PS_LIBRARY_KEY) || "null");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("PocketSheet workbook library could not be read", error);
    return [];
  }
}

let psWorkbookLibrary = psLoadLibrary();
let psActiveBookId = localStorage.getItem(PS_ACTIVE_BOOK_KEY);

function psDefaultWorkbookName() {
  const firstTitle = psWorkbook.sheets[0] && psWorkbook.sheets[0].data && psWorkbook.sheets[0].data.title;
  return firstTitle && firstTitle !== "My Sheet" ? firstTitle : "My Workbook";
}

function psSaveLibrary() {
  localStorage.setItem(PS_LIBRARY_KEY, JSON.stringify(psWorkbookLibrary.slice(0, PS_MAX_WORKBOOKS)));
}

function psEnsureWorkbookLibrary() {
  let active = psWorkbookLibrary.find(book => book.id === psActiveBookId);
  if (!active) {
    const record = {
      id: psWorkbookLibraryId(),
      name: psDefaultWorkbookName(),
      updatedAt: Date.now(),
      workbook: psDeepClone(psWorkbook)
    };
    psWorkbookLibrary.unshift(record);
    psActiveBookId = record.id;
    localStorage.setItem(PS_ACTIVE_BOOK_KEY, psActiveBookId);
    psSaveLibrary();
    active = record;
  }
  return active;
}

function psSyncLibraryActive() {
  const record = psWorkbookLibrary.find(book => book.id === psActiveBookId) || psEnsureWorkbookLibrary();
  record.workbook = psDeepClone(psWorkbook);
  record.updatedAt = Date.now();
  psWorkbookLibrary.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
  psSaveLibrary();
  if (typeof psRenderHome === "function" && !psWorkbookHome.classList.contains("hidden")) psRenderHome();
}

psEnsureWorkbookLibrary();
const psPersistWorkbookBeforeLibrary = psPersistWorkbook;
psPersistWorkbook = function psPersistWorkbookWithLibrary() {
  psPersistWorkbookBeforeLibrary();
  psSyncLibraryActive();
};
psSyncLibraryActive();

const psHomeMarkup = `
  <section class="workbook-home hidden" id="workbookHome" aria-label="PocketSheet home">
    <div class="home-topbar">
      <div class="home-brand"><small>POCKETSHEET</small><strong>Workbooks</strong></div>
      <button type="button" class="home-close" id="closeWorkbookHome" aria-label="Close home">✕</button>
    </div>
    <div class="home-body">
      <button type="button" class="home-new" id="newWorkbookBtn">＋ New workbook</button>
      <p class="home-section-title">RECENT</p>
      <div class="home-workbooks" id="homeWorkbooks"></div>
    </div>
  </section>
  <div class="editor-backdrop hidden" id="newWorkbookBackdrop">
    <div class="editor-sheet new-workbook-sheet">
      <div class="grabber"></div>
      <div class="editor-head">
        <div><p class="eyebrow">NEW WORKBOOK</p><h2>Name your workbook</h2></div>
        <button class="icon-btn" id="closeNewWorkbook" aria-label="Close">✕</button>
      </div>
      <input id="newWorkbookName" maxlength="50" autocomplete="off" placeholder="My Workbook" />
      <p class="new-workbook-help">Starts with one blank sheet. Workbooks stay on this device and work offline.</p>
      <button type="button" class="primary-btn" id="createWorkbookBtn">Create workbook</button>
    </div>
  </div>`;
document.body.insertAdjacentHTML("beforeend", psHomeMarkup);

const psWorkbookHome = document.getElementById("workbookHome");
const psCloseWorkbookHome = document.getElementById("closeWorkbookHome");
const psNewWorkbookBtn = document.getElementById("newWorkbookBtn");
const psHomeWorkbooks = document.getElementById("homeWorkbooks");
const psNewWorkbookBackdrop = document.getElementById("newWorkbookBackdrop");
const psCloseNewWorkbook = document.getElementById("closeNewWorkbook");
const psNewWorkbookName = document.getElementById("newWorkbookName");
const psCreateWorkbookBtn = document.getElementById("createWorkbookBtn");
const psBrandHomeBtn = document.querySelector(".brand-label");

function psRecentLabel(timestamp) {
  const value = Number(timestamp || 0);
  if (!value) return "Saved locally";
  const minutes = Math.max(0, Math.floor((Date.now() - value) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function psRenderHome() {
  psHomeWorkbooks.innerHTML = "";
  psWorkbookLibrary
    .slice()
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
    .forEach(book => {
      const current = book.id === psActiveBookId;
      const card = document.createElement("article");
      card.className = `home-workbook-card${current ? " current" : ""}`;
      const sheetCount = book.workbook && Array.isArray(book.workbook.sheets) ? book.workbook.sheets.length : 0;
      const currentSheet = book.workbook && book.workbook.sheets
        ? book.workbook.sheets.find(sheet => sheet.id === book.workbook.activeId) || book.workbook.sheets[0]
        : null;
      const currentTitle = currentSheet && currentSheet.data ? currentSheet.data.title : "Sheet";
      const info = document.createElement("div");
      info.innerHTML = `<strong></strong><small></small>`;
      info.querySelector("strong").textContent = book.name || "Workbook";
      info.querySelector("small").textContent = `${sheetCount} sheet${sheetCount === 1 ? "" : "s"} · ${currentTitle || "Sheet"} · ${psRecentLabel(book.updatedAt)}`;
      const open = document.createElement("button");
      open.type = "button";
      open.className = "home-open-btn";
      open.textContent = current ? "Current" : "Open";
      open.addEventListener("click", () => {
        if (current) {
          psWorkbookHome.classList.add("hidden");
          return;
        }
        psOpenWorkbook(book.id);
      });
      card.appendChild(info);
      card.appendChild(open);
      psHomeWorkbooks.appendChild(card);
    });
}

function psOpenHome() {
  psSyncActiveRecordFromData();
  psPersistWorkbook();
  psRenderHome();
  psWorkbookHome.classList.remove("hidden");
}

function psOpenWorkbook(id) {
  psSyncLibraryActive();
  const record = psWorkbookLibrary.find(book => book.id === id);
  if (!record || !record.workbook) return;
  psActiveBookId = id;
  localStorage.setItem(PS_ACTIVE_BOOK_KEY, id);
  localStorage.setItem(PS_WORKBOOK_KEY, JSON.stringify(record.workbook));
  const activeSheet = record.workbook.sheets.find(sheet => sheet.id === record.workbook.activeId) || record.workbook.sheets[0];
  if (activeSheet && activeSheet.data) localStorage.setItem("pocketsheet-data", JSON.stringify(activeSheet.data));
  window.location.reload();
}

function psCreateWorkbook(name) {
  if (psWorkbookLibrary.length >= PS_MAX_WORKBOOKS) {
    if (typeof psShowSaveState === "function") psShowSaveState(`Maximum ${PS_MAX_WORKBOOKS} local workbooks for now`, 2200);
    return;
  }
  psSyncLibraryActive();
  const sheetData = psBlankSheetData("My Sheet");
  const sheetId = psWorkbookId();
  const workbook = { activeId: sheetId, sheets: [{ id: sheetId, data: sheetData }] };
  const record = {
    id: psWorkbookLibraryId(),
    name: String(name || "").trim() || "My Workbook",
    updatedAt: Date.now(),
    workbook
  };
  psWorkbookLibrary.unshift(record);
  psSaveLibrary();
  localStorage.setItem(PS_ACTIVE_BOOK_KEY, record.id);
  localStorage.setItem(PS_WORKBOOK_KEY, JSON.stringify(workbook));
  localStorage.setItem("pocketsheet-data", JSON.stringify(sheetData));
  window.location.reload();
}

if (psBrandHomeBtn) {
  psBrandHomeBtn.setAttribute("role", "button");
  psBrandHomeBtn.setAttribute("tabindex", "0");
  psBrandHomeBtn.setAttribute("aria-label", "Open PocketSheet home");
  psBrandHomeBtn.addEventListener("click", psOpenHome);
  psBrandHomeBtn.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") psOpenHome();
  });
}
psCloseWorkbookHome.addEventListener("click", () => psWorkbookHome.classList.add("hidden"));
psNewWorkbookBtn.addEventListener("click", () => {
  psNewWorkbookName.value = "";
  psNewWorkbookBackdrop.classList.remove("hidden");
  setTimeout(() => psNewWorkbookName.focus(), 50);
});
psCloseNewWorkbook.addEventListener("click", () => psNewWorkbookBackdrop.classList.add("hidden"));
psNewWorkbookBackdrop.addEventListener("click", event => {
  if (event.target === psNewWorkbookBackdrop) psNewWorkbookBackdrop.classList.add("hidden");
});
psCreateWorkbookBtn.addEventListener("click", () => psCreateWorkbook(psNewWorkbookName.value));
psNewWorkbookName.addEventListener("keydown", event => {
  if (event.key === "Enter") psCreateWorkbook(psNewWorkbookName.value);
});

psRenderSheetTabs();
