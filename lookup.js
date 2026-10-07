const psLookupMarkup = `
  <div class="editor-backdrop hidden" id="lookupBackdrop">
    <div class="editor-sheet lookup-sheet">
      <div class="grabber"></div>
      <div class="editor-head">
        <div>
          <p class="eyebrow">LOOKUP</p>
          <h2 id="lookupTarget">Result in E2</h2>
        </div>
        <button class="icon-btn" id="closeLookup" aria-label="Close">✕</button>
      </div>

      <p class="lookup-help">Find an exact match in one column and return the value from another column on the same row.</p>

      <div class="lookup-stack">
        <button class="lookup-card" id="lookupValueBtn">
          <span>VALUE TO FIND</span>
          <strong id="lookupValueText">Pick a cell</strong>
          <small id="lookupValueSub">Tap to choose the value you want to search for</small>
        </button>

        <button class="lookup-card" id="lookupSearchBtn">
          <span>LOOK IN COLUMN</span>
          <strong id="lookupSearchText">Pick a column</strong>
          <small id="lookupSearchSub">Tap any cell in the column that contains the matching values</small>
        </button>

        <button class="lookup-card" id="lookupReturnBtn">
          <span>RETURN FROM COLUMN</span>
          <strong id="lookupReturnText">Pick a column</strong>
          <small id="lookupReturnSub">Tap any cell in the column you want returned</small>
        </button>
      </div>

      <div class="lookup-preview">
        <span>Preview</span>
        <strong id="lookupPreview">Choose all three items</strong>
      </div>

      <button class="primary-btn" id="applyLookupBtn" disabled>Apply lookup</button>
      <p class="lookup-note">PocketSheet uses exact match and returns the first matching row. The header row is not searched.</p>
    </div>
  </div>`;

document.body.insertAdjacentHTML("beforeend", psLookupMarkup);

const psLookupBackdrop = document.getElementById("lookupBackdrop");
const psCloseLookup = document.getElementById("closeLookup");
const psLookupTarget = document.getElementById("lookupTarget");
const psLookupValueBtn = document.getElementById("lookupValueBtn");
const psLookupSearchBtn = document.getElementById("lookupSearchBtn");
const psLookupReturnBtn = document.getElementById("lookupReturnBtn");
const psLookupValueText = document.getElementById("lookupValueText");
const psLookupValueSub = document.getElementById("lookupValueSub");
const psLookupSearchText = document.getElementById("lookupSearchText");
const psLookupSearchSub = document.getElementById("lookupSearchSub");
const psLookupReturnText = document.getElementById("lookupReturnText");
const psLookupReturnSub = document.getElementById("lookupReturnSub");
const psLookupPreview = document.getElementById("lookupPreview");
const psApplyLookupBtn = document.getElementById("applyLookupBtn");

const psLookupLaunchBtn = document.createElement("button");
psLookupLaunchBtn.type = "button";
psLookupLaunchBtn.className = "lookup-launch-btn";
psLookupLaunchBtn.innerHTML = `<div><strong>Find & Return</strong><small>Easy exact-match lookup instead of typing VLOOKUP</small></div><span>⌕</span>`;
formulaModePicker.insertAdjacentElement("afterend", psLookupLaunchBtn);

let psLookupPickMode = null;
let psLookupDraft = {
  target: null,
  valueRef: null,
  searchCol: null,
  returnCol: null
};

function psIsLookupFormula(formula) {
  return Boolean(formula && formula.type === "lookup");
}

function psNormalizeLookupValue(value) {
  const text = value == null ? "" : String(value).trim();
  const number = cleanNumber(text);
  return { text: text.toLocaleLowerCase(), number };
}

function psLookupValuesMatch(left, right) {
  const a = psNormalizeLookupValue(left);
  const b = psNormalizeLookupValue(right);
  if (a.number !== null && b.number !== null) return a.number === b.number;
  return a.text === b.text;
}

const psEvaluateCellBeforeLookup = evaluateCell;
evaluateCell = function evaluateCellWithLookup(ref, seen = new Set()) {
  const formula = data.formulas[ref];
  if (!psIsLookupFormula(formula)) return psEvaluateCellBeforeLookup(ref, seen);

  if (seen.has(ref)) return { ok: false, value: null, display: "#CYCLE" };
  const nextSeen = new Set(seen);
  nextSeen.add(ref);

  if (!formula.lookupRef || !COLS.includes(formula.searchCol) || !COLS.includes(formula.returnCol)) {
    return { ok: false, value: null, display: "#LOOKUP" };
  }

  const source = evaluateCell(formula.lookupRef, nextSeen);
  const needle = source.display == null ? "" : String(source.display);
  if (needle.trim() === "") return { ok: false, value: null, display: "#N/A" };
  if (!source.raw && needle.startsWith("#")) return source;

  let matchRow = null;
  for (let row = 2; row <= data.rows; row++) {
    const candidate = evaluateCell(`${formula.searchCol}${row}`, nextSeen);
    const candidateDisplay = candidate.display == null ? "" : String(candidate.display);
    if (!candidate.raw && candidateDisplay.startsWith("#")) continue;
    if (psLookupValuesMatch(needle, candidateDisplay)) {
      matchRow = row;
      break;
    }
  }

  if (matchRow === null) return { ok: false, value: null, display: "#N/A" };

  const returnRef = `${formula.returnCol}${matchRow}`;
  if (returnRef === ref) return { ok: false, value: null, display: "#CYCLE" };

  const returned = evaluateCell(returnRef, nextSeen);
  const display = returned.display == null ? "" : String(returned.display);
  if (!returned.raw && display.startsWith("#")) return returned;

  const numeric = cleanNumber(display);
  return {
    ok: numeric !== null,
    value: numeric,
    display,
    raw: numeric === null,
    lookup: true
  };
};

const psFormulaTextBeforeLookup = formulaText;
formulaText = function formulaTextWithLookup(ref) {
  const formula = data.formulas[ref];
  if (psIsLookupFormula(formula)) {
    return `=LOOKUP(${formula.lookupRef}, ${formula.searchCol} → ${formula.returnCol})`;
  }
  return psFormulaTextBeforeLookup(ref);
};

const psShiftFormulaBeforeLookup = shiftFormula;
shiftFormula = function shiftFormulaWithLookup(formula, rowDelta) {
  if (psIsLookupFormula(formula)) {
    return {
      type: "lookup",
      lookupRef: shiftRef(formula.lookupRef, rowDelta),
      searchCol: formula.searchCol,
      returnCol: formula.returnCol,
      exact: true
    };
  }
  return psShiftFormulaBeforeLookup(formula, rowDelta);
};

const psHandleCellTapBeforeLookup = handleCellTap;
handleCellTap = function handleCellTapWithLookup(ref) {
  if (!psLookupPickMode) return psHandleCellTapBeforeLookup(ref);

  const parts = parseRef(ref);
  if (!parts) return;

  if (psLookupPickMode === "value") psLookupDraft.valueRef = ref;
  if (psLookupPickMode === "search") psLookupDraft.searchCol = parts.col;
  if (psLookupPickMode === "return") psLookupDraft.returnCol = parts.col;

  psLookupPickMode = null;
  pickBanner.classList.add("hidden");
  psLookupBackdrop.classList.remove("hidden");
  psUpdateLookupBuilder();
  renderSheet();
};

const psRenderSheetBeforeLookup = renderSheet;
renderSheet = function renderSheetWithLookupPick() {
  psRenderSheetBeforeLookup();
  if (psLookupPickMode) {
    document.querySelectorAll(".data-cell").forEach(cell => cell.classList.add("lookup-pickable"));
  }
};

function psColumnDescription(col) {
  if (!col) return { title: "Pick a column", sub: "Tap to choose" };
  const header = evaluateCell(`${col}1`).display;
  return {
    title: header ? `${col} · ${header}` : `Column ${col}`,
    sub: `Rows 2–${data.rows}`
  };
}

function psValueDescription(ref) {
  if (!ref) return { title: "Pick a cell", sub: "Tap to choose the value you want to search for" };
  const value = evaluateCell(ref).display;
  return {
    title: ref,
    sub: value === "" ? "This cell is empty" : `Value: ${value}`
  };
}

function psBuildLookupFormula() {
  return {
    type: "lookup",
    lookupRef: psLookupDraft.valueRef,
    searchCol: psLookupDraft.searchCol,
    returnCol: psLookupDraft.returnCol,
    exact: true
  };
}

function psPreviewLookup() {
  if (!psLookupDraft.valueRef || !psLookupDraft.searchCol || !psLookupDraft.returnCol) {
    return { valid: false, apply: false, text: "Choose all three items" };
  }

  if (psLookupDraft.valueRef === psLookupDraft.target) {
    return { valid: false, apply: false, text: "The result cell can't look up itself" };
  }

  const sourceDisplay = String(evaluateCell(psLookupDraft.valueRef).display ?? "");
  if (sourceDisplay.trim() === "") {
    return { valid: false, apply: false, text: "The value-to-find cell is empty" };
  }

  const previous = data.formulas[psLookupDraft.target];
  data.formulas[psLookupDraft.target] = psBuildLookupFormula();
  const result = evaluateCell(psLookupDraft.target);
  if (previous) data.formulas[psLookupDraft.target] = previous;
  else delete data.formulas[psLookupDraft.target];

  if (result.display === "#CYCLE") {
    return { valid: false, apply: false, text: "This lookup creates a circular reference" };
  }
  if (result.display === "#N/A") {
    return { valid: true, apply: true, text: "No exact match yet · #N/A" };
  }
  if (String(result.display).startsWith("#")) {
    return { valid: false, apply: false, text: result.display };
  }
  return { valid: true, apply: true, text: `Result: ${result.display || "blank"}` };
}

function psUpdateLookupBuilder() {
  psLookupTarget.textContent = `Result in ${psLookupDraft.target}`;

  const value = psValueDescription(psLookupDraft.valueRef);
  psLookupValueText.textContent = value.title;
  psLookupValueSub.textContent = value.sub;

  const search = psColumnDescription(psLookupDraft.searchCol);
  psLookupSearchText.textContent = search.title;
  psLookupSearchSub.textContent = psLookupDraft.searchCol ? `Search ${search.sub}` : "Tap any cell in the matching column";

  const returned = psColumnDescription(psLookupDraft.returnCol);
  psLookupReturnText.textContent = returned.title;
  psLookupReturnSub.textContent = psLookupDraft.returnCol ? `Return the value from ${returned.title}` : "Tap any cell in the return column";

  const preview = psPreviewLookup();
  psLookupPreview.textContent = preview.text;
  psApplyLookupBtn.disabled = !preview.apply;
}

function psOpenLookupBuilder(target = selectedRef) {
  if (!target) return;
  const existing = data.formulas[target];
  psLookupDraft = psIsLookupFormula(existing)
    ? {
        target,
        valueRef: existing.lookupRef,
        searchCol: existing.searchCol,
        returnCol: existing.returnCol
      }
    : { target, valueRef: null, searchCol: null, returnCol: null };

  formulaBackdrop.classList.add("hidden");
  psLookupBackdrop.classList.remove("hidden");
  psUpdateLookupBuilder();
}

function psCloseLookupBuilder() {
  psLookupBackdrop.classList.add("hidden");
  pickBanner.classList.add("hidden");
  psLookupPickMode = null;
  renderSheet();
}

function psStartLookupPick(mode) {
  psLookupPickMode = mode;
  psLookupBackdrop.classList.add("hidden");
  pickBanner.classList.remove("hidden");

  if (mode === "value") {
    pickTitle.textContent = "Pick the value to find";
    pickHint.textContent = `The lookup result will stay in ${psLookupDraft.target}`;
  }
  if (mode === "search") {
    pickTitle.textContent = "Pick the search column";
    pickHint.textContent = "Tap any cell in the column containing matching values";
  }
  if (mode === "return") {
    pickTitle.textContent = "Pick the return column";
    pickHint.textContent = "Tap any cell in the column you want PocketSheet to return";
  }
  renderSheet();
}

function psApplyLookup() {
  const preview = psPreviewLookup();
  if (!preview.apply) return;
  data.formulas[psLookupDraft.target] = psBuildLookupFormula();
  delete data.cells[psLookupDraft.target];
  saveData();
  const target = psLookupDraft.target;
  psCloseLookupBuilder();
  selectCell(target);
}

psLookupLaunchBtn.addEventListener("click", () => psOpenLookupBuilder(selectedRef));
psCloseLookup.addEventListener("click", psCloseLookupBuilder);
psLookupValueBtn.addEventListener("click", () => psStartLookupPick("value"));
psLookupSearchBtn.addEventListener("click", () => psStartLookupPick("search"));
psLookupReturnBtn.addEventListener("click", () => psStartLookupPick("return"));
psApplyLookupBtn.addEventListener("click", psApplyLookup);

psLookupBackdrop.addEventListener("click", event => {
  if (event.target === psLookupBackdrop) psCloseLookupBuilder();
});

cancelPickBtn.addEventListener("click", event => {
  if (!psLookupPickMode) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  psLookupPickMode = null;
  pickBanner.classList.add("hidden");
  psLookupBackdrop.classList.remove("hidden");
  psUpdateLookupBuilder();
  renderSheet();
}, true);

formulaBtn.addEventListener("click", event => {
  if (!selectedRef || !psIsLookupFormula(data.formulas[selectedRef])) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  psOpenLookupBuilder(selectedRef);
}, true);

renderSheet();
