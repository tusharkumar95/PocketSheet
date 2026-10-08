const psLeftOperandWrap = document.createElement("div");
psLeftOperandWrap.className = "operand-source-wrap";
leftOperandBtn.parentNode.insertBefore(psLeftOperandWrap, leftOperandBtn);
psLeftOperandWrap.appendChild(leftOperandBtn);

const psRightOperandWrap = document.createElement("div");
psRightOperandWrap.className = "operand-source-wrap";
rightOperandBtn.parentNode.insertBefore(psRightOperandWrap, rightOperandBtn);
psRightOperandWrap.appendChild(rightOperandBtn);

function psAddOperandControls(wrap, side) {
  const controls = document.createElement("div");
  controls.className = "operand-source-toggle";
  controls.innerHTML = `
    <button type="button" data-kind="cell" class="selected">Cell</button>
    <button type="button" data-kind="number">Number</button>`;

  const input = document.createElement("input");
  input.type = "text";
  input.inputMode = "decimal";
  input.autocomplete = "off";
  input.className = "manual-number-input hidden";
  input.placeholder = "Enter a number, e.g. 2";
  input.setAttribute("aria-label", side === "first" ? "First number" : "Second number");

  wrap.appendChild(controls);
  wrap.appendChild(input);
  return { controls, input };
}

const psFirstControls = psAddOperandControls(psLeftOperandWrap, "first");
const psSecondControls = psAddOperandControls(psRightOperandWrap, "second");

function psEnsureArithmeticDraft() {
  if (!formulaDraft.firstKind) formulaDraft.firstKind = "cell";
  if (!formulaDraft.secondKind) formulaDraft.secondKind = "cell";
  if (formulaDraft.firstNumber === undefined || formulaDraft.firstNumber === null) formulaDraft.firstNumber = "";
  if (formulaDraft.secondNumber === undefined || formulaDraft.secondNumber === null) formulaDraft.secondNumber = "";
}

function psReadStoredOperand(raw) {
  if (raw && typeof raw === "object") {
    if (raw.kind === "number") {
      return { kind: "number", ref: null, number: raw.value == null ? "" : String(raw.value) };
    }
    if (raw.kind === "cell") {
      return { kind: "cell", ref: raw.ref || null, number: "" };
    }
  }
  if (typeof raw === "number") return { kind: "number", ref: null, number: String(raw) };
  if (typeof raw === "string" && raw) return { kind: "cell", ref: raw, number: "" };
  return { kind: "cell", ref: null, number: "" };
}

function psDraftOperand(side) {
  psEnsureArithmeticDraft();
  const kind = formulaDraft[`${side}Kind`];
  if (kind === "number") {
    const value = cleanNumber(formulaDraft[`${side}Number`]);
    return { kind: "number", value };
  }
  return { kind: "cell", ref: formulaDraft[side] };
}

function psOperandReady(side) {
  psEnsureArithmeticDraft();
  if (formulaDraft[`${side}Kind`] === "number") {
    return cleanNumber(formulaDraft[`${side}Number`]) !== null;
  }
  return Boolean(formulaDraft[side]);
}

function psEvaluateStoredOperand(raw, seen) {
  if (raw && typeof raw === "object") {
    if (raw.kind === "number") {
      const number = cleanNumber(raw.value);
      return number === null
        ? { ok: false, value: null, display: "#VALUE" }
        : { ok: true, value: number, display: formatNumber(number), raw: true };
    }
    if (raw.kind === "cell") {
      if (!raw.ref) return { ok: false, value: null, display: "#VALUE" };
      return evaluateCell(raw.ref, seen);
    }
  }

  if (typeof raw === "number") {
    return { ok: true, value: raw, display: formatNumber(raw), raw: true };
  }

  if (typeof raw === "string" && raw) return evaluateCell(raw, seen);
  return { ok: false, value: null, display: "#VALUE" };
}

const psEvaluateCellBeforeNumbers = evaluateCell;
evaluateCell = function evaluateCellWithNumbers(ref, seen = new Set()) {
  const formula = data.formulas[ref];
  const isArithmetic = Boolean(
    formula &&
    formula.type !== "aggregate" &&
    formula.type !== "lookup" &&
    (Object.prototype.hasOwnProperty.call(formula, "left") || Object.prototype.hasOwnProperty.call(formula, "right"))
  );

  if (!isArithmetic) return psEvaluateCellBeforeNumbers(ref, seen);
  if (seen.has(ref)) return { ok: false, value: null, display: "#CYCLE" };

  const nextSeen = new Set(seen);
  nextSeen.add(ref);
  const left = psEvaluateStoredOperand(formula.left, nextSeen);
  const right = psEvaluateStoredOperand(formula.right, nextSeen);

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
};

function psOperandText(raw) {
  if (raw && typeof raw === "object") {
    if (raw.kind === "number") {
      const number = cleanNumber(raw.value);
      return number === null ? "?" : formatNumber(number);
    }
    if (raw.kind === "cell") return raw.ref || "?";
  }
  if (typeof raw === "number") return formatNumber(raw);
  return String(raw || "?");
}

const psFormulaTextBeforeNumbers = formulaText;
formulaText = function formulaTextWithNumbers(ref) {
  const formula = data.formulas[ref];
  const isArithmetic = Boolean(
    formula &&
    formula.type !== "aggregate" &&
    formula.type !== "lookup" &&
    (Object.prototype.hasOwnProperty.call(formula, "left") || Object.prototype.hasOwnProperty.call(formula, "right"))
  );
  if (!isArithmetic) return psFormulaTextBeforeNumbers(ref);
  const symbol = formula.op === "*" ? "×" : formula.op === "/" ? "÷" : formula.op;
  return `=${psOperandText(formula.left)} ${symbol} ${psOperandText(formula.right)}`;
};

const psDraftFromExistingBeforeNumbers = draftFromExisting;
draftFromExisting = function draftFromExistingWithNumbers(target, formula) {
  const base = psDraftFromExistingBeforeNumbers(target, formula);
  if (!formula || formulaKind(formula) === "aggregate" || formula.type === "lookup") {
    return {
      ...base,
      firstKind: "cell",
      secondKind: "cell",
      firstNumber: "",
      secondNumber: ""
    };
  }

  const left = psReadStoredOperand(formula.left);
  const right = psReadStoredOperand(formula.right);
  return {
    target,
    mode: "arithmetic",
    first: left.ref,
    second: right.ref,
    firstKind: left.kind,
    secondKind: right.kind,
    firstNumber: left.number,
    secondNumber: right.number,
    op: formula.op || "+"
  };
};

const psBuildDraftFormulaBeforeNumbers = buildDraftFormula;
buildDraftFormula = function buildDraftFormulaWithNumbers() {
  if (formulaDraft.mode !== "arithmetic") return psBuildDraftFormulaBeforeNumbers();
  return {
    type: "arithmetic",
    left: psDraftOperand("first"),
    right: psDraftOperand("second"),
    op: formulaDraft.op
  };
};

const psPreviewDraftBeforeNumbers = previewDraft;
previewDraft = function previewDraftWithNumbers() {
  if (formulaDraft.mode !== "arithmetic") return psPreviewDraftBeforeNumbers();
  psEnsureArithmeticDraft();

  if (!psOperandReady("first") || !psOperandReady("second")) {
    return { ok: false, text: "Choose a cell or enter a number for both values" };
  }

  if (
    (formulaDraft.firstKind === "cell" && formulaDraft.first === formulaDraft.target) ||
    (formulaDraft.secondKind === "cell" && formulaDraft.second === formulaDraft.target)
  ) {
    return { ok: false, text: "Can't use the result cell itself" };
  }

  const temporary = data.formulas[formulaDraft.target];
  data.formulas[formulaDraft.target] = buildDraftFormula();
  const result = evaluateCell(formulaDraft.target);
  if (temporary) data.formulas[formulaDraft.target] = temporary;
  else delete data.formulas[formulaDraft.target];

  if (!result.ok) {
    const message = result.display === "#DIV/0" ? "Can't divide by zero" :
      result.display === "#CYCLE" ? "This creates a circular formula" :
      "Both values need to be numbers";
    return { ok: false, text: message };
  }
  return { ok: true, text: `Result: ${result.display}` };
};

function psShiftStoredOperand(raw, rowDelta) {
  if (raw && typeof raw === "object") {
    if (raw.kind === "number") return { kind: "number", value: raw.value };
    if (raw.kind === "cell") return { kind: "cell", ref: shiftRef(raw.ref, rowDelta) };
  }
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") return shiftRef(raw, rowDelta);
  return raw;
}

const psShiftFormulaBeforeNumbers = shiftFormula;
shiftFormula = function shiftFormulaWithNumbers(formula, rowDelta) {
  const isArithmetic = Boolean(
    formula &&
    formula.type !== "aggregate" &&
    formula.type !== "lookup" &&
    (Object.prototype.hasOwnProperty.call(formula, "left") || Object.prototype.hasOwnProperty.call(formula, "right"))
  );
  if (!isArithmetic) return psShiftFormulaBeforeNumbers(formula, rowDelta);
  return {
    type: "arithmetic",
    left: psShiftStoredOperand(formula.left, rowDelta),
    right: psShiftStoredOperand(formula.right, rowDelta),
    op: formula.op
  };
};

function psSetOperandKind(side, kind) {
  psEnsureArithmeticDraft();
  formulaDraft[`${side}Kind`] = kind;
  updateFormulaBuilder();
  if (kind === "number") {
    const input = side === "first" ? psFirstControls.input : psSecondControls.input;
    setTimeout(() => input.focus(), 0);
  }
}

function psSyncOperandControl(side, wrap, controls, input, card, textEl, subEl) {
  psEnsureArithmeticDraft();
  const arithmetic = formulaDraft.mode === "arithmetic";
  wrap.classList.toggle("manual-controls-hidden", !arithmetic);
  if (!arithmetic) return;

  const kind = formulaDraft[`${side}Kind`];
  controls.querySelectorAll("button").forEach(button => {
    button.classList.toggle("selected", button.dataset.kind === kind);
  });

  input.classList.toggle("hidden", kind !== "number");
  const draftNumber = formulaDraft[`${side}Number`] ?? "";
  if (input.value !== String(draftNumber)) input.value = String(draftNumber);
  card.classList.toggle("number-operand", kind === "number");

  if (kind === "number") {
    const numeric = cleanNumber(draftNumber);
    textEl.textContent = numeric === null ? "Type a number" : formatNumber(numeric);
    subEl.textContent = numeric === null ? "Enter a fixed value below" : "Fixed number";
  }
}

const psUpdateFormulaBuilderBeforeNumbers = updateFormulaBuilder;
updateFormulaBuilder = function updateFormulaBuilderWithNumbers() {
  psEnsureArithmeticDraft();
  psUpdateFormulaBuilderBeforeNumbers();

  if (formulaDraft.mode === "arithmetic") {
    formulaHelp.textContent = "Use a cell or type a fixed number for either side of the calculation.";
  }

  psSyncOperandControl("first", psLeftOperandWrap, psFirstControls.controls, psFirstControls.input, leftOperandBtn, leftOperandText, leftOperandValue);
  psSyncOperandControl("second", psRightOperandWrap, psSecondControls.controls, psSecondControls.input, rightOperandBtn, rightOperandText, rightOperandValue);
};

psFirstControls.controls.addEventListener("click", event => {
  const button = event.target.closest("[data-kind]");
  if (!button) return;
  psSetOperandKind("first", button.dataset.kind);
});

psSecondControls.controls.addEventListener("click", event => {
  const button = event.target.closest("[data-kind]");
  if (!button) return;
  psSetOperandKind("second", button.dataset.kind);
});

psFirstControls.input.addEventListener("input", () => {
  formulaDraft.firstNumber = psFirstControls.input.value;
  updateFormulaBuilder();
});

psSecondControls.input.addEventListener("input", () => {
  formulaDraft.secondNumber = psSecondControls.input.value;
  updateFormulaBuilder();
});

leftOperandBtn.addEventListener("click", event => {
  if (formulaDraft.mode === "arithmetic" && formulaDraft.firstKind === "number") {
    event.preventDefault();
    event.stopImmediatePropagation();
    psFirstControls.input.focus();
  }
}, true);

rightOperandBtn.addEventListener("click", event => {
  if (formulaDraft.mode === "arithmetic" && formulaDraft.secondKind === "number") {
    event.preventDefault();
    event.stopImmediatePropagation();
    psSecondControls.input.focus();
  }
}, true);

formulaModePicker.addEventListener("click", event => {
  const button = event.target.closest(".mode-btn");
  if (!button) return;
  if (button.dataset.mode === "arithmetic") {
    formulaDraft.firstKind = "cell";
    formulaDraft.secondKind = "cell";
    formulaDraft.firstNumber = "";
    formulaDraft.secondNumber = "";
  }
  updateFormulaBuilder();
});

psEnsureArithmeticDraft();
