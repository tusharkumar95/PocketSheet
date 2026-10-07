const psSummaryView = document.createElement("section");
psSummaryView.className = "summary-view";
psSummaryView.id = "summaryView";
document.querySelector(".sheet-wrap").insertAdjacentElement("beforebegin", psSummaryView);

let psSummaryGroupCol = "A";
let psSummaryValueCol = "B";
let psSummaryFn = "SUM";

function psSummaryColumnOptions(includeOverall = false) {
  const options = [];
  if (includeOverall) options.push(`<option value="">Overall only</option>`);
  COLS.forEach(col => {
    const label = psFieldLabel(col);
    options.push(`<option value="${col}">${psEscapeHtml(col)} · ${psEscapeHtml(label)}</option>`);
  });
  return options.join("");
}

function psSummaryRows() {
  if (typeof visibleDataRows === "function") return visibleDataRows();
  const rows = [];
  for (let row = 2; row <= data.rows; row++) rows.push(row);
  return rows;
}

function psSummaryDisplay(ref) {
  return String(evaluateCell(ref).display ?? "");
}

function psBuildSummary() {
  const rows = psSummaryRows();
  const groups = new Map();

  rows.forEach(row => {
    const rawGroup = psSummaryGroupCol ? psSummaryDisplay(`${psSummaryGroupCol}${row}`).trim() : "All rows";
    const group = rawGroup || "(Blank)";
    if (!groups.has(group)) groups.set(group, { label: group, rows: 0, numbers: [] });
    const bucket = groups.get(group);
    bucket.rows += 1;

    if (psSummaryFn !== "COUNT") {
      const value = cleanNumber(psSummaryDisplay(`${psSummaryValueCol}${row}`));
      if (value !== null) bucket.numbers.push(value);
    }
  });

  const result = Array.from(groups.values()).map(group => {
    let value = null;
    let used = group.rows;

    if (psSummaryFn === "COUNT") {
      value = group.rows;
    } else if (psSummaryFn === "SUM") {
      value = group.numbers.length ? group.numbers.reduce((sum, n) => sum + n, 0) : null;
      used = group.numbers.length;
    } else if (psSummaryFn === "AVERAGE") {
      value = group.numbers.length ? group.numbers.reduce((sum, n) => sum + n, 0) / group.numbers.length : null;
      used = group.numbers.length;
    }

    return { ...group, value, used };
  });

  result.sort((a, b) => {
    if (a.value === null && b.value === null) return a.label.localeCompare(b.label);
    if (a.value === null) return 1;
    if (b.value === null) return -1;
    if (b.value !== a.value) return b.value - a.value;
    return a.label.localeCompare(b.label);
  });

  return { rows, result };
}

function psSummaryValueLabel() {
  if (psSummaryFn === "COUNT") return "Count";
  const header = psFieldLabel(psSummaryValueCol);
  return `${psSummaryFn === "SUM" ? "Total" : "Average"} ${header}`;
}

function psRenderSummaryView() {
  if (typeof psActiveView !== "undefined" && psActiveView !== "summary") return;

  const built = psBuildSummary();
  const filterNote = typeof activeFilter !== "undefined" && activeFilter
    ? "Current filter is applied to this summary."
    : "Summary uses all data rows currently visible in the sheet.";

  psSummaryView.innerHTML = `
    <div class="summary-builder">
      <div class="summary-builder-head">
        <p class="eyebrow">CREATE SUMMARY</p>
        <strong>Simple pivot view</strong>
      </div>
      <div class="summary-control-grid">
        <div class="summary-control">
          <label for="summaryGroupCol">Group by</label>
          <select id="summaryGroupCol">${psSummaryColumnOptions(true)}</select>
        </div>
        <div class="summary-control">
          <label for="summaryFunction">Calculate</label>
          <select id="summaryFunction">
            <option value="SUM">Total</option>
            <option value="AVERAGE">Average</option>
            <option value="COUNT">Count rows</option>
          </select>
        </div>
        <div class="summary-control" id="summaryValueWrap">
          <label for="summaryValueCol">Value column</label>
          <select id="summaryValueCol">${psSummaryColumnOptions(false)}</select>
        </div>
      </div>
      <p class="summary-note">${psEscapeHtml(filterNote)} Change any option and the summary updates instantly.</p>
    </div>
    <div class="summary-results" id="summaryResults"></div>`;

  const groupSelect = document.getElementById("summaryGroupCol");
  const functionSelect = document.getElementById("summaryFunction");
  const valueSelect = document.getElementById("summaryValueCol");
  const valueWrap = document.getElementById("summaryValueWrap");

  groupSelect.value = psSummaryGroupCol;
  functionSelect.value = psSummaryFn;
  valueSelect.value = psSummaryValueCol;
  valueWrap.classList.toggle("hidden", psSummaryFn === "COUNT");

  groupSelect.addEventListener("change", () => {
    psSummaryGroupCol = groupSelect.value;
    psRenderSummaryView();
  });
  functionSelect.addEventListener("change", () => {
    psSummaryFn = functionSelect.value;
    psRenderSummaryView();
  });
  valueSelect.addEventListener("change", () => {
    psSummaryValueCol = valueSelect.value;
    psRenderSummaryView();
  });

  psRenderSummaryResults(built);
}

function psRenderSummaryResults(built) {
  const host = document.getElementById("summaryResults");
  if (!host) return;

  if (!built.rows.length) {
    host.innerHTML = `<div class="summary-empty"><strong>No rows to summarize</strong><span>Clear the current filter or add data.</span></div>`;
    return;
  }

  const groupCount = built.result.length;
  host.innerHTML = `
    <div class="summary-kpis">
      <div class="summary-kpi"><span>Records</span><strong>${built.rows.length}</strong></div>
      <div class="summary-kpi"><span>${psSummaryGroupCol ? "Groups" : "Summary"}</span><strong>${groupCount}</strong></div>
    </div>
    <div class="summary-list"></div>`;

  const list = host.querySelector(".summary-list");
  built.result.forEach(item => {
    const row = document.createElement("div");
    row.className = "summary-row";
    const valueText = item.value === null ? "—" : formatNumber(item.value);
    const detail = psSummaryFn === "COUNT"
      ? `${item.rows} record${item.rows === 1 ? "" : "s"}`
      : `${item.used} numeric value${item.used === 1 ? "" : "s"}`;
    row.innerHTML = `
      <div class="summary-row-label">
        <strong>${psEscapeHtml(item.label)}</strong>
        <small>${psEscapeHtml(detail)}</small>
      </div>
      <div class="summary-row-value" aria-label="${psEscapeHtml(psSummaryValueLabel())}">${psEscapeHtml(valueText)}</div>`;
    list.appendChild(row);
  });
}

const psRenderSheetBeforeSummary = renderSheet;
renderSheet = function renderSheetWithSummaryRefresh() {
  psRenderSheetBeforeSummary();
  if (typeof psActiveView !== "undefined" && psActiveView === "summary") psRenderSummaryView();
};
