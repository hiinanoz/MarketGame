import { loadAssets } from './assets.js';
import { Game } from './game.js';

const bar = document.getElementById('loading-bar');

async function start() {
  await loadAssets((p) => {
    bar.style.width = `${Math.round(p * 100)}%`;
  });
  const game = new Game(document.getElementById('app'));
  window.game = game; // tarayıcı konsolundan hata ayıklama için
  document.getElementById('loading').classList.add('hidden');

  let last = performance.now();
  const loop = (now) => {
    const dt = Math.max(0, Math.min((now - last) / 1000, 0.05));
    last = now;
    game.update(dt);
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
