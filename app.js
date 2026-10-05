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
const leftOperandBtn = document.getElementById("leftOperandBtn");
const rightOperandBtn = document.getElementById("rightOperandBtn");
const leftOperandText = document.getElementById("leftOperandText");
const rightOperandText = document.getElementById("rightOperandText");
const leftOperandValue = document.getElementById("leftOperandValue");
const rightOperandValue = document.getElementById("rightOperandValue");
const operatorPicker = document.getElementById("operatorPicker");
const formulaPreview = document.getElementById("formulaPreview");
const applyFormulaBtn = document.getElementById("applyFormulaBtn");
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
let formulaDraft = { target: null, left: null, right: null, op: "+" };

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

function evaluateCell(ref, seen = new Set()) {
  if (seen.has(ref)) return { ok: false, value: null, display: "#CYCLE" };

  const formula = data.formulas[ref];
  if (!formula) {
    const raw = data.cells[ref] ?? "";
    const numeric = cleanNumber(raw);
    return { ok: numeric !== null, value: numeric, display: String(raw) };
  }

  const nextSeen = new Set(seen);
  nextSeen.add(ref);
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
  if (pickMode) {
    formulaDraft[pickMode] = ref;
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

function openFormulaBuilder() {
  if (!selectedRef) return;
  const existing = data.formulas[selectedRef];
  formulaDraft = existing
    ? { target: selectedRef, left: existing.left, right: existing.right, op: existing.op }
    : { target: selectedRef, left: null, right: null, op: "+" };
  formulaBackdrop.classList.remove("hidden");
  updateFormulaBuilder();
}

function closeFormulaBuilder() {
  formulaBackdrop.classList.add("hidden");
  pickBanner.classList.add("hidden");
  pickMode = null;
  renderSheet();
}

function startPicking(side) {
  pickMode = side;
  formulaBackdrop.classList.add("hidden");
  pickBanner.classList.remove("hidden");
  pickTitle.textContent = side === "left" ? "Pick the first value" : "Pick the second value";
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

function previewDraft() {
  if (!formulaDraft.left || !formulaDraft.right) {
    return { ok: false, text: "Pick two cells" };
  }
  if (formulaDraft.left === formulaDraft.target || formulaDraft.right === formulaDraft.target) {
    return { ok: false, text: "Can't use the result cell itself" };
  }

  const temporary = data.formulas[formulaDraft.target];
  data.formulas[formulaDraft.target] = {
    left: formulaDraft.left,
    right: formulaDraft.right,
    op: formulaDraft.op
  };
  const result = evaluateCell(formulaDraft.target);
  if (temporary) data.formulas[formulaDraft.target] = temporary;
  else delete data.formulas[formulaDraft.target];

  if (!result.ok) {
    const message = result.display === "#DIV/0" ? "Can't divide by zero" :
      result.display === "#CYCLE" ? "This creates a circular formula" :
      "Both cells need numbers";
    return { ok: false, text: message };
  }
  return { ok: true, text: `Result: ${result.display}` };
}

function updateFormulaBuilder() {
  formulaTarget.textContent = `Result in ${formulaDraft.target}`;

  const left = operandDetails(formulaDraft.left);
  leftOperandText.textContent = left.title;
  leftOperandValue.textContent = left.subtitle;

  const right = operandDetails(formulaDraft.right);
  rightOperandText.textContent = right.title;
  rightOperandValue.textContent = right.subtitle;

  operatorPicker.querySelectorAll(".operator-btn").forEach(btn => {
    btn.classList.toggle("selected", btn.dataset.op === formulaDraft.op);
  });

  const preview = previewDraft();
  formulaPreview.textContent = preview.text;
  applyFormulaBtn.disabled = !preview.ok;
}

function applyFormula() {
  const preview = previewDraft();
  if (!preview.ok) return;
  data.formulas[formulaDraft.target] = {
    left: formulaDraft.left,
    right: formulaDraft.right,
    op: formulaDraft.op
  };
  delete data.cells[formulaDraft.target];
  saveData();
  const target = formulaDraft.target;
  closeFormulaBuilder();
  selectCell(target);
}

editBtn.addEventListener("click", () => openEditor());
saveCellBtn.addEventListener("click", saveCell);
closeEditor.addEventListener("click", closeEditorSheet);
formulaBtn.addEventListener("click", openFormulaBuilder);
closeFormula.addEventListener("click", closeFormulaBuilder);
leftOperandBtn.addEventListener("click", () => startPicking("left"));
rightOperandBtn.addEventListener("click", () => startPicking("right"));
cancelPickBtn.addEventListener("click", cancelPicking);
applyFormulaBtn.addEventListener("click", applyFormula);

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
