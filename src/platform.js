import { Capacitor, registerPlugin } from '@capacitor/core';

// Platform katmanı: web ile iOS (Capacitor) arasındaki farklar tek yerde.
// Web'de her şey sessizce boş çalışır; iOS'ta Game Center, iCloud kayıt, titreşim, yaşam döngüsü.

export const SAVE_KEY = 'marketgame-save-v2';
export const native = Capacitor.isNativePlatform();

const GameCenter = registerPlugin('GameCenter');
const CloudSave = registerPlugin('CloudSave');
const NativeApp = registerPlugin('NativeApp');
const Haptics = registerPlugin('Haptics');
const Preferences = registerPlugin('Preferences');
const App = registerPlugin('App');

// Game Center kimlikleri (App Store Connect'te aynı adlarla tanımlanır — apple/GAMECENTER.md)
export const GC_PREFIX = 'mt.';
export const LEADERBOARDS = {
  companyValue: 'mt.lb.company_value',
  customers: 'mt.lb.customers',
  fastestRuler: 'mt.lb.fastest_ruler', // düşük daha iyi (gün)
};

const safe = async (fn, fallback = null) => {
  if (!native) return fallback;
  try {
    return await fn();
  } catch (e) {
    console.warn('[platform]', e?.message ?? e);
    return fallback;
  }
};

/** Kayıt özetinden kart bilgisi: gün, seviye, para, kaydedildiği an. */
export function saveMeta(json) {
  try {
    const d = JSON.parse(json);
    return { day: d.day?.day ?? 1, level: estimateLevel(d), money: Math.round(d.money ?? 0), savedAt: d.savedAt ?? 0, name: d.marketName ?? 'Kasaba' };
  } catch {
    return null;
  }
}

function estimateLevel(d) {
  return d.levelCache ?? 1; // kayıtta tutulan seviye (XP'den hesaplamaya gerek yok)
}

export const platform = {
  native,
  gameCenter: false,
  player: null,

  /**
   * Oyun kurulmadan önce: yerel (localStorage), cihaz yedeği (Preferences) ve iCloud kayıtlarını karşılaştır.
   * Farklıysa oyuncuya seçtir; seçilen kayıt localStorage'a yazılır (oyun oradan yükler).
   */
  async prepareSave(choose) {
    if (!native) return;
    const local = localStorage.getItem(SAVE_KEY);
    const pref = (await safe(() => Preferences.get({ key: SAVE_KEY })))?.value ?? null;
    const cloud = (await safe(() => CloudSave.get({ key: SAVE_KEY })))?.value ?? null;
    // WebKit verisi silinmişse cihaz yedeğinden dön
    let best = local ?? pref;
    const m = (j) => (j ? saveMeta(j) : null);
    if (local && pref && (m(pref)?.savedAt ?? 0) > (m(local)?.savedAt ?? 0)) best = pref;
    if (cloud && cloud !== best) {
      const a = m(best);
      const b = m(cloud);
      if (!a) best = cloud;
      else if (b && (a.day !== b.day || a.level !== b.level)) {
        best = (await choose({ device: a, cloud: b })) === 'cloud' ? cloud : best;
      }
    }
    if (best && best !== local) localStorage.setItem(SAVE_KEY, best);
  },

  /** Her kayıtta: cihaz yedeği hemen, iCloud birkaç saniye gecikmeli (sık yazmamak için). */
  persist(json) {
    if (!native) return;
    safe(() => Preferences.set({ key: SAVE_KEY, value: json }));
    clearTimeout(this.cloudT);
    this.cloudT = setTimeout(() => safe(() => CloudSave.set({ key: SAVE_KEY, value: json })), 4000);
  },

  /** Sıfırlama: tüm kopyaları sil. */
  async clearSave() {
    await safe(() => Preferences.remove({ key: SAVE_KEY }));
    await safe(() => CloudSave.remove({ key: SAVE_KEY }));
  },

  // ---- Game Center ----

  async signIn() {
    const r = await safe(() => GameCenter.authenticate());
    this.gameCenter = !!r?.authenticated;
    this.player = r?.alias ?? null;
    return this.gameCenter;
  },

  achievement(id) {
    if (this.gameCenter) safe(() => GameCenter.reportAchievement({ id: GC_PREFIX + 'ach.' + id, percent: 100 }));
  },

  score(board, value) {
    if (this.gameCenter) safe(() => GameCenter.submitScore({ leaderboardID: board, score: Math.max(0, Math.round(value)) }));
  },

  showGameCenter() {
    return safe(() => GameCenter.showDashboard());
  },

  accessPoint(active) {
    if (this.gameCenter) safe(() => GameCenter.setAccessPoint({ active }));
  },

  // ---- Titreşim ve uygulama ----

  haptic(style = 'LIGHT') {
    if (!native || this.hapticsOff) return;
    safe(() => Haptics.impact({ style }));
  },

  keepAwake(on) {
    safe(() => NativeApp.setKeepAwake({ on }));
  },

  /** Uygulama arka plana gidince / dönünce. */
  onAppState(cb) {
    if (native) safe(() => App.addListener('appStateChange', (s) => cb(s.isActive)));
    else document.addEventListener('visibilitychange', () => cb(!document.hidden));
  },
};
