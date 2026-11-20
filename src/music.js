// ============================================================
//  GLASBA – vesela melodija v slogu starih igric, narejena s kodo.
//  Note so zapisane v tabelah spodaj – kar spreminjaj in poslušaj!
// ============================================================

const BPM = 132
const STEP = 60 / BPM / 2 // osminka

// Številke so poltoni od A4 (0 = A, 3 = C, 7 = E, 10 = G); null = tišina
// Akordi: C – A mol – F – G (vsak 8 osmink)
const CHORDS = [[3, 7, 10], [0, 3, 7], [-4, 0, 3], [-2, 2, 5]]
const BASS = [3, 3, 15, 3, 0, 0, 12, 0, -4, -4, 8, -4, -2, -2, 10, 2]
const MELODY = [
  15, null, 19, 22, 19, null, 15, 17, 19, null, 15, 12, 15, null, null, null,
  12, null, 15, 19, 17, null, 15, 12, 14, null, 17, 19, 22, null, null, null,
  27, null, 22, 19, 22, null, 19, 15, 17, null, 19, 17, 15, null, 12, null,
  15, 17, 19, null, 17, 15, 12, null, 14, null, 10, null, 15, null, null, null,
]

let ctx = null
let master = null
let timer = null
let step = 0
let nextTime = 0
export let musicOn = true

const freq = (semi) => 440 * Math.pow(2, semi / 12)

function note(semi, time, dur, type, vol) {
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq(semi)
  g.gain.setValueAtTime(vol, time)
  g.gain.exponentialRampToValueAtTime(0.0001, time + dur)
  osc.connect(g).connect(master)
  osc.start(time)
  osc.stop(time + dur + 0.02)
}

// Načrtujemo note malo vnaprej, da glasba ne zatika
function schedule() {
  while (nextTime < ctx.currentTime + 0.2) {
    const bar = Math.floor(step / 8) % 4
    // bas: vsako drugo osminko
    if (step % 2 === 0) note(BASS[(step / 2) % 16] - 24, nextTime, STEP * 1.8, 'triangle', 0.22)
    const arp = CHORDS[bar][step % 3]
    note(arp + 12, nextTime, STEP * 0.6, 'square', 0.025)
    const m = MELODY[step % MELODY.length]
    if (m !== null) note(m, nextTime, STEP * 1.6, 'square', 0.05)
    if (step % 4 === 2) noise(nextTime) // "činela"
    nextTime += STEP
    step++
  }
}

function noise(time) {
  const len = 0.05
  const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length)
  const src = ctx.createBufferSource()
  const g = ctx.createGain()
  const f = ctx.createBiquadFilter()
  f.type = 'highpass'
  f.frequency.value = 6000
  g.gain.value = 0.06
  src.buffer = buf
  src.connect(f).connect(g).connect(master)
  src.start(time)
}

export function startMusic() {
  if (!musicOn || timer) return
  try {
    ctx ||= new AudioContext()
    if (ctx.state === 'suspended') ctx.resume()
    if (!master) {
      master = ctx.createGain()
      master.gain.value = 0.5
      master.connect(ctx.destination)
    }
    nextTime = ctx.currentTime + 0.05
    timer = setInterval(schedule, 50)
  } catch {}
}

export function stopMusic() {
  clearInterval(timer)
  timer = null
}

export function setMusic(on) {
  musicOn = on
  if (on) startMusic()
  else stopMusic()
}
