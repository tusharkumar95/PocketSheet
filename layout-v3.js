// PocketSheet compact workspace layout: tabs in header, top Edit/Actions, grid-corner Undo.
(function () {
  const app = document.querySelector('.app');
  const oldTopbar = document.querySelector('.topbar');
  const toolbar = document.querySelector('.bottom-bar');
  const viewSwitcher = document.querySelector('.view-switcher');
  const sheetTabs = document.querySelector('.sheet-tabs');
  const moreBtn = document.getElementById('moreBtn');
  const addRowBtnEl = document.getElementById('addRowBtn');
  const undoBtnEl = document.getElementById('undoBtn');
  const editBtnEl = document.getElementById('editBtn');
  const formulaBtnEl = document.getElementById('formulaBtn');
  const dataBtnEl = document.getElementById('dataBtn');
  const formatBtnEl = document.getElementById('formatBtn');
  const actionsBtnEl = document.getElementById('cellActionsBtn');

  if (!app || !toolbar || !viewSwitcher || !sheetTabs || !moreBtn) return;

  // ---------- Compact workspace header ----------
  const header = document.createElement('div');
  header.className = 'workspace-header';

  const homeBtn = document.createElement('button');
  homeBtn.type = 'button';
  homeBtn.className = 'workspace-home-btn';
  homeBtn.textContent = 'P';
  homeBtn.setAttribute('aria-label', 'PocketSheet home');
  homeBtn.title = 'PocketSheet home';

  const tabsHost = document.createElement('div');
  tabsHost.style.display = 'contents';

  moreBtn.classList.add('workspace-more-btn');

  header.appendChild(homeBtn);
  header.appendChild(sheetTabs);
  header.appendChild(moreBtn);

  if (oldTopbar && oldTopbar.parentNode === app) {
    oldTopbar.insertAdjacentElement('afterend', header);
  } else {
    app.insertAdjacentElement('afterbegin', header);
  }

  // Ensure the working controls follow the header in a predictable order.
  header.insertAdjacentElement('afterend', toolbar);
  toolbar.insertAdjacentElement('afterend', viewSwitcher);

  homeBtn.addEventListener('click', () => {
    if (typeof psV2OpenHome === 'function') {
      psV2OpenHome();
      return;
    }
    const legacyBrand = document.querySelector('.brand-label');
    if (legacyBrand) legacyBrand.click();
  });

  // ---------- Rebuild primary toolbar around selected-cell work ----------
  if (editBtnEl) toolbar.appendChild(editBtnEl);
  if (actionsBtnEl) toolbar.appendChild(actionsBtnEl);
  if (formulaBtnEl) toolbar.appendChild(formulaBtnEl);
  if (dataBtnEl) toolbar.appendChild(dataBtnEl);
  if (formatBtnEl) toolbar.appendChild(formatBtnEl);

  // Keep legacy Add Row / Undo nodes alive because existing event handlers depend on them.
  // CSS removes them visually from the main toolbar.
  if (addRowBtnEl) toolbar.appendChild(addRowBtnEl);
  if (undoBtnEl) toolbar.appendChild(undoBtnEl);

  // ---------- Put Add row and Undo inside the existing Actions sheet ----------
  const actionGrid = document.querySelector('.cell-actions-grid');
  let actionUndoBtn = null;

  if (actionGrid) {
    const addAction = document.createElement('button');
    addAction.type = 'button';
    addAction.className = 'cell-action-btn layout-v3-quick-action';
    addAction.innerHTML = '<strong>Add row</strong><small>Add a new row at the bottom</small>';
    addAction.addEventListener('click', () => {
      if (typeof psCloseCellActionsSheet === 'function') psCloseCellActionsSheet();
      if (addRowBtnEl) addRowBtnEl.click();
    });

    actionUndoBtn = document.createElement('button');
    actionUndoBtn.type = 'button';
    actionUndoBtn.className = 'cell-action-btn layout-v3-quick-action';
    actionUndoBtn.innerHTML = '<strong>Undo</strong><small>Reverse the last sheet change</small>';
    actionUndoBtn.addEventListener('click', () => {
      if (typeof psCloseCellActionsSheet === 'function') psCloseCellActionsSheet();
      if (typeof psUndo === 'function') psUndo();
      else if (undoBtnEl) undoBtnEl.click();
    });

    actionGrid.prepend(actionUndoBtn);
    actionGrid.prepend(addAction);
  }

  // ---------- Grid-corner Undo shortcut ----------
  let cornerUndoBtn = null;

  function undoAvailable() {
    if (undoBtnEl) return !undoBtnEl.disabled;
    try {
      return typeof psUndoHistory !== 'undefined' && psUndoHistory.length > 0;
    } catch (error) {
      return false;
    }
  }

  function syncUndoShortcuts() {
    const enabled = undoAvailable();
    if (cornerUndoBtn) cornerUndoBtn.disabled = !enabled;
    if (actionUndoBtn) actionUndoBtn.disabled = !enabled;
  }

  function decorateCornerUndo() {
    const corner = document.querySelector('.corner.header, .header.corner, .corner');
    if (!corner) return;

    corner.innerHTML = '';
    cornerUndoBtn = document.createElement('button');
    cornerUndoBtn.type = 'button';
    cornerUndoBtn.className = 'grid-undo-btn';
    cornerUndoBtn.textContent = '↶';
    cornerUndoBtn.title = 'Undo';
    cornerUndoBtn.setAttribute('aria-label', 'Undo last change');
    cornerUndoBtn.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      if (typeof psUndo === 'function') psUndo();
      else if (undoBtnEl) undoBtnEl.click();
    });
    corner.appendChild(cornerUndoBtn);
    syncUndoShortcuts();
  }

  // Existing modules wrap renderSheet repeatedly; wrap the final function once more.
  if (typeof renderSheet === 'function') {
    const renderBeforeLayoutV3 = renderSheet;
    renderSheet = function renderSheetLayoutV3() {
      renderBeforeLayoutV3();
      decorateCornerUndo();
    };
  }

  if (typeof psUpdateUndoButton === 'function') {
    const updateUndoBeforeLayoutV3 = psUpdateUndoButton;
    psUpdateUndoButton = function psUpdateUndoButtonLayoutV3() {
      updateUndoBeforeLayoutV3();
      syncUndoShortcuts();
    };
  }

  if (actionsBtnEl) {
    actionsBtnEl.addEventListener('click', () => {
      requestAnimationFrame(syncUndoShortcuts);
    });
  }

  // Keep Edit/Actions in sync with cell selection even after moving them out of the bottom card.
  if (typeof selectCell === 'function') {
    const selectBeforeLayoutV3 = selectCell;
    selectCell = function selectCellLayoutV3(ref) {
      selectBeforeLayoutV3(ref);
      if (editBtnEl) editBtnEl.disabled = false;
      if (actionsBtnEl) actionsBtnEl.disabled = false;
    };
  }

  // If selection is reset by Undo/sheet switch, the underlying modules already disable Edit;
  // mirror that state to Actions as well.
  if (typeof psResetSelectionUi === 'function') {
    const resetBeforeLayoutV3 = psResetSelectionUi;
    psResetSelectionUi = function psResetSelectionUiLayoutV3() {
      resetBeforeLayoutV3();
      if (actionsBtnEl) actionsBtnEl.disabled = true;
      syncUndoShortcuts();
    };
  }

  // Initial render so the corner shortcut appears immediately.
  if (typeof renderSheet === 'function') renderSheet();
  syncUndoShortcuts();
})();
