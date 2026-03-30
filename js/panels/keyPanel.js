import { pitchToNote } from '../core/notes.js';

/**
 * Render the key detection panel.
 * @param {Array}         keyResults   - [{key, confidence}] sorted by confidence
 * @param {object|null}   activeKey    - currently displayed key (may differ from keyResults[0] if user overrode it)
 * @param {function}      onKeyClick   - called with (root, quality) when user clicks any key chip
 */
export function renderKeyPanel(keyResults, activeKey, onKeyClick) {
  const container = document.getElementById('key-display');
  const summary   = document.getElementById('key-header-summary');
  if (!container) return;

  if (!keyResults || keyResults.length === 0) {
    container.innerHTML = '<div class="key-placeholder">Select chords on the fretboard…</div>';
    if (summary) summary.innerHTML = '';
    return;
  }

  // Determine which key to display as primary
  const displayKey = activeKey ?? keyResults[0].key;

  // Confidence for the displayed key (from keyResults)
  const displayResult = keyResults.find(r => r.key.root === displayKey.root && r.key.quality === displayKey.quality);
  const pct = Math.round((displayResult?.confidence ?? keyResults[0].confidence) * 100);

  // Whether the user has manually overridden the auto-detected key
  const topKey = keyResults[0].key;
  const isOverridden = displayKey.root !== topKey.root || displayKey.quality !== topKey.quality;

  const dominantNote    = pitchToNote(displayKey.dominantRoot);
  const subdominantNote = pitchToNote(displayKey.subdominantRoot);

  // All detected keys as clickable chips (all 4 shown, active one highlighted)
  const allChips = keyResults.map(r => {
    const p          = Math.round(r.confidence * 100);
    const isActive   = r.key.root === displayKey.root && r.key.quality === displayKey.quality;
    const isDetected = r.key.root === topKey.root && r.key.quality === topKey.quality;
    return `<span
      class="key-alt-chip${isActive ? ' key-alt-chip--active' : ''}"
      data-root="${r.key.root}"
      data-quality="${r.key.quality}"
      title="${isActive ? 'Currently active' : 'Click to use this key'}"
    >${r.key.name}${isDetected && !isActive ? ' <span class="key-alt-detected" title="Auto-detected">★</span>' : ''} <span class="key-alt-pct">${p}%</span></span>`;
  }).join('');

  // Enharmonic hint: show the alternate spelling when flat/sharp names differ
  // (e.g. key is "Ab Major" → also show "(enharmonic: G# Major)")
  const flatSpelling  = pitchToNote(displayKey.root, true);
  const sharpSpelling = pitchToNote(displayKey.root, false);
  const altSpelling   = flatSpelling !== sharpSpelling
    ? (displayKey.rootNote === flatSpelling ? sharpSpelling : flatSpelling)
    : null;
  const altName = altSpelling
    ? `${altSpelling}${displayKey.quality === 'minor' ? 'm' : (displayKey.isModal ? ' ' + displayKey.modeName : ' ' + (displayKey.modeName ?? 'Major'))}`
    : null;
  const enharmonicHtml = altName
    ? `<div class="key-enharmonic" title="Enharmonically equivalent — same pitches, different spelling">(enharmonic: ${altName})</div>`
    : '';

  // Update the collapsed header summary with key name + confidence
  if (summary) {
    const keyLabel = displayKey.isModal ? displayKey.rootNote : displayKey.shortName;
    const qualLabel = displayKey.modeName ?? (displayKey.quality === 'major' ? 'Major' : 'Minor');
    summary.innerHTML = `<span class="key-header-name">${keyLabel} ${qualLabel}</span><span class="key-header-pct">${pct}%</span>`;
  }

  container.innerHTML = `
    <div class="key-summary-row">
      <div class="key-main">
        <span class="key-name">${displayKey.isModal ? displayKey.rootNote : displayKey.shortName}</span>
        <span class="key-quality">${displayKey.modeName ?? (displayKey.quality === 'major' ? 'Major' : 'Minor')}</span>
        ${displayKey.isModal ? '<span class="key-mode-badge" title="Modal tonal center">Modal</span>' : ''}
        ${isOverridden ? '<span class="key-override-badge" title="Manually selected">override</span>' : ''}
      </div>
    </div>

    <div class="key-confidence-label">Confidence: ${pct}%</div>
    ${enharmonicHtml}

    <div class="key-details-expanded">
      <div class="key-relations">
        <div class="key-relation">
          <div class="key-relation-label">${displayKey.relativeLabel ?? ('Relative ' + displayKey.relativeQuality)}</div>
          <div class="key-relation-value">${displayKey.relativeName}</div>
        </div>
        <div class="key-relation">
          <div class="key-relation-label">V (Dominant)</div>
          <div class="key-relation-value">${dominantNote}</div>
        </div>
        <div class="key-relation">
          <div class="key-relation-label">IV (Subdominant)</div>
          <div class="key-relation-value">${subdominantNote}</div>
        </div>
      </div>
      <div class="key-alt-header">
        <span style="font-size:0.68rem; color:var(--text-hint)">Possible keys — click to switch:</span>
        ${isOverridden ? `<button class="key-reset-btn" id="key-reset-btn" title="Revert to auto-detected key">↺ Auto-detect</button>` : ''}
      </div>
      <div class="key-alternatives">${allChips}</div>
    </div>
  `;

  // Alt key chip clicks
  container.querySelectorAll('.key-alt-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const root    = parseInt(chip.dataset.root, 10);
      const quality = chip.dataset.quality;
      if (onKeyClick) onKeyClick(root, quality);
    });
  });

  // Reset button
  container.querySelector('#key-reset-btn')?.addEventListener('click', () => {
    if (onKeyClick) onKeyClick(topKey.root, topKey.quality);
  });
}
