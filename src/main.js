import { loadAssets } from './assets.js';
import { Game } from './game.js';
import { platform } from './platform.js';

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
    if (!active) {
      game.save();
      if (!game.paused && !game.hud.summaryOpen) document.getElementById('menu-btn').click();
    }
  });
  window.game = game; // tarayıcı konsolundan hata ayıklama için
  const zoomBtn = document.getElementById('zoom-btn');
  zoomBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
  zoomBtn.addEventListener('click', () => game.cycleZoom());
  // Masaüstü: fare tekerleği ile yakınlaş/uzaklaş
  window.addEventListener('wheel', (e) => game.setZoom((game.zoomTarget ?? 1) * (e.deltaY > 0 ? 1.12 : 1 / 1.12)), { passive: true });
  document.getElementById('loading').classList.add('hidden');
  if (game.isNewGame) {
    const intro = document.getElementById('intro');
    intro.classList.remove('hidden');
    game.paused = true; // hikâye okunurken gün ilerlemesin
    intro.addEventListener('pointerdown', (e) => e.stopPropagation());
    const nameInput = document.getElementById('intro-name');
    const preview = document.getElementById('intro-preview');
    nameInput.addEventListener('input', () => {
      game.marketName = nameInput.value.trim() || 'Kasaba';
      preview.innerHTML = `Tabelada: <b>${game.marketTitle.replace(/</g, '&lt;')}</b>`;
    });
    nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('intro-start').click(); });
    document.getElementById('intro-start').addEventListener('click', () => {
      intro.classList.add('hidden');
      game.setMarketName(nameInput.value);
      game.paused = false;
    });
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
  const loop = (now) => {
    const dt = Math.max(0, Math.min((now - last) / 1000, 0.05));
    last = now;
    // 2× hız: aynı karede simülasyonu iki kez ilerlet (adım küçük kalsın)
    if (game.running) for (let i = 0; i < (game.options.fast ? 2 : 1); i++) game.update(dt);
    game.render();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  const save = () => { if (!game.resetting) game.save(); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  window.addEventListener('pagehide', save);
}

start().catch((err) => {
  console.error(err);
  bar.parentElement.insertAdjacentHTML('afterend', `<p style="color:#9b2c2c">Yüklenemedi: ${err.message}</p>`);
});

/** İki kayıt arasında seçim kartları (cihaz / iCloud). */
function chooseSave({ device, cloud }) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'overlay';
    const card = (key, title, m) => `<button class="save-card" data-pick="${key}"><b>${title}</b><span>${m.name} · Gün ${m.day} · Sv.${m.level}</span><small>$${m.money.toLocaleString('tr-TR')} · ${m.savedAt ? new Date(m.savedAt).toLocaleString('tr-TR') : 'tarih yok'}</small></button>`;
    el.innerHTML = `<div class="panel"><h2>Hangi kayıtla devam?</h2><p class="note">Bu cihazdaki kayıt ile iCloud'daki kayıt farklı.</p>${card('device', '📱 Bu cihaz', device)}${card('cloud', '☁️ iCloud', cloud)}</div>`;
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-pick]');
      if (!b) return;
      el.remove();
      resolve(b.dataset.pick);
    });
    document.body.appendChild(el);
  });
}
