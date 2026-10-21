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
  const ctx = await b.newContext({ viewport: { width: o.breite || 390, height: 844 }, colorScheme: o.farbe || 'light', serviceWorkers: 'block' });
  await ctx.route(u => /^https?:$/.test(u.protocol) && !u.href.startsWith(BASIS), route => {
    const u = new URL(route.request().url());
    if (u.host === 'api.open-meteo.com') return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: OM });
    if (u.host === 'geocoding-api.open-meteo.com') return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ results: [{ id: 2907911, name: 'Heidelberg', latitude: 49.41, longitude: 8.69, country: 'Deutschland', admin1: 'Baden-Württemberg' }] }) });
    if (u.host === 'api.brightsky.dev') return route.fulfill({ status: 404, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"title":"Not Found"}' });
    return route.abort();
  });
  const p = await ctx.newPage();
  await p.goto(BASIS);
  await p.waitForSelector('.aktuell-kachel', { timeout: 10000 });
  await p.waitForTimeout(500);
  return { ctx, p };
}

// Alle Texte im Meteogramm: gezeichnete Größe = font-size × Skalierung des SVG
const GROESSEN_JS = () => {
  const aus = [];
  document.querySelectorAll('#graphs text, #graphs small, #graphs span, #graphs div, #graphs button, #graphs b, #graphs label, #graphs p').forEach(e => {
    if (!e.getClientRects().length || e.closest('[hidden]')) return;
    if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return;
    let px = parseFloat(getComputedStyle(e).fontSize);
    if (e instanceof SVGElement) { const m = e.getScreenCTM(); px *= Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)); }
    aus.push({ t: e.textContent.trim().slice(0, 16), cls: e.getAttribute('class') || e.tagName, px: Math.round(px * 100) / 100 });
  });
  return aus;
};
// Textproben (bis zu 3 je Klasse, nur sichtbar und nicht verdeckt): Ort und Schriftfarbe
const PROBEN_JS = () => {
  const je = {}, aus = [];
  document.querySelectorAll('#graphs text, #graphs small, #graphs span, #graphs div, #graphs button, #graphs b, #graphs label, #graphs p').forEach(e => {
    if (!e.getClientRects().length || e.closest('[hidden]')) return;
    if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return;
    const r = e.getBoundingClientRect(), cls = e.getAttribute('class') || e.tagName;
    if (r.width < 4 || r.height < 4 || r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight) return;
    const oben = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (!oben || !(e === oben || e.contains(oben) || oben.contains(e))) return;
    if ((je[cls] = (je[cls] || 0) + 1) > 3) return;
    const cs = getComputedStyle(e);
    aus.push({ t: e.textContent.trim().slice(0, 16), cls, x: r.left, y: r.top, w: r.width, h: r.height, fill: e instanceof SVGElement ? cs.fill : cs.color });
  });
  return aus;
};
// Kontrast Schriftfarbe gegen den häufigsten Pixel hinter dem Text (der echte Untergrund)
const PIXEL_JS = async ({ png, fill }) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + png; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data, zaehler = {};
  for (let i = 0; i < d.length; i += 4) { const k = d[i] + ',' + d[i + 1] + ',' + d[i + 2]; zaehler[k] = (zaehler[k] || 0) + 1; }
  const grund = Object.entries(zaehler).sort((a, b) => b[1] - a[1])[0][0].split(',').map(Number);
  const m = (fill.match(/[\d.]+/g) || [0, 0, 0]).map(Number), vorn = /^color\(/.test(fill) ? m.slice(0, 3).map(v => v * 255) : m.slice(0, 3), al = m.length > 3 ? m[3] : 1;
  const mix = vorn.map((v, i) => v * al + grund[i] * (1 - al));
  const L = q => { const [r, gg, b] = q.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * gg + 0.0722 * b; };
  const x = L(mix), y = L(grund);
  return Math.round((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) * 100) / 100;
};

(async () => {
  const s = await server(), b = await webkit.launch();
  try {
    console.log('1) Meteogramm: jeder Text mindestens 11 px gezeichnet und Kontrast mindestens 4,5:1');
    for (const farbe of ['light', 'dark']) for (const breite of [390, 1280]) for (const voll of [false, true]) {
      const { ctx, p } = await neueSeite(b, { farbe, breite });
      await p.click('#leiste [data-tab="graphs"]');
      await p.waitForSelector('#graphs .mg-svg .mg-sonne', { timeout: 10000 });
      if (voll) { await p.click('#graphs .mg-btn-voll'); }
      await p.waitForTimeout(700);
      await p.evaluate(() => { const w = document.querySelector('#graphs .mg-ax-wert'); if (w) w.hidden = false; });   // die Marke zeigt sich sonst nur beim Antippen
      const l = await p.evaluate(GROESSEN_JS), name = farbe + ' ' + breite + (voll ? ' Vollbild' : '');
      const klein = l.filter(x => x.px < 10.95);
      pruefe(name + ': ' + l.length + ' Texte, keiner unter 11 px gezeichnet', l.length > 20 && !klein.length, klein.slice(0, 6));
      if (breite === 390) {
        const schwach = [], proben = await p.evaluate(PROBEN_JS);
        for (const q of proben) {
          const png = (await p.screenshot({ clip: { x: q.x, y: q.y, width: q.w, height: q.h } })).toString('base64');
          const k = await p.evaluate(PIXEL_JS, { png, fill: q.fill });
          if (k < 4.5) schwach.push({ t: q.t, cls: q.cls, k });
        }
        pruefe(name + ': ' + proben.length + ' Proben (je Klasse bis 3), Kontrast gegen den echten Untergrund mindestens 4,5:1', proben.length > 8 && !schwach.length, schwach.slice(0, 8));
      }
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

    console.log('5) Fokus nach Ortswechsel und „Karte öffnen“ im neuen Reiter');
    {
      const { ctx, p } = await neueSeite(b);
      const im = sel => p.evaluate(s => { const a = document.activeElement; return !!a && a !== document.body && !!a.closest(s); }, sel);
      await p.click('#radarAuf');
      await p.waitForTimeout(500);
      pruefe('Nach „Karte öffnen“ liegt der Fokus im Reiter Rad/Sat', await im('#tab-radsat'), await p.evaluate(() => document.activeElement.tagName));
      await p.click('#kopfSuche');
      await p.keyboard.type('Heidelberg');
      await p.waitForSelector('[data-treffer]', { timeout: 5000 });
      await p.click('[data-treffer="0"]');
      await p.waitForTimeout(500);
      pruefe('Nach der Ortswahl liegt der Fokus im Reiter Wetter', await im('#tab-wetter'), await p.evaluate(() => document.activeElement.tagName));
      await ctx.close();
    }
  } finally {
    await b.close(); s.close();
  }
  console.log('\n' + ok + ' Prüfungen bestanden, ' + fehler + ' fehlgeschlagen.');
  process.exit(fehler ? 1 : 0);
})();
