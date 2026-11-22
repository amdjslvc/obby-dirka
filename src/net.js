// ============================================================
//  OMREŽJE: igranje s prijatelji preko kode sobe.
//  Brskalniki se povežejo neposredno (WebRTC, knjižnica Trystero) –
//  nobenega lastnega strežnika ne potrebujemo.
// ============================================================
import { joinRoom } from 'trystero'

const APP_ID = 'amadej-obby-dirka-2026'
// Povečaj, ko spremeniš kaj, kar mora imeti vsak igralec v sobi (nove kocke, sporočila ...)
export const GAME_VERSION = 5

// Ustvari naključno kodo sobe, npr. "KX7P"
export function newRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // brez O/0 in I/1, da se ne zmedemo
  let s = ''
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

export class Net {
  // events: { onProfile, onLeave, onPos, onEmote, onRace, onFinish, onTag }
  constructor(code, profile, events) {
    this.code = code
    this.events = events
    this.room = joinRoom({ appId: APP_ID, identity: 'none', maxUsers: 8 }, 'soba-' + code)

    // Profil vsakega igralca (ime, barva, klobuk)
    this.profile = this.room.makeUserState('profile', { ...profile, v: GAME_VERSION })
    this.profile.set({ ...profile, v: GAME_VERSION })
    this.profile.onChange((value, ctx) => {
      if (ctx.self) return
      if (ctx.removed || !value) events.onLeave(ctx.userId)
      else events.onProfile(ctx.userId, value)
    }, { replay: true })
    this.room.onUserLeave(({ userId }) => events.onLeave(userId))

    // Položaj: pošiljamo ~15x na sekundo
    this.posAction = this.room.makeAction('pos')
    this.posAction.onMessage((data, { userId }) => events.onPos(userId, data))

    // Emoti (oblački nad glavo)
    this.emoteAction = this.room.makeAction('emote')
    this.emoteAction.onMessage((n, { userId }) => events.onEmote(userId, n)) // n = številka emota

    // Dirka: skupno stanje sobe (katera proga, kateri krog). Kdorkoli lahko začne novo dirko.
    this.race = this.room.makeState('race', null, { maxBytes: 65536 })
    this.race.onChange((value) => value && events.onRace(value), { replay: true })

    // Ko nekdo pride na cilj
    this.finishAction = this.room.makeAction('finish')
    this.finishAction.onMessage((data, { userId }) => events.onFinish(userId, data))

    // Lovljenje: skupno stanje – kdo je lovec, od kdaj, do kdaj traja igra
    this.tag = this.room.makeState('tag', null, { maxBytes: 65536 })
    this.tag.onChange((value) => value && events.onTag(value), { replay: true })

    // Moj ID v sobi (enak, kot ga vidijo drugi)
    this.selfId = null
    this.room.getSelf().then((s) => (this.selfId = s.userId)).catch(() => {})

    this.room.onError((err) => console.warn('Napaka v sobi:', err))
  }

  sendPos(p) { this.posAction.send(p).catch(() => {}) }
  sendEmote(text) { this.emoteAction.send(text).catch(() => {}) }
  sendFinish(data) { this.finishAction.send(data).catch(() => {}) }
  setProfile(p) { this.profile.set({ ...p, v: GAME_VERSION }) }

  startRace(levelCode, levelName, by) {
    const prev = this.race.get()
    const round = (prev ? prev.round : 0) + 1
    const value = { round, level: levelCode, name: levelName, by, at: Date.now() }
    this.race.set(value)
    this.events.onRace(value) // tudi sami začnemo (glavna zanka podvojitve ignorira)
  }

  // Začni lovljenje: lovec je naključni igralec
  startTag(levelCode, levelName, by, players, seconds = 90) {
    const prev = this.tag.get()
    const now = Date.now()
    const value = {
      round: (prev ? prev.round : 0) + 1, level: levelCode, name: levelName, by,
      it: players[Math.floor(Math.random() * players.length)], since: now + 3000, at: now, end: now + 3000 + seconds * 1000,
    }
    this.tag.set(value)
    this.events.onTag(value)
  }

  // Nekoga smo ujeli (ali lovec je odšel): zdaj lovi on
  setIt(userId) {
    const prev = this.tag.get()
    if (!prev) return
    const value = { ...prev, it: userId, since: Date.now() }
    this.tag.set(value)
    this.events.onTag(value)
  }

  leave() {
    this.room.leave()
  }
}
