const psViewSwitcher = document.createElement("div");
psViewSwitcher.className = "view-switcher";
psViewSwitcher.innerHTML = `
  <button type="button" id="gridViewBtn" class="active">Grid</button>
  <button type="button" id="rowViewBtn">Rows</button>`;

document.querySelector(".topbar").insertAdjacentElement("afterend", psViewSwitcher);

const psRowView = document.createElement("section");
psRowView.className = "row-view";
psRowView.id = "rowView";
document.querySelector(".sheet-wrap").insertAdjacentElement("beforebegin", psRowView);

const psGridViewBtn = document.getElementById("gridViewBtn");
const psRowViewBtn = document.getElementById("rowViewBtn");
let psActiveView = "grid";
let psRowCursor = 0;

function psRowViewRows() {
  if (typeof visibleDataRows === "function") return visibleDataRows();
  const rows = [];
  for (let row = 2; row <= data.rows; row++) rows.push(row);
  return rows;
}

function psFieldLabel(col) {
  const header = String(evaluateCell(`${col}1`).display ?? "").trim();
  return header || `Column ${col}`;
}

function psClampRowCursor() {
  const rows = psRowViewRows();
  if (!rows.length) {
    psRowCursor = 0;
    return rows;
  }
  psRowCursor = Math.max(0, Math.min(psRowCursor, rows.length - 1));
  return rows;
}

function psRenderRowView() {
  if (psActiveView !== "rows") return;
  const rows = psClampRowCursor();
  psRowView.innerHTML = "";

  if (!rows.length) {
    psRowView.innerHTML = `
      <div class="row-view-card">
        <div class="row-empty-state">
          <strong>No visible records</strong>
          <span>Clear the current filter or add a new row.</span>
        </div>
      </div>
      <div class="row-view-actions">
        <button type="button" class="row-add-record" id="rowAddRecord">＋ Add record</button>
        <button type="button" class="row-grid-button" id="rowBackGrid">Grid view</button>
      </div>`;
    document.getElementById("rowAddRecord").addEventListener("click", psAddRecord);
    document.getElementById("rowBackGrid").addEventListener("click", () => psSetView("grid"));
    return;
  }

  const row = rows[psRowCursor];
  const card = document.createElement("div");
  card.className = "row-view-card";

  const head = document.createElement("div");
  head.className = "row-view-head";
  head.innerHTML = `
    <div>
      <p class="row-view-kicker">RECORD ${psRowCursor + 1} OF ${rows.length}</p>
      <p class="row-view-title">Row ${row}</p>
    </div>
    <div class="row-nav">
      <button type="button" id="rowPrevBtn" aria-label="Previous record">‹</button>
      <button type="button" id="rowNextBtn" aria-label="Next record">›</button>
    </div>`;
  card.appendChild(head);

  const fields = document.createElement("div");
  fields.className = "row-fields";

  COLS.forEach(col => {
    const ref = `${col}${row}`;
    const value = evaluateCell(ref);
    const formula = formulaText(ref);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "row-field";
    const display = String(value.display ?? "");
    button.innerHTML = `
      <span class="row-field-label">${psEscapeHtml(psFieldLabel(col))}${formula ? '<span class="row-fx">ƒx</span>' : ""}</span>
      <span class="row-field-value ${display ? "" : "row-field-empty"}">${psEscapeHtml(display || "Tap to enter value")}</span>
      ${formula ? `<span class="row-field-formula">${psEscapeHtml(formula)}</span>` : ""}`;
    button.addEventListener("click", () => {
      selectedRef = ref;
      openEditor(ref);
    });
    fields.appendChild(button);
  });

  card.appendChild(fields);
  psRowView.appendChild(card);

  const actions = document.createElement("div");
  actions.className = "row-view-actions";
  actions.innerHTML = `
    <button type="button" class="row-add-record" id="rowAddRecord">＋ Add record</button>
    <button type="button" class="row-grid-button" id="rowBackGrid">Grid view</button>`;
  psRowView.appendChild(actions);

  const prev = document.getElementById("rowPrevBtn");
  const next = document.getElementById("rowNextBtn");
  prev.disabled = psRowCursor === 0;
  next.disabled = psRowCursor >= rows.length - 1;
  prev.addEventListener("click", () => {
    if (psRowCursor > 0) {
      psRowCursor -= 1;
      psRenderRowView();
    }
  });
  next.addEventListener("click", () => {
    if (psRowCursor < rows.length - 1) {
      psRowCursor += 1;
      psRenderRowView();
    }
  });
  document.getElementById("rowAddRecord").addEventListener("click", psAddRecord);
  document.getElementById("rowBackGrid").addEventListener("click", () => psSetView("grid"));
}

function psEscapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function psSetView(view) {
  psActiveView = view === "rows" ? "rows" : "grid";
  const isRows = psActiveView === "rows";
  document.body.classList.toggle("row-mode", isRows);
  psGridViewBtn.classList.toggle("active", !isRows);
  psRowViewBtn.classList.toggle("active", isRows);
  if (isRows) psRenderRowView();
  else renderSheet();
}

function psAddRecord() {
  data.rows += 1;
  saveData();
  const rows = psRowViewRows();
  const newIndex = rows.indexOf(data.rows);
  psRowCursor = newIndex >= 0 ? newIndex : Math.max(0, rows.length - 1);
  psRenderRowView();
}

const psSelectCellBeforeRowView = selectCell;
selectCell = function selectCellWithRowView(ref) {
  psSelectCellBeforeRowView(ref);
  if (psActiveView === "rows") {
    const parts = parseRef(ref);
    const rows = psRowViewRows();
    if (parts) {
      const idx = rows.indexOf(parts.row);
      if (idx >= 0) psRowCursor = idx;
    }
    psRenderRowView();
  }
};

const psRenderSheetBeforeRowView = renderSheet;
renderSheet = function renderSheetWithRowViewRefresh() {
  psRenderSheetBeforeRowView();
  if (psActiveView === "rows") psRenderRowView();
};

if (typeof clearEntireView === "function") {
  const psClearEntireViewBeforeRowView = clearEntireView;
  clearEntireView = function clearEntireViewWithRows() {
    psClearEntireViewBeforeRowView();
    psRowCursor = 0;
    if (psActiveView === "rows") psRenderRowView();
  };
}

psGridViewBtn.addEventListener("click", () => psSetView("grid"));
psRowViewBtn.addEventListener("click", () => psSetView("rows"));

psSetView("grid");
