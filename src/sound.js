// ============================================================
//  ZVOKI – narejeni kar s kodo (brez zvočnih datotek)
// ============================================================
let ctx = null

// Vsak zvok je seznam not: [frekvenca (Hz), trajanje (s), oblika vala]
const SOUNDS = {
  tick: [[440, 0.12, 'square']],
  go: [[880, 0.3, 'square']],
  bounce: [[300, 0.06, 'sine'], [600, 0.12, 'sine']],
  boost: [[500, 0.05, 'sawtooth'], [800, 0.05, 'sawtooth'], [1100, 0.1, 'sawtooth']],
  checkpoint: [[660, 0.08, 'triangle'], [880, 0.15, 'triangle']],
  death: [[300, 0.08, 'sawtooth'], [180, 0.2, 'sawtooth']],
  finish: [[523, 0.1, 'triangle'], [659, 0.1, 'triangle'], [784, 0.1, 'triangle'], [1047, 0.35, 'triangle']],
}

export function sfx(name) {
  try {
    ctx ||= new AudioContext()
    let t = ctx.currentTime
    for (const [freq, dur, type] of SOUNDS[name] || []) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.12, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + dur)
      t += dur * 0.8
    }
  } catch {}
}
