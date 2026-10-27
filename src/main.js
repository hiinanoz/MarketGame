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
  if (!game.isNewGame) showHome(game);
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
    // Hız 1× / 1.5× / 2×: adım küçük kalsın diye kare başına en fazla iki alt adım
    if (game.running && !game.simulating) {
      const sp = game.options.speed ?? 1;
      const n = Math.ceil(sp);
      for (let i = 0; i < n; i++) game.update((dt * sp) / n);
    }
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

// ---- Ana menü (açılışta, kayıtlı oyun varsa) ----

const HELP = [
  ['🕹️', 'Ekrana dokunup sürükleyerek yürü. Depodaki paletten kasa al, aynı ürünün reyonuna bırak.'],
  ['💳', 'Müşteriler kasada bekler: kasiyer alana kadar kasanın arkasında dur, parayı topla.'],
  ['🟩', 'Yerdeki alanların üstünde durarak para öde: reyon, çalışan, genişleme açılır.'],
  ['🧾', 'Muhasebe odası: sipariş, banka, kampanya ve reklam. Sv.21\'den sonra 💼 tabletle işletmeleri yönet.'],
  ['🌙', 'Gün 22:00\'de biter. Çalışanların maaşı, kira ve faiz gün sonunda ödenir.'],
  ['👑', 'Hedef: şehrin her şeyini almak ve Kasabanın Hakimi olmak. Derecen oyun gününe göre verilir.'],
];

function showHome(game) {
  const el = document.getElementById('home');
  const sub = document.getElementById('home-sub');
  game.paused = true;
  el.classList.remove('hidden');
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
  document.getElementById('home-title').textContent = game.marketTitle;
  document.getElementById('home-meta').textContent = `Gün ${game.day.day} · Seviye ${game.level} · $${Math.round(game.money).toLocaleString('tr-TR')}`;
  const gc = document.getElementById('home-gc');
  const refreshGc = () => {
    gc.classList.toggle('hidden', !platform.gameCenter);
    platform.accessPoint(!el.classList.contains('hidden'));
  };
  setTimeout(refreshGc, 1500);
  const close = () => {
    el.classList.add('hidden');
    sub.classList.add('hidden');
    platform.accessPoint(false);
    game.paused = false;
  };
  // Alt sayfa: başlık ve Geri düğmesi sabit, aradaki içerik kaydırılır
  const showSub = (title, body, closeLabel = 'Tamam') => {
    sub.innerHTML = `<div class="sub-head"><button data-back class="sub-back" aria-label="Geri">‹</button><h3>${title}</h3></div><div class="sub-body">${body}</div><button data-back class="primary sub-close">${closeLabel}</button>`;
    sub.classList.remove('hidden');
    sub.querySelector('.sub-body').scrollTop = 0;
  };
  sub.addEventListener('click', (e) => { if (e.target.closest('[data-back]')) sub.classList.add('hidden'); });
  document.getElementById('home-continue').addEventListener('click', close);
  gc.addEventListener('click', () => platform.showGameCenter());
  document.getElementById('home-settings').addEventListener('click', () => {
    close();
    document.getElementById('menu-btn').click();
  });
  document.getElementById('home-help').addEventListener('click', () => {
    showSub('Nasıl oynanır', `${HELP.map(([e, t]) => `<p class="help-row"><span>${e}</span>${t}</p>`).join('')}`);
  });
  document.getElementById('home-ach').addEventListener('click', async () => {
    const { ACHIEVEMENTS } = await import('./achievements.js');
    const earned = game.achievements.earned;
    // Kazanılanlar üstte; ilerleme çubuğu başlığın altında
    const list = [...ACHIEVEMENTS].sort((x, y) => earned.has(y.id) - earned.has(x.id));
    const pct = Math.round((earned.size / ACHIEVEMENTS.length) * 100);
    showSub(
      `Başarımlar <small>${earned.size}/${ACHIEVEMENTS.length}</small>`,
      `<div class="ach-progress"><i style="width:${pct}%"></i></div><div class="ach-list">${list.map((a) => `<div class="${earned.has(a.id) ? 'on' : ''}"><span>${earned.has(a.id) ? a.emoji : '🔒'}</span>${a.name}</div>`).join('')}</div>`,
    );
  });
  document.getElementById('home-new').addEventListener('click', () => {
    showSub('Yeni oyun?', `<p>Mevcut oyunun (${game.marketTitle}, Gün ${game.day.day}) silinir${platform.native ? ' — iCloud kopyası dahil' : ''}. Bu geri alınamaz.</p><button data-reset class="danger">Sil ve yeni oyuna başla</button>`, 'Vazgeç');
    sub.querySelector('[data-reset]').addEventListener('click', () => game.reset());
  });
}
