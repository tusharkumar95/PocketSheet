const psUndoBtn = document.getElementById("undoBtn");
const psFormatBtn = document.getElementById("formatBtn");

if (!data.formats) data.formats = {};

// ---------- Undo ----------
const psUndoHistory = [];
let psUndoing = false;
const psSaveDataBeforeUndo = saveData;

function psUpdateUndoButton() {
  if (psUndoBtn) psUndoBtn.disabled = psUndoHistory.length === 0;
}

saveData = function saveDataWithUndo() {
  const previous = localStorage.getItem("pocketsheet-data");
  const current = JSON.stringify(data);

  if (!psUndoing && previous && previous !== current) {
    if (psUndoHistory[psUndoHistory.length - 1] !== previous) {
      psUndoHistory.push(previous);
      if (psUndoHistory.length > 30) psUndoHistory.shift();
    }
  }

  psSaveDataBeforeUndo();
  psUpdateUndoButton();
};

function psUndo() {
  const previous = psUndoHistory.pop();
  if (!previous) return;

  try {
    psUndoing = true;
    data = JSON.parse(previous);
    if (!data.cells) data.cells = {};
    if (!data.formulas) data.formulas = {};
    if (!data.formats) data.formats = {};
    if (!data.rows) data.rows = DEFAULT_ROWS;
    localStorage.setItem("pocketsheet-data", JSON.stringify(data));
  } finally {
    psUndoing = false;
  }

  const selected = parseRef(selectedRef);
  if (selected && selected.row <= data.rows) {
    selectCell(selectedRef);
  } else {
    selectedRef = null;
    renderSheet();
    cellRefEl.textContent = "No cell selected";
    cellValueEl.textContent = "Tap a cell to edit";
    cellFormulaEl.classList.add("hidden");
    editBtn.disabled = true;
    formulaBtn.disabled = true;
    if (psFormatBtn) psFormatBtn.disabled = true;
  }

  psUpdateUndoButton();
}

if (psUndoBtn) psUndoBtn.addEventListener("click", psUndo);
psUpdateUndoButton();

// ---------- Number display formatting ----------
const psCleanNumberBeforeFormat = cleanNumber;
cleanNumber = function cleanNumberWithPercent(value) {
  if (typeof value === "string" && value.trim().endsWith("%")) {
    return psCleanNumberBeforeFormat(value.trim().slice(0, -1));
  }
  return psCleanNumberBeforeFormat(value);
};

function psFormatNumeric(value, type) {
  if (!Number.isFinite(value)) return null;

  if (type === "number") {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 8 }).format(value);
  }

  if (type === "currency") {
    const absolute = Math.abs(value);
    const formatted = new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(absolute);
    return `${value < 0 ? "-" : ""}$${formatted}`;
  }

  if (type === "percent") {
    return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(value)}%`;
  }

  return null;
}

const psEvaluateCellBeforeFormat = evaluateCell;
evaluateCell = function evaluateCellWithFormat(ref, seen = new Set()) {
  const result = psEvaluateCellBeforeFormat(ref, seen);
  const format = data.formats && data.formats[ref];
  if (!format || !format.type || format.type === "general") return result;

  const numeric = result.ok && Number.isFinite(result.value)
    ? result.value
    : cleanNumber(result.display);

  if (numeric === null || String(result.display || "").startsWith("#")) return result;
  const display = psFormatNumeric(numeric, format.type);
  return display === null ? result : { ...result, display };
};

function psApplyGridFormats() {
  document.querySelectorAll(".data-cell[data-ref]").forEach(cell => {
    const format = data.formats && data.formats[cell.dataset.ref];
    cell.classList.toggle("fmt-bold", Boolean(format && format.bold));
    cell.classList.toggle("fmt-center", Boolean(format && format.align === "center"));
    cell.classList.toggle("fmt-right", Boolean(format && format.align === "right"));
  });
}

const psRenderSheetBeforeFormat = renderSheet;
renderSheet = function renderSheetWithFormats() {
  psRenderSheetBeforeFormat();
  psApplyGridFormats();
};

const psSelectCellBeforeFormat = selectCell;
selectCell = function selectCellWithFormat(ref) {
  psSelectCellBeforeFormat(ref);
  if (psFormatBtn) psFormatBtn.disabled = false;
};

// ---------- Format sheet ----------
const psFormatMarkup = `
  <div class="editor-backdrop hidden" id="formatBackdrop">
    <div class="editor-sheet format-sheet">
      <div class="grabber"></div>
      <div class="editor-head">
        <div>
          <p class="eyebrow">FORMAT CELL</p>
          <h2 id="formatTarget">A1</h2>
        </div>
        <button class="icon-btn" id="closeFormat" aria-label="Close">✕</button>
      </div>

      <section class="format-section">
        <p class="format-label">NUMBER TYPE</p>
        <div class="format-grid" id="formatTypeGrid">
          <button type="button" data-type="general">General</button>
          <button type="button" data-type="number">1,234</button>
          <button type="button" data-type="currency">$1,234.00</button>
          <button type="button" data-type="percent">25%</button>
        </div>
      </section>

      <section class="format-section">
        <p class="format-label">TEXT</p>
        <button type="button" class="format-wide" id="formatBoldBtn"><strong>B</strong> Bold</button>
      </section>

      <section class="format-section">
        <p class="format-label">ALIGNMENT</p>
        <div class="format-grid format-align-grid" id="formatAlignGrid">
          <button type="button" data-align="left">Left</button>
          <button type="button" data-align="center">Center</button>
          <button type="button" data-align="right">Right</button>
        </div>
      </section>

      <button class="primary-btn" id="applyFormatBtn">Apply formatting</button>
    </div>
  </div>`;

document.body.insertAdjacentHTML("beforeend", psFormatMarkup);

const psFormatBackdrop = document.getElementById("formatBackdrop");
const psCloseFormat = document.getElementById("closeFormat");
const psFormatTarget = document.getElementById("formatTarget");
const psFormatTypeGrid = document.getElementById("formatTypeGrid");
const psFormatBoldBtn = document.getElementById("formatBoldBtn");
const psFormatAlignGrid = document.getElementById("formatAlignGrid");
const psApplyFormatBtn = document.getElementById("applyFormatBtn");

let psFormatDraft = { type: "general", bold: false, align: "left" };

function psCurrentFormat(ref) {
  const saved = (data.formats && data.formats[ref]) || {};
  return {
    type: saved.type || "general",
    bold: Boolean(saved.bold),
    align: saved.align || "left"
  };
}

function psSyncFormatControls() {
  psFormatTypeGrid.querySelectorAll("[data-type]").forEach(button => {
    button.classList.toggle("selected", button.dataset.type === psFormatDraft.type);
  });
  psFormatBoldBtn.classList.toggle("selected", psFormatDraft.bold);
  psFormatAlignGrid.querySelectorAll("[data-align]").forEach(button => {
    button.classList.toggle("selected", button.dataset.align === psFormatDraft.align);
  });
}

function psOpenFormat() {
  if (!selectedRef) return;
  psFormatDraft = psCurrentFormat(selectedRef);
  psFormatTarget.textContent = selectedRef;
  psSyncFormatControls();
  psFormatBackdrop.classList.remove("hidden");
}

function psCloseFormatSheet() {
  psFormatBackdrop.classList.add("hidden");
}

function psApplyFormat() {
  if (!selectedRef) return;

  const isDefault = psFormatDraft.type === "general" && !psFormatDraft.bold && psFormatDraft.align === "left";
  if (isDefault) delete data.formats[selectedRef];
  else data.formats[selectedRef] = { ...psFormatDraft };

  saveData();
  psCloseFormatSheet();
  selectCell(selectedRef);
}

if (psFormatBtn) psFormatBtn.addEventListener("click", psOpenFormat);
psCloseFormat.addEventListener("click", psCloseFormatSheet);
psApplyFormatBtn.addEventListener("click", psApplyFormat);

psFormatTypeGrid.addEventListener("click", event => {
  const button = event.target.closest("[data-type]");
  if (!button) return;
  psFormatDraft.type = button.dataset.type;
  psSyncFormatControls();
});

psFormatBoldBtn.addEventListener("click", () => {
  psFormatDraft.bold = !psFormatDraft.bold;
  psSyncFormatControls();
});

psFormatAlignGrid.addEventListener("click", event => {
  const button = event.target.closest("[data-align]");
  if (!button) return;
  psFormatDraft.align = button.dataset.align;
  psSyncFormatControls();
});

psFormatBackdrop.addEventListener("click", event => {
  if (event.target === psFormatBackdrop) psCloseFormatSheet();
});

renderSheet();
