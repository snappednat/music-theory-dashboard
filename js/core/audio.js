/**
 * Chord audio synthesis using the Web Audio API.
 * Supports multiple selectable tone presets (Acoustic, Clean Electric, Overdrive, Synth).
 * Strums strings low→high with a 30ms delay per string.
 */

// Standard open-string MIDI notes: E2=40, A2=45, D3=50, G3=55, B3=59, E4=64
const STD_OPEN_MIDI = [40, 45, 50, 55, 59, 64];
const STD_TUNING    = [4, 9, 2, 7, 11, 4];  // standard pitch classes (EADGBE)

// ─── Sample Engine ────────────────────────────────────────────────────────────
// Estimated MIDI root pitch of each sample — adjust if playback sounds out of tune.
// Acoustic coverage: C2=36 → Bb5=82 (max 3-semitone pitch-shift anywhere).
// Electric coverage: G1=31 → E6=88 (max 2-semitone pitch-shift anywhere).
const SAMPLE_PITCHES = [
  // ── Sub-bass baritone (C2): covers Drop C and below ──────────────────────
  { file: 'assets/audio/SO_GA_guitar_acoustic_note_C2.wav',          midi: 36 },  // C2

  // ── Low register (E2–D3): GIO_CGTR classical guitar lownotes ─────────────
  // Note: lownotes_F#, lownotes_C#, lownotes_D# all fail to load (# in URL) — omitted.
  // SC_BG samples fill those gaps (Bb2, Db3).
  { file: 'assets/audio/GIO_CGTR_classical_guitar_lownotes_E.wav',  midi: 40 },  // E2
  { file: 'assets/audio/GIO_CGTR_classical_guitar_lownotes_F.wav',  midi: 41 },  // F2
  { file: 'assets/audio/GIO_CGTR_classical_guitar_lownotes_G.wav',  midi: 43 },  // G2
  // guitar_A.wav removed — chord recording, not a single note. A2 pitch-shifts from Bb2 (46).
  { file: 'assets/audio/SC_BG_guitar_acoustic_note_Bb2.wav',         midi: 46 },  // Bb2
  { file: 'assets/audio/GIO_CGTR_classical_guitar_lownotes_C.wav',  midi: 48 },  // C3
  { file: 'assets/audio/SC_BG_guitar_acoustic_note_Db3.wav',         midi: 49 },  // Db3
  { file: 'assets/audio/GIO_CGTR_classical_guitar_lownotes_D.wav',  midi: 50 },  // D3

  // ── Mid register (E3–Db4): SC_BG fills the previously-empty E3–B3 gap ────
  { file: 'assets/audio/SC_BG_guitar_acoustic_note_E3.wav',          midi: 52 },  // E3
  { file: 'assets/audio/SC_BG_guitar_acoustic_note_G3.wav',          midi: 55 },  // G3
  { file: 'assets/audio/SC_BG_guitar_acoustic_note_Bb3.wav',         midi: 58 },  // Bb3
  { file: 'assets/audio/SC_BG_guitar_acoustic_note_B3.wav',          midi: 59 },  // B3
  { file: 'assets/audio/SC_BG_guitar_acoustic_note_Db4.wav',         midi: 61 },  // Db4

  // ── High register (E4–Bb5): SC_BG primary, SNS_FK/GIO_CGTR as alternates ─
  // SNS_FK/GIO_CGTR notes_*.wav actual pitches are one octave lower than filenames suggest — MIDI tags reflect real pitch.
  // SC_BG entries listed first — they win on ties as the more reliable source.
  { file: 'assets/audio/SC_BG_guitar_acoustic_note_E4.wav',                        midi: 64 },  // E4
  { file: 'assets/audio/SNS_FK_guitar_acoustic_one_shot_cinema_E.wav',              midi: 64 },  // E4 (alt)
  { file: 'assets/audio/SC_BG_guitar_acoustic_note_G4.wav',                         midi: 67 },  // G4
  // SNS_FK…picnic_A.wav removed — chord recording, not a single note. A4 pitch-shifts from Bb4 (70).
  { file: 'assets/audio/SC_BG_guitar_acoustic_note_Bb4.wav',                        midi: 70 },  // Bb4
  { file: 'assets/audio/SNS_FK_guitar_acoustic_one_shot_visual_B.wav',              midi: 59 },  // B3 (actual pitch; B4 pitch-shifts from Bb4)
  { file: 'assets/audio/SNS_FK_guitar_acoustic_one_shot_heritage_C.wav',            midi: 60 },  // C4 (actual pitch; C5 pitch-shifts from Db5)
  { file: 'assets/audio/SC_BG_guitar_acoustic_note_Db5.wav',                        midi: 73 },  // Db5
  { file: 'assets/audio/SC_BG_guitar_acoustic_note_E5.wav',                         midi: 76 },  // E5
  { file: 'assets/audio/GIO_CGTR_classical_guitar_notes_E.wav',                     midi: 76 },  // E5 (alt)
  { file: 'assets/audio/GIO_CGTR_classical_guitar_notes_F.wav',                     midi: 65 },  // F4 (actual pitch; F5 pitch-shifts from E5, Gb5 from G5)
  { file: 'assets/audio/SC_BG_guitar_acoustic_note_G5.wav',                         midi: 79 },  // G5
  { file: 'assets/audio/GIO_CGTR_classical_guitar_notes_G.wav',                     midi: 79 },  // G5 (alt)
  { file: 'assets/audio/SC_BG_guitar_acoustic_note_Bb5.wav',                        midi: 82 },  // Bb5 — extends acoustic range
];

// ─── Electric clean samples ──────────────────────────────────────────────────
// Single-note WAVs spanning G1(31) → Db6(85).
// Optional `gain` field scales peak/sustain for that sample only (default 1.0).
// Note: filenames containing '#' use %23 encoding so fetch() treats them as paths, not fragments.
const SAMPLE_PITCHES_ELECTRIC = [
  // ── Sub-bass / baritone (G1–D2) ──────────────────────────────────────────
  { file: 'assets/audio/electric/SO_DI_baritone_guitar_note_batiste_long_G1.wav',                            midi: 31 },  // G1
  { file: 'assets/audio/electric/CO_BG_baritone_guitar_note_A1.wav',                                         midi: 33 },  // A1
  { file: 'assets/audio/electric/shs_grunge_Guitar_Single_Note_6_C2.wav',                                    midi: 36 },  // C2
  { file: 'assets/audio/electric/shs_grunge_Guitar_Single_Note_1_D2.wav',                                    midi: 38 },  // D2

  // ── Low register (E2–B2) ─────────────────────────────────────────────────
  { file: 'assets/audio/electric/CO_BG_baritone_guitar_note_E2.wav',                                         midi: 40 },  // E2
  { file: 'assets/audio/electric/SO_LN_guitar_electric_note_F2.wav',                                         midi: 41 },  // F2
  // G2 removed — SO_VS recording was distorted; G#2/Ab2 now pitch-shifts from A2(−1)
  { file: 'assets/audio/electric/SC_WG_guitar_electric_notes_A_string_A2.wav',                               midi: 45 },  // A2
  { file: 'assets/audio/electric/SC_WG_guitar_electric_notes_low_Bb2.wav',                                   midi: 46 },  // Bb2
  { file: 'assets/audio/electric/shs_grunge_Guitar_Single_Note_2_B2.wav',                                    midi: 47 },  // B2

  // ── Mid-low register (C3–E3) ─────────────────────────────────────────────
  { file: 'assets/audio/electric/SO_JC_guitar_note_C3.wav',                                                  midi: 48, gain: 1.6 },  // C3 — boosted
  { file: 'assets/audio/electric/SC_WG_guitar_electric_notes_low_Db3.wav',                                   midi: 49 },  // Db3
  { file: 'assets/audio/electric/SC_WG_guitar_electric_notes_D_string_D3.wav',                               midi: 50 },  // D3
  { file: 'assets/audio/electric/TRKTRN_DJV3GLKBL_Electric_Guitar_Jazzmaster_AC30_One_Shot_Button_E3.wav',   midi: 52, gain: 1.5 },  // E3 — boosted (E3/F3 covered via shift)

  // ── Mid register (Bb3–B3) ─────────────────────────────────────────────────
  // G3 removed — SC_WG recording sounds wrong; G3 now pitch-shifts from E3(+3) or Bb3(−3)
  // G#3 removed — SO_LH pedal steel plays wrong pitch; G#3/A3 now pitch-shift from Bb3(−2/−1)
  { file: 'assets/audio/electric/SC_WG_guitar_electric_notes_mid_Bb3.wav',                                   midi: 58 },  // Bb3
  { file: 'assets/audio/electric/SC_WG_guitar_electric_notes_B_string_B3.wav',                               midi: 59 },  // B3

  // ── Upper-mid register (Db4–E4) ──────────────────────────────────────────
  { file: 'assets/audio/electric/SC_WG_guitar_electric_notes_mid_Db4.wav',                                   midi: 61 },  // Db4
  { file: 'assets/audio/electric/SO_AD_guitar_electric_note_long_Eb4.wav',                                   midi: 63, gain: 1.5 },  // Eb4 — boosted (D#/Eb across all strings)
  { file: 'assets/audio/electric/SC_WG_guitar_electric_notes_high_E4.wav',                                   midi: 64, gain: 1.5 },  // E4 — boosted (E4/F4 covered via shift)

  // ── High register (G4–Bb4) ───────────────────────────────────────────────
  // Gb4/F#4 removed — SS_MK recording has pitch bend; Gb4 now pitch-shifts from G4(−1)
  { file: 'assets/audio/electric/SC_WG_guitar_electric_notes_mid_G4.wav',                                    midi: 67 },  // G4
  { file: 'assets/audio/electric/09_Fender_One_Shot_G%234.wav',                                              midi: 68 },  // G#4
  { file: 'assets/audio/electric/SC_WG_guitar_electric_notes_high_Bb4.wav',                                  midi: 70 },  // Bb4

  // ── Very high register (Db5–Db6) ─────────────────────────────────────────
  { file: 'assets/audio/electric/SO_LH_pedal_steel_note_Db5.wav',                                            midi: 73 },  // Db5
  { file: 'assets/audio/electric/SC_WG_guitar_electric_notes_highest_E5.wav',                                midi: 76 },  // E5
  // Gb5/F#5 removed — both recordings have pitch bend; Gb5 now pitch-shifts from G5(−1)
  { file: 'assets/audio/electric/SC_WG_guitar_electric_notes_high_G5.wav',                                   midi: 79 },  // G5
  { file: 'assets/audio/electric/SC_WG_guitar_electric_notes_highest_Bb5.wav',                               midi: 82 },  // Bb5
  { file: 'assets/audio/electric/TRKTRN_DJV3GLKBL_Electric_Guitar_Jazzmaster_AC30_One_Shot_Requ_C6.wav',    midi: 84, gain: 0.6 },  // C6 — quieter/less bright
  { file: 'assets/audio/electric/SC_WG_guitar_electric_notes_highest_Db6.wav',                               midi: 85 },  // Db6
];

let _sampleBuffers  = null;   // Map<file, AudioBuffer> — acoustic
let _samplesPromise = null;
let _electricBuffers  = null; // Map<file, AudioBuffer> — clean electric
let _electricPromise  = null;

function _makeSampleLoader(pitches, getBuffers, setBuffers, getPromise, setPromise) {
  return async function(ctx) {
    if (getBuffers()) return;
    if (getPromise()) { await getPromise(); return; }
    const p = (async () => {
      const map = new Map();
      await Promise.all(pitches.map(async ({ file }) => {
        try {
          const res = await fetch(file);
          const ab  = await res.arrayBuffer();
          map.set(file, await ctx.decodeAudioData(ab));
        } catch (e) {
          console.warn('[audio] could not load sample:', file, e);
        }
      }));
      setBuffers(map);
    })();
    setPromise(p);
    await p;
  };
}

const _loadSamples = _makeSampleLoader(
  SAMPLE_PITCHES,
  () => _sampleBuffers,  () => { /* unused */ },
  () => _samplesPromise, () => { /* unused */ },
);

// Inline acoustic loader (keeps original variable mutation pattern)
async function _loadAcousticSamples(ctx) {
  if (_sampleBuffers) return;
  if (_samplesPromise) { await _samplesPromise; return; }
  _samplesPromise = (async () => {
    const map = new Map();
    await Promise.all(SAMPLE_PITCHES.map(async ({ file }) => {
      try {
        const res = await fetch(file);
        const ab  = await res.arrayBuffer();
        map.set(file, await ctx.decodeAudioData(ab));
      } catch (e) {
        console.warn('[audio] could not load sample:', file, e);
      }
    }));
    _sampleBuffers = map;
  })();
  await _samplesPromise;
}

async function _loadElectricSamples(ctx) {
  if (_electricBuffers) return;
  if (_electricPromise) { await _electricPromise; return; }
  _electricPromise = (async () => {
    const map = new Map();
    await Promise.all(SAMPLE_PITCHES_ELECTRIC.map(async ({ file }) => {
      try {
        const res = await fetch(file);
        const ab  = await res.arrayBuffer();
        map.set(file, await ctx.decodeAudioData(ab));
      } catch (e) {
        console.warn('[audio] could not load sample:', file, e);
      }
    }));
    _electricBuffers = map;
  })();
  await _electricPromise;
}

function _closestSample(midiNote) {
  let best = null, bestDist = Infinity;
  for (const sp of SAMPLE_PITCHES) {
    const buf = _sampleBuffers?.get(sp.file);
    if (!buf) continue;
    const d = Math.abs(sp.midi - midiNote);
    if (d < bestDist) { bestDist = d; best = { buf, midi: sp.midi }; }
  }
  // More than 6 semitones away → pitch-shift would be audibly wrong; let synthesis handle it
  if (bestDist > 6) return null;
  return best;
}

function _closestElectricSample(midiNote) {
  let best = null, bestDist = Infinity;
  for (const sp of SAMPLE_PITCHES_ELECTRIC) {
    const buf = _electricBuffers?.get(sp.file);
    if (!buf) continue;
    const d = Math.abs(sp.midi - midiNote);
    if (d < bestDist) { bestDist = d; best = { buf, midi: sp.midi, gain: sp.gain ?? 1 }; }
  }
  // More than 6 semitones away → pitch-shift would be audibly wrong; let synthesis handle it
  if (bestDist > 6) return null;
  return best;
}

let _ctx        = null;
let _masterComp = null;   // shared compressor/limiter
let _reverbSend = null;   // acoustic reverb send bus (1.2 s tail)
let _reverbNode = null;   // acoustic ConvolverNode
let _reverbSendElec = null; // electric reverb send bus (0.8 s tail — separate from acoustic)
let _reverbNodeElec = null; // electric ConvolverNode
let _slapDelay    = null;   // slapback delay (clean electric only)
let _slapFeedback = null;   // slapback feedback gain
let _microDelayL  = null;   // stereo widener — 11 ms, panned hard L
let _microDelayR  = null;   // stereo widener — 17 ms, panned hard R
let _microPanL    = null;   // StereoPannerNode (-1)
let _microPanR    = null;   // StereoPannerNode (+1)
let _elecComp     = null;   // electric-only dynamics compressor (before _masterComp)
let _temperWorkletReady = false;  // true once temper-worklet.js module has loaded (module loaded for future use)
let _aa50Curve    = null;   // cached Float32Array for aa50 waveshaper

// Track oscillators scheduled for current playback
let _scheduledNodes  = [];
let _activeDistEnvGains = [];  // envGain refs for live distortion notes (soft-stop support)
let _completionTimer = null;
let _chordTimers     = [];

// ─── Tone Presets ────────────────────────────────────────────────────────────
// reverbMix: 0–1 wet signal level sent to the shared reverb bus

const TONE_PRESETS = {
  acoustic: {
    label:    'Acoustic',
    duration: 2.2,
    // Inharmonic partial stack (Inharm 38%): each upper harmonic is slightly sharp.
    // freqMult = harmonic number; inharmonB = string stiffness coefficient.
    // Higher partials get lower gain (they decay faster on real strings).
    oscillators: [
      { type: 'triangle', freqMult: 1, inharmonB: 0,      gain: 0.50 },
      { type: 'triangle', freqMult: 2, inharmonB: 0.0004, gain: 0.20 },
      { type: 'triangle', freqMult: 3, inharmonB: 0.0004, gain: 0.09 },
      { type: 'triangle', freqMult: 4, inharmonB: 0.0004, gain: 0.04 },
    ],
    // Attack noise burst: simulates Plectrum exciter scraping the string
    pluckNoise: { gain: 0.30, decayTime: 0.020, bandpassFreqMult: 2.8 },
    envelope:  { curve: 'exponential', attack: 0.003, decay: 0.6, sustain: 0.06, release: 0.8 },
    // Body Low Cut 38% (Jazz Bright Guitar) → gentler highpass at 120 Hz
    filter:    { type: 'lowpass', frequency: 3000, Q: 1, highpassHz: 120 },
    overdrive: null,
    reverbMix: 0.22,
  },
  clean_electric: {
    label:    'Clean Electric',
    duration: 2.5,
    // Sine waves only — sawtooth/triangle contain all harmonics (that IS the buzz).
    // Real strings vibrate nearly sinusoidally once the pick transient settles.
    // Small 2nd + 3rd harmonic sines add warmth without adding buzz.
    oscillators: [
      { type: 'sine', freqMult: 1, inharmonB: 0,      gain: 0.50 },  // fundamental
      { type: 'sine', freqMult: 2, inharmonB: 0.0002, gain: 0.10 },  // 2nd partial — warmth
      { type: 'sine', freqMult: 3, inharmonB: 0.0002, gain: 0.04 },  // 3rd partial — barely audible
    ],
    // Subtle pick click: the "guitar identifier". Quieter than acoustic (clean playing).
    pluckNoise: { gain: 0.025, decayTime: 0.009, bandpassFreqMult: 5.0 },
    // Very fast attack (real pick), modest sustain (notes don't blur), long natural release
    envelope:  { curve: 'exponential', attack: 0.00045, decay: 0.25, sustain: 0.18, release: 2.0 },
    // sweepFrom: filter opens BRIGHT at the pick moment, then closes to resting freq over sweepTime.
    // This mimics how upper harmonics decay much faster than the fundamental on a real string —
    // the single biggest reason Web Audio guitars sound like synths without it.
    filter: { type: 'lowpass', frequency: 7000, Q: 0.8, highpassHz: 80,
              sweepFrom: 12000, sweepTime: 0.45 },
    // Fender-style 3 kHz presence bump: string definition without fizz
    presenceFilter: { frequency: 3000, gain: 2.0, Q: 1.0 },
    overdrive: null,
    reverbMix: 0.15,
  },
  overdriven: {
    label:    'Overdrive',
    duration: 2.0,
    // 3 inharmonic partials — WaveShaper colors them all, richer source = richer distortion
    oscillators: [
      { type: 'sawtooth', freqMult: 1, inharmonB: 0,      gain: 0.60 },
      { type: 'sawtooth', freqMult: 2, inharmonB: 0.0002, gain: 0.25 },
      { type: 'sawtooth', freqMult: 3, inharmonB: 0.0002, gain: 0.10 },
    ],
    // Mid-frequency "chunk" attack — pick through a driven amp sounds thicker, less bright
    pluckNoise: { gain: 0.40, decayTime: 0.015, bandpassFreqMult: 1.8 },
    envelope:  { curve: 'exponential', attack: 0.005, decay: 0.2, sustain: 0.3, release: 0.3 },
    filter:    { type: 'lowpass', frequency: 6000, Q: 1 },
    overdrive: { amount: 8 },
    reverbMix: 0.08,
  },
  synth: {
    label:       'Synth',
    duration:    1.5,
    oscillators: [
      { type: 'triangle', detune: 0, gain: 1.0 },
    ],
    envelope:  { curve: 'linear', attack: 0.005, decay: 0.1, sustain: 0.15, release: 0.3 },
    filter:    { type: 'lowpass', frequency: 2000, Q: 1 },
    overdrive: null,
    reverbMix: 0,
  },
  distortion: {
    label:    'Distortion',
    duration: 2.8,
    // Sample-based (electric samples). Actual chain in _playNoteDistortionSampled:
    // aa50 amp sim (inputGain → resonanceLP → bottomShelf → preGain → aa50WaveShaper
    //   → presence/bass/mid/treble EQ → outputGain)
    //   → cab sim (cabLP → cabNotch → sm57Air) → safetyClip → pan → _elecComp → _masterComp
    reverbMix: 0.12,
  },
};

let _activePreset = TONE_PRESETS.acoustic;

export function setTonePreset(name) {
  if (!TONE_PRESETS[name]) return;
  const wasDistortion = _activePreset === TONE_PRESETS.distortion;
  _activePreset = TONE_PRESETS[name];

  // If we were on distortion, the AudioContext shared nodes (_elecComp, _masterComp)
  // may have accumulated NaN state from upstream gain/filter instability, permanently
  // silencing all subsequent audio. Close and nullify the context — _getCtx() will
  // recreate everything fresh on the next play action.
  if (wasDistortion && _ctx) {
    stopPlayback();
    _ctx.close().catch(() => {});
    _ctx        = null;
    _masterComp = null;
    _reverbSend = null;   _reverbNode     = null;
    _reverbSendElec = null; _reverbNodeElec = null;
    _slapDelay  = null;   _slapFeedback   = null;
    _microDelayL = null;  _microDelayR    = null;
    _microPanL  = null;   _microPanR      = null;
    _elecComp   = null;
    _temperWorkletReady = false;
  }
}

export function getTonePresetName() {
  return Object.keys(TONE_PRESETS).find(k => TONE_PRESETS[k] === _activePreset) ?? 'acoustic';
}

export const TONE_PRESET_LABELS = Object.fromEntries(
  Object.entries(TONE_PRESETS).map(([k, v]) => [k, v.label])
);

// ─── Audio Context & Shared Buses ────────────────────────────────────────────

/**
 * Synthetic room reverb using exponentially-decaying stereo noise as an impulse response.
 * Created once per AudioContext; output feeds directly into _masterComp.
 */
function _initReverb(ctx) {
  const duration = 1.2;   // reverb tail — short room, keeps notes defined (tightened from 1.7 s)
  const decay    = 2.8;   // steeper = faster decay
  const rate     = ctx.sampleRate;
  const length   = Math.floor(rate * duration);
  const buffer   = ctx.createBuffer(2, length, rate);

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }

  _reverbNode = ctx.createConvolver();
  _reverbNode.buffer = buffer;

  _reverbSend = ctx.createGain();
  _reverbSend.gain.value = 1;

  _reverbSend.connect(_reverbNode);
  _reverbNode.connect(_masterComp);
}

/**
 * Electric-specific reverb — very short room (0.45 s) for presence without wash.
 * Replaces the previous 0.8 s tail; sends are kept low (0.08) to give space, not bloom.
 */
function _initElectricReverb(ctx) {
  const duration = 0.45;   // short room — definition over ambience
  const decay    = 1.8;    // tighter decay curve matches the short tail
  const rate     = ctx.sampleRate;
  const length   = Math.floor(rate * duration);
  const buffer   = ctx.createBuffer(2, length, rate);

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }

  _reverbNodeElec = ctx.createConvolver();
  _reverbNodeElec.buffer = buffer;

  _reverbSendElec = ctx.createGain();
  _reverbSendElec.gain.value = 1;

  _reverbSendElec.connect(_reverbNodeElec);
  _reverbNodeElec.connect(_masterComp);
}

/**
 * Stereo micro-delay widener — 10 ms L / 16 ms R, no feedback, panned hard L/R.
 * Sends a 10% wet copy of each note into each side, creating perceived stereo width
 * without reverb muddiness. Classic "wide clean electric" technique.
 */
function _initMicroDelay(ctx) {
  _microDelayL = ctx.createDelay(0.1);
  _microDelayL.delayTime.value = 0.010;  // 10 ms

  _microDelayR = ctx.createDelay(0.1);
  _microDelayR.delayTime.value = 0.016;  // 16 ms

  _microPanL = ctx.createStereoPanner();
  _microPanL.pan.value = -1;  // hard left

  _microPanR = ctx.createStereoPanner();
  _microPanR.pan.value = 1;   // hard right

  _microDelayL.connect(_microPanL);
  _microPanL.connect(_masterComp);

  _microDelayR.connect(_microPanR);
  _microPanR.connect(_masterComp);
}

/**
 * Electric-only dynamics compressor — sits before _masterComp in the electric signal path.
 * Gentler settings than the shared _masterComp: lets chord transients breathe and sustain bloom.
 */
function _initElecComp(ctx) {
  _elecComp = ctx.createDynamicsCompressor();
  _elecComp.threshold.value = -17;   // engage later than shared comp — transients pass through
  _elecComp.knee.value      = 14;    // wide soft knee — very gradual onset
  _elecComp.ratio.value     = 2.0;   // 2:1 gentle glue — holds chord body without squeezing it
  _elecComp.attack.value    = 0.026; // 26 ms — pick transient passes before compression grabs
  _elecComp.release.value   = 0.210; // 210 ms — sustain body recovers naturally between strings
  _elecComp.connect(_masterComp);
}

/**
 * Slapback delay (50 ms, 8% feedback) — classic clean electric character.
 * Output feeds directly into _masterComp; feedback loops within the delay line only.
 */
function _initSlap(ctx) {
  _slapDelay          = ctx.createDelay(0.5);
  _slapDelay.delayTime.value = 0.05;  // 50 ms (tighter slap — less room, more presence)

  _slapFeedback       = ctx.createGain();
  _slapFeedback.gain.value = 0.08;  // 8% feedback

  // delay → feedback → delay (self-loop for natural echo decay)
  _slapDelay.connect(_slapFeedback);
  _slapFeedback.connect(_slapDelay);
  // and to output so we hear the echoes
  _slapDelay.connect(_masterComp);
}

/**
 * Loads the Temper AudioWorklet module (module only — no shared insert node).
 * The worklet is available for future use but not wired into the live signal path.
 * Per-note distortion uses native WaveShaper nodes which have zero persistent state,
 * preventing the "glitch for minutes" issue caused by orphaned AudioWorkletNode connections.
 */
async function _initTemperWorklet(ctx) {
  try {
    await ctx.audioWorklet.addModule('js/audio/temper-worklet.js');
    _temperWorkletReady = true;
  } catch (e) {
    // Worklet failed to load (e.g. file:// origin, CSP) — not a problem since we use native nodes
    console.warn('[audio] Temper worklet unavailable:', e.message);
  }
}

/**
 * Precomputes the aa50-amp-sim waveshaper curve (4096 points).
 * Formula ported from joeloftusdev/aa50-amp-sim PluginProcessor.cpp.
 * Cached in _aa50Curve after first call.
 *
 * The rational approximation provides a smooth, asymptotically bounded soft-clip
 * that retains more harmonic richness than a pure tanh.
 */
function _makeAa50WaveshapeCurve() {
  if (_aa50Curve) return _aa50Curve;
  const n = 4096;
  _aa50Curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const rawX = (i * 2) / n - 1;     // −1 … +1
    const x    = rawX * 0.25;          // scale as in aa50 source
    const a    = Math.abs(x);
    const x2   = x * x;
    const y    = 1 - 1 / (1 + a + x2 + 0.66422417311781 * x2 * a + 0.36483285408241 * x2 * x2);
    _aa50Curve[i] = x >= 0 ? y : -y;
  }
  return _aa50Curve;
}

function _getCtx() {
  if (!_ctx || _ctx.state === 'closed') {
    _ctx = new AudioContext();
    _temperWorkletReady = false;  // worklet must be re-registered in the new context

    _masterComp = _ctx.createDynamicsCompressor();
    _masterComp.threshold.value = -20;   // engage later — lets pick transients breathe
    _masterComp.knee.value      = 14;    // wide soft knee — very gradual onset
    _masterComp.ratio.value     = 2.5;   // gentler glue — lets sample dynamics breathe
    _masterComp.attack.value    = 0.016; // 16 ms — transient passes before compression grabs it
    _masterComp.release.value   = 0.16;  // 160 ms — recovery between strings
    _masterComp.connect(_ctx.destination);

    _initReverb(_ctx);
    _initElectricReverb(_ctx);
    _initMicroDelay(_ctx);
    _initElecComp(_ctx);
    _initSlap(_ctx);
    _initTemperWorklet(_ctx);  // async fire-and-forget; sets _temperWorkletReady when done
    // Eagerly pre-load both sample banks so they're ready on first play
    _loadAcousticSamples(_ctx);
    _loadElectricSamples(_ctx);
  }
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

// ─── Note Helpers ─────────────────────────────────────────────────────────────

function _midiForString(stringIdx, fret, tuning) {
  let diff = tuning[stringIdx] - STD_TUNING[stringIdx];
  diff = ((diff + 6) % 12 + 12) % 12 - 6;
  return STD_OPEN_MIDI[stringIdx] + diff + fret;
}

/**
 * tanh-based soft-clipping WaveShaper — warm tube amp character.
 * amount = pregain multiplier: ~8 = light crunch, ~20 = heavy distortion.
 */
function _makeDistortionNode(ctx, amount) {
  const n = 512;
  const curve = new Float32Array(n);
  const tanhAmount = Math.tanh(amount);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = Math.tanh(amount * x) / tanhAmount;
  }
  const ws = ctx.createWaveShaper();
  ws.curve = curve;
  ws.oversample = 'none';
  return ws;
}

/**
 * Play a single note using the active tone preset.
 */
function _playNote(ctx, freq, startTime, duration) {
  const preset       = _activePreset;
  const nodeDuration = duration ?? preset.duration;
  const env          = preset.envelope;
  const peak         = 0.5;
  const sus          = Math.max(peak * env.sustain, 0.0001);

  // Oscillators → merger
  const merger = ctx.createGain();
  merger.gain.value = 1;

  for (const oscDef of preset.oscillators) {
    const osc = ctx.createOscillator();
    osc.type = oscDef.type;
    // freqMult: harmonic number (default 1 = fundamental)
    // inharmonB: string stiffness coeff — shifts partial n by sqrt(1 + B*n²)
    const n         = oscDef.freqMult ?? 1;
    const B         = oscDef.inharmonB ?? 0;
    const inharmonF = B > 0 ? Math.sqrt(1 + B * n * n) : 1;
    osc.frequency.setValueAtTime(freq * n * inharmonF, startTime);
    osc.detune.value = oscDef.detune ?? 0;

    const oscGain = ctx.createGain();
    oscGain.gain.value = oscDef.gain;
    osc.connect(oscGain);
    oscGain.connect(merger);

    osc.start(startTime);
    osc.stop(startTime + nodeDuration + 0.05);
    _scheduledNodes.push(osc);
  }

  // Pluck noise burst — simulates pick/plectrum exciter transient
  if (preset.pluckNoise) {
    const pn       = preset.pluckNoise;
    const bufLen   = Math.floor(ctx.sampleRate * 0.05);  // 50 ms white noise
    const noiseBuf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data     = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuf;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq * pn.bandpassFreqMult;
    bp.Q.value = 1.5;

    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, startTime);
    ng.gain.exponentialRampToValueAtTime(pn.gain, startTime + 0.001);
    ng.gain.exponentialRampToValueAtTime(0.0001, startTime + pn.decayTime);

    noiseSrc.connect(bp);
    bp.connect(ng);
    ng.connect(_masterComp);

    noiseSrc.start(startTime);
    noiseSrc.stop(startTime + pn.decayTime + 0.01);
    _scheduledNodes.push(noiseSrc);
  }

  // Optional WaveShaper (overdrive)
  const distNode = preset.overdrive
    ? _makeDistortionNode(ctx, preset.overdrive.amount)
    : null;
  if (distNode) merger.connect(distNode);

  // Optional highpass (Body Low Cut) → removes boominess before main tone filter
  let lastNode = distNode ?? merger;
  if (preset.filter.highpassHz) {
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = preset.filter.highpassHz;
    hp.Q.value = 0.7;
    lastNode.connect(hp);
    lastNode = hp;
  }

  // Optional presence EQ — peaking filter for string definition (e.g. Fender 3.5 kHz bump)
  // Keeps "keep_note_definition_high" and "allow_pick_attack_detail" without adding fizz
  if (preset.presenceFilter) {
    const pf = ctx.createBiquadFilter();
    pf.type            = 'peaking';
    pf.frequency.value = preset.presenceFilter.frequency;
    pf.gain.value      = preset.presenceFilter.gain;  // dB
    pf.Q.value         = preset.presenceFilter.Q;
    lastNode.connect(pf);
    lastNode = pf;
  }

  // Main tone filter (lowpass / bandpass)
  // If sweepFrom is set: starts bright (pick moment) → ramps to resting frequency.
  // This is the key technique that makes sines sound like real strings, not synths —
  // upper harmonics die off faster than the fundamental on every plucked string.
  const filter = ctx.createBiquadFilter();
  filter.type    = preset.filter.type;
  filter.Q.value = preset.filter.Q;
  if (preset.filter.sweepFrom) {
    filter.frequency.setValueAtTime(preset.filter.sweepFrom, startTime);
    filter.frequency.exponentialRampToValueAtTime(
      preset.filter.frequency,
      startTime + (preset.filter.sweepTime ?? 0.3)
    );
  } else {
    filter.frequency.setValueAtTime(preset.filter.frequency, startTime);
  }
  lastNode.connect(filter);

  // ADSR envelope gain
  const envGain = ctx.createGain();
  envGain.gain.setValueAtTime(0.0001, startTime);

  if (env.curve === 'exponential') {
    envGain.gain.exponentialRampToValueAtTime(peak, startTime + env.attack);
    envGain.gain.exponentialRampToValueAtTime(sus,  startTime + env.attack + env.decay);
    const holdUntil = startTime + nodeDuration - env.release;
    if (holdUntil > startTime + env.attack + env.decay) {
      envGain.gain.setValueAtTime(sus, holdUntil);
    }
    envGain.gain.exponentialRampToValueAtTime(0.0001, startTime + nodeDuration);
  } else {
    envGain.gain.linearRampToValueAtTime(peak, startTime + env.attack);
    envGain.gain.linearRampToValueAtTime(sus,  startTime + env.attack + env.decay);
    const holdUntil = startTime + nodeDuration - env.release;
    if (holdUntil > startTime + env.attack + env.decay) {
      envGain.gain.setValueAtTime(sus, holdUntil);
    }
    envGain.gain.linearRampToValueAtTime(0, startTime + nodeDuration);
  }

  filter.connect(envGain);

  // Dry path → master compressor
  envGain.connect(_masterComp);

  // Wet path → shared reverb bus
  if (preset.reverbMix > 0 && _reverbSend) {
    const wetGain = ctx.createGain();
    wetGain.gain.value = preset.reverbMix;
    envGain.connect(wetGain);
    wetGain.connect(_reverbSend);
  }
}

/**
 * Sample-based note playback for the acoustic preset.
 * Pitch-shifts the closest WAV sample via playbackRate to match the target MIDI note.
 * Falls back to synthesis if samples haven't loaded yet.
 */
function _playNoteSampled(ctx, midiNote, freq, startTime) {
  const sample = _closestSample(midiNote);
  if (!sample) {
    // No samples available at all — fall back to synthesis
    _playNote(ctx, freq, startTime, _activePreset.duration);
    return;
  }

  const semitoneOffset = midiNote - sample.midi;
  const rate = Math.pow(2, semitoneOffset / 12);

  // Tighter boost — compensates for duller low-transposition onset without over-pumping
  const attackBoost = Math.max(0.82, Math.min(1.0, 1.0 - semitoneOffset * 0.015));

  const src = ctx.createBufferSource();
  src.buffer = sample.buf;
  src.playbackRate.value = rate;

  // Two-stage envelope: fast attack → brief initial decay → sustained body → long release tail
  // This lets the note bloom through its body resonance before releasing, rather than
  // plucking and immediately falling away.
  const peak    = 0.95 * attackBoost;
  const body    = peak * 0.76;   // settle to ~76% of peak after initial decay
  const envGain = ctx.createGain();
  envGain.gain.setValueAtTime(0.0001, startTime);
  envGain.gain.exponentialRampToValueAtTime(peak, startTime + 0.002);  // 2 ms attack
  envGain.gain.exponentialRampToValueAtTime(body, startTime + 0.105);  // 100 ms initial decay
  envGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 3.0);  // 2.9 s release tail

  src.connect(envGain);
  envGain.connect(_masterComp);

  // Reverb send — pulled back so dry note definition is preserved
  if (_reverbSend) {
    const wet = ctx.createGain();
    wet.gain.value = 0.22;
    envGain.connect(wet);
    wet.connect(_reverbSend);
  }

  // Stop well after the gain envelope is silent; add extra tail for low-pitched notes
  const tailExtra = Math.max(0, -semitoneOffset) * 0.04;  // longer tail for downward-shifted samples
  src.start(startTime);
  src.stop(startTime + 3.5 + tailExtra);
  _scheduledNodes.push(src);
}

/**
 * Sample-based note playback for the clean electric preset.
 *
 * Two envelope modes (auto-detected):
 *   Chord (≥2 strings): 4ms / 190ms / pk0.89 / sus0.82 / rel2.8s / stop~4s
 *   Single note:        2ms / 120ms / pk0.90 / sus0.64 / rel1.5s / stop~2.25s
 *
 * EQ chain: HP(80Hz) → Peaking(1900Hz,+1.2dB) → Highshelf(4200Hz,+0.9dB) → LP(6800Hz)
 *
 * Routing (dry):  lp → perStringPan → _elecComp → _masterComp
 * Routing (wet):  lp → [0.08] → _reverbSendElec (0.45s short room) → _masterComp
 *                 lp → [0.06] → _slapDelay (50ms) → _masterComp
 *                 lp → [0.10] → _microDelayL/R (10ms L / 16ms R, panned hard) → _masterComp
 * Detune layer (chord only): two extra BufferSources at ±3 cents, 4% mix, panned hard L/R
 */
function _playNoteElectricSampled(ctx, midiNote, startTime, stringIdx = 0, isChord = false) {
  const sample = _closestElectricSample(midiNote);
  if (!sample) {
    const freq = 440 * Math.pow(2, (midiNote - 69) / 12);
    _playNote(ctx, freq, startTime, _activePreset.duration);
    return;
  }

  const semitoneOffset = midiNote - sample.midi;
  const rate = Math.pow(2, semitoneOffset / 12);

  // ── Envelope parameters (chord vs single-note) ───────────────────────────
  const attack  = isChord ? 0.004 : 0.002;
  const decay   = isChord ? 0.190 : 0.120;
  const release = isChord ? 2.8   : 1.5;

  // Per-note gain variance in chord mode (±1 dB) — prevents uniform machine-like attack
  const gainTrim   = isChord ? Math.pow(10, (Math.random() - 0.5) * 0.115) : 1.0;
  const sampleGain = sample.gain ?? 1;
  const peak     = (isChord ? 0.89 : 0.90) * gainTrim * sampleGain;
  const sustain  = (isChord ? 0.82 : 0.64) * gainTrim * sampleGain;

  // Tiny sample-start jitter in chord mode (0–3 ms) makes each string feel hand-played
  const jitter = isChord ? Math.random() * 0.003 : 0;
  const stopAt = startTime + jitter + attack + decay + release + 0.4;

  // ── Envelope ─────────────────────────────────────────────────────────────
  const src = ctx.createBufferSource();
  src.buffer = sample.buf;
  src.playbackRate.value = rate;

  const envGain = ctx.createGain();
  envGain.gain.setValueAtTime(0.0001, startTime);
  envGain.gain.exponentialRampToValueAtTime(peak,    startTime + attack);
  envGain.gain.exponentialRampToValueAtTime(sustain, startTime + attack + decay);
  envGain.gain.exponentialRampToValueAtTime(0.0001,  startTime + attack + decay + release);

  src.connect(envGain);

  // ── EQ chain: HP → Peaking → Highshelf → LP ──────────────────────────────
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 80; hp.Q.value = 0.7;  // was 95 — more body

  const peaking = ctx.createBiquadFilter();
  peaking.type = 'peaking'; peaking.frequency.value = 1900; peaking.Q.value = 1.0;
  peaking.gain.value = 1.2;  // was 1.5 — less poky, more musical

  const shelf = ctx.createBiquadFilter();
  shelf.type = 'highshelf'; shelf.frequency.value = 4200; shelf.gain.value = 0.9;

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 6800; lp.Q.value = 0.7;  // was 6200 — more open

  envGain.connect(hp); hp.connect(peaking); peaking.connect(shelf); shelf.connect(lp);

  // ── Dry path — per-string pan → electric comp → master comp ──────────────
  // Low strings drift left; high strings drift right — adds spatial realism to strummed chords
  const STRING_PAN = [-0.12, -0.08, -0.03, +0.03, +0.08, +0.12];
  const panNode = ctx.createStereoPanner();
  panNode.pan.value = STRING_PAN[stringIdx] ?? 0;
  lp.connect(panNode);
  panNode.connect(_elecComp ?? _masterComp);  // graceful fallback if _elecComp not ready

  // ── Wet sends (tap off lp before pan — bypass electric comp) ─────────────

  // Short room reverb — 0.08 send into 0.45 s convolver
  if (_reverbSendElec) {
    const w = ctx.createGain(); w.gain.value = 0.08;
    lp.connect(w); w.connect(_reverbSendElec);
  }

  // Slapback — 0.06 send (50 ms delay)
  if (_slapDelay) {
    const sl = ctx.createGain(); sl.gain.value = 0.06;
    lp.connect(sl); sl.connect(_slapDelay);
  }

  // Stereo micro-delay widener — 10% wet into L (10 ms) and R (16 ms)
  if (_microDelayL && _microDelayR) {
    const m = ctx.createGain(); m.gain.value = 0.10;
    lp.connect(m); m.connect(_microDelayL); m.connect(_microDelayR);
  }

  // ── Detune widener (chord mode only) — ±3 cents at 4% mix, panned hard L/R ─
  // Two additional buffer sources from the same sample create a subtle chorus-free width.
  // dp.disconnect() in onended prevents dp→_masterComp from accumulating as orphaned nodes.
  if (isChord) {
    for (const [cents, side] of [[-3, -1], [+3, 1]]) {
      const ds = ctx.createBufferSource();
      ds.buffer = sample.buf;
      ds.playbackRate.value = rate;
      ds.detune.value = cents;
      const dg = ctx.createGain(); dg.gain.value = 0.04 * gainTrim;
      const dp = ctx.createStereoPanner(); dp.pan.value = side;
      ds.connect(dg); dg.connect(dp); dp.connect(_masterComp);
      ds.start(startTime + jitter); ds.stop(stopAt);
      ds.onended = () => { dg.disconnect(); dp.disconnect(); };
      _scheduledNodes.push(ds);
    }
  }

  src.start(startTime + jitter);
  src.stop(stopAt);
  _scheduledNodes.push(src);
}

/**
 * Sample-based note playback for the distortion preset.
 *
 * Chain: BufferSource → envGain
 *   → Temper nonlinear SVF worklet (or tanh fallback if worklet not ready)
 *   → aa50 amp sim: inputGain(×7.94) → resonanceLP(5 kHz) → bottomShelf(400 Hz,+3 dB)
 *       → preGain(×31.6,+30 dB) → aa50WaveShaper(4× OS)
 *       → presencePeak(3500 Hz,+3 dB) → bassEQ(100 Hz,+2 dB)
 *       → midEQ(500 Hz,−2 dB) → trebleEQ(5000 Hz,+2 dB) → outputGain(×0.25)
 *   → cab sim: cabLP(5800 Hz) → cabNotch(2200 Hz,−4 dB) → sm57Air(7000 Hz,−2 dB)
 *   → per-string pan → _elecComp → _masterComp
 *   → reverbSend(0.12) → _reverbSendElec  (taps off outputGain, before cab)
 *
 * Parameter values mapped from Vermilion "Stoned and Doomed" OVD preset:
 *   Gain~7/10, Low~6/10, Mid~4/10, High~6/10, Pres~5/10, Black Tolex 2×12, Dynamic 57
 */
function _playNoteDistortionSampled(ctx, midiNote, startTime, stringIdx = 0, isChord = false) {
  const sample = _closestElectricSample(midiNote);
  if (!sample) {
    const freq = 440 * Math.pow(2, (midiNote - 69) / 12);
    _playNote(ctx, freq, startTime, TONE_PRESETS.distortion.duration);
    return;
  }

  const semitoneOffset = midiNote - sample.midi;
  const rate = Math.pow(2, semitoneOffset / 12);

  // Envelope (chord vs single-note)
  // Longer attack (12ms chord / 6ms single) reduces the onset transient through
  // the aa50 nonlinear waveshaper — a 4ms ramp into ×8 gain caused a brief click-thud.
  const attack  = isChord ? 0.012 : 0.006;
  const decay   = isChord ? 0.200 : 0.130;
  const release = isChord ? 3.0   : 1.8;

  const gainTrim   = isChord ? Math.pow(10, (Math.random() - 0.5) * 0.115) : 1.0;
  // Cap sampleGain at 1.0 — the distortion chain amplifies aggressively; boosted samples
  // (gain: 1.5/1.6) would push the pre-waveshaper gain to ×12+, saturating too hard.
  const sampleGain = Math.min(sample.gain ?? 1, 1.0);
  const peak    = (isChord ? 0.78 : 0.80) * gainTrim * sampleGain;
  const sustain = (isChord ? 0.68 : 0.55) * gainTrim * sampleGain;

  const jitter = isChord ? Math.random() * 0.003 : 0;
  const stopAt = startTime + jitter + attack + decay + release + 0.4;

  // ── Source + envelope ──────────────────────────────────────────────────────
  const src = ctx.createBufferSource();
  src.buffer = sample.buf;
  src.playbackRate.value = rate;

  const envGain = ctx.createGain();
  envGain.gain.setValueAtTime(0.0001, startTime);
  envGain.gain.exponentialRampToValueAtTime(peak,    startTime + attack);
  envGain.gain.exponentialRampToValueAtTime(sustain, startTime + attack + decay);
  envGain.gain.exponentialRampToValueAtTime(0.0001,  startTime + attack + decay + release);
  src.connect(envGain);

  // ── Stage 1: aa50 amp sim ─────────────────────────────────────────────────
  // Ported from joeloftusdev/aa50-amp-sim. Parameter values mapped to Vermilion screenshot.
  // All nodes are per-note and short-lived — no shared persistent state that could glitch.
  //
  // Gain staging (total ×6 before waveshaper):
  //   sampleGain capped at 1.0 → peak ≈ 0.78 → ×1.5 → ×4.0 → 4.68 into WaveShaper
  //   Internal ×0.25 scale → x ≈ 1.17 → rational saturation y ≈ 0.76 (musical saturation)

  // Input gain: +3.5 dB (Vermilion Gain stage)
  const inputGain = ctx.createGain();
  inputGain.gain.value = 1.5;
  envGain.connect(inputGain);

  // Resonance: 12 dB/octave lowpass at 5000 Hz, Q=0.2 (Resonance param=5 → 5 kHz)
  const resonanceLP = ctx.createBiquadFilter();
  resonanceLP.type = 'lowpass'; resonanceLP.frequency.value = 5000; resonanceLP.Q.value = 0.2;
  inputGain.connect(resonanceLP);

  // Bottom end: low shelf +3 dB @ 400 Hz (aa50 fixed bottom-end stage)
  const bottomShelf = ctx.createBiquadFilter();
  bottomShelf.type = 'lowshelf'; bottomShelf.frequency.value = 400; bottomShelf.gain.value = 3.0;
  resonanceLP.connect(bottomShelf);

  // Pre-gain: +12 dB — drives the waveshaper into saturation
  const preGain = ctx.createGain();
  preGain.gain.value = 4.0;  // 10^(12/20)
  bottomShelf.connect(preGain);

  // aa50 waveshaper — custom rational soft-clip. oversample:'none' so the node has
  // no browser-internal IIR anti-alias filter state that stays alive after src.stop()
  // until GC — '2x'/'4x' both leave that state, producing a tail that gets amplified
  // through preGain×4 and causes pops in the shared _elecComp/_masterComp nodes.
  const aa50ws = ctx.createWaveShaper();
  aa50ws.curve = _makeAa50WaveshapeCurve();
  aa50ws.oversample = 'none';
  preGain.connect(aa50ws);

  // Presence: peaking +3 dB @ 3500 Hz, Q=0.65 (Presence ~5/10 → mid-range of 3–4.5 kHz)
  const presencePeak = ctx.createBiquadFilter();
  presencePeak.type = 'peaking'; presencePeak.frequency.value = 3500;
  presencePeak.gain.value = 3.0; presencePeak.Q.value = 0.65;
  aa50ws.connect(presencePeak);

  // Bass EQ: peaking +2 dB @ 100 Hz, Q=0.6 (Bass ~6/10)
  const bassEQ = ctx.createBiquadFilter();
  bassEQ.type = 'peaking'; bassEQ.frequency.value = 100;
  bassEQ.gain.value = 2.0; bassEQ.Q.value = 0.6;
  presencePeak.connect(bassEQ);

  // Mid EQ: peaking −2 dB @ 500 Hz, Q=0.9 (Mid ~4/10 — slight scoop)
  const midEQ = ctx.createBiquadFilter();
  midEQ.type = 'peaking'; midEQ.frequency.value = 500;
  midEQ.gain.value = -2.0; midEQ.Q.value = 0.9;
  bassEQ.connect(midEQ);

  // Treble EQ: peaking +2 dB @ 5000 Hz, Q=0.6 (Treble ~6/10)
  const trebleEQ = ctx.createBiquadFilter();
  trebleEQ.type = 'peaking'; trebleEQ.frequency.value = 5000;
  trebleEQ.gain.value = 2.0; trebleEQ.Q.value = 0.6;
  midEQ.connect(trebleEQ);

  // Output gain: −6 dB — compensates for gain staging
  const outputGain = ctx.createGain();
  outputGain.gain.value = 0.5;  // 10^(−6/20)
  trebleEQ.connect(outputGain);

  // ── Reverb send — taps before cab sim (brighter wet signal) ──────────────
  // Track rv so onended can disconnect it — otherwise the outputGain→rv→_reverbSendElec
  // path keeps the entire node chain alive (preventing GC) after the note ends.
  let _rv = null;
  if (_reverbSendElec) {
    _rv = ctx.createGain(); _rv.gain.value = 0.12;
    outputGain.connect(_rv); _rv.connect(_reverbSendElec);
  }

  // ── Stage 3: Cabinet sim — Black Tolex 2×12 + Dynamic 57 ─────────────────
  // Approximates speaker/mic response without an IR file.

  // Speaker rolloff: lowpass 5800 Hz (cab + mic combined HF rolloff)
  const cabLP = ctx.createBiquadFilter();
  cabLP.type = 'lowpass'; cabLP.frequency.value = 5800; cabLP.Q.value = 0.8;
  outputGain.connect(cabLP);

  // Cabinet resonance dip: notch −4 dB @ 2200 Hz (2×12 box resonance)
  const cabNotch = ctx.createBiquadFilter();
  cabNotch.type = 'peaking'; cabNotch.frequency.value = 2200;
  cabNotch.gain.value = -4.0; cabNotch.Q.value = 3.0;
  cabLP.connect(cabNotch);

  // SM57 air rolloff: high shelf −2 dB above 7000 Hz
  const sm57Air = ctx.createBiquadFilter();
  sm57Air.type = 'highshelf'; sm57Air.frequency.value = 7000; sm57Air.gain.value = -2.0;
  cabNotch.connect(sm57Air);

  // ── Safety limiter → per-string pan → output ─────────────────────────────
  // Hard-clips any residual extreme value (e.g. from peaking EQ resonance) before it
  // reaches the long-lived _elecComp/_masterComp nodes — NaN in their IIR state would
  // permanently silence all audio until the AudioContext is recreated.
  //
  // MUST be a unity-gain identity clipper — NOT _makeDistortionNode(ctx, 10).
  // _makeDistortionNode normalises by tanh(amount), giving small-signal gain ≈ amount.
  // At amount=10 that's a ×10 amplifier for quiet signals, which turns a softly decaying
  // tail into persistent audible static. The identity WaveShaper maps x→x for |x|≤1 and
  // clamps |x|>1 to ±1 (the Web Audio spec guarantees out-of-range inputs use the curve
  // endpoints), so it is truly transparent at all normal signal levels.
  const _safetyCurve = new Float32Array(256);
  for (let i = 0; i < 256; i++) _safetyCurve[i] = (i * 2) / 255 - 1;
  const safetyClip = ctx.createWaveShaper();
  safetyClip.curve = _safetyCurve;
  safetyClip.oversample = 'none';
  sm57Air.connect(safetyClip);

  const STRING_PAN = [-0.12, -0.08, -0.03, +0.03, +0.08, +0.12];
  const panNode = ctx.createStereoPanner();
  panNode.pan.value = STRING_PAN[stringIdx] ?? 0;
  safetyClip.connect(panNode);
  panNode.connect(_elecComp ?? _masterComp);

  // Track envGain for soft-stop (fade out on new chord) and disconnect on end.
  // Also disconnect panNode and _rv to sever the entire per-note chain from the shared
  // _elecComp/_masterComp/_reverbSendElec nodes — prevents orphaned chains from
  // accumulating with decaying IIR state that pumps the shared compressors and causes pops.
  _activeDistEnvGains.push(envGain);
  src.onended = () => {
    envGain.disconnect();
    panNode.disconnect();
    if (_rv) _rv.disconnect();
    const idx = _activeDistEnvGains.indexOf(envGain);
    if (idx !== -1) _activeDistEnvGains.splice(idx, 1);
  };

  src.start(startTime + jitter);
  src.stop(stopAt);
  _scheduledNodes.push(src);
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function playChord(selectedFrets, tuning) {
  const ctx        = _getCtx();
  const presetKey  = getTonePresetName();
  const isAcoustic   = presetKey === 'acoustic';
  const isCleanElec  = presetKey === 'clean_electric';
  const isDistortion = presetKey === 'distortion';

  // Defer if the required sample bank isn't loaded yet
  if (isAcoustic && !_sampleBuffers && _samplesPromise) {
    _samplesPromise.then(() => playChord(selectedFrets, tuning));
    return;
  }
  if (isCleanElec && !_electricBuffers && _electricPromise) {
    _electricPromise.then(() => playChord(selectedFrets, tuning));
    return;
  }
  if (isDistortion && !_electricBuffers && _electricPromise) {
    _electricPromise.then(() => playChord(selectedFrets, tuning));
    return;
  }

  // Fade out any still-playing distortion notes before new ones start.
  // Prevents many simultaneous chains from stressing _elecComp and causing pops.
  if (isDistortion) _softStopDistortion();

  const now = ctx.currentTime + 0.02;   // 20ms lookahead — avoids pipeline-not-ready click

  // Chord mode: ≥2 strings played triggers the expansive chord envelope
  const playedCount = selectedFrets.filter(f => f >= 0).length;
  const isChord     = (isCleanElec || isDistortion) && playedCount >= 2;

  let delay = 0;
  for (let s = 0; s <= 5; s++) {        // low E → high e (downstrum)
    if (selectedFrets[s] < 0) continue;
    const midi = _midiForString(s, selectedFrets[s], tuning);
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    if (isAcoustic) {
      _playNoteSampled(ctx, midi, freq, now + delay);
    } else if (isCleanElec) {
      _playNoteElectricSampled(ctx, midi, now + delay, s, isChord);
    } else if (isDistortion) {
      _playNoteDistortionSampled(ctx, midi, now + delay, s, isChord);
    } else {
      _playNote(ctx, freq, now + delay, _activePreset.duration);
    }
    // Electric (clean or distortion): tighter strum (24ms ± 5ms); others: 28ms ± 6ms
    delay += (isCleanElec || isDistortion)
      ? 0.024 + (Math.random() * 0.010 - 0.005)
      : 0.028 + (Math.random() * 0.014 - 0.006);
  }
}

export function playPitches(pitchSet, bassPitch = null) {
  if (!pitchSet || pitchSet.length === 0) return;
  const ctx = _getCtx();
  const now = ctx.currentTime;
  for (const pitch of pitchSet) {
    const isBass   = pitch === bassPitch;
    const baseMidi = isBass ? 40 : 52;
    let midi = baseMidi + ((pitch - (baseMidi % 12) + 12) % 12);
    if (midi > baseMidi + 11) midi -= 12;
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    _playNote(ctx, freq, now, _activePreset.duration);
  }
}

/**
 * Fade out all currently playing distortion notes over 30ms then disconnect them.
 * Called before a new chord plays to prevent old-note overlap from loading _elecComp
 * with too many simultaneous chains, which causes DynamicsCompressor gain-change pops.
 */
function _softStopDistortion() {
  if (!_ctx || _activeDistEnvGains.length === 0) return;
  const now = _ctx.currentTime;
  for (const g of _activeDistEnvGains) {
    try {
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.linearRampToValueAtTime(0, now + 0.030);
    } catch (_) {}
  }
  _activeDistEnvGains = [];
}

export function stopPlayback() {
  for (const osc of _scheduledNodes) {
    try { osc.stop(0); } catch (_) {}
  }
  _scheduledNodes = [];
  _activeDistEnvGains = [];
  if (_completionTimer !== null) {
    clearTimeout(_completionTimer);
    _completionTimer = null;
  }
  for (const t of _chordTimers) clearTimeout(t);
  _chordTimers = [];
}

export function playProgression(chords, tuning, secondsPerChord = 1, onComplete = null, onChordPlay = null) {
  stopPlayback();
  if (!chords || chords.length === 0) return;

  const ctx          = _getCtx();
  const presetKey    = getTonePresetName();
  const isAcoustic   = presetKey === 'acoustic';
  const isCleanElec  = presetKey === 'clean_electric';
  const isDistortion = presetKey === 'distortion';

  // Defer if the required sample bank isn't loaded yet
  if (isAcoustic && !_sampleBuffers && _samplesPromise) {
    _samplesPromise.then(() => playProgression(chords, tuning, secondsPerChord, onComplete, onChordPlay));
    return;
  }
  if (isCleanElec && !_electricBuffers && _electricPromise) {
    _electricPromise.then(() => playProgression(chords, tuning, secondsPerChord, onComplete, onChordPlay));
    return;
  }
  if (isDistortion && !_electricBuffers && _electricPromise) {
    _electricPromise.then(() => playProgression(chords, tuning, secondsPerChord, onComplete, onChordPlay));
    return;
  }

  const now          = ctx.currentTime;
  const noteDuration = Math.min(secondsPerChord + 0.3, 2.0);

  for (let c = 0; c < chords.length; c++) {
    const chord = chords[c];
    if (!chord.frets) continue;
    const startTime = now + c * secondsPerChord;
    // Chord mode: ≥2 strings played triggers expansive chord envelope
    const chordPlayedCount = chord.frets.filter(f => f >= 0).length;
    const chordIsChord     = (isCleanElec || isDistortion) && chordPlayedCount >= 2;

    let strumDelay = 0;
    for (let s = 0; s <= 5; s++) {         // low E → high e (downstrum)
      if (chord.frets[s] < 0) continue;
      const midi = _midiForString(s, chord.frets[s], tuning);
      const freq = 440 * Math.pow(2, (midi - 69) / 12);
      if (isAcoustic) {
        _playNoteSampled(ctx, midi, freq, startTime + strumDelay);
      } else if (isCleanElec) {
        _playNoteElectricSampled(ctx, midi, startTime + strumDelay, s, chordIsChord);
      } else if (isDistortion) {
        _playNoteDistortionSampled(ctx, midi, startTime + strumDelay, s, chordIsChord);
      } else {
        _playNote(ctx, freq, startTime + strumDelay, noteDuration);
      }
      strumDelay += (isCleanElec || isDistortion)
        ? 0.024 + (Math.random() * 0.010 - 0.005)
        : 0.028 + (Math.random() * 0.014 - 0.006);
    }
    if (onChordPlay) {
      const delayMs = c * secondsPerChord * 1000;
      const t = setTimeout(() => onChordPlay(chord, c), delayMs);
      _chordTimers.push(t);
    }
  }

  const totalMs = chords.length * secondsPerChord * 1000 + 400;
  _completionTimer = setTimeout(() => {
    _scheduledNodes  = [];
    _completionTimer = null;
    onComplete?.();
  }, totalMs);
}
