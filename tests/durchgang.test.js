/* tests/durchgang.test.js – Funde aus dem Nutzer-Durchgang vom 21.10.2026 (DURCHGANG-2026-10-21.md)
   Start:  PORT=8961 NODE_PATH="<Ordner mit playwright>/node_modules" node tests/durchgang.test.js
   Ohne Netz: Open-Meteo antwortet mit tests/fixtures/open-meteo-mannheim.json, alles andere wird abgewiesen (wie in wetterfoto.test.js).
   Exit-Code 0 = alles grün, 1 = mindestens ein Fehler. */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { webkit } = require('playwright');

const WURZEL = path.join(__dirname, '..');
const PORT = +process.env.PORT || 8893;
const BASIS = 'http://127.0.0.1:' + PORT + '/';
const FOTO = path.join(__dirname, 'fixtures', 'foto.jpg');
const OM = fs.readFileSync(path.join(__dirname, 'fixtures', 'open-meteo-mannheim.json'), 'utf8');

let ok = 0, fehler = 0;
function pruefe(name, bedingung, detail) {
  if (bedingung) { ok++; console.log('  ✓ ' + name); }
  else { fehler++; console.log('  ✗ ' + name + (detail !== undefined ? '  → ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '')); }
}

const TYPEN = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' };
function server() {
  return new Promise(fertig => {
    const s = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, BASIS).pathname);
      if (p.endsWith('/')) p += 'index.html';
      const datei = path.join(WURZEL, path.normalize(p));
      if (!datei.startsWith(WURZEL) || !fs.existsSync(datei) || fs.statSync(datei).isDirectory()) { res.writeHead(404); return res.end('fehlt'); }
      res.writeHead(200, { 'Content-Type': TYPEN[path.extname(datei)] || 'application/octet-stream' });
      fs.createReadStream(datei).pipe(res);
    }).listen(PORT, '127.0.0.1', () => fertig(s));
  });
}

async function neueSeite(b, o) {
  o = o || {};
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: o.farbe || 'light', serviceWorkers: 'block' });
  await ctx.route(u => /^https?:$/.test(u.protocol) && !u.href.startsWith(BASIS), route => {
    const u = new URL(route.request().url());
    if (u.host === 'api.open-meteo.com') return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: OM });
    if (u.host === 'api.brightsky.dev') return route.fulfill({ status: 404, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"title":"Not Found"}' });
    return route.abort();
  });
  const p = await ctx.newPage();
  await p.goto(BASIS);
  await p.waitForSelector('.aktuell-kachel', { timeout: 10000 });
  await p.waitForTimeout(500);
  return { ctx, p };
}

// Kontrast einer Textfarbe auf dem Grund des Meteogramms (Fläche der Karte #graphs)
const KONTRAST_JS = sel => {
  const rgb = c => { const m = c.match(/[\d.]+/g).map(Number); return /^color\(/.test(c) ? [m[0] * 255, m[1] * 255, m[2] * 255] : [m[0], m[1], m[2]]; };
  const L = c => { const [r, g, b] = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const e = document.querySelector(sel); if (!e) return null;
  const cs = getComputedStyle(e), vorn = rgb(e.closest('svg') ? cs.fill : cs.color), hinten = rgb(getComputedStyle(document.querySelector('#graphs')).backgroundColor);
  const a = L(vorn), c = L(hinten);
  return { kontrast: Math.round((Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05) * 100) / 100, px: parseFloat(cs.fontSize) };
};

(async () => {
  const s = await server(), b = await webkit.launch();
  try {
    console.log('1) Meteogramm: Sonnenzeiten und Wert-Marke lesbar');
    for (const farbe of ['light', 'dark']) {
      const { ctx, p } = await neueSeite(b, { farbe });
      await p.click('#leiste [data-tab="graphs"]');
      await p.waitForSelector('#graphs .mg-svg .mg-sonne', { timeout: 10000 });
      await p.waitForTimeout(500);
      const son = await p.evaluate(KONTRAST_JS, '#graphs .mg-svg .mg-sonne');
      pruefe(farbe + ': Sonnenauf-/-untergang mindestens 11 px', son && son.px >= 11, son);
      pruefe(farbe + ': Sonnenauf-/-untergang Kontrast mindestens 4,5:1', son && son.kontrast >= 4.5, son);
      await p.evaluate(() => { const w = document.querySelector('#graphs .mg-ax-wert'); if (w) w.hidden = false; });   // die Marke zeigt sich sonst nur beim Antippen
      const wert = await p.evaluate(KONTRAST_JS, '#graphs .mg-ax-wert');
      pruefe(farbe + ': Wert-Marke am Achsenrand Kontrast mindestens 4,5:1', wert && wert.kontrast >= 4.5, wert);
      await ctx.close();
    }

    console.log('2) Rad/Sat: Zeit-Regler mindestens 44 px hoch');
    {
      const { ctx, p } = await neueSeite(b);
      await p.click('#leiste [data-tab="radsat"]');
      await p.waitForSelector('#karte .wk-range', { timeout: 10000 });
      const h = await p.$eval('#karte .wk-range', e => Math.round(e.getBoundingClientRect().height));
      pruefe('Zeit-Regler ≥ 44 px hoch', h >= 44, h);
      await ctx.close();
    }

    console.log('3) Mehr: Text ohne „iPhone“');
    {
      const { ctx, p } = await neueSeite(b);
      await p.click('#leiste [data-tab="mehr"]');
      const text = await p.$eval('#tab-mehr', e => e.innerText);
      pruefe('Darstellungs-Hinweis sagt „Gerät“ statt „iPhone“ (die App läuft auch am Mac)', !/Hell und Dunkel folgen deinem iPhone/.test(text));
      await ctx.close();
    }

    console.log('4) Tastatur: Fokus bleibt im Wetterfoto');
    {
      const { ctx, p } = await neueSeite(b);
      await p.waitForFunction(() => window.KSStudio, null, { timeout: 8000 });
      const imStudio = () => p.evaluate(() => { const a = document.activeElement; return !!a && a !== document.body && !!a.closest('#studio'); });
      await p.focus('#leiste [data-zugang]');
      await p.keyboard.press('Enter');
      await p.waitForTimeout(800);
      pruefe('Nach Enter auf dem Kamera-Knopf liegt der Fokus im Studio', await imStudio());
      await p.setInputFiles('#studio input[type=file]', FOTO);
      await p.waitForFunction(() => { const r = document.querySelector('#ksWurzel .ks'); return r && r._ksInst && r._ksInst.quelle; }, null, { timeout: 8000 });
      await p.waitForTimeout(1500);
      pruefe('Nach dem Laden des Fotos liegt der Fokus noch im Studio', await imStudio(), await p.evaluate(() => document.activeElement && document.activeElement.tagName));
      await ctx.close();
    }
  } finally {
    await b.close(); s.close();
  }
  console.log('\n' + ok + ' Prüfungen bestanden, ' + fehler + ' fehlgeschlagen.');
  process.exit(fehler ? 1 : 0);
})();
