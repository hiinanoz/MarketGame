import { loadAssets } from './assets.js';
import { Game } from './game.js';

const bar = document.getElementById('loading-bar');

async function start() {
  await loadAssets((p) => {
    bar.style.width = `${Math.round(p * 100)}%`;
  });
  const game = new Game(document.getElementById('app'));
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
