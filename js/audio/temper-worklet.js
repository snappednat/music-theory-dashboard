/**
 * Temper Nonlinear State Variable Filter — AudioWorklet Processor
 *
 * Ported from the open-source Temper plugin algorithm by cpl0.
 * A State Variable Filter (SVF) with saturation applied in the feedback path,
 * producing a resonant, nonlinearly coloured filter character.
 *
 * Signal flow (per sample, per channel):
 *   1. Drive stage  — soft-clip input via tanh
 *   2. Saturate bandpass state (curve + saturation shape the nonlinearity)
 *   3. SVF update   — new_bp = bp + g * (v0 - r*sat_bp - lp + feedback*bp)
 *                     new_lp = lp + g * new_bp
 *   4. Output LOWPASS × outputGain — passes the full guitar signal below cutoff.
 *      (Bandpass output would strip the fundamental and alias badly at 15 kHz;
 *       lowpass at 15.1 kHz is essentially a wire for guitar, adding only the
 *       saturation character from the nonlinear feedback path.)
 *
 * Parameters (all a-rate AudioParams):
 *   cutoff     — filter cutoff Hz     (default 15100 Hz  ← screenshot: 15.1 kHz)
 *   resonance  — Q-like resonance     (default 5.0       ← screenshot: 5.0)
 *   curve      — waveshaper exponent  (default 2.0       ← screenshot: 2.0)
 *   drive      — input drive linear   (default 0.944     ← −0.5 dB)
 *   saturation — feedback saturation  (default 0.5       ← screenshot: 0.5)
 *   feedback   — SVF feedback amount  (default 0.003     ← −50.2 dB)
 *   outputGain — post-filter gain     (default 0.955     ← −0.9 dB)
 */
class TemperProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'cutoff',     defaultValue: 15100, minValue: 20,   maxValue: 20000, automationRate: 'a-rate' },
      { name: 'resonance',  defaultValue: 5.0,   minValue: 0.1,  maxValue: 30,    automationRate: 'a-rate' },
      { name: 'curve',      defaultValue: 2.0,   minValue: 0.1,  maxValue: 10,    automationRate: 'a-rate' },
      { name: 'drive',      defaultValue: 0.944, minValue: 0.1,  maxValue: 10,    automationRate: 'a-rate' },
      { name: 'saturation', defaultValue: 0.5,   minValue: 0.01, maxValue: 5,     automationRate: 'a-rate' },
      { name: 'feedback',   defaultValue: 0.003, minValue: 0,    maxValue: 0.99,  automationRate: 'a-rate' },
      { name: 'outputGain', defaultValue: 0.955, minValue: 0,    maxValue: 2,     automationRate: 'a-rate' },
    ];
  }

  constructor() {
    super();
    // Per-channel SVF state (stereo)
    this._lp = [0, 0];
    this._bp = [0, 0];
  }

  process(inputs, outputs, parameters) {
    const input  = inputs[0];
    const output = outputs[0];

    // If no input connected, pass silence and keep alive
    if (!input || input.length === 0) return true;

    const numChannels = Math.min(input.length, output.length);

    // Param arrays (a-rate = one value per sample; k-rate = length 1)
    const cutoffArr     = parameters.cutoff;
    const resonanceArr  = parameters.resonance;
    const curveArr      = parameters.curve;
    const driveArr      = parameters.drive;
    const satArr        = parameters.saturation;
    const fbArr         = parameters.feedback;
    const outGainArr    = parameters.outputGain;

    const blockSize = input[0].length;

    for (let ch = 0; ch < numChannels; ch++) {
      const inBuf  = input[ch];
      const outBuf = output[ch];
      let lp = this._lp[ch];
      let bp = this._bp[ch];

      for (let i = 0; i < blockSize; i++) {
        // Param values (handle both a-rate and k-rate gracefully)
        const cutoff     = cutoffArr.length > 1     ? cutoffArr[i]    : cutoffArr[0];
        const resonance  = resonanceArr.length > 1  ? resonanceArr[i] : resonanceArr[0];
        const curve      = curveArr.length > 1      ? curveArr[i]     : curveArr[0];
        const drive      = driveArr.length > 1      ? driveArr[i]     : driveArr[0];
        const saturation = satArr.length > 1        ? satArr[i]       : satArr[0];
        const feedback   = fbArr.length > 1         ? fbArr[i]        : fbArr[0];
        const outputGain = outGainArr.length > 1    ? outGainArr[i]   : outGainArr[0];

        // SVF coefficient from cutoff frequency.
        // g must stay < 1 for a stable bilinear SVF — g ≥ 1 causes self-oscillation.
        // tan(π × fc / fs) < 1 requires fc < fs/4 (quarter sample rate).
        // The screenshot cutoff of 15.1 kHz exceeds fs/4 at typical rates (44.1/48 kHz),
        // so we hard-clamp g to 0.95 — equivalent to ~13.7 kHz at 44100 Hz / ~14.9 kHz
        // at 48000 Hz. Aurally transparent; prevents the runaway that causes buzzing.
        const g = Math.min(Math.tan(Math.PI * Math.min(cutoff, sampleRate * 0.5 - 1) / sampleRate), 0.95);
        const r = 1.0 / Math.max(resonance, 0.01);  // damping

        // 1. Drive stage — soft clip input
        const v0 = Math.tanh(inBuf[i] * drive);

        // 2. Saturate bandpass state (nonlinearity in feedback path)
        //    sat_bp = tanh(bp * sat * curve) / tanh(sat * curve + ε)
        const satCurve = saturation * curve;
        const denom    = Math.tanh(satCurve) + 1e-8;
        const sat_bp   = Math.tanh(bp * satCurve) / denom;

        // 3. SVF update
        const new_bp = bp + g * (v0 - r * sat_bp - lp + feedback * bp);
        const new_lp = lp + g * new_bp;

        // Guard: reset state on NaN/Inf OR if the state grows very large.
        // Large-but-finite values escape the NaN check, then get amplified ×251
        // by the downstream aa50 gain chain, overflowing IIR filter state → NaN
        // in the shared _elecComp/_masterComp nodes (permanent silence).
        if (!isFinite(new_bp) || !isFinite(new_lp) ||
            Math.abs(new_bp) > 10 || Math.abs(new_lp) > 10) {
          bp = 0; lp = 0;
          outBuf[i] = 0;
          continue;
        }
        bp = new_bp;
        lp = new_lp;

        // 4. LOWPASS output scaled by outputGain, hard-clamped to [-1, 1].
        // LP passes the full guitar signal (below 15.1 kHz ≈ full audible range)
        // with the nonlinear saturation character from the feedback path.
        const raw = new_lp * outputGain;
        outBuf[i] = raw > 1 ? 1 : raw < -1 ? -1 : raw;
      }

      this._lp[ch] = lp;
      this._bp[ch] = bp;
    }

    return true;
  }
}

registerProcessor('temper-processor', TemperProcessor);
