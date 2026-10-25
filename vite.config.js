import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build`        → dist/ (GitHub Pages vb. için normal çıktı)
// `npm run build:single` → dist-single/index.html (modeller dahil tek dosya; reklam ağları / paylaşım için)
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    base: './',
    build: {
      outDir: single ? 'dist-single' : 'dist',
      assetsInlineLimit: single ? 100_000_000 : 4096,
      chunkSizeWarningLimit: 2000,
    },
    plugins: single ? [viteSingleFile()] : [],
  };
});
