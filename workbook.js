const PS_WORKBOOK_KEY = "pocketsheet-workbook-v1";
const PS_MAX_SHEETS = 12;

function psWorkbookId() {
  return `sheet-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function psNormalizeSheetData(sheetData, fallbackTitle = "My Sheet") {
  const next = psDeepClone(sheetData || {});
  if (!next.cells) next.cells = {};
  if (!next.formulas) next.formulas = {};
  if (!next.formats) next.formats = {};
  if (!next.rows) next.rows = DEFAULT_ROWS;
  if (!next.title) next.title = fallbackTitle;
  if (!next.columnCount) next.columnCount = Math.max(PS_MIN_COLUMNS, psHighestStoredColumnCount());
  if (typeof next.freezeHeader !== "boolean") next.freezeHeader = false;
  if (typeof next.freezeFirstCol !== "boolean") next.freezeFirstCol = false;
  return next;
}

function psBlankSheetData(title = "My Sheet") {
  return {
    title,
    rows: DEFAULT_ROWS,
    columnCount: PS_MIN_COLUMNS,
    cells: {},
    formulas: {},
    formats: {},
    freezeHeader: false,
    freezeFirstCol: false
  };
}

function psTemplateFormula(left, op, right) {
  return {
    type: "arithmetic",
    left: { kind: "cell", ref: left },
    right: { kind: "cell", ref: right },
    op
  };
}

function psTemplateData(type) {
  if (type === "budget") {
    const sheet = psBlankSheetData("Budget");
    sheet.cells = {
      A1: "Category", B1: "Planned", C1: "Actual", D1: "Difference",
      A2: "Housing", A3: "Groceries", A4: "Transport", A5: "Bills", A6: "Other",
      A8: "Total"
    };
    for (let row = 2; row <= 6; row++) sheet.formulas[`D${row}`] = psTemplateFormula(`B${row}`, "-", `C${row}`);
    sheet.formulas.B8 = { type: "aggregate", fn: "SUM", start: "B2", end: "B6" };
    sheet.formulas.C8 = { type: "aggregate", fn: "SUM", start: "C2", end: "C6" };
    sheet.formulas.D8 = psTemplateFormula("B8", "-", "C8");
    sheet.formats.B8 = { type: "currency", bold: true, align: "right" };
    sheet.formats.C8 = { type: "currency", bold: true, align: "right" };
    sheet.formats.D8 = { type: "currency", bold: true, align: "right" };
    return sheet;
  }

  if (type === "expenses") {
    const sheet = psBlankSheetData("Expenses");
    sheet.cells = { A1: "Date", B1: "Category", C1: "Description", D1: "Amount", E1: "Paid" };
    return sheet;
  }

  if (type === "inventory") {
    const sheet = psBlankSheetData("Inventory");
    sheet.cells = {
      A1: "Item", B1: "Quantity", C1: "Unit Cost", D1: "Value", E1: "Notes"
    };
    for (let row = 2; row <= 6; row++) sheet.formulas[`D${row}`] = psTemplateFormula(`B${row}`, "*", `C${row}`);
    return sheet;
  }

  if (type === "checklist") {
    const sheet = psBlankSheetData("Checklist");
    sheet.cells = { A1: "Task", B1: "Owner", C1: "Due", D1: "Status", E1: "Notes" };
    return sheet;
  }

  if (type === "contacts") {
    const sheet = psBlankSheetData("Contacts");
    sheet.cells = { A1: "Name", B1: "Company", C1: "Phone", D1: "Email", E1: "Status" };
    return sheet;
  }

  return psBlankSheetData("My Sheet");
}

function psLoadWorkbook() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PS_WORKBOOK_KEY) || "null");
    if (parsed && Array.isArray(parsed.sheets) && parsed.sheets.length) {
      parsed.sheets = parsed.sheets.slice(0, PS_MAX_SHEETS).map((sheet, index) => ({
        id: sheet.id || psWorkbookId(),
        data: psNormalizeSheetData(sheet.data, `Sheet ${index + 1}`)
      }));
      if (!parsed.sheets.some(sheet => sheet.id === parsed.activeId)) parsed.activeId = parsed.sheets[0].id;
      return parsed;
    }
  } catch (error) {
    console.error("PocketSheet workbook load failed", error);
  }

  const first = {
    id: psWorkbookId(),
    data: psNormalizeSheetData(data, data.title || "My Sheet")
  };
  return { activeId: first.id, sheets: [first] };
}

let psWorkbook = psLoadWorkbook();

function psActiveSheetRecord() {
  return psWorkbook.sheets.find(sheet => sheet.id === psWorkbook.activeId) || psWorkbook.sheets[0];
}

function psPersistWorkbook() {
  localStorage.setItem(PS_WORKBOOK_KEY, JSON.stringify(psWorkbook));
}

function psSyncActiveRecordFromData() {
  const record = psActiveSheetRecord();
  if (!record) return;
  record.data = psNormalizeSheetData(data, data.title || "My Sheet");
  psPersistWorkbook();
}

function psClearSheetUiState() {
  if (typeof activeSort !== "undefined") activeSort = null;
  if (typeof activeFilter !== "undefined") activeFilter = null;
  if (typeof psRowCursor !== "undefined") psRowCursor = 0;
  if (typeof psUndoHistory !== "undefined") psUndoHistory.length = 0;
  if (typeof psUpdateUndoButton === "function") psUpdateUndoButton();
  if (typeof psCellActionsBtn !== "undefined" && psCellActionsBtn) psCellActionsBtn.disabled = true;
}

function psActivateSheetData(record) {
  if (!record) return;
  data = psNormalizeSheetData(record.data, "My Sheet");
  localStorage.setItem("pocketsheet-data", JSON.stringify(data));
  psSyncColumnsFromData();
  psClearSheetUiState();

  const title = document.getElementById("sheetTitle");
  if (title) title.textContent = data.title;
  if (typeof psSyncFreezeControls === "function") psSyncFreezeControls();
  if (typeof psUpdateColumnTools === "function") psUpdateColumnTools();
  if (typeof psSetView === "function") psSetView("grid");
  if (typeof psResetSelectionUi === "function") psResetSelectionUi();
  else renderSheet();
}

// On reload the workbook is canonical; mirror its active sheet into the legacy single-sheet key.
psActivateSheetData(psActiveSheetRecord());
psPersistWorkbook();

// Every normal save continues to power Undo, then updates the active workbook sheet.
const psSaveDataBeforeWorkbook = saveData;
saveData = function saveDataWithWorkbook() {
  psSaveDataBeforeWorkbook();
  psSyncActiveRecordFromData();
  psRenderSheetTabs();
};

// Undo mutates data directly, so sync the restored result back to the workbook after the existing handler runs.
if (typeof psUndoBtn !== "undefined" && psUndoBtn) {
  psUndoBtn.addEventListener("click", () => {
    psSyncActiveRecordFromData();
    psRenderSheetTabs();
  });
}

// ---------- Sheet tabs ----------
const psSheetTabs = document.createElement("nav");
psSheetTabs.className = "sheet-tabs";
psSheetTabs.setAttribute("aria-label", "Workbook sheets");
const psViewSwitcherEl = document.querySelector(".view-switcher");
if (psViewSwitcherEl) psViewSwitcherEl.insertAdjacentElement("afterend", psSheetTabs);
else document.querySelector(".topbar").insertAdjacentElement("afterend", psSheetTabs);

function psSwitchSheet(id) {
  if (id === psWorkbook.activeId) return;
  psSyncActiveRecordFromData();
  const next = psWorkbook.sheets.find(sheet => sheet.id === id);
  if (!next) return;
  psWorkbook.activeId = id;
  psPersistWorkbook();
  psActivateSheetData(next);
  psRenderSheetTabs();
}

function psNextSheetTitle(base = "Sheet") {
  const titles = new Set(psWorkbook.sheets.map(sheet => String(sheet.data.title || "").toLowerCase()));
  let index = 1;
  let candidate = `${base} ${index}`;
  while (titles.has(candidate.toLowerCase())) {
    index += 1;
    candidate = `${base} ${index}`;
  }
  return candidate;
}

function psAddWorkbookSheet(sheetData = null) {
  if (psWorkbook.sheets.length >= PS_MAX_SHEETS) return null;
  psSyncActiveRecordFromData();
  const nextData = psNormalizeSheetData(sheetData || psBlankSheetData(psNextSheetTitle()), psNextSheetTitle());
  if (!sheetData) nextData.title = psNextSheetTitle();
  const record = { id: psWorkbookId(), data: nextData };
  psWorkbook.sheets.push(record);
  psWorkbook.activeId = record.id;
  psPersistWorkbook();
  psActivateSheetData(record);
  psRenderSheetTabs();
  return record;
}

function psDuplicateActiveSheet() {
  if (psWorkbook.sheets.length >= PS_MAX_SHEETS) return;
  psSyncActiveRecordFromData();
  const copy = psDeepClone(data);
  copy.title = `${data.title || "Sheet"} Copy`;
  psAddWorkbookSheet(copy);
}

function psDeleteActiveSheet() {
  if (psWorkbook.sheets.length <= 1) return;
  const activeIndex = psWorkbook.sheets.findIndex(sheet => sheet.id === psWorkbook.activeId);
  psWorkbook.sheets.splice(activeIndex, 1);
  const nextIndex = Math.max(0, Math.min(activeIndex - 1, psWorkbook.sheets.length - 1));
  psWorkbook.activeId = psWorkbook.sheets[nextIndex].id;
  psPersistWorkbook();
  psActivateSheetData(psWorkbook.sheets[nextIndex]);
  psRenderSheetTabs();
}

function psRenderSheetTabs() {
  if (!psSheetTabs) return;
  psSheetTabs.innerHTML = "";
  psWorkbook.sheets.forEach(sheet => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sheet-tab";
    button.classList.toggle("active", sheet.id === psWorkbook.activeId);
    button.textContent = sheet.data.title || "Sheet";
    button.title = sheet.data.title || "Sheet";
    button.addEventListener("click", () => psSwitchSheet(sheet.id));
    psSheetTabs.appendChild(button);
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
    const active = psSheetTabs.querySelector(".sheet-tab.active");
    if (active) active.scrollIntoView({ block: "nearest", inline: "nearest" });
  });
}

// ---------- Workbook + template controls in ••• ----------
const psWorkbookSection = document.createElement("section");
psWorkbookSection.className = "file-tools-section";
psWorkbookSection.innerHTML = `
  <p class="file-tools-label">SHEETS</p>
  <div class="workbook-action-grid">
    <button type="button" id="newSheetBtn">＋ New</button>
    <button type="button" id="duplicateSheetBtn">Duplicate</button>
    <button type="button" id="deleteSheetBtn" class="danger">Delete</button>
  </div>
  <p class="workbook-note" id="workbookSheetNote">CSV import/export applies to the current sheet only.</p>`;

const psTemplateSection = document.createElement("section");
psTemplateSection.className = "file-tools-section";
psTemplateSection.innerHTML = `
  <p class="file-tools-label">NEW FROM TEMPLATE</p>
  <div class="template-grid">
    <button type="button" class="template-card" data-template="budget"><strong>Budget</strong><small>Planned vs actual with totals</small></button>
    <button type="button" class="template-card" data-template="expenses"><strong>Expenses</strong><small>Date, category, amount and paid</small></button>
    <button type="button" class="template-card" data-template="inventory"><strong>Inventory</strong><small>Quantity × unit cost value</small></button>
    <button type="button" class="template-card" data-template="checklist"><strong>Checklist</strong><small>Tasks, owner, due date and status</small></button>
    <button type="button" class="template-card" data-template="contacts"><strong>Contacts</strong><small>Name, company, phone and email</small></button>
    <button type="button" class="template-card" data-template="blank"><strong>Blank</strong><small>A clean 5-column sheet</small></button>
  </div>
</section>`;

if (typeof psFileToolsNote !== "undefined" && psFileToolsNote && psFileToolsNote.parentNode) {
  psFileToolsNote.parentNode.insertBefore(psWorkbookSection, psFileToolsNote);
  psFileToolsNote.parentNode.insertBefore(psTemplateSection, psFileToolsNote);
}

const psNewSheetBtn = document.getElementById("newSheetBtn");
const psDuplicateSheetBtn = document.getElementById("duplicateSheetBtn");
const psDeleteSheetBtn = document.getElementById("deleteSheetBtn");
const psWorkbookSheetNote = document.getElementById("workbookSheetNote");

function psUpdateWorkbookControls() {
  const atMax = psWorkbook.sheets.length >= PS_MAX_SHEETS;
  psNewSheetBtn.disabled = atMax;
  psDuplicateSheetBtn.disabled = atMax;
  psDeleteSheetBtn.disabled = psWorkbook.sheets.length <= 1;
  psWorkbookSheetNote.textContent = `${psWorkbook.sheets.length} of ${PS_MAX_SHEETS} sheets · CSV import/export applies to the current sheet only.`;
}

psNewSheetBtn.addEventListener("click", () => {
  psAddWorkbookSheet();
  if (typeof psCloseFileToolsSheet === "function") psCloseFileToolsSheet();
});
psDuplicateSheetBtn.addEventListener("click", () => {
  psDuplicateActiveSheet();
  if (typeof psCloseFileToolsSheet === "function") psCloseFileToolsSheet();
});
psDeleteSheetBtn.addEventListener("click", () => {
  psDeleteActiveSheet();
  if (typeof psCloseFileToolsSheet === "function") psCloseFileToolsSheet();
});

psTemplateSection.addEventListener("click", event => {
  const button = event.target.closest("[data-template]");
  if (!button || psWorkbook.sheets.length >= PS_MAX_SHEETS) return;
  const type = button.dataset.template;
  const template = type === "blank" ? psBlankSheetData(psNextSheetTitle()) : psTemplateData(type);
  psAddWorkbookSheet(template);
  if (typeof psCloseFileToolsSheet === "function") psCloseFileToolsSheet();
});

if (typeof psMoreBtn !== "undefined" && psMoreBtn) psMoreBtn.addEventListener("click", psUpdateWorkbookControls);

// Rename is already wired by file-tools.js. Render tabs after its existing listener has saved the new title.
if (typeof psRenameSheetBtn !== "undefined" && psRenameSheetBtn) {
  psRenameSheetBtn.addEventListener("click", () => {
    psSyncActiveRecordFromData();
    psRenderSheetTabs();
  });
}
if (typeof psSheetNameInput !== "undefined" && psSheetNameInput) {
  psSheetNameInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      requestAnimationFrame(() => {
        psSyncActiveRecordFromData();
        psRenderSheetTabs();
      });
    }
  });
}

psRenderSheetTabs();
psUpdateWorkbookControls();
