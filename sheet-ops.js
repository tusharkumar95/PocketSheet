const psCellPanel = document.getElementById("cellPanel");
const psEditBtnForActions = document.getElementById("editBtn");

function psDeepClone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function psRefPartsAny(ref) {
  const match = /^([A-Z]+)(\d+)$/.exec(String(ref || ""));
  if (!match) return null;
  const colIndex = typeof psColumnIndexFromName === "function"
    ? psColumnIndexFromName(match[1])
    : COLS.indexOf(match[1]);
  const row = Number(match[2]);
  if (colIndex < 0 || !Number.isInteger(row) || row < 1) return null;
  return { col: match[1], colIndex, row };
}

function psRefFromParts(colIndex, row) {
  if (colIndex < 0 || row < 1) return "#REF";
  const col = typeof psColumnNameFromIndex === "function"
    ? psColumnNameFromIndex(colIndex)
    : COLS[colIndex];
  return col ? `${col}${row}` : "#REF";
}

// Make broken structural references visible instead of silently reading as blank.
const psEvaluateCellBeforeStructuralRefs = evaluateCell;
evaluateCell = function evaluateCellWithStructuralRefs(ref, seen = new Set()) {
  if (ref === "#REF") return { ok: false, value: null, display: "#REF" };
  return psEvaluateCellBeforeStructuralRefs(ref, seen);
};

// ---------- Cell action button ----------
const psCellPanelActions = document.createElement("div");
psCellPanelActions.className = "cell-panel-actions";
psEditBtnForActions.parentNode.insertBefore(psCellPanelActions, psEditBtnForActions);
psCellPanelActions.appendChild(psEditBtnForActions);

const psCellActionsBtn = document.createElement("button");
psCellActionsBtn.type = "button";
psCellActionsBtn.id = "cellActionsBtn";
psCellActionsBtn.className = "small-btn";
psCellActionsBtn.textContent = "Actions";
psCellActionsBtn.disabled = true;
psCellPanelActions.appendChild(psCellActionsBtn);

const psCellActionsMarkup = `
  <div class="editor-backdrop hidden" id="cellActionsBackdrop">
    <div class="editor-sheet cell-actions-sheet">
      <div class="grabber"></div>
      <div class="editor-head">
        <div>
          <p class="eyebrow">CELL ACTIONS</p>
          <h2 id="cellActionsTarget">A1</h2>
        </div>
        <button class="icon-btn" id="closeCellActions" aria-label="Close">✕</button>
      </div>

      <div class="cell-actions-grid">
        <button type="button" class="cell-action-btn" id="copyCellBtn"><strong>Copy</strong><small>Copy value, formula and formatting</small></button>
        <button type="button" class="cell-action-btn" id="pasteCellBtn"><strong>Paste</strong><small>Paste into the selected cell</small></button>
        <button type="button" class="cell-action-btn" id="fillDownCellBtn"><strong>Fill down</strong><small>Repeat a value or shift a formula down</small></button>
        <button type="button" class="cell-action-btn" id="clearCellBtn"><strong>Clear cell</strong><small>Remove value/formula but keep the sheet</small></button>
      </div>

      <section class="cell-actions-section">
        <p class="cell-actions-label">ROWS</p>
        <div class="cell-actions-row three">
          <button type="button" id="insertRowAboveBtn">＋ Above</button>
          <button type="button" id="insertRowBelowBtn">＋ Below</button>
          <button type="button" id="deleteRowBtn" class="danger">Delete</button>
        </div>
      </section>

      <section class="cell-actions-section">
        <p class="cell-actions-label">COLUMNS</p>
        <div class="cell-actions-row three">
          <button type="button" id="insertColLeftBtn">＋ Left</button>
          <button type="button" id="insertColRightBtn">＋ Right</button>
          <button type="button" id="deleteColBtn" class="danger">Delete</button>
        </div>
      </section>

      <p class="cell-actions-note" id="cellActionsNote">Structural changes update linked formulas automatically. PocketSheet keeps at least 5 columns for a comfortable starter grid.</p>
    </div>
  </div>`;
document.body.insertAdjacentHTML("beforeend", psCellActionsMarkup);

const psCellActionsBackdrop = document.getElementById("cellActionsBackdrop");
const psCellActionsTarget = document.getElementById("cellActionsTarget");
const psCloseCellActions = document.getElementById("closeCellActions");
const psCopyCellBtn = document.getElementById("copyCellBtn");
const psPasteCellBtn = document.getElementById("pasteCellBtn");
const psFillDownCellBtn = document.getElementById("fillDownCellBtn");
const psClearCellBtn = document.getElementById("clearCellBtn");
const psInsertRowAboveBtn = document.getElementById("insertRowAboveBtn");
const psInsertRowBelowBtn = document.getElementById("insertRowBelowBtn");
const psDeleteRowBtn = document.getElementById("deleteRowBtn");
const psInsertColLeftBtn = document.getElementById("insertColLeftBtn");
const psInsertColRightBtn = document.getElementById("insertColRightBtn");
const psDeleteColBtn = document.getElementById("deleteColBtn");
const psCellActionsNote = document.getElementById("cellActionsNote");

let psCellClipboard = null;
let psOpsPickMode = null;
let psFillSourceRef = null;

function psOpenCellActions() {
  if (!selectedRef) return;
  psCellActionsTarget.textContent = selectedRef;
  psPasteCellBtn.disabled = !psCellClipboard;
  psDeleteRowBtn.disabled = data.rows <= 1;
  psDeleteColBtn.disabled = COLS.length <= (typeof PS_MIN_COLUMNS === "number" ? PS_MIN_COLUMNS : 5);
  psInsertColLeftBtn.disabled = COLS.length >= (typeof PS_MAX_COLUMNS === "number" ? PS_MAX_COLUMNS : 52);
  psInsertColRightBtn.disabled = psInsertColLeftBtn.disabled;
  psCellActionsNote.textContent = "Structural changes update linked formulas automatically. PocketSheet keeps at least 5 columns for a comfortable starter grid.";
  psCellActionsBackdrop.classList.remove("hidden");
}

function psCloseCellActionsSheet() {
  psCellActionsBackdrop.classList.add("hidden");
}

const psSelectCellBeforeActions = selectCell;
selectCell = function selectCellWithActions(ref) {
  psSelectCellBeforeActions(ref);
  psCellActionsBtn.disabled = false;
};

psCellActionsBtn.addEventListener("click", psOpenCellActions);
psCloseCellActions.addEventListener("click", psCloseCellActionsSheet);
psCellActionsBackdrop.addEventListener("click", event => {
  if (event.target === psCellActionsBackdrop) psCloseCellActionsSheet();
});

// ---------- Copy / paste / fill ----------
function psShiftRef2D(ref, rowDelta, colDelta) {
  if (!ref || ref === "#REF") return ref || "#REF";
  const parts = psRefPartsAny(ref);
  if (!parts) return ref;
  return psRefFromParts(parts.colIndex + colDelta, parts.row + rowDelta);
}

function psShiftOperand2D(operand, rowDelta, colDelta) {
  if (operand && typeof operand === "object") {
    if (operand.kind === "number") return psDeepClone(operand);
    if (operand.kind === "cell") return { ...operand, ref: psShiftRef2D(operand.ref, rowDelta, colDelta) };
  }
  if (typeof operand === "string") return psShiftRef2D(operand, rowDelta, colDelta);
  return psDeepClone(operand);
}

function psShiftFormula2D(formula, rowDelta, colDelta) {
  if (!formula) return formula;
  if (formula.type === "lookup") {
    const searchIndex = psColumnIndexFromName(formula.searchCol);
    const returnIndex = psColumnIndexFromName(formula.returnCol);
    return {
      ...psDeepClone(formula),
      lookupRef: psShiftRef2D(formula.lookupRef, rowDelta, colDelta),
      searchCol: searchIndex >= 0 ? psColumnNameFromIndex(searchIndex + colDelta) : formula.searchCol,
      returnCol: returnIndex >= 0 ? psColumnNameFromIndex(returnIndex + colDelta) : formula.returnCol
    };
  }
  if (formula.type === "aggregate" || formula.fn) {
    return {
      ...psDeepClone(formula),
      start: psShiftRef2D(formula.start, rowDelta, colDelta),
      end: psShiftRef2D(formula.end, rowDelta, colDelta)
    };
  }
  return {
    ...psDeepClone(formula),
    left: psShiftOperand2D(formula.left, rowDelta, colDelta),
    right: psShiftOperand2D(formula.right, rowDelta, colDelta)
  };
}

function psCopySelectedCell() {
  if (!selectedRef) return;
  psCellClipboard = {
    sourceRef: selectedRef,
    cell: Object.prototype.hasOwnProperty.call(data.cells || {}, selectedRef) ? data.cells[selectedRef] : null,
    hasCell: Object.prototype.hasOwnProperty.call(data.cells || {}, selectedRef),
    formula: psDeepClone((data.formulas || {})[selectedRef] || null),
    format: psDeepClone((data.formats || {})[selectedRef] || null)
  };
  psPasteCellBtn.disabled = false;
  const display = String(evaluateCell(selectedRef).display ?? "");
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(display).catch(() => {});
  }
  psCellActionsNote.textContent = `Copied ${selectedRef}. Select another cell and use Actions → Paste.`;
}

function psPasteIntoSelectedCell() {
  if (!selectedRef || !psCellClipboard) return;
  const source = psRefPartsAny(psCellClipboard.sourceRef);
  const target = psRefPartsAny(selectedRef);
  if (!source || !target) return;
  const rowDelta = target.row - source.row;
  const colDelta = target.colIndex - source.colIndex;

  if (psCellClipboard.formula) {
    data.formulas[selectedRef] = psShiftFormula2D(psCellClipboard.formula, rowDelta, colDelta);
    delete data.cells[selectedRef];
  } else if (psCellClipboard.hasCell) {
    data.cells[selectedRef] = psCellClipboard.cell;
    delete data.formulas[selectedRef];
  } else {
    delete data.cells[selectedRef];
    delete data.formulas[selectedRef];
  }

  if (psCellClipboard.format) data.formats[selectedRef] = psDeepClone(psCellClipboard.format);
  else delete data.formats[selectedRef];

  saveData();
  psCloseCellActionsSheet();
  selectCell(selectedRef);
}

function psStartOpsFillDown() {
  if (!selectedRef) return;
  psFillSourceRef = selectedRef;
  psOpsPickMode = "fillDown";
  psCloseCellActionsSheet();
  pickBanner.classList.remove("hidden");
  pickTitle.textContent = "Fill down to…";
  pickHint.textContent = `Tap a cell below ${selectedRef} in the same column`;
  renderSheet();
}

function psApplyOpsFillDown(endRef) {
  const start = psRefPartsAny(psFillSourceRef);
  const end = psRefPartsAny(endRef);
  if (!start || !end || start.colIndex !== end.colIndex || end.row <= start.row) {
    pickHint.textContent = `Choose a cell below ${psFillSourceRef} in the same column`;
    return;
  }

  const hasCell = Object.prototype.hasOwnProperty.call(data.cells || {}, psFillSourceRef);
  const sourceCell = data.cells[psFillSourceRef];
  const sourceFormula = psDeepClone((data.formulas || {})[psFillSourceRef] || null);
  const sourceFormat = psDeepClone((data.formats || {})[psFillSourceRef] || null);

  for (let row = start.row + 1; row <= end.row; row++) {
    const targetRef = psRefFromParts(start.colIndex, row);
    if (sourceFormula) {
      data.formulas[targetRef] = psShiftFormula2D(sourceFormula, row - start.row, 0);
      delete data.cells[targetRef];
    } else if (hasCell) {
      data.cells[targetRef] = sourceCell;
      delete data.formulas[targetRef];
    } else {
      delete data.cells[targetRef];
      delete data.formulas[targetRef];
    }
    if (sourceFormat) data.formats[targetRef] = psDeepClone(sourceFormat);
    else delete data.formats[targetRef];
  }

  saveData();
  psOpsPickMode = null;
  psFillSourceRef = null;
  pickBanner.classList.add("hidden");
  selectCell(endRef);
}

const psHandleCellTapBeforeOps = handleCellTap;
handleCellTap = function handleCellTapWithOps(ref) {
  if (psOpsPickMode === "fillDown") {
    psApplyOpsFillDown(ref);
    return;
  }
  psHandleCellTapBeforeOps(ref);
};

cancelPickBtn.addEventListener("click", event => {
  if (!psOpsPickMode) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  psOpsPickMode = null;
  psFillSourceRef = null;
  pickBanner.classList.add("hidden");
  renderSheet();
}, true);

function psClearSelectedCell() {
  if (!selectedRef) return;
  delete data.cells[selectedRef];
  delete data.formulas[selectedRef];
  saveData();
  psCloseCellActionsSheet();
  selectCell(selectedRef);
}

psCopyCellBtn.addEventListener("click", psCopySelectedCell);
psPasteCellBtn.addEventListener("click", psPasteIntoSelectedCell);
psFillDownCellBtn.addEventListener("click", psStartOpsFillDown);
psClearCellBtn.addEventListener("click", psClearSelectedCell);

// ---------- Structural row/column operations ----------
function psTransformRefStructure(ref, axis, index, mode) {
  if (!ref || ref === "#REF") return ref || "#REF";
  const parts = psRefPartsAny(ref);
  if (!parts) return ref;

  let row = parts.row;
  let colIndex = parts.colIndex;

  if (axis === "row") {
    if (mode === "insert" && row >= index) row += 1;
    if (mode === "delete") {
      if (row === index) return "#REF";
      if (row > index) row -= 1;
    }
  } else {
    if (mode === "insert" && colIndex >= index) colIndex += 1;
    if (mode === "delete") {
      if (colIndex === index) return "#REF";
      if (colIndex > index) colIndex -= 1;
    }
  }

  return psRefFromParts(colIndex, row);
}

function psTransformColStructure(col, index, mode) {
  const colIndex = psColumnIndexFromName(col);
  if (colIndex < 0) return col;
  if (mode === "insert" && colIndex >= index) return psColumnNameFromIndex(colIndex + 1);
  if (mode === "delete") {
    if (colIndex === index) return "#REF";
    if (colIndex > index) return psColumnNameFromIndex(colIndex - 1);
  }
  return col;
}

function psTransformFormulaStructure(formula, axis, index, mode) {
  if (!formula) return formula;
  const next = psDeepClone(formula);

  if (next.type === "lookup") {
    next.lookupRef = psTransformRefStructure(next.lookupRef, axis, index, mode);
    if (axis === "column") {
      next.searchCol = psTransformColStructure(next.searchCol, index, mode);
      next.returnCol = psTransformColStructure(next.returnCol, index, mode);
    }
    return next;
  }

  if (next.type === "aggregate" || next.fn) {
    next.start = psTransformRefStructure(next.start, axis, index, mode);
    next.end = psTransformRefStructure(next.end, axis, index, mode);
    return next;
  }

  ["left", "right"].forEach(side => {
    const operand = next[side];
    if (operand && typeof operand === "object" && operand.kind === "cell") {
      operand.ref = psTransformRefStructure(operand.ref, axis, index, mode);
    } else if (typeof operand === "string") {
      next[side] = psTransformRefStructure(operand, axis, index, mode);
    }
  });
  return next;
}

function psRemapStore(store, axis, index, mode) {
  const next = {};
  Object.entries(store || {}).forEach(([ref, value]) => {
    const mapped = psTransformRefStructure(ref, axis, index, mode);
    if (mapped === "#REF") return;
    next[mapped] = value;
  });
  return next;
}

function psClearViewsForStructure() {
  if (typeof activeSort !== "undefined") activeSort = null;
  if (typeof activeFilter !== "undefined") activeFilter = null;
}

function psApplyStructure(axis, index, mode) {
  if (axis === "row") {
    if (mode === "insert") {
      if (data.rows >= 1000) return false;
      data.rows += 1;
    } else {
      if (data.rows <= 1) return false;
      data.rows -= 1;
    }
  } else {
    const minCols = typeof PS_MIN_COLUMNS === "number" ? PS_MIN_COLUMNS : 5;
    const maxCols = typeof PS_MAX_COLUMNS === "number" ? PS_MAX_COLUMNS : 52;
    if (mode === "insert") {
      if (COLS.length >= maxCols) return false;
    } else if (COLS.length <= minCols) {
      return false;
    }
  }

  data.cells = psRemapStore(data.cells, axis, index, mode);
  data.formats = psRemapStore(data.formats, axis, index, mode);
  const movedFormulas = psRemapStore(data.formulas, axis, index, mode);
  const transformedFormulas = {};
  Object.entries(movedFormulas).forEach(([ref, formula]) => {
    transformedFormulas[ref] = psTransformFormulaStructure(formula, axis, index, mode);
  });
  data.formulas = transformedFormulas;

  if (axis === "column") {
    const nextCount = COLS.length + (mode === "insert" ? 1 : -1);
    psSetColumnCount(nextCount);
  }

  psClearViewsForStructure();
  saveData();
  return true;
}

function psRunRowOperation(mode, where) {
  const parts = psRefPartsAny(selectedRef);
  if (!parts) return;
  const index = mode === "insert" && where === "below" ? parts.row + 1 : parts.row;
  if (!psApplyStructure("row", index, mode)) {
    psCellActionsNote.textContent = "PocketSheet supports up to 1,000 rows and keeps at least one row.";
    return;
  }
  psCloseCellActionsSheet();
  const targetRow = Math.min(index, data.rows);
  selectCell(psRefFromParts(parts.colIndex, targetRow));
}

function psRunColumnOperation(mode, where) {
  const parts = psRefPartsAny(selectedRef);
  if (!parts) return;
  const index = mode === "insert" && where === "right" ? parts.colIndex + 1 : parts.colIndex;
  if (!psApplyStructure("column", index, mode)) {
    psCellActionsNote.textContent = "PocketSheet currently keeps 5–52 columns.";
    return;
  }
  psCloseCellActionsSheet();
  const targetIndex = Math.min(index, COLS.length - 1);
  selectCell(psRefFromParts(targetIndex, parts.row));
  if (typeof psUpdateColumnTools === "function") psUpdateColumnTools();
}

psInsertRowAboveBtn.addEventListener("click", () => psRunRowOperation("insert", "above"));
psInsertRowBelowBtn.addEventListener("click", () => psRunRowOperation("insert", "below"));
psDeleteRowBtn.addEventListener("click", () => psRunRowOperation("delete", "current"));
psInsertColLeftBtn.addEventListener("click", () => psRunColumnOperation("insert", "left"));
psInsertColRightBtn.addEventListener("click", () => psRunColumnOperation("insert", "right"));
psDeleteColBtn.addEventListener("click", () => psRunColumnOperation("delete", "current"));

// ---------- Freeze controls ----------
if (typeof data.freezeHeader !== "boolean") data.freezeHeader = false;
if (typeof data.freezeFirstCol !== "boolean") data.freezeFirstCol = false;

const psFreezeSection = document.createElement("section");
psFreezeSection.className = "file-tools-section";
psFreezeSection.innerHTML = `
  <p class="file-tools-label">FREEZE</p>
  <div class="freeze-control-grid">
    <button type="button" class="freeze-toggle" id="freezeHeaderBtn">Header row</button>
    <button type="button" class="freeze-toggle" id="freezeFirstColBtn">First column</button>
  </div>`;

if (typeof psFileToolsNote !== "undefined" && psFileToolsNote && psFileToolsNote.parentNode) {
  psFileToolsNote.parentNode.insertBefore(psFreezeSection, psFileToolsNote);
}

const psFreezeHeaderBtn = document.getElementById("freezeHeaderBtn");
const psFreezeFirstColBtn = document.getElementById("freezeFirstColBtn");

function psSyncFreezeControls() {
  psFreezeHeaderBtn.classList.toggle("selected", Boolean(data.freezeHeader));
  psFreezeFirstColBtn.classList.toggle("selected", Boolean(data.freezeFirstCol));
}

function psApplyFreezeClasses() {
  sheetEl.classList.toggle("freeze-header", Boolean(data.freezeHeader));
  sheetEl.classList.toggle("freeze-first-column", Boolean(data.freezeFirstCol));
  sheetEl.classList.toggle("freeze-active", Boolean(data.freezeHeader || data.freezeFirstCol));

  document.querySelectorAll(".data-cell[data-ref]").forEach(cell => {
    const parts = psRefPartsAny(cell.dataset.ref);
    cell.classList.toggle("frozen-row-one", Boolean(parts && parts.row === 1));
    cell.classList.toggle("frozen-col-one", Boolean(parts && parts.colIndex === 0));
  });
  const rowHeaders = document.querySelectorAll(".row-header");
  rowHeaders.forEach((header, index) => header.classList.toggle("frozen-row-one-header", index === 0));
}

const psRenderSheetBeforeFreeze = renderSheet;
renderSheet = function renderSheetWithFreeze() {
  psRenderSheetBeforeFreeze();
  psApplyFreezeClasses();
};

function psToggleFreeze(key) {
  data[key] = !data[key];
  saveData();
  psSyncFreezeControls();
  renderSheet();
}

psFreezeHeaderBtn.addEventListener("click", () => psToggleFreeze("freezeHeader"));
psFreezeFirstColBtn.addEventListener("click", () => psToggleFreeze("freezeFirstCol"));
if (typeof psMoreBtn !== "undefined" && psMoreBtn) psMoreBtn.addEventListener("click", psSyncFreezeControls);

psSyncFreezeControls();
renderSheet();
