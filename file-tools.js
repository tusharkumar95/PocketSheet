const psMoreBtn = document.getElementById("moreBtn");
const psSheetTitle = document.getElementById("sheetTitle");

if (!data.title) data.title = "My Sheet";
psSheetTitle.textContent = data.title;

const psFileToolsMarkup = `
  <div class="editor-backdrop hidden" id="fileToolsBackdrop">
    <div class="editor-sheet file-tools-sheet">
      <div class="grabber"></div>
      <div class="editor-head">
        <div>
          <p class="eyebrow">SHEET</p>
          <h2>File & sheet</h2>
        </div>
        <button class="icon-btn" id="closeFileTools" aria-label="Close">✕</button>
      </div>

      <section class="file-tools-section">
        <label class="file-tools-label" for="sheetNameInput">SHEET NAME</label>
        <div class="rename-row">
          <input id="sheetNameInput" autocomplete="off" maxlength="40" />
          <button type="button" id="renameSheetBtn">Rename</button>
        </div>
      </section>

      <section class="file-tools-section">
        <p class="file-tools-label">CSV</p>
        <div class="file-action-grid">
          <button type="button" id="importCsvBtn"><span>↑</span><strong>Import CSV</strong><small>Replace this sheet with a CSV file</small></button>
          <button type="button" id="exportCsvBtn"><span>↓</span><strong>Export CSV</strong><small>Save current values as a CSV file</small></button>
        </div>
        <input type="file" id="csvFileInput" accept=".csv,text/csv,text/plain" class="hidden" />
      </section>

      <p class="file-tools-note" id="fileToolsNote">PocketSheet currently supports the first 5 CSV columns. Formula results export as their current displayed values.</p>
    </div>
  </div>`;

document.body.insertAdjacentHTML("beforeend", psFileToolsMarkup);

const psFileToolsBackdrop = document.getElementById("fileToolsBackdrop");
const psCloseFileTools = document.getElementById("closeFileTools");
const psSheetNameInput = document.getElementById("sheetNameInput");
const psRenameSheetBtn = document.getElementById("renameSheetBtn");
const psImportCsvBtn = document.getElementById("importCsvBtn");
const psExportCsvBtn = document.getElementById("exportCsvBtn");
const psCsvFileInput = document.getElementById("csvFileInput");
const psFileToolsNote = document.getElementById("fileToolsNote");

function psOpenFileTools() {
  psSheetNameInput.value = data.title || "My Sheet";
  psFileToolsNote.textContent = "PocketSheet currently supports the first 5 CSV columns. Formula results export as their current displayed values.";
  psFileToolsBackdrop.classList.remove("hidden");
}

function psCloseFileToolsSheet() {
  psFileToolsBackdrop.classList.add("hidden");
  psSheetNameInput.blur();
}

function psRenameSheet() {
  const next = psSheetNameInput.value.trim() || "My Sheet";
  data.title = next;
  saveData();
  psSheetTitle.textContent = next;
  psFileToolsNote.textContent = `Renamed to ${next}.`;
}

function psCsvEscape(value) {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function psExportCell(ref) {
  if (data.formulas && data.formulas[ref]) return String(evaluateCell(ref).display ?? "");
  return String((data.cells && data.cells[ref]) ?? "");
}

function psExportCsv() {
  const rows = [];
  for (let row = 1; row <= data.rows; row++) {
    rows.push(COLS.map(col => psCsvEscape(psExportCell(`${col}${row}`))).join(","));
  }

  while (rows.length > 1 && rows[rows.length - 1].split(",").every(value => value === "")) rows.pop();

  const blob = new Blob(["\ufeff" + rows.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safeName = (data.title || "PocketSheet").replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "") || "PocketSheet";
  link.href = url;
  link.download = `${safeName}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  psFileToolsNote.textContent = "CSV export created.";
}

function psParseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === "," && !quoted) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  row.push(field);
  rows.push(row);

  while (rows.length && rows[rows.length - 1].every(value => String(value).trim() === "")) rows.pop();
  return rows;
}

async function psImportCsv(file) {
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = psParseCsv(text);
    if (!parsed.length) {
      psFileToolsNote.textContent = "That CSV appears to be empty.";
      return;
    }

    const maxRows = 1000;
    const rows = parsed.slice(0, maxRows);
    const ignoredColumns = rows.some(row => row.length > COLS.length);
    const ignoredRows = parsed.length > maxRows;

    data.cells = {};
    data.formulas = {};
    data.formats = {};
    data.rows = Math.max(DEFAULT_ROWS, rows.length);

    rows.forEach((values, rowIndex) => {
      values.slice(0, COLS.length).forEach((value, colIndex) => {
        const cleaned = String(value ?? "");
        if (cleaned !== "") data.cells[`${COLS[colIndex]}${rowIndex + 1}`] = cleaned;
      });
    });

    saveData();
    selectedRef = null;
    renderSheet();
    cellRefEl.textContent = "No cell selected";
    cellValueEl.textContent = "Tap a cell to edit";
    cellFormulaEl.classList.add("hidden");
    editBtn.disabled = true;
    formulaBtn.disabled = true;
    if (psFormatBtn) psFormatBtn.disabled = true;

    const notes = [`Imported ${rows.length} row${rows.length === 1 ? "" : "s"}.`];
    if (ignoredColumns) notes.push("Columns after E were ignored.");
    if (ignoredRows) notes.push("Rows after 1,000 were ignored.");
    psFileToolsNote.textContent = notes.join(" ");
  } catch (error) {
    psFileToolsNote.textContent = "PocketSheet couldn't read that CSV file.";
  } finally {
    psCsvFileInput.value = "";
  }
}

psMoreBtn.addEventListener("click", psOpenFileTools);
psCloseFileTools.addEventListener("click", psCloseFileToolsSheet);
psRenameSheetBtn.addEventListener("click", psRenameSheet);
psImportCsvBtn.addEventListener("click", () => psCsvFileInput.click());
psExportCsvBtn.addEventListener("click", psExportCsv);
psCsvFileInput.addEventListener("change", () => psImportCsv(psCsvFileInput.files && psCsvFileInput.files[0]));

psSheetNameInput.addEventListener("keydown", event => {
  if (event.key === "Enter") psRenameSheet();
});

psFileToolsBackdrop.addEventListener("click", event => {
  if (event.target === psFileToolsBackdrop) psCloseFileToolsSheet();
});
