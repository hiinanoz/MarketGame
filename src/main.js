import { loadAssets } from './assets.js';
import { Game } from './game.js';
import { platform } from './platform.js';
import { Menus } from './menus.js';
import { GFX } from './config.js';
import { translateDom, t, num, dateTime } from './i18n.js';

translateDom(); // index.html'deki sabit metinler (seçili dil Türkçe değilse)

const bar = document.getElementById('loading-bar');

async function start() {
  await loadAssets((p) => {
    bar.style.width = `${Math.round(p * 100)}%`;
  });
  // iOS: cihaz ve iCloud kayıtları farklıysa oyuncuya seçtir (oyun kurulmadan önce)
  await platform.prepareSave(chooseSave);
  const game = new Game(document.getElementById('app'));
  if (platform.native) document.documentElement.classList.add('native');
  // Game Center: sessiz giriş; bağlanınca önceki başarımları da gönder
  platform.signIn().then((ok) => { if (ok) game.achievements.syncAll(); });
  platform.keepAwake(true);
  // Arka plana geçince kaydet ve menüyü aç (oyun duraklar)
  platform.onAppState((active) => {
    if (active && game.bgAt) {
      // Uzun süre arka planda kaldıysa "sen yokken" kazancı
      const off = game.goals.computeOffline(game.bgAt);
      game.bgAt = 0;
      if (off) game.menus?.showOffline(off);
    }
    if (!active) {
      game.bgAt = Date.now();
      game.save();
      if (!game.paused && !game.hud.summaryOpen) document.getElementById('menu-btn').click();
    }
  });
  window.game = game; // tarayıcı konsolundan hata ayıklama için
  // Arayüz düğmelerine dokununca hafif tık sesi
  document.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b && !b.disabled) game.audio.play('click', 0.55);
  }, true);
  const zoomBtn = document.getElementById('zoom-btn');
  zoomBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
  zoomBtn.addEventListener('click', () => game.cycleZoom());
  // Masaüstü: fare tekerleği ile yakınlaş/uzaklaş
  window.addEventListener('wheel', (e) => game.setZoom((game.zoomTarget ?? 1) * (e.deltaY > 0 ? 1.12 : 1 / 1.12)), { passive: true });
  document.getElementById('loading').classList.add('hidden');
  // Ana menü: her açılışta. Kayıtlı oyunda önce "sen yokken" kazancı, sonra günlük ödül.
  const menus = new Menus(game);
  game.menus = menus;
  menus.showHome();
  if (!game.isNewGame) {
    const off = game.goals.computeOffline(game.lastSavedAt);
    const login = () => { if (game.goals.loginPending) menus.showLogin(); };
    if (off) menus.showOffline(off, login);
    else login();
  }

  // Menü: market adını değiştir
  const menuName = document.getElementById('menu-name');
  document.getElementById('menu-btn').addEventListener('click', () => { menuName.value = game.marketName; });
  document.getElementById('menu-name-save').addEventListener('click', () => game.setMarketName(menuName.value));
  menuName.addEventListener('keydown', (e) => { if (e.key === 'Enter') game.setMarketName(menuName.value); });

  document.getElementById('final').addEventListener('pointerdown', (e) => e.stopPropagation());
  document.getElementById('final-continue').addEventListener('click', () => {
    document.getElementById('final').classList.add('hidden');
    game.paused = false;
  });

  let last = performance.now();
  let lastIdleRender = 0;
  const loop = (now) => {
    requestAnimationFrame(loop);
    // Kare sınırı (ısınmayı azaltır): seçilen fps'ten sık gelen kareleri atla
    // CEO masası açıkken harita çizilmez (zaman akar)
    const plaza = (game.plaza?.open || game.venues?.open) && !game.simulating;
    const idle = !plaza && ((!game.viewMode && (game.simulating || !game.running) && !game.party.active) || game.ceoDesk?.open || game.legal?.jailed);
    const fps = plaza ? Math.min(20, game.gfx.fps) : idle ? GFX.idleFps : game.gfx.fps; // plaza: küçük sahne, 20 fps yeter
    if (now - last < 1000 / fps - 2) return;
    const dt = Math.max(0, Math.min((now - last) / 1000, 0.05));
    last = now;
    // Hız 1× / 1.5× / 2×: adım küçük kalsın diye kare başına en fazla iki alt adım
    if (game.running && !game.simulating) {
      let sp = game.options.speed ?? 1;
      if (!game.speedAllowed(sp)) sp = 1.5; // Sv.20 sonrası 2× Premium
      const n = Math.ceil(sp);
      for (let i = 0; i < n; i++) game.update((dt * sp) / n);
    }
    else if (game.viewMode) {
      game.updateCamera(dt); // ana menü / karakter: oyun durur, kamera hareket eder
      game.music.react(game);
    }
    // Sahne duruyorsa (menü, panel, gün tamamlama) seyrek çiz
    if (!idle || now - lastIdleRender > 1000 / GFX.idleFps) {
      game.render();
      lastIdleRender = now;
    }
  };
  requestAnimationFrame(loop);

  const save = () => { if (!game.resetting) game.save(); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  window.addEventListener('pagehide', save);
}

start().catch((err) => {
  console.error(err);
  bar.parentElement.insertAdjacentHTML('afterend', `<p style="color:#9b2c2c">${t('Yüklenemedi: {error}', { error: err.message })}</p>`);
});

/** İki kayıt arasında seçim kartları (cihaz / iCloud). */
function chooseSave({ device, cloud }) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'overlay save-choose'; // yükleme ekranının üstünde olmalı (z-index)
    const card = (key, title, m) => `<button class="save-card" data-pick="${key}"><b>${title}</b><span>${m.name} · ${t('Gün {n}', { n: m.day })} · ${t('Sv.{n}', { n: m.level })}</span><small>$${num(m.money)} · ${m.savedAt ? dateTime(m.savedAt) : t('tarih yok')}</small></button>`;
    el.innerHTML = `<div class="panel"><h2>${t('Hangi kayıtla devam?')}</h2><p class="note">${t('Bu cihazdaki kayıt ile iCloud\'daki kayıt farklı.')}</p>${card('device', t('📱 Bu cihaz'), device)}${card('cloud', '☁️ iCloud', cloud)}</div>`;
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-pick]');
      if (!b) return;
      el.remove();
      resolve(b.dataset.pick);
    });
    document.body.appendChild(el);
  });
}
