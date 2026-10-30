// Henüz t() ile sarılmamış (muhtemelen Türkçe) metinleri listeler — dosya taşırken yardımcı.
//   node tools/i18n-scan.mjs src/hud.js [src/goals.js …]
// Yaklaşık çalışır: yorumları atlar, tırnak/şablon içindeki Türkçe harfli ya da birden çok kelimeli metinleri gösterir.
import { readFileSync } from 'node:fs';

const TR = /[çğıöşüÇĞİÖŞÜ]/;
const words = (s) => (s.match(/\p{L}{2,}/gu) || []).length;

for (const file of process.argv.slice(2)) {
  const src = readFileSync(file, 'utf8');
  const out = [];
  let i = 0;
  let line = 1;
  const stack = []; // şablon içindeki ${ } derinliği
  let buf = '';
  let bufLine = 0;
  let quote = null;
  const flush = (pre) => {
    const s = buf.replace(/<[^>]*>/g, ' ').trim();
    if (s && (TR.test(s) || words(s) >= 3) && !/\bt\(\s*$/.test(pre)) out.push([bufLine, s]);
    buf = '';
  };
  let lastCode = '';
  while (i < src.length) {
    const c = src[i];
    if (c === '\n') line++;
    if (!quote) {
      if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
      if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); line += (src.slice(i, e).match(/\n/g) || []).length; i = e + 2; continue; }
      if (c === "'" || c === '"' || c === '`') { quote = c; buf = ''; bufLine = line; lastCode = src.slice(Math.max(0, i - 6), i); i++; continue; }
      if (c === '}' && stack.length && stack[stack.length - 1] === 0) { stack.pop(); quote = '`'; buf = ''; bufLine = line; i++; continue; }
      if (c === '{' && stack.length) stack[stack.length - 1]++;
      if (c === '}' && stack.length) stack[stack.length - 1]--;
      i++;
      continue;
    }
    if (c === '\\') { buf += src[i + 1]; i += 2; continue; }
    if (quote === '`' && c === '$' && src[i + 1] === '{') { flush(lastCode); quote = null; stack.push(0); lastCode = '${'; i += 2; continue; }
    if (c === quote) { flush(lastCode); quote = null; i++; continue; }
    buf += c;
    i++;
  }
  console.log(`== ${file} (${out.length})`);
  for (const [l, s] of out) console.log(`${String(l).padStart(5)}: ${s.length > 110 ? s.slice(0, 110) + '…' : s}`);
}
