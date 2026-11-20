// ============================================================
//  GLAVNI PROGRAM: poveže vse skupaj – meni, igro, urejevalnik in sobe.
// ============================================================
import * as THREE from 'three'
import { Level, BLOCKS, HOTBAR, sampleLevel } from './level.js'
import { createScene, LevelView, Avatar, SKINS, HATS } from './world.js'
import { Player } from './player.js'
import { Input } from './input.js'
import { Editor } from './editor.js'
import { Net, newRoomCode } from './net.js'
import { sfx } from './sound.js'
import { setupTouch } from './touch.js'

const $ = (id) => document.getElementById(id)
const EMOTES = ['👋 Živjo!', '😂 Haha', '🏆 GG!', '⏳ Počakaj!']

// ---------- shranjevanje v brskalnik ----------
const store = {
  get(k, def) {
    try { return JSON.parse(localStorage.getItem('obby.' + k)) ?? def } catch { return def }
  },
  set(k, v) {
    try { localStorage.setItem('obby.' + k, JSON.stringify(v)) } catch {}
  },
}

// ---------- stanje igre ----------
const canvas = $('game')
const { renderer, scene, camera, followSun } = createScene(canvas)
const input = new Input(canvas)
const levelView = new LevelView(scene)
const editor = new Editor(scene, camera, input, levelView)

let level = sampleLevel()
let mode = 'menu' // 'menu' | 'play' | 'edit' | 'race'
let lastMode = null // kam se vrnemo z "Nadaljuj"
const player = new Player(level)
let me = null // moj avatar
let profile = store.get('profile', { name: '', color: SKINS[Math.floor(Math.random() * SKINS.length)], hat: 'brez' })

const cam = { yaw: Math.PI, pitch: -0.35, dist: 7 }
let runTime = 0
let running = false // ali teče štoparica
let finished = false
let countdown = 0

// soba
let net = null
const remotes = new Map() // userId -> { avatar, profile, target, yaw, speed, ground, seen }
let race = { round: 0, name: '' }
const results = new Map() // userId -> { name, time }

// ============================================================
//  PROGA
// ============================================================
function setLevel(l) {
  level = l
  player.level = l
  levelView.rebuild(l)
  $('levelNameInput').value = l.name
  saveCurrentSoon()
}

let saveTimer = 0
function saveCurrentSoon() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => store.set('current', await level.toCode()), 500)
}

editor.onChange = saveCurrentSoon

// ============================================================
//  NAČINI: igra, urejevalnik, dirka
// ============================================================
function ensureMe() {
  if (me) me.dispose()
  me = new Avatar(scene, { name: profile.name || 'Jaz', color: profile.color, hat: profile.hat })
}

function startPlay(raceMode = false) {
  if (!level.find(9)) return toast('Proga nima starta 🟦\nPostavi ga v urejevalniku.')
  if (!level.find(11)) return toast('Proga nima cilja 🏁\nPostavi ga v urejevalniku.')
  editor.stop()
  mode = raceMode ? 'race' : 'play'
  ensureMe()
  player.reset()
  cam.yaw = Math.PI
  runTime = 0
  finished = false
  running = !raceMode
  countdown = raceMode ? 3 : 0
  if (raceMode) results.clear()
  renderResults()
  enterGame()
}

function startEdit() {
  if (mode === 'race') return toast('Med dirko ne moreš urejati 😉')
  if (input.touch) return toast('Urejevalnik zaenkrat deluje samo na računalniku 💻')
  mode = 'edit'
  if (me) me.setVisible(false)
  // kamero postavimo za igralca/start
  const s = level.find(9) || [0, 0, 0]
  if (lastMode !== 'edit') editor.pos.set(s[0], s[1] + 4, s[2] - 8)
  editor.start(level)
  enterGame()
}

function enterGame() {
  lastMode = mode
  $('menu').hidden = true
  $('hud').hidden = false
  $('hud').classList.toggle('edit', mode === 'edit')
  $('hotbar').hidden = mode !== 'edit'
  $('timer').hidden = mode === 'edit'
  $('help').textContent = input.touch ? '' : mode === 'edit'
    ? 'Desni klik: postavi · Levi klik: pobriši · E: preizkusi · Esc: meni'
    : 'Space: skok · R: znova · 1–4: emoti' + (mode === 'play' ? ' · E: urejevalnik' : '') + ' · Esc: meni'
  $('levelName').textContent = level.name
  input.lock()
  // Če miške ni bilo mogoče ujeti (npr. dirko je začel prijatelj), prosimo za klik
  setTimeout(() => !input.locked && $('menu').hidden && toast('🖱 Klikni na zaslon!', 3000), 400)
}

function showMenu() {
  $('menu').hidden = false
  $('resumeBtn').hidden = !lastMode
  input.unlock()
}

// Ko miška ni več "ujeta" (npr. pritisnemo Esc), pokažemo meni
document.addEventListener('pointerlockchange', () => {
  if (!input.locked) showMenu()
})
// Klik na igro (če je meni skrit) spet ujame miško
canvas.addEventListener('click', () => {
  if ($('menu').hidden && !input.locked) input.lock()
})

input.onKey((e) => {
  if (!input.locked) return
  if (mode === 'play' || mode === 'race') {
    if (e.code === 'Space') player.pressJump()
    if (e.code === 'KeyR') restart()
    const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code)
    if (n >= 0) emote(n)
  }
  if (e.code === 'KeyE') {
    if (mode === 'play') startEdit()
    else if (mode === 'edit') startPlay()
  }
})

function restart() {
  if (mode === 'play') startPlay()
  if (mode === 'race' && !finished) { player.respawn(); sfx('death') }
}

function emote(n) {
  me.say(EMOTES[n])
  net?.sendEmote(EMOTES[n])
}

// Kontrole za telefon
setupTouch(input, {
  jump: () => player.pressJump(),
  restart,
  emote,
  menu: () => showMenu(),
}, EMOTES)
document.body.classList.toggle('touch', input.touch)

// Za razhroščevanje v konzoli brskalnika (samo med razvojem): obby.player.pos
if (import.meta.env.DEV) window.obby = { player, cam, get mode() { return mode } }

// ============================================================
//  GLAVNA ZANKA – teče ~60x na sekundo
// ============================================================
let lastTime = performance.now()
let time = 0
let sendTimer = 0

function frame() {
  const now = performance.now()
  const dt = Math.min((now - lastTime) / 1000, 0.05)
  lastTime = now
  time += dt
  levelView.animate(time)

  if (mode === 'edit') {
    editor.update(dt)
    followSun(editor.pos)
  } else if (mode === 'play' || mode === 'race') {
    updatePlayer(dt)
  }
  updateRemotes(dt)
  renderer.render(scene, camera)
  requestAnimationFrame(frame)
}

function updatePlayer(dt) {
  // --- kamera z miško ---
  const [lx, ly] = input.takeLook()
  cam.yaw -= lx
  cam.pitch = Math.max(-1.2, Math.min(0.9, cam.pitch - ly))

  // --- odštevanje pred dirko ---
  if (countdown > 0) {
    const before = Math.ceil(countdown)
    countdown -= dt
    const now = Math.ceil(countdown)
    $('countdown').textContent = countdown > 0 ? now : 'GO!'
    if (now !== before) sfx(countdown > 0 ? 'tick' : 'go')
    if (countdown <= 0) {
      running = true
      setTimeout(() => ($('countdown').textContent = ''), 700)
    }
  }

  // --- igralec ---
  const frozen = countdown > 0 || !input.locked
  player.update(dt, frozen ? { forward: 0, right: 0 } : input.move, cam.yaw)
  if (frozen) player.jumpTimer = 0
  for (const ev of player.events) handleEvent(ev)
  player.events.length = 0

  if (running && !finished) runTime += dt
  $('timer').textContent = formatTime(runTime)
  me.update(dt, player.pos, player.yaw, player.horizontalSpeed, player.onGround)

  // --- kamera za igralcem (ne gre skozi kocke) ---
  const head = player.pos.clone().add(new THREE.Vector3(0, 1.6, 0))
  const back = new THREE.Vector3(
    Math.sin(cam.yaw) * Math.cos(cam.pitch),
    -Math.sin(cam.pitch),
    Math.cos(cam.yaw) * Math.cos(cam.pitch)
  )
  const hit = level.raycast(head, back, cam.dist, (t) => BLOCKS[t].glass)
  const dist = hit ? Math.max(0.6, hit.dist - 0.3) : cam.dist
  camera.position.copy(head).addScaledVector(back, dist)
  camera.lookAt(head)
  followSun(player.pos)

  // --- pošlji svoj položaj prijateljem ---
  sendTimer -= dt
  if (net && sendTimer <= 0) {
    sendTimer = 1 / 15
    const p = player.pos
    net.sendPos([+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2), +player.yaw.toFixed(2),
      +player.horizontalSpeed.toFixed(1), player.onGround ? 1 : 0])
  }
}

function handleEvent(ev) {
  if (ev === 'death') { sfx('death'); flash('#ff3b30') }
  if (ev === 'bounce') sfx('bounce')
  if (ev === 'boost') { sfx('boost'); toast('⚡ Pospešek!') }
  if (ev === 'checkpoint') { sfx('checkpoint'); toast('✅ Kontrolna točka') }
  if (ev === 'finish' && !finished && running) {
    finished = true
    sfx('finish')
    const t = runTime
    // osebni rekord za to progo
    level.toCode().then((code) => {
      const bestKey = 'best.' + hash(code)
      const best = store.get(bestKey, null)
      const record = best === null || t < best
      if (record) store.set(bestKey, t)
      toast(`🏁 CILJ! ${formatTime(t)}` + (record ? '\n⭐ Nov rekord!' : `\nRekord: ${formatTime(best)}`), 4000)
    })
    if (mode === 'race') {
      net?.sendFinish({ round: race.round, time: t })
      addResult('me', profile.name || 'Jaz', t)
    }
  }
}

// ============================================================
//  DRUGI IGRALCI
// ============================================================
function getRemote(userId) {
  let r = remotes.get(userId)
  if (!r) {
    r = { profile: { name: '...', color: '#888', hat: 'brez' }, avatar: null, target: null, yaw: 0, speed: 0, ground: true, seen: 0 }
    r.avatar = new Avatar(scene, r.profile)
    r.avatar.setVisible(false)
    remotes.set(userId, r)
  }
  return r
}

function updateRemotes(dt) {
  const now = performance.now()
  for (const r of remotes.values()) {
    const visible = !!r.target && now - r.seen < 2000
    r.avatar.setVisible(visible)
    if (!visible) continue
    const g = r.avatar.group.position
    // gladko premikanje proti zadnjemu prejetemu položaju
    if (g.distanceTo(r.target) > 4) g.copy(r.target)
    else g.lerp(r.target, Math.min(1, dt * 12))
    r.avatar.update(dt, g, r.yaw, r.speed, r.ground)
  }
}

const netEvents = {
  onProfile(userId, p) {
    const r = getRemote(userId)
    r.profile = { name: String(p.name || 'Igralec').slice(0, 16), color: String(p.color || '#888'), hat: HATS.includes(p.hat) ? p.hat : 'brez' }
    const wasVisible = r.avatar.group.visible
    const pos = r.avatar.group.position.clone()
    r.avatar.dispose()
    r.avatar = new Avatar(scene, r.profile)
    r.avatar.group.position.copy(pos)
    r.avatar.setVisible(wasVisible)
    renderPlayers()
  },
  onLeave(userId) {
    const r = remotes.get(userId)
    if (!r) return
    r.avatar.dispose()
    remotes.delete(userId)
    renderPlayers()
  },
  onPos(userId, d) {
    if (!Array.isArray(d) || d.length < 6) return
    const r = getRemote(userId)
    const [x, y, z, yaw, speed, ground] = d.map(Number)
    if (![x, y, z].every(Number.isFinite)) return
    if (!r.target) r.avatar.group.position.set(x, y, z)
    r.target = new THREE.Vector3(x, y, z)
    r.yaw = yaw
    r.speed = speed
    r.ground = !!ground
    r.seen = performance.now()
  },
  onEmote(userId, text) {
    if (EMOTES.includes(text)) getRemote(userId).avatar.say(text)
  },
  async onRace(value) {
    if (!value || value.round <= race.round) return
    race = { round: value.round, name: value.name }
    // Stare dirke (ko pridemo v sobo pozneje) ne začnemo samodejno
    if (Date.now() - value.at > 30000) return
    try {
      const l = await Level.fromCode(value.level)
      setLevel(l)
      startPlay(true)
      toast(`🏁 Dirka: ${l.name}\n(začel/a ${value.by})`, 2500)
    } catch (e) {
      toast('Proge za dirko ni bilo mogoče naložiti 😕')
    }
  },
  onFinish(userId, d) {
    if (!d || d.round !== race.round || !Number.isFinite(d.time)) return
    const r = remotes.get(userId)
    addResult(userId, r ? r.profile.name : 'Igralec', d.time)
    if (mode === 'race') toast(`🏁 ${r ? r.profile.name : 'Nekdo'} je v cilju!`, 1500)
  },
}

function addResult(id, name, time) {
  if (!results.has(id)) results.set(id, { name, time })
  renderResults()
}

function renderResults() {
  const box = $('results')
  box.hidden = mode !== 'race' || results.size === 0
  const list = [...results.values()].sort((a, b) => a.time - b.time)
  const medals = ['🥇', '🥈', '🥉']
  box.innerHTML = '<h3>Rezultati</h3><ol>' +
    list.map((r, i) => `<li>${medals[i] || ''} ${escapeHtml(r.name)} – ${formatTime(r.time)}</li>`).join('') + '</ol>'
}

// ============================================================
//  MENI
// ============================================================
function initMenu() {
  // --- lik ---
  $('nameInput').value = profile.name
  $('nameInput').addEventListener('input', (e) => {
    profile.name = e.target.value.trim()
    saveProfile()
  })
  for (const h of HATS) $('hatSelect').add(new Option('🎩 ' + h, h))
  $('hatSelect').value = profile.hat
  $('hatSelect').addEventListener('change', (e) => {
    profile.hat = e.target.value
    saveProfile()
  })
  for (const c of SKINS) {
    const b = document.createElement('button')
    b.className = 'skin' + (c === profile.color ? ' sel' : '')
    b.style.background = c
    b.onclick = () => {
      profile.color = c
      document.querySelectorAll('.skin').forEach((s) => s.classList.toggle('sel', s === b))
      saveProfile()
    }
    $('skins').append(b)
  }

  // --- proga ---
  $('levelNameInput').addEventListener('input', (e) => {
    level.name = e.target.value || 'Proga'
    saveCurrentSoon()
  })
  $('playBtn').onclick = () => startPlay()
  $('editBtn').onclick = () => startEdit()
  $('resumeBtn').onclick = () => {
    if (lastMode === 'edit') startEdit()
    else enterGame()
  }
  $('shareBtn').onclick = async () => {
    const code = await level.toCode()
    const link = location.origin + location.pathname + '#proga=' + code
    $('shareBox').hidden = false
    $('codeArea').value = link
    $('codeOkBtn').hidden = true
    try {
      await navigator.clipboard.writeText(link)
      $('codeMsg').textContent = 'Povezava je kopirana – pošlji jo prijatelju!'
    } catch {
      $('codeMsg').textContent = 'Kopiraj povezavo zgoraj in jo pošlji prijatelju.'
    }
  }
  $('loadBtn').onclick = () => {
    $('shareBox').hidden = false
    $('codeArea').value = ''
    $('codeArea').placeholder = 'Prilepi kodo proge (OBBY-...) ali povezavo'
    $('codeOkBtn').hidden = false
    $('codeMsg').textContent = ''
    $('codeArea').focus()
  }
  $('codeOkBtn').onclick = async () => {
    try {
      setLevel(await Level.fromCode($('codeArea').value))
      $('codeMsg').textContent = `Naložena proga »${level.name}« (${level.size} kock)`
      editor.history = []
      lastMode = null
      $('resumeBtn').hidden = true
    } catch (e) {
      $('codeMsg').textContent = '❌ ' + (e.message.startsWith('To ni') ? e.message : 'Koda ni pravilna')
    }
  }
  $('saveBtn').onclick = async () => {
    const saved = store.get('levels', {})
    saved[level.name] = await level.toCode()
    store.set('levels', saved)
    renderSaved()
    toastMenu('💾 Shranjeno')
  }
  $('newBtn').onclick = () => {
    const l = new Level('Nova proga')
    for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) l.set(x, 0, z, 2)
    l.set(0, 0, 0, 9)
    setLevel(l)
    editor.history = []
    lastMode = null
    startEdit()
  }
  $('sampleBtn').onclick = () => {
    setLevel(sampleLevel())
    lastMode = null
    $('resumeBtn').hidden = true
  }
  renderSaved()

  // --- soba ---
  $('createRoomBtn').onclick = () => joinRoomCode(newRoomCode())
  $('joinRoomBtn').onclick = () => {
    const code = $('roomInput').value.trim().toUpperCase()
    if (code.length === 4) joinRoomCode(code)
  }
  $('roomInput').addEventListener('keydown', (e) => e.key === 'Enter' && $('joinRoomBtn').click())
  $('leaveRoomBtn').onclick = leaveRoom
  $('raceBtn').onclick = async () => {
    if (!level.find(9) || !level.find(11)) return toastMenu('Proga potrebuje start in cilj!')
    net.startRace(await level.toCode(), level.name, profile.name || 'Nekdo')
  }

  // --- hotbar urejevalnika ---
  HOTBAR.forEach((t, i) => {
    const s = document.createElement('div')
    s.className = 'slot'
    s.style.background = '#' + BLOCKS[t].color.toString(16).padStart(6, '0')
    s.innerHTML = `<b>${['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='][i]}</b>`
    s.title = BLOCKS[t].name
    $('hotbar').append(s)
  })
  const nameEl = document.createElement('div')
  nameEl.id = 'slotName'
  $('hud').append(nameEl)
  editor.onSelect = (i) => {
    document.querySelectorAll('.slot').forEach((s, j) => s.classList.toggle('sel', i === j))
    nameEl.textContent = mode === 'edit' ? BLOCKS[HOTBAR[i]].name : ''
  }
}

function renderSaved() {
  const saved = store.get('levels', {})
  const box = $('savedList')
  box.innerHTML = ''
  for (const [name, code] of Object.entries(saved)) {
    const b = document.createElement('button')
    b.textContent = '📁 ' + name
    b.title = 'Naloži (Shift+klik: izbriši)'
    b.onclick = async (e) => {
      if (e.shiftKey) {
        delete saved[name]
        store.set('levels', saved)
        return renderSaved()
      }
      setLevel(await Level.fromCode(code))
      editor.history = []
      lastMode = null
      $('resumeBtn').hidden = true
      toastMenu(`Naložena »${name}«`)
    }
    box.append(b)
  }
}

function saveProfile() {
  store.set('profile', profile)
  net?.setProfile(profile)
  if (me) ensureMe()
}

function joinRoomCode(code) {
  if (net) leaveRoom()
  if (!profile.name) {
    profile.name = 'Igralec' + Math.floor(Math.random() * 100)
    $('nameInput').value = profile.name
    saveProfile()
  }
  net = new Net(code, profile, netEvents)
  race = { round: 0, name: '' }
  $('roomCode').textContent = code
  $('roomOut').hidden = true
  $('roomIn').hidden = false
  history.replaceState(null, '', '#soba=' + code)
  renderPlayers()
}

function leaveRoom() {
  net?.leave()
  net = null
  for (const r of remotes.values()) r.avatar.dispose()
  remotes.clear()
  $('roomOut').hidden = false
  $('roomIn').hidden = true
  history.replaceState(null, '', location.pathname)
  if (mode === 'race') mode = 'play'
}

function renderPlayers() {
  const ul = $('playerList')
  ul.innerHTML = `<li><i style="background:${profile.color}"></i>${escapeHtml(profile.name || 'Jaz')} (ti)</li>`
  for (const r of remotes.values()) {
    ul.innerHTML += `<li><i style="background:${escapeHtml(r.profile.color)}"></i>${escapeHtml(r.profile.name)}</li>`
  }
  if (!remotes.size) ul.innerHTML += '<li class="muted">Čakam na prijatelje …</li>'
}

// ============================================================
//  POMOŽNE FUNKCIJE
// ============================================================
let toastTimer = 0
function toast(text, ms = 1500) {
  const el = $('toast')
  el.textContent = text
  el.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => el.classList.remove('show'), ms)
  if (!$('menu').hidden) toastMenu(text)
}

function toastMenu(text) {
  $('menuMsg').textContent = text
}

function flash(color) {
  const el = document.createElement('div')
  el.style.cssText = `position:fixed;inset:0;background:${color};opacity:.35;pointer-events:none;transition:opacity .4s`
  document.body.append(el)
  requestAnimationFrame(() => (el.style.opacity = 0))
  setTimeout(() => el.remove(), 450)
}

function formatTime(t) {
  const m = Math.floor(t / 60)
  const s = (t % 60).toFixed(2).padStart(5, '0')
  return `${m}:${s}`
}

function hash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

// ============================================================
//  ZAGON
// ============================================================
async function boot() {
  initMenu()
  // Proga iz povezave (#proga=...) ima prednost, sicer zadnja urejana
  const h = location.hash
  try {
    if (h.startsWith('#proga=')) {
      setLevel(await Level.fromCode(h.slice(7)))
      history.replaceState(null, '', location.pathname)
      toastMenu(`Naložena proga »${level.name}« iz povezave 🎉`)
    } else {
      const saved = store.get('current', null)
      setLevel(saved ? await Level.fromCode(saved) : sampleLevel())
    }
  } catch {
    setLevel(sampleLevel())
  }
  if (h.startsWith('#soba=')) $('roomInput').value = h.slice(6, 10)

  // Pred začetkom kamera počasi kroži okoli proge
  const s = level.find(9) || [0, 0, 0]
  camera.position.set(s[0] + 12, s[1] + 10, s[2] - 12)
  camera.lookAt(s[0], s[1], s[2] + 15)
  followSun(new THREE.Vector3(s[0], s[1], s[2] + 15))
  frame()
}

boot()
