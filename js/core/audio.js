/**
 * Chord audio synthesis using the Web Audio API.
 * Produces a guitar-like sound via triangle oscillator → lowpass filter → ADSR gain.
 * Strums strings low→high with a 30ms delay per string.
 */

// Standard open-string MIDI notes: E2=40, A2=45, D3=50, G3=55, B3=59, E4=64
const STD_OPEN_MIDI = [40, 45, 50, 55, 59, 64];
const STD_TUNING    = [4, 9, 2, 7, 11, 4];  // standard pitch classes (EADGBE)

let _ctx        = null;
let _masterComp = null;   // shared compressor/limiter — prevents clipping when 6 notes sum

// Track oscillators scheduled for current progression playback
let _scheduledNodes  = [];
let _completionTimer = null;
let _chordTimers     = [];  // per-chord setTimeout handles (cleared on stopPlayback)

function _getCtx() {
  if (!_ctx || _ctx.state === 'closed') {
    _ctx = new AudioContext();

    // Hard limiter: high ratio + fast attack catches transient peaks from chord strums
    _masterComp = _ctx.createDynamicsCompressor();
    _masterComp.threshold.value = -6;    // dB — start compressing 6 dB below full scale
    _masterComp.knee.value      = 3;     // dB — tight knee for limiter-like behaviour
    _masterComp.ratio.value     = 20;    // 20:1 ≈ hard limiter
    _masterComp.attack.value    = 0.002; // 2 ms — catches strum transients quickly
    _masterComp.release.value   = 0.1;   // 100 ms — recover fast between strum notes
    _masterComp.connect(_ctx.destination);
  }
  if (_ctx.state === 'suspended') {
    _ctx.resume();
  }
  return _ctx;
}

/**
 * Compute the MIDI note number for a given string + fret in an arbitrary tuning.
 * Shifts the standard open-string MIDI by the pitch class difference, then adds fret offset.
 */
function _midiForString(stringIdx, fret, tuning) {
  const pcDiff = ((tuning[stringIdx] - STD_TUNING[stringIdx]) % 12 + 12) % 12;
  return STD_OPEN_MIDI[stringIdx] + pcDiff + fret;
}

/**
 * Play a single note with a guitar-like ADSR envelope.
 * @param {AudioContext} ctx
 * @param {number} freq       - frequency in Hz
 * @param {number} startTime  - AudioContext time to start
 * @param {number} duration   - total note duration in seconds
 */
function _playNote(ctx, freq, startTime, duration = 1.5) {
  const osc    = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain   = ctx.createGain();

  // Triangle wave — warmer than sawtooth, more guitar-like than sine
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, startTime);

  // Lowpass filter — cuts harshness, gives a mellow guitar tone
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2000, startTime);
  filter.Q.setValueAtTime(1, startTime);

  // ADSR envelope
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(0.5, startTime + 0.005);   // attack
  gain.gain.linearRampToValueAtTime(0.15, startTime + 0.1);    // decay → sustain
  gain.gain.setValueAtTime(0.15, startTime + duration - 0.3);  // hold sustain
  gain.gain.linearRampToValueAtTime(0, startTime + duration);  // release

  // Chain: oscillator → filter → gain → master compressor → output
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(_masterComp);

  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
  return osc;
}

/**
 * Play a chord from fret positions (the exact voicing on the fretboard).
 * Strums strings low→high with 30ms delay between each string.
 * @param {number[]} selectedFrets  [-1=muted, 0=open, 1+=fret]
 * @param {number[]} tuning         pitch class per string; index 0 = low E
 */
export function playChord(selectedFrets, tuning) {
  const ctx = _getCtx();
  const now = ctx.currentTime;
  let delay = 0;
  for (let s = 0; s < 6; s++) {
    if (selectedFrets[s] < 0) continue;
    const midi = _midiForString(s, selectedFrets[s], tuning);
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    _playNote(ctx, freq, now + delay);
    delay += 0.03;
  }
}

/**
 * Play from pitch classes when no specific voicing is known.
 * Maps each pitch class to guitar range and plays all notes simultaneously.
 * @param {number[]} pitchSet   pitch classes 0–11
 * @param {number|null} bassPitch  bass pitch class (played in lower octave)
 */
export function playPitches(pitchSet, bassPitch = null) {
  if (!pitchSet || pitchSet.length === 0) return;
  const ctx = _getCtx();
  const now = ctx.currentTime;

  for (const pitch of pitchSet) {
    const isBass = pitch === bassPitch;
    // Map to guitar range: bass pitch goes to lower octave (MIDI ~40–52), others to mid range (~52–72)
    const baseMidi = isBass ? 40 : 52;
    // Find the MIDI note in range closest to baseMidi
    let midi = baseMidi + ((pitch - (baseMidi % 12) + 12) % 12);
    if (midi > baseMidi + 11) midi -= 12;

    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    _playNote(ctx, freq, now, 1.5);
  }
}

/**
 * Stop any in-progress progression playback immediately.
 */
export function stopPlayback() {
  for (const osc of _scheduledNodes) {
    try { osc.stop(0); } catch (_) {}
  }
  _scheduledNodes = [];
  if (_completionTimer !== null) {
    clearTimeout(_completionTimer);
    _completionTimer = null;
  }
  for (const t of _chordTimers) clearTimeout(t);
  _chordTimers = [];
}

/**
 * Play an array of chords one after another using AudioContext scheduling.
 * Each chord is strummed (30 ms per string) then held for secondsPerChord.
 * @param {object[]} chords           - chord objects with .frets array
 * @param {number[]} tuning           - pitch class per string
 * @param {number}   secondsPerChord  - duration between chord starts (default 1)
 * @param {function} [onComplete]     - called when sequence finishes naturally
 * @param {function} [onChordPlay]    - called with (chord, index) as each chord starts
 */
export function playProgression(chords, tuning, secondsPerChord = 1, onComplete = null, onChordPlay = null) {
  stopPlayback(); // cancel any previous playback
  if (!chords || chords.length === 0) return;

  const ctx  = _getCtx();
  const now  = ctx.currentTime;
  const noteDuration = Math.min(secondsPerChord + 0.3, 2.0); // sustain slightly into next chord

  for (let c = 0; c < chords.length; c++) {
    const chord = chords[c];
    if (!chord.frets) continue;
    const startTime = now + c * secondsPerChord;
    let strumDelay = 0;
    for (let s = 0; s < 6; s++) {
      if (chord.frets[s] < 0) continue;
      const midi = _midiForString(s, chord.frets[s], tuning);
      const freq = 440 * Math.pow(2, (midi - 69) / 12);
      const osc = _playNote(ctx, freq, startTime + strumDelay, noteDuration);
      _scheduledNodes.push(osc);
      strumDelay += 0.03;
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
