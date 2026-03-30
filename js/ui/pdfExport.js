import { buildChordDiagramHtml } from './voicingExplorer.js';
import { rateScaleForProgression, SCALE_DISPLAY_NAMES, generateScale } from '../core/scales.js';
import {
  DEGREE_NAMES, DEGREE_EXPLANATIONS, DEGREE_EXPLANATIONS_MODAL,
  getHarmonicFunction, HARMONIC_FUNCTIONS, FUNCTION_LABELS,
} from '../core/keys.js';
import { CHROMATIC_SHARP, normalizePitch } from '../core/notes.js';
import { getChordAnalysisData } from '../panels/theoryPanel.js';

// ─── Height budget constants (inches) ─────────────────────────────────────────
const _H = {
  PAGE:     11,
  HDR:      0.78,
  FTR:      0.32,
  KEY_INFO: 0.42,
  TITLE:    0.22,
  PILL:     0.28,
};

// ─── Scale reason strings ──────────────────────────────────────────────────────
const _SCALE_REASONS = {
  major:            'Full 7-note diatonic scale for this key',
  natural_minor:    'Full diatonic minor scale',
  harmonic_minor:   'Raises 7th — creates stronger V→i cadence',
  melodic_minor:    'Raises 6th and 7th — smooth voice leading',
  pentatonic_major: '5 notes — no avoid notes, easy to improvise',
  pentatonic_minor: '5 notes — backbone of rock and blues',
  blues:            'Adds blue note — essential for expressive phrasing',
  dorian:           'Natural 6th gives a brighter, jazzier minor sound',
  phrygian:         'Flat 2nd — dark, Spanish/metal character',
  lydian:           'Raised 4th — bright, dreamy, ethereal quality',
  mixolydian:       'Major with ♭7 — great over dominant 7th chords',
  locrian:          'Flat 2nd and 5th — very dark, rarely used as primary',
};

// ─── Modal wiring ──────────────────────────────────────────────────────────────

export function openExportModal(appState) {
  if (!appState.progression.length) {
    alert('Add some chords to the progression first.');
    return;
  }

  const overlay   = document.getElementById('pdf-export-modal');
  const titleIn   = document.getElementById('pdf-song-title');
  const closeBtn  = document.getElementById('btn-pdf-export-close');
  const cancelBtn = document.getElementById('btn-pdf-export-cancel');
  const genBtn    = document.getElementById('btn-pdf-export-generate');
  const boxes     = overlay.querySelectorAll('input[name="pdf-page"]');

  titleIn.value = 'Untitled';
  boxes.forEach(b => { b.checked = true; });
  _syncGenerateBtn(genBtn, boxes);

  overlay.style.display = 'flex';
  titleIn.focus();
  titleIn.select();

  boxes.forEach(b => b.addEventListener('change', () => _syncGenerateBtn(genBtn, boxes)));

  function close() {
    overlay.style.display = 'none';
    closeBtn.removeEventListener('click', close);
    cancelBtn.removeEventListener('click', close);
    genBtn.removeEventListener('click', generate);
    overlay.removeEventListener('click', overlayClick);
  }
  function overlayClick(e) { if (e.target === overlay) close(); }
  async function generate() {
    const title = titleIn.value.trim() || 'Untitled';
    const pages = [...boxes].filter(b => b.checked).map(b => b.value);
    if (!pages.length) return;
    close();
    await _generatePDF(title, pages, appState);
  }

  closeBtn.addEventListener('click', close);
  cancelBtn.addEventListener('click', close);
  genBtn.addEventListener('click', generate);
  overlay.addEventListener('click', overlayClick);

  titleIn.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Enter') { generate(); titleIn.removeEventListener('keydown', onKey); }
    if (e.key === 'Escape') { close();    titleIn.removeEventListener('keydown', onKey); }
  });
}

function _syncGenerateBtn(genBtn, boxes) {
  genBtn.disabled = ![...boxes].some(b => b.checked);
}

// ─── Logo fetch ────────────────────────────────────────────────────────────────

async function _fetchLogoBase64() {
  try {
    const resp = await fetch('/assets/logo-riffly.png');
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return new Promise(res => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

// ─── PDF generation ────────────────────────────────────────────────────────────

async function _generatePDF(songTitle, pages, state) {
  const date    = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  const logoUrl = await _fetchLogoBase64();
  const allHtml = [];
  let pageNum = 1;

  if (pages.includes('diagrams')) {
    const { pagesHtml, lastPageNum } = _buildPage1(songTitle, date, state, pageNum, logoUrl);
    allHtml.push(pagesHtml);
    pageNum = lastPageNum;
  }
  if (pages.includes('tabs')) {
    const { pagesHtml, lastPageNum } = _buildPage2(songTitle, date, state, pageNum, logoUrl);
    allHtml.push(pagesHtml);
    pageNum = lastPageNum;
  }
  if (pages.includes('scales')) {
    const { pagesHtml, lastPageNum } = _buildPage3(songTitle, date, state, pageNum, logoUrl);
    allHtml.push(pagesHtml);
    pageNum = lastPageNum;
  }
  if (pages.includes('theory')) {
    const { pagesHtml } = _buildTheoryPage(songTitle, date, state, pageNum, logoUrl);
    allHtml.push(pagesHtml);
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${_esc(songTitle)}_Riffly</title>
<style>${_printCss()}</style>
</head>
<body>
${allHtml.join('\n')}
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) { alert('Pop-up blocked. Please allow pop-ups for this site and try again.'); return; }
  win.document.title = songTitle + '_Riffly';
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 500);
}

// ─── Print CSS (white/light background) ───────────────────────────────────────

function _printCss() {
  return `
* { box-sizing: border-box; margin: 0; padding: 0; }
@page { size: letter portrait; margin: 0; }
body { background: #fff; color: #1a1a2e; font-family: Calibri, 'Segoe UI', Arial, sans-serif; }

.page {
  width: 8.5in; min-height: 11in;
  background: #fff;
  page-break-after: always;
  display: flex; flex-direction: column;
}
.page:last-child { page-break-after: avoid; }
.page-content { padding: 0.18in 0.4in 0; flex: 1; }

/* ── Page header (logo bar) ── */
.page-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.1in 0.4in;
  background: #1a1a2e;
  border-bottom: 3px solid #A855F7;
  margin-bottom: 0.15in;
}
.header-logo {
  display: flex; align-items: center; gap: 10px;
}
.header-logo img { height: 36px; width: auto; }
.header-logo-text {
  font-size: 14pt; font-weight: 800; color: #fff;
  letter-spacing: 0.04em;
}
.header-logo-tagline {
  font-size: 7.5pt; color: #F59E0B; font-style: italic; margin-top: 1px;
}
.header-right {
  text-align: right;
}
.header-song-title {
  font-size: 10pt; font-weight: 700; color: #fff;
}
.header-song-title span { color: #F59E0B; }
.header-date { font-size: 8pt; color: #A855F7; margin-top: 2px; }

/* ── Key info row ── */
.key-info-row {
  display: flex; gap: 0.2in; align-items: center;
  font-size: 9pt; color: #374151;
  margin-bottom: 0.14in;
  padding: 6px 10px;
  background: #f5f3ff; border-radius: 6px;
  border: 1px solid #e9d5ff;
}
.key-badge {
  background: #A855F7; color: #fff;
  border-radius: 4px; padding: 1px 8px;
  font-weight: 700; font-size: 9pt;
}
.confidence-val { color: #d97706; font-weight: 600; }
.tuning-val { color: #0369a1; font-family: Consolas, monospace; font-size: 8.5pt; }

/* ── Page title ── */
.page-title {
  font-size: 11pt; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.08em; color: #4c1d95;
  margin-bottom: 0.12in; padding-bottom: 4px;
  border-bottom: 1px solid #e9d5ff;
}

/* ── Section pill ── */
.section-pill {
  display: inline-block;
  background: #A855F7; color: #fff;
  font-size: 7.5pt; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.1em; border-radius: 4px; padding: 2px 10px;
  margin-bottom: 0.08in; margin-top: 0.06in;
}

/* ── Chord grid (page 1) ── */
.chord-grid {
  display: flex; flex-wrap: wrap; gap: 0.08in;
  margin-bottom: 0.18in;
}
.chord-card {
  display: flex; flex-direction: column; align-items: center;
  width: 0.85in; gap: 0; overflow: visible;
}
.chord-card-name  { font-size: 9pt; font-weight: 700; color: #1a1a2e; text-align: center; }
.chord-card-numeral { font-size: 7.5pt; color: #7c3aed; text-align: center; }
.chord-card-fret  { font-size: 7pt; color: #6b7280; text-align: center; font-style: italic; }
.chord-card svg   { display: block; overflow: visible; width: 0.85in; height: auto; }

/* ── Horizontal tabs (page 2) ── */
.tab-section-block { page-break-inside: avoid; margin-bottom: 0.18in; }
.tab-row { page-break-inside: avoid; margin-bottom: 4px; }
.tab-pre {
  font-family: Consolas, 'Courier New', monospace;
  font-size: 8.5pt; color: #1a1a2e;
  background: #f8f7ff; padding: 8px 12px;
  border-radius: 4px; border-left: 3px solid #A855F7;
  line-height: 1.55; white-space: pre;
}

/* ── Scale suggestions (page 3) ── */
.scale-card {
  border: 1px solid #e9d5ff; border-radius: 6px;
  padding: 10px 12px; margin-bottom: 0.1in;
  page-break-inside: avoid; background: #faf5ff;
}
.scale-card-header { display: flex; align-items: center; gap: 10px; margin-bottom: 5px; }
.scale-name { font-size: 11pt; font-weight: 700; color: #1a1a2e; }
.rating-badge {
  font-size: 7pt; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.06em; padding: 2px 7px; border-radius: 3px;
}
.rating-green  { color: #15803d; border: 1px solid #15803d; background: #f0fdf4; }
.rating-yellow { color: #a16207; border: 1px solid #a16207; background: #fefce8; }
.scale-reason  { font-size: 8pt; color: #374151; margin-bottom: 6px; }
.chord-fits    { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px; }
.fit-dot {
  font-size: 7.5pt; padding: 1px 6px; border-radius: 3px; font-weight: 600;
}
.fit-full    { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
.fit-partial { background: #fefce8; color: #a16207; border: 1px solid #fde68a; }
.fit-clash   { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
.section-fit-strip { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px; align-items: center; }
.section-fit-label { font-size: 7pt; color: #6b7280; margin-right: 2px; }
.section-fit-tag {
  font-size: 7pt; padding: 1px 7px; border-radius: 10px; font-weight: 600;
}
.sfit-green  { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
.sfit-yellow { background: #fefce8; color: #a16207; border: 1px solid #fde68a; }
.sfit-red    { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
.section-chord-list {
  font-size: 7.5pt; color: #A855F7; font-weight: 600; margin-bottom: 4px;
}
.neck-diagram { margin: 6px 0 4px; page-break-inside: avoid; }

/* ── Theory intro block ── */
.theory-intro {
  background: #f5f3ff; border-radius: 6px; border: 1px solid #e9d5ff;
  padding: 8px 12px; margin-bottom: 0.12in;
  font-size: 8.5pt; color: #374151; line-height: 1.5;
}
.theory-intro p { margin-bottom: 4px; }
.theory-intro p:last-child { margin-bottom: 0; }
.theory-intro strong { color: #4c1d95; }

/* ── Theory analysis (page 4) ── */
.theory-chord-row {
  background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 6px;
  padding: 7px 12px; margin-bottom: 7px; page-break-inside: avoid;
}
.theory-chord-row-header { display: flex; align-items: center; gap: 8px; margin-bottom: 3px; }
.theory-numeral    { font-size: 9pt; font-weight: 700; color: #7c3aed; min-width: 30px; }
.theory-chord-name-pdf { font-size: 10pt; font-weight: 700; color: #1a1a2e; }
.theory-quality-pdf    { font-size: 8pt; color: #6b7280; }
.hfn-badge {
  font-size: 7pt; font-weight: 700; padding: 1px 6px; border-radius: 3px; margin-left: auto;
}
.hfn-T  { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
.hfn-TP { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
.hfn-PD { background: #fefce8; color: #a16207; border: 1px solid #fde68a; }
.hfn-D  { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
.theory-classification     { font-size: 8pt; color: #374151; margin-bottom: 2px; }
.theory-quality-color-pdf  { font-size: 7.5pt; color: #6b7280; font-style: italic; margin-bottom: 2px; }
.theory-cadence-label      { font-size: 7.5pt; color: #d97706; font-weight: 600; margin-bottom: 2px; }
.theory-motion-pdf         { font-size: 7.5pt; color: #6b7280; }

/* ── Scale degrees table (page 5) ── */
.degree-table { width: 100%; border-collapse: collapse; margin-bottom: 0.18in; }
.degree-table th {
  font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
  color: #6b7280; border-bottom: 2px solid #e9d5ff; padding: 4px 8px; text-align: left;
}
.degree-table td {
  font-size: 8pt; color: #374151;
  border-bottom: 1px solid #f3e8ff;
  padding: 5px 8px; vertical-align: top; line-height: 1.4;
}
.deg-numeral { color: #7c3aed; font-weight: 700; }
.deg-name    { color: #1a1a2e; font-weight: 600; }
.deg-note    { color: #0369a1; font-family: Consolas, monospace; }
.deg-function { font-size: 7pt; padding: 1px 5px; border-radius: 3px; white-space: nowrap; }

/* ── Footer ── */
.page-footer {
  margin-top: auto;
  padding: 4px 0.4in 0.18in;
  display: flex; justify-content: space-between; align-items: center;
  font-size: 7.5pt; color: #9ca3af;
  border-top: 1px solid #e9d5ff;
}
.footer-brand { font-style: italic; }
.footer-page  { color: #A855F7; font-weight: 700; }

@media screen {
  html, body { margin: 0; padding: 0; background: #fff; }
  .page { width: 100%; margin: 0; }
}

@media print {
  html, body { margin: 0; padding: 0; background: #fff;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { margin: 0; }
  .page { width: 100%; page-break-after: always; }
  .page:last-child { page-break-after: avoid; }
}
`;
}

// ─── Shared header / footer ────────────────────────────────────────────────────

function _pageHeader(songTitle, date, logoUrl) {
  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="Riffly" style="height:36px;width:auto;">`
    : `<span class="header-logo-text">RIFFLY</span>`;
  return `<div class="page-header">
    <div class="header-logo">
      ${logoHtml}
      <div>
        <div class="header-logo-tagline">riffly.com &nbsp;·&nbsp; Actionable Guitar Theory</div>
      </div>
    </div>
    <div class="header-right">
      <div class="header-song-title">Song Title: <span>${_esc(songTitle)}</span></div>
      <div class="header-date">${_esc(date)}</div>
    </div>
  </div>`;
}

function _pageFooter(pageNum) {
  return `<div class="page-footer">
    <span class="footer-brand">riffly.com &nbsp;·&nbsp; Actionable Guitar Theory</span>
    <span class="footer-page">${pageNum}</span>
  </div>`;
}

function _keyInfoRow(state) {
  if (!state.activeKey) return '';
  const key = state.activeKey;
  const qual = key.quality === 'major' ? 'Major' : key.quality.charAt(0).toUpperCase() + key.quality.slice(1);
  const keyLabel = `${CHROMATIC_SHARP[key.root]} ${qual}`;
  const conf = state.keyResults?.[0]?.confidence;
  const confStr = conf != null ? Math.round(conf * 100) + '%' : '—';
  const tuningStr = [...state.tuning.map(p => CHROMATIC_SHARP[p])].reverse().join(' – ');
  return `<div class="key-info-row">
    <span style="color:#6b7280">Detected Key</span>
    <span class="key-badge">${_esc(keyLabel)}</span>
    <span>Confidence: <span class="confidence-val">${confStr}</span></span>
    <span><strong>Tuning:</strong> <span class="tuning-val">${_esc(tuningStr)}</span></span>
  </div>`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _groupBySection(state) {
  const labelMap = Object.fromEntries((state.sections || []).map(s => [s.id, s.label]));
  const groups = [];
  const seen = new Map();
  for (const chord of state.progression) {
    const sid = chord.section ?? '__none__';
    if (!seen.has(sid)) {
      const raw = labelMap[sid] ?? sid;
      const label = raw
        .replace(/-(\d+)$/, (_, n) => n === '1' ? '' : ` ${n}`)
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
        .trim() || 'Progression';
      const group = { sectionId: sid, label, chords: [] };
      groups.push(group);
      seen.set(sid, group);
    }
    seen.get(sid).chords.push(chord);
  }
  return groups;
}

function _esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _chordNumeral(chord, key) {
  if (!key) return '';
  const dc = key.diatonicChords?.find(d => normalizePitch(d.root) === normalizePitch(chord.root));
  return dc?.numeral ?? '✦';
}

function _dedupChords(chords) {
  const seen = new Set();
  return chords.filter(c => {
    const k = `${c.root}|${c.quality}|${c.slashName ?? c.name}`;
    return seen.has(k) ? false : (seen.add(k), true);
  });
}

// ─── Pagination helper ─────────────────────────────────────────────────────────
// contentBlocks: Array<{ html: string, estimatedH: number }>
// showKeyInfo: bool — show key info row on first page only
// Returns: { pagesHtml: string, lastPageNum: number }

function _splitIntoPages(pageTitle, songTitle, date, startPageNum, logoUrl, state, contentBlocks, showKeyInfo) {
  const SAFETY       = 0.85; // conservative buffer so estimates never cause overflow
  const keyInfoH     = (showKeyInfo && state.activeKey) ? _H.KEY_INFO : 0;
  const firstBudget  = (_H.PAGE - _H.HDR - _H.FTR - keyInfoH - _H.TITLE) * SAFETY;
  const contBudget   = (_H.PAGE - _H.HDR - _H.FTR - _H.TITLE) * SAFETY;

  const pages = [];
  let current = [];
  let used = 0;
  let isFirst = true;

  for (const block of contentBlocks) {
    const budget = isFirst ? firstBudget : contBudget;
    if (current.length > 0 && used + block.estimatedH > budget) {
      pages.push({ blocks: current, isFirst });
      current = [block];
      used = block.estimatedH;
      isFirst = false;
    } else {
      current.push(block);
      used += block.estimatedH;
    }
  }
  if (current.length > 0) pages.push({ blocks: current, isFirst });
  if (pages.length === 0) pages.push({ blocks: [], isFirst: true });

  let pageNum = startPageNum;
  const htmlParts = pages.map((page, idx) => {
    const title       = idx === 0 ? pageTitle : `${pageTitle} (Continued)`;
    const keyInfoHtml = (idx === 0 && showKeyInfo) ? _keyInfoRow(state) : '';
    const contentHtml = page.blocks.map(b => b.html).join('\n');
    return `<div class="page">
      ${_pageHeader(songTitle, date, logoUrl)}
      <div class="page-content">
        ${keyInfoHtml}
        <div class="page-title">${_esc(title)}</div>
        ${contentHtml}
      </div>
      ${_pageFooter(pageNum++)}
    </div>`;
  });

  return { pagesHtml: htmlParts.join('\n'), lastPageNum: pageNum };
}

// ─── Page 1: Chord Diagrams ────────────────────────────────────────────────────

function _buildPage1(songTitle, date, state, startPageNum, logoUrl) {
  const groups = _groupBySection(state);
  const CARDS_PER_ROW = 8;
  const blocks = [];

  for (const group of groups) {
    const uniqueChords = _dedupChords(group.chords);

    let gridHtml = '<div class="chord-grid">';
    for (const chord of uniqueChords) {
      const numeral = _chordNumeral(chord, state.activeKey);
      const frets   = chord.frets ?? [-1,-1,-1,-1,-1,-1];
      const svg     = buildChordDiagramHtml(frets, state.tuning, chord.root);
      gridHtml += `<div class="chord-card">
        <div class="chord-card-name">${_esc(chord.slashName ?? chord.name)}</div>
        <div class="chord-card-numeral">${_esc(numeral)}</div>
        ${svg}
      </div>`;
    }
    gridHtml += '</div>';

    const sectionH = _H.PILL + Math.ceil(uniqueChords.length / CARDS_PER_ROW) * 1.2 + 0.18;
    blocks.push({
      html: `<div class="section-pill">${_esc(group.label)}</div>${gridHtml}`,
      estimatedH: sectionH,
    });
  }

  if (!blocks.length) {
    blocks.push({ html: '<p style="color:#6b7280;font-size:9pt">No chords in progression.</p>', estimatedH: 0.3 });
  }

  return _splitIntoPages('Chord Diagrams', songTitle, date, startPageNum, logoUrl, state, blocks, true);
}

// ─── Page 2: Chord Progression: Tabs ──────────────────────────────────────────

function _buildPage2(songTitle, date, state, startPageNum, logoUrl) {
  const STRING_ORDER  = [5, 4, 3, 2, 1, 0];
  const STRING_LABELS = ['e', 'B', 'G', 'D', 'A', 'E'];
  const STEM     = '----';
  const LINE_W   = 104;
  const PREFIX_W = 3; // label(2) + pipe(1)

  const _centerStr = (s, width, pad) => {
    s = String(s).slice(0, width);
    const total = width - s.length;
    const l = Math.floor(total / 2);
    return pad.repeat(l) + s + pad.repeat(total - l);
  };

  const groups = _groupBySection(state);
  const blocks = [];

  for (const group of groups) {
    // RLE grouping: consecutive same-chord runs → one group (non-consecutive = separate groups)
    const chordGroups = [];
    for (const chord of group.chords) {
      const k = `${chord.root}|${chord.quality}|${chord.slashName ?? chord.name}`;
      const last = chordGroups[chordGroups.length - 1];
      if (last && last.key === k) {
        last.occurrences.push(chord);
      } else {
        chordGroups.push({ key: k, chord, occurrences: [chord] });
      }
    }

    // Precompute maxValW (widest fret string in group) and cellW for each group
    // cellW = STEM + N × (maxValW + STEM)  e.g. N=4 val=1: 4+4*5=24
    for (const cg of chordGroups) {
      let maxW = 1;
      for (const occ of cg.occurrences) {
        for (const f of (occ.frets ?? [])) {
          if (f >= 0) maxW = Math.max(maxW, String(f).length);
        }
      }
      cg.maxValW = maxW;
      cg.cellW   = STEM.length + cg.occurrences.length * (maxW + STEM.length);
    }

    // Greedy row packing: string line width = PREFIX_W + Σ(cellW+1) ≤ LINE_W
    let rowsHtml = '';
    let numTabRows = 0;
    let i = 0;
    while (i < chordGroups.length) {
      let w = PREFIX_W;
      let count = 0;
      for (let j = i; j < chordGroups.length; j++) {
        const groupW = chordGroups[j].cellW + 1; // +1 for pipe separator/trailing
        if (count > 0 && w + groupW > LINE_W) break;
        w += groupW;
        count++;
      }
      count = Math.max(1, count);
      const rowGroups = chordGroups.slice(i, i + count);
      numTabRows++;

      // Name header: "   " prefix + names centered in cellW, joined by single space
      const nameParts = rowGroups.map(cg =>
        _centerStr(cg.chord.slashName ?? cg.chord.name, cg.cellW, ' ')
      );
      const nameHeaderLine = '   ' + nameParts.join(' ');

      // 6 string lines: label(2) + | + cells joined by | + trailing |
      // Cell format: STEM + (val + STEM) × N
      const stringLines = STRING_ORDER.map((s, idx) => {
        const label = STRING_LABELS[idx].padEnd(2);
        const cells = rowGroups.map(cg => {
          return STEM + cg.occurrences.map(occ => {
            const f = (occ.frets ?? [-1,-1,-1,-1,-1,-1])[s];
            const val = f === -1 ? 'x' : String(f);
            return val.padEnd(cg.maxValW, '-') + STEM;
          }).join('');
        });
        return `${label}|${cells.join('|')}|`;
      });

      const tabText = [nameHeaderLine, ...stringLines].join('\n');
      rowsHtml += `<div class="tab-row"><pre class="tab-pre">${_esc(tabText)}</pre></div>`;
      i += count;
    }

    const sectionH = _H.PILL + numTabRows * 1.15 + 0.2;
    blocks.push({
      html: `<div class="tab-section-block"><div class="section-pill">${_esc(group.label)}</div>${rowsHtml}</div>`,
      estimatedH: sectionH,
    });
  }

  if (!blocks.length) {
    blocks.push({ html: '<p style="color:#6b7280;font-size:9pt">No chords in progression.</p>', estimatedH: 0.3 });
  }

  return _splitIntoPages('Chord Progression: Tabs', songTitle, date, startPageNum, logoUrl, state, blocks, true);
}

// ─── Page 3: Scale Suggestions ────────────────────────────────────────────────

function _buildPage3(songTitle, date, state, startPageNum, logoUrl) {
  if (!state.activeKey) {
    return _splitIntoPages('Scale Suggestions', songTitle, date, startPageNum, logoUrl, state, [
      { html: '<p style="color:#6b7280;font-size:9pt;margin-top:0.15in">No key detected yet. Add chords and let the key analyzer run before exporting.</p>', estimatedH: 0.4 },
    ], true);
  }

  const key    = state.activeKey;
  const prog   = state.progression;
  const groups = _groupBySection(state);

  // Rate all 12 scale types
  const allTypes = Object.keys(SCALE_DISPLAY_NAMES);
  const rated = [];
  for (const type of allTypes) {
    const { rating, chordFits } = rateScaleForProgression(type, key.root, prog);
    if (rating === 'red') continue;
    rated.push({ type, rating, chordFits });
  }
  // Green first, then yellow
  rated.sort((a, b) => (a.rating === b.rating ? 0 : a.rating === 'green' ? -1 : 1));

  const blocks = [];

  for (const { type, rating, chordFits } of rated) {
    const scaleName  = `${CHROMATIC_SHARP[key.root]} ${SCALE_DISPLAY_NAMES[type] ?? type}`;
    const scaleNotes = generateScale(key.root, type).map(p => CHROMATIC_SHARP[p]).join(' · ');
    const reason     = _SCALE_REASONS[type] ?? type;
    const fitMap     = new Map(prog.map((c, i) => [c, chordFits[i]]));

    // Section strips (color-only, no symbols)
    const sectionStripHtml = groups.map(g => {
      const chordSpans = g.chords.map(c => {
        const cf = fitMap.get(c);
        const fitCls = !cf ? 'fit-full'
          : cf.fits === 'full'    ? 'fit-full'
          : cf.fits === 'partial' ? 'fit-partial'
          : 'fit-clash';
        return `<span class="fit-dot ${fitCls}">${_esc(c.slashName ?? c.name)}</span>`;
      }).join('<span style="color:#9ca3af;margin:0 3px">–</span>');
      return `<div style="margin-bottom:4px;display:flex;flex-wrap:wrap;align-items:center;gap:3px;">
        <span style="font-size:7pt;font-weight:700;color:#A855F7;white-space:nowrap;">${_esc(g.label)}:</span>
        ${chordSpans}
      </div>`;
    }).join('');

    const neckSvg = _buildFullNeckSvg(key.root, type, state.tuning);

    const cardHtml = `<div class="scale-card">
      <div class="scale-card-header">
        <span class="scale-name">${_esc(scaleName)}</span>
        <span class="rating-badge rating-${rating}">${rating === 'green' ? '✓ Great fit' : '~ Good fit'}</span>
      </div>
      <div style="font-size:7.5pt;color:#7c3aed;letter-spacing:0.03em;margin-bottom:4px;">${_esc(scaleNotes)}</div>
      <div class="scale-reason">${_esc(reason)}</div>
      ${sectionStripHtml}
      <div class="neck-diagram">${neckSvg}</div>
    </div>`;
    blocks.push({ html: cardHtml, estimatedH: 2.1 });
  }

  if (!blocks.length) {
    blocks.push({ html: '<p style="color:#6b7280;font-size:9pt">No green or yellow-rated scales found for this progression.</p>', estimatedH: 0.3 });
  }

  return _splitIntoPages('Scale Suggestions', songTitle, date, startPageNum, logoUrl, state, blocks, true);
}

// ─── Full-neck scale SVG (24 frets) ───────────────────────────────────────────

function _buildFullNeckSvg(rootPitch, scaleType, tuning) {
  const scaleArr    = generateScale(rootPitch, scaleType);
  const scaleSet    = new Set(scaleArr);
  const degreeMap   = new Map(scaleArr.map((p, i) => [p, i + 1]));
  const rootNorm    = normalizePitch(rootPitch);

  const FRETS   = 24;
  const STRINGS = 6;
  const W       = 800;
  const H       = 112;
  const PAD_L   = 26;
  const PAD_R   = 8;
  const PAD_T   = 14;
  const PAD_B   = 18;

  const boardW  = W - PAD_L - PAD_R;
  const boardH  = H - PAD_T - PAD_B;
  const fretW   = boardW / FRETS;
  const stringH = boardH / (STRINGS - 1);

  const slotX   = f => PAD_L + fretW * (f - 0.5);
  const openX   = PAD_L - 14;
  const stringY = s => PAD_T + s * stringH;

  const parts = [];

  // Board background
  parts.push(`<rect x="${PAD_L}" y="${PAD_T}" width="${boardW}" height="${boardH}" fill="#4a2810" rx="2"/>`);

  // Nut
  parts.push(`<rect x="${PAD_L - 1}" y="${PAD_T - 1}" width="4" height="${boardH + 2}" fill="#c8a96a" rx="1"/>`);

  // Fret lines
  for (let f = 1; f <= FRETS; f++) {
    const x  = PAD_L + fretW * f;
    const sw = (f === 12 || f === 24) ? '1.4' : '0.7';
    parts.push(`<line x1="${x}" y1="${PAD_T}" x2="${x}" y2="${PAD_T + boardH}" stroke="#666" stroke-width="${sw}"/>`);
  }

  // Position markers — single dots
  [3, 5, 7, 9, 15, 17, 19, 21].forEach(f => {
    parts.push(`<circle cx="${slotX(f)}" cy="${PAD_T + boardH / 2}" r="4" fill="rgba(255,255,255,0.13)"/>`);
  });
  // Double dots at 12 and 24
  [12, 24].forEach(f => {
    const x = slotX(f);
    parts.push(`<circle cx="${x}" cy="${PAD_T + boardH * 0.28}" r="4" fill="rgba(255,255,255,0.13)"/>`);
    parts.push(`<circle cx="${x}" cy="${PAD_T + boardH * 0.72}" r="4" fill="rgba(255,255,255,0.13)"/>`);
  });

  // String lines and labels (s=0 = high e at top, s=5 = low E at bottom)
  const STRING_NAMES = ['e','B','G','D','A','E'];
  for (let s = 0; s < STRINGS; s++) {
    const y      = stringY(s);
    const appIdx = STRINGS - 1 - s;
    const thick  = (0.8 + appIdx * 0.18).toFixed(2);
    parts.push(`<line x1="${PAD_L - 20}" y1="${y}" x2="${PAD_L + boardW}" y2="${y}" stroke="#aaa" stroke-width="${thick}"/>`);
    parts.push(`<text x="${PAD_L - 22}" y="${y}" font-size="8" fill="#ccc" text-anchor="middle" dominant-baseline="middle">${STRING_NAMES[s]}</text>`);
  }

  // Scale note dots across all frets 0-24
  for (let s = 0; s < STRINGS; s++) {
    const appIdx    = STRINGS - 1 - s;
    const openPitch = tuning[appIdx];
    const y = stringY(s);

    for (let f = 0; f <= FRETS; f++) {
      const pitch = normalizePitch(openPitch + f);
      if (!scaleSet.has(pitch)) continue;
      const isRoot = pitch === rootNorm;
      const deg    = degreeMap.get(pitch);
      const x      = f === 0 ? openX : slotX(f);
      const r      = 6.5;
      const fill   = isRoot ? '#e74c3c' : '#2563EB';
      parts.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="rgba(255,255,255,0.6)" stroke-width="0.8"/>`);
      parts.push(`<text x="${x}" y="${y}" font-size="6.5" fill="#fff" text-anchor="middle" dominant-baseline="middle" font-weight="bold">${deg}</text>`);
    }
  }

  // Fret number labels along bottom
  [0, 3, 5, 7, 9, 12, 15, 17, 19, 21, 24].forEach(f => {
    const x = f === 0 ? openX : slotX(f);
    parts.push(`<text x="${x}" y="${H - 3}" font-size="7" fill="#aaa" text-anchor="middle">${f === 0 ? 'O' : f}</text>`);
  });

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;max-width:${W}px" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`;
}

// ─── Theory intro paragraph ────────────────────────────────────────────────────

function _buildTheoryIntro(key) {
  if (!key) return '';
  const scaleNotes = (key.scalePitches ?? []).map(p => CHROMATIC_SHARP[p]).join(' – ');
  const domNote    = CHROMATIC_SHARP[key.dominantRoot];
  const subNote    = CHROMATIC_SHARP[key.subdominantRoot];
  const domLabel   = key.quality === 'major' ? `${domNote} major` : `${domNote}m`;
  const subLabel   = key.quality === 'major' ? `${subNote} major` : `${subNote}m`;
  return `<div class="theory-intro">
    <p>Your progression suggests the key of <strong>${_esc(key.name)}</strong>.
       The scale contains: <strong>${_esc(scaleNotes)}</strong>.</p>
    <p>The relative ${_esc(key.relativeQuality ?? '')} is <strong>${_esc(key.relativeName ?? '')}</strong>
       — it shares the same notes but with a different tonal centre.</p>
    <p>On the circle of fifths, the nearest keys are <strong>${_esc(domLabel)}</strong>
       (dominant direction — one sharp more) and <strong>${_esc(subLabel)}</strong>
       (subdominant direction — one flat more).</p>
  </div>`;
}

// ─── Theory page: Chord Analysis + Scale Degrees ──────────────────────────────

function _buildTheoryPage(songTitle, date, state, startPageNum, logoUrl) {
  if (!state.activeKey) {
    return _splitIntoPages('Theory Explanation', songTitle, date, startPageNum, logoUrl, state, [
      { html: '<p style="color:#6b7280;font-size:9pt;margin-top:0.15in">No key detected yet.</p>', estimatedH: 0.3 },
    ], false);
  }

  const key    = state.activeKey;
  const prog   = state.progression;
  const groups = _groupBySection(state);
  const blocks = [];

  // Block 0: intro paragraph
  const introHtml = _buildTheoryIntro(key);
  if (introHtml) blocks.push({ html: introHtml, estimatedH: 0.72 });

  // Chord analysis sections
  let firstSection = true;
  for (const group of groups) {
    const uniqueChords = _dedupChords(group.chords);

    let rowsHtml = '';
    for (const chord of uniqueChords) {
      const gi        = prog.indexOf(chord);
      const prevChord = gi > 0 ? prog[gi - 1] : null;
      const data      = getChordAnalysisData(chord, key, prevChord, gi, state.cadences);
      if (!data) continue;

      const hfnClass = data.harmonicFunction ? `hfn-${data.harmonicFunction}` : '';
      const hfnLabel = data.harmonicFunction
        ? (FUNCTION_LABELS[data.harmonicFunction]?.name ?? data.harmonicFunction) : '';

      const motionParts = [];
      if (data.functionalMotion)         motionParts.push(data.functionalMotion);
      if (data.bassMotion)               motionParts.push(`Bass: ${data.bassMotion}`);
      if (data.commonTones?.length >= 2) motionParts.push(`Common tones: ${data.commonTones.join(', ')}`);

      rowsHtml += `<div class="theory-chord-row">
        <div class="theory-chord-row-header">
          <span class="theory-numeral">${_esc(data.numeral)}</span>
          <span class="theory-chord-name-pdf">${_esc(data.displayName)}</span>
          <span class="theory-quality-pdf">${_esc(data.qualityLabel)}</span>
          ${hfnLabel ? `<span class="hfn-badge ${hfnClass}">${_esc(hfnLabel)}</span>` : ''}
        </div>
        ${data.classification ? `<div class="theory-classification">${_esc(data.classification)}</div>` : ''}
        ${data.qualityColor ? `<div class="theory-quality-color-pdf">${_esc(data.qualityColor)}</div>` : ''}
        ${data.cadenceLabel ? `<div class="theory-cadence-label">⬡ ${_esc(data.cadenceLabel)}${data.cadenceIsTrueCadence ? ' (structural)' : ''}</div>` : ''}
        ${motionParts.length ? `<div class="theory-motion-pdf">${motionParts.map(_esc).join(' · ')}</div>` : ''}
      </div>`;
    }

    const titleHtml = firstSection
      ? `<div class="page-title" style="margin-top:0.12in">Chord Analysis</div>`
      : '';
    const titleH = firstSection ? _H.TITLE : 0;
    firstSection = false;

    blocks.push({
      html: `${titleHtml}<div class="section-pill" style="margin-bottom:8px">${_esc(group.label)}</div>${rowsHtml}`,
      estimatedH: titleH + _H.PILL + uniqueChords.length * 0.72 + 0.1,
    });
  }

  const theoryResult = _splitIntoPages('Theory Explanation', songTitle, date, startPageNum, logoUrl, state, blocks, false);

  // Scale degrees gets its own page with its own title (never shows "Theory Explanation (Continued)")
  const degTableHtml = _buildScaleDegreesTableHtml(state);
  if (!degTableHtml) return theoryResult;
  const degResult = _splitIntoPages(
    'Scale Degrees & Theory', songTitle, date, theoryResult.lastPageNum, logoUrl, state,
    [{ html: degTableHtml, estimatedH: 4.2 }], false,
  );
  return { pagesHtml: theoryResult.pagesHtml + '\n' + degResult.pagesHtml, lastPageNum: degResult.lastPageNum };
}

// ─── Scale degrees inner HTML ──────────────────────────────────────────────────

function _buildScaleDegreesHtml(state) {
  if (!state.activeKey) return '';

  const key     = state.activeKey;
  const isModal = ['dorian','phrygian','lydian','mixolydian'].includes(key.quality);
  const degExpl = isModal
    ? (DEGREE_EXPLANATIONS_MODAL[key.quality] ?? DEGREE_EXPLANATIONS[key.quality === 'minor' ? 'minor' : 'major'])
    : (DEGREE_EXPLANATIONS[key.quality] ?? DEGREE_EXPLANATIONS.major);
  const degNames = DEGREE_NAMES[key.quality] ?? DEGREE_NAMES.major;
  const hFuncs   = HARMONIC_FUNCTIONS[key.quality] ?? HARMONIC_FUNCTIONS.major;

  let tableRows = '';
  for (let deg = 1; deg <= 7; deg++) {
    const pitch   = key.scalePitches?.[deg - 1];
    const note    = pitch != null ? CHROMATIC_SHARP[pitch] : '—';
    const dc      = key.diatonicChords?.[deg - 1];
    const numeral = dc?.numeral ?? `${deg}`;
    const fn      = hFuncs[deg] ?? '';
    const fnLabel = FUNCTION_LABELS[fn]?.name ?? fn;
    const fnClass = fn ? `hfn-${fn}` : '';
    const expl    = (degExpl[deg] ?? '').replace(/<[^>]+>/g, '');

    tableRows += `<tr>
      <td class="deg-numeral">${_esc(numeral)}</td>
      <td class="deg-note">${_esc(note)}</td>
      <td class="deg-name">${_esc(degNames[deg] ?? '')}</td>
      <td>${fnLabel ? `<span class="deg-function hfn-badge ${fnClass}">${_esc(fnLabel)}</span>` : ''}</td>
      <td style="font-size:7.5pt;color:#374151">${_esc(expl)}</td>
    </tr>`;
  }

  return `<table class="degree-table">
      <thead><tr>
        <th>Numeral</th><th>Note</th><th>Degree Name</th><th>Function</th><th>Description</th>
      </tr></thead>
      <tbody>${tableRows}</tbody>
    </table>`;
}

// Alias used by _buildTheoryPage for the paginated scale degrees block
function _buildScaleDegreesTableHtml(state) {
  return _buildScaleDegreesHtml(state);
}
