const PS_MIN_COLUMNS = 5;
const PS_MAX_COLUMNS = 52;

function psColumnNameFromIndex(index) {
  let value = index + 1;
  let name = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function psColumnIndexFromName(name) {
  const text = String(name || "").toUpperCase();
  if (!/^[A-Z]+$/.test(text)) return -1;
  let value = 0;
  for (const char of text) value = value * 26 + (char.charCodeAt(0) - 64);
  return value - 1;
}

function psHighestStoredColumnCount() {
  const stores = [data.cells || {}, data.formulas || {}, data.formats || {}];
  let highest = 0;

  stores.forEach(store => {
    Object.keys(store).forEach(ref => {
      const match = /^([A-Z]+)\d+$/.exec(ref);
      if (!match) return;
      const index = psColumnIndexFromName(match[1]);
      if (index >= 0) highest = Math.max(highest, index + 1);
    });
  });

  return highest;
}

function psSetColumnCount(count) {
  const target = Math.max(PS_MIN_COLUMNS, Math.min(PS_MAX_COLUMNS, Number(count) || PS_MIN_COLUMNS));
  COLS.length = 0;
  for (let index = 0; index < target; index++) COLS.push(psColumnNameFromIndex(index));
  data.columnCount = target;
  return target;
}

function psSyncColumnsFromData() {
  const storedCount = Number(data.columnCount) || 0;
  const detectedCount = psHighestStoredColumnCount();
  return psSetColumnCount(Math.max(PS_MIN_COLUMNS, storedCount, detectedCount));
}

psSyncColumnsFromData();

const psColumnSection = document.createElement("section");
psColumnSection.className = "file-tools-section";
psColumnSection.innerHTML = `
  <p class="file-tools-label">COLUMNS</p>
  <div class="column-control-row">
    <div>
      <strong id="columnCountText">5 columns</strong>
      <small id="columnRangeText">A–E</small>
    </div>
    <button type="button" id="addColumnToolBtn">＋ Add column</button>
  </div>`;

if (psFileToolsNote && psFileToolsNote.parentNode) {
  psFileToolsNote.parentNode.insertBefore(psColumnSection, psFileToolsNote);
}

const psColumnCountText = document.getElementById("columnCountText");
const psColumnRangeText = document.getElementById("columnRangeText");
const psAddColumnToolBtn = document.getElementById("addColumnToolBtn");

function psUpdateColumnTools() {
  if (!psColumnCountText || !psColumnRangeText || !psAddColumnToolBtn) return;
  psColumnCountText.textContent = `${COLS.length} column${COLS.length === 1 ? "" : "s"}`;
  psColumnRangeText.textContent = `${COLS[0]}–${COLS[COLS.length - 1]}`;
  psAddColumnToolBtn.disabled = COLS.length >= PS_MAX_COLUMNS;
}

function psAddColumn() {
  if (COLS.length >= PS_MAX_COLUMNS) {
    psFileToolsNote.textContent = `PocketSheet is capped at ${PS_MAX_COLUMNS} columns for now to keep phone performance predictable.`;
    return;
  }

  psSetColumnCount(COLS.length + 1);
  saveData();
  renderSheet();
  psUpdateColumnTools();
  psFileToolsNote.textContent = `Added column ${COLS[COLS.length - 1]}.`;
}

if (psAddColumnToolBtn) psAddColumnToolBtn.addEventListener("click", psAddColumn);
if (psMoreBtn) psMoreBtn.addEventListener("click", psUpdateColumnTools);

psImportCsv = async function psImportCsvWithDynamicColumns(file) {
  if (!file) return;

  try {
    const rawText = await file.text();
    const text = rawText.replace(/^\uFEFF/, "");
    const parsed = psParseCsv(text);
    if (!parsed.length) {
      psFileToolsNote.textContent = "That CSV appears to be empty.";
      return;
    }

    const maxRows = 1000;
    const rows = parsed.slice(0, maxRows);
    const widestRow = rows.reduce((max, row) => Math.max(max, row.length), 0);
    const importedColumns = Math.max(PS_MIN_COLUMNS, Math.min(PS_MAX_COLUMNS, widestRow || PS_MIN_COLUMNS));
    const ignoredColumns = widestRow > PS_MAX_COLUMNS;
    const ignoredRows = parsed.length > maxRows;

    data.cells = {};
    data.formulas = {};
    data.formats = {};
    data.rows = Math.max(DEFAULT_ROWS, rows.length);
    psSetColumnCount(importedColumns);

    rows.forEach((values, rowIndex) => {
      values.slice(0, COLS.length).forEach((value, colIndex) => {
        const cleaned = String(value ?? "");
        if (cleaned !== "") data.cells[`${COLS[colIndex]}${rowIndex + 1}`] = cleaned;
      });
    });

    if (typeof activeSort !== "undefined") activeSort = null;
    if (typeof activeFilter !== "undefined") activeFilter = null;

    saveData();
    if (typeof psResetSelectionUi === "function") psResetSelectionUi();
    else renderSheet();
    psUpdateColumnTools();

    const notes = [
      `Imported ${rows.length} row${rows.length === 1 ? "" : "s"} across ${Math.min(widestRow, PS_MAX_COLUMNS)} column${Math.min(widestRow, PS_MAX_COLUMNS) === 1 ? "" : "s"}.`
    ];
    if (ignoredColumns) notes.push(`Columns after ${COLS[COLS.length - 1]} were ignored.`);
    if (ignoredRows) notes.push("Rows after 1,000 were ignored.");
    psFileToolsNote.textContent = notes.join(" ");
  } catch (error) {
    console.error("PocketSheet CSV import failed", error);
    psFileToolsNote.textContent = "PocketSheet couldn't read that CSV file.";
  } finally {
    psCsvFileInput.value = "";
  }
};

psUpdateColumnTools();
renderSheet();
