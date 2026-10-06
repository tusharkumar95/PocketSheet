const dataBtn = document.getElementById("dataBtn");
const dataBackdrop = document.getElementById("dataBackdrop");
const closeData = document.getElementById("closeData");
const dataTitle = document.getElementById("dataTitle");
const dataSubtitle = document.getElementById("dataSubtitle");
const sortGrid = document.getElementById("sortGrid");
const clearSortBtn = document.getElementById("clearSortBtn");
const filterOpGrid = document.getElementById("filterOpGrid");
const filterValue = document.getElementById("filterValue");
const applyFilterBtn = document.getElementById("applyFilterBtn");
const clearFilterBtn = document.getElementById("clearFilterBtn");
const viewBanner = document.getElementById("viewBanner");
const viewTitle = document.getElementById("viewTitle");
const viewDetail = document.getElementById("viewDetail");
const clearViewBtn = document.getElementById("clearViewBtn");

let dataColumn = null;
let filterOperator = "equals";
let activeSort = null;
let activeFilter = null;

function columnLabel(col) {
  const header = evaluateCell(`${col}1`).display;
  return header ? `${col} · ${header}` : `Column ${col}`;
}

function viewValue(col, row) {
  const evaluated = evaluateCell(`${col}${row}`);
  const display = evaluated.display == null ? "" : String(evaluated.display);
  return {
    display,
    number: cleanNumber(display),
    empty: display.trim() === ""
  };
}

function matchesActiveFilter(row) {
  if (!activeFilter) return true;

  const cell = viewValue(activeFilter.col, row);
  const criterion = String(activeFilter.value ?? "").trim();
  const cellText = cell.display.trim().toLocaleLowerCase();
  const criterionText = criterion.toLocaleLowerCase();
  const criterionNumber = cleanNumber(criterion);

  if (activeFilter.op === "equals") {
    if (cell.number !== null && criterionNumber !== null) return cell.number === criterionNumber;
    return cellText === criterionText;
  }

  if (activeFilter.op === "contains") {
    return cellText.includes(criterionText);
  }

  if (activeFilter.op === "gt") {
    return cell.number !== null && criterionNumber !== null && cell.number > criterionNumber;
  }

  if (activeFilter.op === "lt") {
    return cell.number !== null && criterionNumber !== null && cell.number < criterionNumber;
  }

  return true;
}

function compareViewRows(a, b) {
  if (!activeSort) return a - b;

  const left = viewValue(activeSort.col, a);
  const right = viewValue(activeSort.col, b);

  if (left.empty && right.empty) return a - b;
  if (left.empty) return 1;
  if (right.empty) return -1;

  let comparison = 0;
  if (left.number !== null && right.number !== null) {
    comparison = left.number - right.number;
  } else {
    comparison = left.display.localeCompare(right.display, undefined, {
      numeric: true,
      sensitivity: "base"
    });
  }

  if (comparison === 0) comparison = a - b;
  return activeSort.direction === "desc" ? -comparison : comparison;
}

function visibleDataRows() {
  const rows = [];
  for (let row = 2; row <= data.rows; row++) {
    if (matchesActiveFilter(row)) rows.push(row);
  }
  if (activeSort) rows.sort(compareViewRows);
  return rows;
}

function headerHasView(col) {
  return (activeSort && activeSort.col === col) || (activeFilter && activeFilter.col === col);
}

renderSheet = function renderSheetWithDataView() {
  sheetEl.innerHTML = "";
  sheetEl.style.gridTemplateColumns = `44px repeat(${COLS.length}, 112px)`;

  sheetEl.appendChild(makeCell("", "corner header"));
  COLS.forEach(col => {
    const header = makeCell(col, "header data-header");
    if (headerHasView(col)) header.classList.add("active-data-column");
    if (!pickMode) header.addEventListener("click", () => openDataForColumn(col));
    sheetEl.appendChild(header);
  });

  const rows = [1, ...visibleDataRows()];

  rows.forEach(row => {
    const rowHeader = makeCell(String(row), "row-header");
    if ((activeSort || activeFilter) && row > 1) rowHeader.classList.add("view-sorted-row");
    sheetEl.appendChild(rowHeader);

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
  });

  updateViewBanner();
};

const selectCellBeforeData = selectCell;
selectCell = function selectCellWithData(ref) {
  selectCellBeforeData(ref);
  dataBtn.disabled = false;
};

function openDataForColumn(col) {
  if (!COLS.includes(col)) return;
  dataColumn = col;
  dataTitle.textContent = `Column ${col}`;
  const headerText = evaluateCell(`${col}1`).display;
  dataSubtitle.textContent = headerText || "No header name yet";

  if (activeFilter && activeFilter.col === col) {
    filterOperator = activeFilter.op;
    filterValue.value = activeFilter.value;
  } else {
    filterOperator = "equals";
    filterValue.value = "";
  }

  syncDataControls();
  dataBackdrop.classList.remove("hidden");
}

function openDataFromSelection() {
  const parts = parseRef(selectedRef);
  if (!parts) return;
  openDataForColumn(parts.col);
}

function closeDataSheet() {
  dataBackdrop.classList.add("hidden");
  filterValue.blur();
}

function syncDataControls() {
  sortGrid.querySelectorAll("[data-sort]").forEach(button => {
    const selected = activeSort && activeSort.col === dataColumn && activeSort.direction === button.dataset.sort;
    button.classList.toggle("selected", Boolean(selected));
  });

  filterOpGrid.querySelectorAll("[data-filter-op]").forEach(button => {
    button.classList.toggle("selected", button.dataset.filterOp === filterOperator);
  });

  clearSortBtn.disabled = !activeSort;
  clearFilterBtn.disabled = !activeFilter;
}

function updateViewBanner() {
  if (!activeSort && !activeFilter) {
    viewBanner.classList.add("hidden");
    return;
  }

  const details = [];
  if (activeSort) {
    const arrow = activeSort.direction === "asc" ? "↑" : "↓";
    details.push(`${columnLabel(activeSort.col)} ${arrow}`);
  }
  if (activeFilter) {
    const opText = {
      equals: "=",
      contains: "contains",
      gt: ">",
      lt: "<"
    }[activeFilter.op];
    details.push(`${columnLabel(activeFilter.col)} ${opText} ${activeFilter.value || "blank"}`);
  }

  const shownRows = visibleDataRows().length;
  const totalRows = Math.max(0, data.rows - 1);
  viewTitle.textContent = activeFilter ? `${shownRows} of ${totalRows} rows shown` : "Sorted view";
  viewDetail.textContent = details.join(" · ");
  viewBanner.classList.remove("hidden");
}

function applySort(direction) {
  if (!dataColumn) return;
  activeSort = { col: dataColumn, direction };
  closeDataSheet();
  renderSheet();
}

function clearSort() {
  activeSort = null;
  closeDataSheet();
  renderSheet();
}

function applyFilter() {
  if (!dataColumn) return;
  activeFilter = {
    col: dataColumn,
    op: filterOperator,
    value: filterValue.value.trim()
  };
  closeDataSheet();
  renderSheet();
}

function clearFilter() {
  activeFilter = null;
  closeDataSheet();
  renderSheet();
}

function clearEntireView() {
  activeSort = null;
  activeFilter = null;
  renderSheet();
}

dataBtn.addEventListener("click", openDataFromSelection);
closeData.addEventListener("click", closeDataSheet);
clearViewBtn.addEventListener("click", clearEntireView);
clearSortBtn.addEventListener("click", clearSort);
clearFilterBtn.addEventListener("click", clearFilter);
applyFilterBtn.addEventListener("click", applyFilter);

sortGrid.addEventListener("click", event => {
  const button = event.target.closest("[data-sort]");
  if (!button) return;
  applySort(button.dataset.sort);
});

filterOpGrid.addEventListener("click", event => {
  const button = event.target.closest("[data-filter-op]");
  if (!button) return;
  filterOperator = button.dataset.filterOp;
  syncDataControls();
});

dataBackdrop.addEventListener("click", event => {
  if (event.target === dataBackdrop) closeDataSheet();
});

filterValue.addEventListener("keydown", event => {
  if (event.key === "Enter") applyFilter();
});

renderSheet();
