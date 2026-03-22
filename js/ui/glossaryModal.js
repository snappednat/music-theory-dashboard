/**
 * Glossary modal — contextual theory term definitions.
 */

import { GLOSSARY, getContextualTerms } from '../core/glossary.js';

const getOverlay = () => document.getElementById('glossary-overlay');
const getModal   = () => document.getElementById('glossary-modal');

let _escHandler      = null;
let _backdropHandler = null;

export function openGlossaryModal(appState) {
  renderGlossaryModal(appState);

  const ov = getOverlay();
  if (!ov) return;
  ov.style.display = 'flex';

  // Backdrop click — set once per open
  if (_backdropHandler) ov.removeEventListener('click', _backdropHandler);
  _backdropHandler = e => { if (e.target === ov) closeGlossaryModal(); };
  ov.addEventListener('click', _backdropHandler);

  // Esc key — set once per open
  if (_escHandler) document.removeEventListener('keydown', _escHandler);
  _escHandler = e => { if (e.key === 'Escape') closeGlossaryModal(); };
  document.addEventListener('keydown', _escHandler);
}

export function closeGlossaryModal() {
  const ov = getOverlay();
  if (ov) ov.style.display = 'none';
  if (_escHandler)      { document.removeEventListener('keydown', _escHandler); _escHandler = null; }
  if (_backdropHandler) { const ov2 = getOverlay(); ov2?.removeEventListener('click', _backdropHandler); _backdropHandler = null; }
}

/**
 * Render (or re-render) the modal body. Safe to call while modal is open.
 * @param {object} appState
 */
export function renderGlossaryModal(appState) {
  const m = getModal();
  if (!m) return;

  const contextKeys  = getContextualTerms(appState);
  const contextTerms = [...contextKeys]
    .map(k => GLOSSARY[k]).filter(Boolean)
    .sort((a, b) => a.term.localeCompare(b.term));

  const allTerms = Object.values(GLOSSARY)
    .sort((a, b) => a.term.localeCompare(b.term));

  m.innerHTML = `
    <div class="glossary-header">
      <span class="glossary-title">📖 Theory Glossary</span>
      <button class="glossary-close" id="glossary-close-btn" aria-label="Close glossary">✕</button>
    </div>
    <input class="glossary-search" id="glossary-search" placeholder="Search terms…" type="search" autocomplete="off">
    <div class="glossary-body">
      <div class="glossary-section-label">Relevant to your progression</div>
      ${contextTerms.map(t => _termHTML(t.term, t.short, t.long)).join('')}
      <button class="glossary-all-toggle" id="glossary-all-btn">All Terms ▾</button>
      <div class="glossary-all-section" id="glossary-all-section">
        <div class="glossary-section-label">All Terms</div>
        ${allTerms.map(t => _termHTML(t.term, t.short, t.long)).join('')}
      </div>
    </div>
  `;

  // Close button
  m.querySelector('#glossary-close-btn').addEventListener('click', closeGlossaryModal);

  // All Terms toggle
  m.querySelector('#glossary-all-btn').addEventListener('click', () => {
    const sec = m.querySelector('#glossary-all-section');
    const btn = m.querySelector('#glossary-all-btn');
    sec.classList.toggle('open');
    btn.textContent = sec.classList.contains('open') ? 'All Terms ▴' : 'All Terms ▾';
  });

  // Live search (filters all .glossary-term elements in both sections)
  m.querySelector('#glossary-search').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    m.querySelectorAll('.glossary-term').forEach(el => {
      el.style.display = el.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });

  // Accordion — single term open at a time
  m.querySelectorAll('.glossary-term').forEach(el => {
    el.addEventListener('click', () => {
      const wasOpen = el.classList.contains('open');
      m.querySelectorAll('.glossary-term.open').forEach(o => o.classList.remove('open'));
      if (!wasOpen) el.classList.add('open');
    });
  });
}

function _termHTML(name, short, long) {
  return `<div class="glossary-term">
    <div class="glossary-term-header">
      <span class="glossary-term-name">${name}</span>
      <span class="glossary-chevron">▶</span>
    </div>
    <div class="glossary-term-short">${short}</div>
    <div class="glossary-definition">${long}</div>
  </div>`;
}
