// PocketSheet one-tap cell style presets.
(function () {
  if (typeof psFormatBackdrop === 'undefined' || !psFormatBackdrop || typeof psCurrentFormat !== 'function') return;

  const presets = [
    { id: 'plain', name: 'Plain', help: 'No fill or border' },
    { id: 'header', name: 'Header', help: 'Strong title cell' },
    { id: 'section', name: 'Section', help: 'Soft divider label' },
    { id: 'input', name: 'Input', help: 'Editable entry cell' },
    { id: 'total', name: 'Total', help: 'Emphasized result' },
    { id: 'success', name: 'Success', help: 'Positive status' },
    { id: 'warning', name: 'Warning', help: 'Needs attention' },
    { id: 'note', name: 'Note', help: 'Supporting context' }
  ];

  const section = document.createElement('section');
  section.className = 'format-section cell-style-section';
  section.innerHTML = `
    <p class="format-label">CELL STYLE</p>
    <div class="cell-style-grid" id="cellStyleGrid"></div>`;

  const firstFormatSection = psFormatBackdrop.querySelector('.format-section');
  if (firstFormatSection) firstFormatSection.insertAdjacentElement('beforebegin', section);
  else psFormatBackdrop.querySelector('.editor-sheet')?.appendChild(section);

  const grid = document.getElementById('cellStyleGrid');
  presets.forEach(preset => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cell-style-card';
    button.dataset.stylePreset = preset.id;
    button.innerHTML = `<span class="style-swatch ${preset.id}"></span><span><strong>${preset.name}</strong><small>${preset.help}</small></span>`;
    grid.appendChild(button);
  });

  const currentFormatBeforeStyles = psCurrentFormat;
  psCurrentFormat = function psCurrentFormatWithStyle(ref) {
    const current = currentFormatBeforeStyles(ref);
    const saved = (data.formats && data.formats[ref]) || {};
    return { ...current, style: saved.style || 'plain' };
  };

  function syncStyleCards() {
    const active = (typeof psFormatDraft !== 'undefined' && psFormatDraft.style) || 'plain';
    grid.querySelectorAll('[data-style-preset]').forEach(button => {
      button.classList.toggle('selected', button.dataset.stylePreset === active);
    });
  }

  grid.addEventListener('click', event => {
    const button = event.target.closest('[data-style-preset]');
    if (!button || typeof psFormatDraft === 'undefined') return;
    psFormatDraft.style = button.dataset.stylePreset;
    syncStyleCards();
  });

  // The existing Format opener now receives style from the overridden psCurrentFormat.
  if (typeof psFormatBtn !== 'undefined' && psFormatBtn) {
    psFormatBtn.addEventListener('click', () => requestAnimationFrame(syncStyleCards));
  }

  // Replace Apply so a preset is considered part of the saved format.
  if (typeof psApplyFormat === 'function' && typeof psApplyFormatBtn !== 'undefined' && psApplyFormatBtn) {
    psApplyFormatBtn.removeEventListener('click', psApplyFormat);
    psApplyFormat = function psApplyFormatWithStyle() {
      if (!selectedRef) return;

      const style = psFormatDraft.style || 'plain';
      const isDefault = psFormatDraft.type === 'general' &&
        !psFormatDraft.bold &&
        psFormatDraft.align === 'left' &&
        style === 'plain';

      if (isDefault) {
        delete data.formats[selectedRef];
      } else {
        data.formats[selectedRef] = { ...psFormatDraft, style };
      }

      saveData();
      psCloseFormatSheet();
      selectCell(selectedRef);
    };
    psApplyFormatBtn.addEventListener('click', psApplyFormat);
  }

  const styleClasses = presets.filter(p => p.id !== 'plain').map(p => `cell-style-${p.id}`);
  if (typeof psApplyGridFormats === 'function') {
    const applyGridFormatsBeforeStyles = psApplyGridFormats;
    psApplyGridFormats = function psApplyGridFormatsWithStyles() {
      applyGridFormatsBeforeStyles();
      document.querySelectorAll('.data-cell[data-ref]').forEach(cell => {
        styleClasses.forEach(className => cell.classList.remove(className));
        const style = data.formats?.[cell.dataset.ref]?.style || 'plain';
        if (style !== 'plain' && presets.some(p => p.id === style)) {
          cell.classList.add(`cell-style-${style}`);
        }
      });
    };
  }

  if (typeof renderSheet === 'function') renderSheet();
})();
