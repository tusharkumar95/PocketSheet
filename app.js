const COLS = ["A","B","C","D","E"];
const DEFAULT_ROWS = 12;

const sheetEl = document.getElementById("sheet");
const cellRefEl = document.getElementById("cellRef");
const cellValueEl = document.getElementById("cellValue");
const cellFormulaEl = document.getElementById("cellFormula");
const editBtn = document.getElementById("editBtn");
const addRowBtn = document.getElementById("addRowBtn");
const formulaBtn = document.getElementById("formulaBtn");

const editorBackdrop = document.getElementById("editorBackdrop");
const editorCellRef = document.getElementById("editorCellRef");
const cellInput = document.getElementById("cellInput");
const saveCellBtn = document.getElementById("saveCellBtn");
const closeEditor = document.getElementById("closeEditor");

const formulaBackdrop = document.getElementById("formulaBackdrop");
const formulaTarget = document.getElementById("formulaTarget");
const closeFormula = document.getElementById("closeFormula");
const formulaModePicker = document.getElementById("formulaModePicker");
const formulaHelp = document.getElementById("formulaHelp");
const leftOperandBtn = document.getElementById("leftOperandBtn");
const rightOperandBtn = document.getElementById("rightOperandBtn");
const leftOperandLabel = document.getElementById("leftOperandLabel");
const rightOperandLabel = document.getElementById("rightOperandLabel");
const leftOperandText = document.getElementById("leftOperandText");
const rightOperandText = document.getElementById("rightOperandText");
const leftOperandValue = document.getElementById("leftOperandValue");
const rightOperandValue = document.getElementById("rightOperandValue");
const operatorPicker = document.getElementById("operatorPicker");
const formulaPreview = document.getElementById("formulaPreview");
const applyFormulaBtn = document.getElementById("applyFormulaBtn");
const fillDownBtn = document.getElementById("fillDownBtn");
const pickBanner = document.getElementById("pickBanner");
const pickTitle = document.getElementById("pickTitle");
const pickHint = document.getElementById("pickHint");
const cancelPickBtn = document.getElementById("cancelPickBtn");

let data = JSON.parse(localStorage.getItem("pocketsheet-data") || "null") || {
  rows: DEFAULT_ROWS,
  cells: {
    A1: "Item",
    B1: "Cost",
    C1: "Paid",
    A2: "Rent",
    B2: "2100",
    C2: "Yes",
    A3: "Phone",
    B3: "65",
    C3: "Yes",
    A4: "Hydro",
    B4: "92"
  },
  formulas: {}
};

if (!data.formulas) data.formulas = {};
if (!data.cells) data.cells = {};
if (!data.rows) data.rows = DEFAULT_ROWS;

let selectedRef = null;
let pickMode = null;
let formulaDraft = {
  target: null,
  mode: "arithmetic",
  first: null,
  second: null,
  op: "+"
};

function saveData() {
  localStorage.setItem("pocketsheet-data", JSON.stringify(data));
}

function cleanNumber(value) {
  if (typeof value === "number") return value;
  if (value === null || value === undefined || value === "") return null;
  const cleaned = String(value).trim().replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return "#ERROR";
  const rounded = Math.round((value + Number.EPSILON) * 100000000) / 100000000;
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 8 }).format(rounded);
}

function parseRef(ref) {
  const match = /^([A-Z]+)(\d+)$/.exec(ref || "");
  if (!match) return null;
  const colIndex = COLS.indexOf(match[1]);
  const row = Number(match[2]);
  if (colIndex < 0 || !Number.isInteger(row) || row < 1) return null;
  return { col: match[1], colIndex, row };
}

function makeRef(colIndex, row) {
  if (colIndex < 0 || colIndex >= COLS.length || row < 1) return null;
  return `${COLS[colIndex]}${row}`;
}

function refsInRange(startRef, endRef) {
  const start = parseRef(startRef);
  const end = parseRef(endRef);
  if (!start || !end) return [];

  const minCol = Math.min(start.colIndex, end.colIndex);
  const maxCol = Math.max(start.colIndex, end.colIndex);
  const minRow = Math.min(start.row, end.row);
  const maxRow = Math.max(start.row, end.row);
  const refs = [];

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      refs.push(makeRef(col, row));
    }
  }
  return refs.filter(Boolean);
}

function formulaKind(formula) {
  if (!formula) return null;
  if (formula.type === "aggregate" || formula.fn) return "aggregate";
  return "arithmetic";
}

function evaluateCell(ref, seen = new Set()) {
  if (seen.has(ref)) return { ok: false, value: null, display: "#CYCLE" };

  const formula = data.formulas[ref];
  if (!formula) {
    const raw = data.cells[ref] ?? "";
    const numeric = cleanNumber(raw);
    return { ok: numeric !== null, value: numeric, display: String(raw), raw: true };
  }

  const nextSeen = new Set(seen);
  nextSeen.add(ref);

  if (formulaKind(formula) === "aggregate") {
    const rangeRefs = refsInRange(formula.start, formula.end);
    if (!rangeRefs.length) return { ok: false, value: null, display: "#RANGE" };
    if (rangeRefs.includes(ref)) return { ok: false, value: null, display: "#CYCLE" };

    const numbers = [];
    for (const rangeRef of rangeRefs) {
      const evaluated = evaluateCell(rangeRef, nextSeen);
      if (evaluated.ok) {
        numbers.push(evaluated.value);
      } else if (!evaluated.raw && String(evaluated.display).startsWith("#")) {
        return evaluated;
      }
    }

    const fn = String(formula.fn || "SUM").toUpperCase();
    if (fn === "COUNT") {
      return { ok: true, value: numbers.length, display: formatNumber(numbers.length) };
    }
    if (!numbers.length) {
      return { ok: false, value: null, display: fn === "AVERAGE" ? "#DIV/0" : "0" };
    }
    if (fn === "SUM") {
      const result = numbers.reduce((sum, value) => sum + value, 0);
      return { ok: true, value: result, display: formatNumber(result) };
    }
    if (fn === "AVERAGE") {
      const result = numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
      return { ok: true, value: result, display: formatNumber(result) };
    }
    return { ok: false, value: null, display: "#ERROR" };
  }

  const left = evaluateCell(formula.left, nextSeen);
  const right = evaluateCell(formula.right, nextSeen);

  if (!left.ok || !right.ok) {
    const cycle = left.display === "#CYCLE" || right.display === "#CYCLE";
    return { ok: false, value: null, display: cycle ? "#CYCLE" : "#VALUE" };
  }

  let result;
  if (formula.op === "+") result = left.value + right.value;
  if (formula.op === "-") result = left.value - right.value;
  if (formula.op === "*") result = left.value * right.value;
  if (formula.op === "/") {
    if (right.value === 0) return { ok: false, value: null, display: "#DIV/0" };
    result = left.value / right.value;
  }

  if (!Number.isFinite(result)) return { ok: false, value: null, display: "#ERROR" };
  return { ok: true, value: result, display: formatNumber(result) };
}

function formulaText(ref) {
  const formula = data.formulas[ref];
  if (!formula) return "";

  if (formulaKind(formula) === "aggregate") {
    return `=${String(formula.fn).toUpperCase()}(${formula.start}:${formula.end})`;
  }

  const symbol = formula.op === "*" ? "×" : formula.op === "/" ? "÷" : formula.op;
  return `=${formula.left} ${symbol} ${formula.right}`;
}

function renderSheet() {
  sheetEl.innerHTML = "";
  sheetEl.style.gridTemplateColumns = `44px repeat(${COLS.length}, 112px)`;

  sheetEl.appendChild(makeCell("", "corner header"));
  COLS.forEach(col => sheetEl.appendChild(makeCell(col, "header")));

  for (let row = 1; row <= data.rows; row++) {
    sheetEl.appendChild(makeCell(String(row), "row-header"));
    COLS.forEach(col => {
      const ref = `${col}${row}`;
      const evaluated = evaluateCell(ref);
      const cell = makeCell(evaluated.display, "data-cell");
      cell.dataset.ref = ref;
      if (selectedRef === ref && !pickMode) cell.classList.add("selected");
      if (data.formulas[ref]) cell.classList.add("formula-cell");
      if (pickMode) cell.classList.add("pickable");
      cell.addEventListener("click", () => handleCellTap(ref));
      cell.addEventListener("dblclick", () => {
        if (!pickMode) openEditor(ref);
      });
      sheetEl.appendChild(cell);
    });
  }
}

function makeCell(text, className) {
  const div = document.createElement("div");
  div.className = `cell ${className}`;
  div.textContent = text;
  return div;
}

function handleCellTap(ref) {
  if (pickMode === "fillEnd") {
    applyFillDown(ref);
    return;
  }

  if (pickMode) {
    if (pickMode === "first") formulaDraft.first = ref;
    if (pickMode === "second") formulaDraft.second = ref;
    pickMode = null;
    pickBanner.classList.add("hidden");
    formulaBackdrop.classList.remove("hidden");
    updateFormulaBuilder();
    renderSheet();
    return;
  }

  selectCell(ref);
}

function selectCell(ref) {
  selectedRef = ref;
  const evaluated = evaluateCell(ref);
  cellRefEl.textContent = ref;
  cellValueEl.textContent = evaluated.display || "Empty cell";
  const fText = formulaText(ref);
  cellFormulaEl.textContent = fText;
  cellFormulaEl.classList.toggle("hidden", !fText);
  editBtn.disabled = false;
  formulaBtn.disabled = false;
  renderSheet();
}

function openEditor(ref = selectedRef) {
  if (!ref) return;
  selectedRef = ref;
  editorCellRef.textContent = ref;
  cellInput.value = data.formulas[ref] ? evaluateCell(ref).display : (data.cells[ref] || "");
  editorBackdrop.classList.remove("hidden");
  setTimeout(() => cellInput.focus(), 120);
}

function closeEditorSheet() {
  editorBackdrop.classList.add("hidden");
  cellInput.blur();
}

function saveCell() {
  if (!selectedRef) return;
  const value = cellInput.value.trim();
  delete data.formulas[selectedRef];
  if (value) data.cells[selectedRef] = value;
  else delete data.cells[selectedRef];
  saveData();
  closeEditorSheet();
  selectCell(selectedRef);
}

function draftFromExisting(target, formula) {
  if (!formula) {
    return { target, mode: "arithmetic", first: null, second: null, op: "+" };
  }

  if (formulaKind(formula) === "aggregate") {
    const fn = String(formula.fn || "SUM").toLowerCase();
    return {
      target,
      mode: ["sum", "average", "count"].includes(fn) ? fn : "sum",
      first: formula.start,
      second: formula.end,
      op: "+"
    };
  }

  return {
    target,
    mode: "arithmetic",
    first: formula.left,
    second: formula.right,
    op: formula.op || "+"
  };
}

function openFormulaBuilder() {
  if (!selectedRef) return;
  formulaDraft = draftFromExisting(selectedRef, data.formulas[selectedRef]);
  formulaBackdrop.classList.remove("hidden");
  updateFormulaBuilder();
}

function closeFormulaBuilder() {
  formulaBackdrop.classList.add("hidden");
  pickBanner.classList.add("hidden");
  pickMode = null;
  renderSheet();
}

function startPicking(which) {
  pickMode = which;
  formulaBackdrop.classList.add("hidden");
  pickBanner.classList.remove("hidden");

  if (formulaDraft.mode === "arithmetic") {
    pickTitle.textContent = which === "first" ? "Pick the first value" : "Pick the second value";
  } else {
    pickTitle.textContent = which === "first" ? "Pick the start of the range" : "Pick the end of the range";
  }
  pickHint.textContent = `Result will stay in ${formulaDraft.target}`;
  renderSheet();
}

function cancelPicking() {
  pickMode = null;
  pickBanner.classList.add("hidden");
  formulaBackdrop.classList.remove("hidden");
  updateFormulaBuilder();
  renderSheet();
}

function operandDetails(ref) {
  if (!ref) return { title: "Pick a cell", subtitle: "Tap to choose" };
  const evaluated = evaluateCell(ref);
  return {
    title: ref,
    subtitle: evaluated.display === "" ? "Empty cell" : `Value: ${evaluated.display}`
  };
}

function buildDraftFormula() {
  if (formulaDraft.mode === "arithmetic") {
    return {
      type: "arithmetic",
      left: formulaDraft.first,
      right: formulaDraft.second,
      op: formulaDraft.op
    };
  }

  return {
    type: "aggregate",
    fn: formulaDraft.mode.toUpperCase(),
    start: formulaDraft.first,
    end: formulaDraft.second
  };
}

function previewDraft() {
  if (!formulaDraft.first || !formulaDraft.second) {
    return {
      ok: false,
      text: formulaDraft.mode === "arithmetic" ? "Pick two cells" : "Pick a range"
    };
  }

  if (formulaDraft.first === formulaDraft.target || formulaDraft.second === formulaDraft.target) {
    return { ok: false, text: "Can't use the result cell itself" };
  }

  const temporary = data.formulas[formulaDraft.target];
  data.formulas[formulaDraft.target] = buildDraftFormula();
  const result = evaluateCell(formulaDraft.target);
  if (temporary) data.formulas[formulaDraft.target] = temporary;
  else delete data.formulas[formulaDraft.target];

  if (!result.ok) {
    const message = result.display === "#DIV/0" ? "Can't divide by zero / no numbers to average" :
      result.display === "#CYCLE" ? "This creates a circular formula" :
      result.display === "#RANGE" ? "Choose a valid range" :
      formulaDraft.mode === "arithmetic" ? "Both cells need numbers" : "Range needs numbers";
    return { ok: false, text: message };
  }
  return { ok: true, text: `Result: ${result.display}` };
}

function updateFormulaBuilder() {
  formulaTarget.textContent = `Result in ${formulaDraft.target}`;

  formulaModePicker.querySelectorAll(".mode-btn").forEach(btn => {
    btn.classList.toggle("selected", btn.dataset.mode === formulaDraft.mode);
  });

  const isArithmetic = formulaDraft.mode === "arithmetic";
  operatorPicker.classList.toggle("hidden", !isArithmetic);
  leftOperandLabel.textContent = isArithmetic ? "FIRST VALUE" : "RANGE START";
  rightOperandLabel.textContent = isArithmetic ? "SECOND VALUE" : "RANGE END";

  const help = {
    arithmetic: "Build the calculation by tapping cells instead of typing a formula.",
    sum: "Total all numeric cells between the start and end you choose.",
    average: "Average all numeric cells between the start and end you choose.",
    count: "Count how many numeric cells are in the range you choose."
  };
  formulaHelp.textContent = help[formulaDraft.mode];

  const left = operandDetails(formulaDraft.first);
  leftOperandText.textContent = left.title;
  leftOperandValue.textContent = left.subtitle;

  const right = operandDetails(formulaDraft.second);
  rightOperandText.textContent = right.title;
  rightOperandValue.textContent = right.subtitle;

  operatorPicker.querySelectorAll(".operator-btn").forEach(btn => {
    btn.classList.toggle("selected", btn.dataset.op === formulaDraft.op);
  });

  const preview = previewDraft();
  formulaPreview.textContent = preview.text;
  applyFormulaBtn.disabled = !preview.ok;

  const hasExistingFormula = Boolean(data.formulas[formulaDraft.target]);
  const targetParts = parseRef(formulaDraft.target);
  fillDownBtn.classList.toggle("hidden", !hasExistingFormula || !targetParts || targetParts.row >= data.rows);
}

function applyFormula() {
  const preview = previewDraft();
  if (!preview.ok) return;
  data.formulas[formulaDraft.target] = buildDraftFormula();
  delete data.cells[formulaDraft.target];
  saveData();
  const target = formulaDraft.target;
  closeFormulaBuilder();
  selectCell(target);
}

function shiftRef(ref, rowDelta) {
  const parts = parseRef(ref);
  if (!parts) return ref;
  return makeRef(parts.colIndex, parts.row + rowDelta) || ref;
}

function shiftFormula(formula, rowDelta) {
  if (formulaKind(formula) === "aggregate") {
    return {
      type: "aggregate",
      fn: formula.fn,
      start: shiftRef(formula.start, rowDelta),
      end: shiftRef(formula.end, rowDelta)
    };
  }

  return {
    type: "arithmetic",
    left: shiftRef(formula.left, rowDelta),
    right: shiftRef(formula.right, rowDelta),
    op: formula.op
  };
}

function startFillDown() {
  if (!formulaDraft.target || !data.formulas[formulaDraft.target]) return;
  pickMode = "fillEnd";
  formulaBackdrop.classList.add("hidden");
  pickBanner.classList.remove("hidden");
  pickTitle.textContent = "Fill formula down to…";
  pickHint.textContent = `Tap a cell below ${formulaDraft.target} in the same column`;
  renderSheet();
}

function applyFillDown(endRef) {
  const start = parseRef(formulaDraft.target);
  const end = parseRef(endRef);

  if (!start || !end || start.colIndex !== end.colIndex || end.row <= start.row) {
    pickHint.textContent = `Choose a cell below ${formulaDraft.target} in the same column`;
    return;
  }

  const sourceFormula = data.formulas[formulaDraft.target];
  if (!sourceFormula) {
    cancelPicking();
    return;
  }

  for (let row = start.row + 1; row <= end.row; row++) {
    const targetRef = makeRef(start.colIndex, row);
    data.formulas[targetRef] = shiftFormula(sourceFormula, row - start.row);
    delete data.cells[targetRef];
  }

  saveData();
  pickMode = null;
  pickBanner.classList.add("hidden");
  selectCell(endRef);
}

editBtn.addEventListener("click", () => openEditor());
saveCellBtn.addEventListener("click", saveCell);
closeEditor.addEventListener("click", closeEditorSheet);
formulaBtn.addEventListener("click", openFormulaBuilder);
closeFormula.addEventListener("click", closeFormulaBuilder);
leftOperandBtn.addEventListener("click", () => startPicking("first"));
rightOperandBtn.addEventListener("click", () => startPicking("second"));
cancelPickBtn.addEventListener("click", () => {
  if (pickMode === "fillEnd") {
    pickMode = null;
    pickBanner.classList.add("hidden");
    formulaBackdrop.classList.remove("hidden");
    updateFormulaBuilder();
    renderSheet();
  } else {
    cancelPicking();
  }
});
applyFormulaBtn.addEventListener("click", applyFormula);
fillDownBtn.addEventListener("click", startFillDown);

formulaModePicker.addEventListener("click", event => {
  const button = event.target.closest(".mode-btn");
  if (!button) return;
  formulaDraft.mode = button.dataset.mode;
  formulaDraft.first = null;
  formulaDraft.second = null;
  updateFormulaBuilder();
});

operatorPicker.addEventListener("click", event => {
  const button = event.target.closest(".operator-btn");
  if (!button) return;
  formulaDraft.op = button.dataset.op;
  updateFormulaBuilder();
});

editorBackdrop.addEventListener("click", event => {
  if (event.target === editorBackdrop) closeEditorSheet();
});

formulaBackdrop.addEventListener("click", event => {
  if (event.target === formulaBackdrop) closeFormulaBuilder();
});

cellInput.addEventListener("keydown", event => {
  if (event.key === "Enter") saveCell();
});

addRowBtn.addEventListener("click", () => {
  data.rows += 1;
  saveData();
  renderSheet();
  requestAnimationFrame(() => {
    const wrap = document.querySelector(".sheet-wrap");
    wrap.scrollTo({ top: wrap.scrollHeight, behavior: "smooth" });
  });
});

renderSheet();
