
const COLS = ["A","B","C","D","E"];
const DEFAULT_ROWS = 12;

const sheetEl = document.getElementById("sheet");
const cellRefEl = document.getElementById("cellRef");
const cellValueEl = document.getElementById("cellValue");
const editBtn = document.getElementById("editBtn");
const addRowBtn = document.getElementById("addRowBtn");
const editorBackdrop = document.getElementById("editorBackdrop");
const editorCellRef = document.getElementById("editorCellRef");
const cellInput = document.getElementById("cellInput");
const saveCellBtn = document.getElementById("saveCellBtn");
const closeEditor = document.getElementById("closeEditor");

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
  }
};

let selectedRef = null;

function saveData() {
  localStorage.setItem("pocketsheet-data", JSON.stringify(data));
}

function renderSheet() {
  sheetEl.innerHTML = "";
  sheetEl.style.gridTemplateColumns = `44px repeat(${COLS.length}, 112px)`;

  const corner = makeCell("", "corner header");
  sheetEl.appendChild(corner);

  COLS.forEach(col => {
    sheetEl.appendChild(makeCell(col, "header"));
  });

  for (let row = 1; row <= data.rows; row++) {
    sheetEl.appendChild(makeCell(String(row), "row-header"));
    COLS.forEach(col => {
      const ref = `${col}${row}`;
      const cell = makeCell(data.cells[ref] || "", "data-cell");
      cell.dataset.ref = ref;
      if (selectedRef === ref) cell.classList.add("selected");
      cell.addEventListener("click", () => selectCell(ref));
      cell.addEventListener("dblclick", () => openEditor(ref));
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

function selectCell(ref) {
  selectedRef = ref;
  cellRefEl.textContent = ref;
  cellValueEl.textContent = data.cells[ref] || "Empty cell";
  editBtn.disabled = false;
  renderSheet();
}

function openEditor(ref = selectedRef) {
  if (!ref) return;
  selectedRef = ref;
  editorCellRef.textContent = ref;
  cellInput.value = data.cells[ref] || "";
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
  if (value) data.cells[selectedRef] = value;
  else delete data.cells[selectedRef];
  saveData();
  cellValueEl.textContent = value || "Empty cell";
  closeEditorSheet();
  renderSheet();
}

editBtn.addEventListener("click", () => openEditor());
saveCellBtn.addEventListener("click", saveCell);
closeEditor.addEventListener("click", closeEditorSheet);

editorBackdrop.addEventListener("click", e => {
  if (e.target === editorBackdrop) closeEditorSheet();
});

cellInput.addEventListener("keydown", e => {
  if (e.key === "Enter") saveCell();
});

addRowBtn.addEventListener("click", () => {
  data.rows += 1;
  saveData();
  renderSheet();
  requestAnimationFrame(() => {
    document.querySelector(".sheet-wrap").scrollTo({
      top: document.querySelector(".sheet-wrap").scrollHeight,
      behavior: "smooth"
    });
  });
});

renderSheet();
