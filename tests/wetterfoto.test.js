/* tests/wetterfoto.test.js – Wetterfoto (Kamera-Studio) in der WeddaApp, 20.10.2026
   Start:  NODE_PATH="<Ordner mit playwright>/node_modules" node tests/wetterfoto.test.js
           (die WeddaApp hat keine eigenen Abhängigkeiten; Playwright z. B. aus „Wetter Apps/WetterPro Camera App/node_modules“)
   Startet einen kleinen Server auf Port 8892 und prüft die App in WebKit (Browser-Kern von Safari).
   Ohne Netz: Open-Meteo antwortet mit tests/fixtures/open-meteo-mannheim.json (echte Antwort vom 20.10.2026), Bright Sky mit „nicht gefunden“, alles andere wird abgewiesen.
   Bildschirmfotos landen in /tmp/weddaapp-tests/. Exit-Code 0 = alles grün, 1 = mindestens ein Fehler. */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { webkit } = require('playwright');

const WURZEL = path.join(__dirname, '..');
const PORT = +process.env.PORT || 8892;
const BASIS = 'http://127.0.0.1:' + PORT + '/';
const BILDER = process.env.BILDER || '/tmp/weddaapp-tests';   // vor Bildern 0,5 s warten: Reiter blenden ein
const FOTO = path.join(__dirname, 'fixtures', 'foto.jpg');
const OM = fs.readFileSync(path.join(__dirname, 'fixtures', 'open-meteo-mannheim.json'), 'utf8');
fs.mkdirSync(BILDER, { recursive: true });

let ok = 0, fehler = 0;
function pruefe(name, bedingung, detail) {
  if (bedingung) { ok++; console.log('  ✓ ' + name); }
  else { fehler++; console.log('  ✗ ' + name + (detail !== undefined ? '  → ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '')); }
}

/* ---------- kleiner Server für die App-Dateien ---------- */
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

/* ---------- fremde Dienste auf feste Antworten umleiten ---------- */
async function umleiten(ctx, modus) {
  await ctx.route(u => /^https?:$/.test(u.protocol) && !u.href.startsWith(BASIS), route => {   // blob:-Adressen (Foto im Studio) nicht anfassen
    const u = new URL(route.request().url());
    const json = (text, status) => route.fulfill({ status: status || 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: text });
    if (u.host === 'api.open-meteo.com') return modus.omAus === 'langsam' ? setTimeout(() => route.abort(), 1500) : modus.omAus ? route.abort() : json(OM);
    if (u.host === 'api.brightsky.dev') return json('{"title":"Not Found"}', 404);
    return route.abort();
  });
}

async function neueSeite(b, o) {
  o = o || {};
  const ctx = await b.newContext({ viewport: { width: o.breite || 390, height: o.hoehe || 844 }, colorScheme: o.farbe || 'light', serviceWorkers: o.sw ? 'allow' : 'block' });
  const modus = { omAus: !!o.omAus };
  await umleiten(ctx, modus);
  if (o.engineSperren) await ctx.route('**/lib/kamera-studio/ks-engine.js', r => r.abort());
  const p = await ctx.newPage(), probleme = [];
  p.on('pageerror', e => probleme.push('JS: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|access control|net::|abgewiesen|Load failed/i.test(m.text())) probleme.push('Konsole: ' + m.text()); });
  if (o.fremderSpeicher) await ctx.addInitScript(() => { if (window.caches) caches.open('fremde-app-v1'); });   // Speicher einer anderen App unter derselben Adresse
  if (o.speicher) await ctx.addInitScript(s => { Object.keys(s).forEach(k => localStorage.setItem(k, s[k])); }, o.speicher);
  await p.goto(BASIS + (o.adresse || ''));
  await p.waitForSelector(o.omAus ? '#leiste button' : '.aktuell-kachel', { timeout: 10000 });
  return { ctx, p, probleme, modus };
}
const studioDa = p => p.evaluate(() => !document.getElementById('studio').hidden && !!document.querySelector('#ksWurzel .ks'));
const inst = p => p.evaluate(() => { const r = document.querySelector('#ksWurzel .ks'), i = r && r._ksInst; return i ? { foto: !!i.quelle, wetter: i.wetter, variante: i.variante, optionen: i.optionen } : null; });

(async () => {
  const s = await server(), b = await webkit.launch();
  try {
    console.log('1) Zugangsknopf und Studio');
    {
      const { ctx, p, probleme } = await neueSeite(b);
      const leiste = await p.$$eval('#leiste button', bs => bs.map(x => ({ zugang: x.hasAttribute('data-zugang'), klasse: x.className, name: x.getAttribute('aria-label') })));
      pruefe('Tab-Leiste: 5 Knöpfe, Wetterfoto auf Platz 3, rund', leiste.length === 5 && leiste[2].zugang && /zugang-rund/.test(leiste[2].klasse), leiste);
      pruefe('Wetterfoto-Knopf hat einen Namen', leiste[2] && leiste[2].name === 'Wetterfoto – Foto aufnehmen', leiste[2]);
      const tipp = await p.$eval('#leiste [data-zugang]', e => { const r = e.getBoundingClientRect(); return [r.width, r.height]; });
      pruefe('Wetterfoto-Knopf mindestens 44 × 44 px', tipp[0] >= 44 && tipp[1] >= 44, tipp);
      await p.waitForFunction(() => window.KSStudio, null, { timeout: 8000 });
      pruefe('Studio wird nach dem Start im Hintergrund geladen', await p.evaluate(() => !!window.KSStudio && !!window.KSEngine));
      const [fc] = await Promise.all([p.waitForEvent('filechooser', { timeout: 4000 }).catch(() => null), p.click('#leiste [data-zugang]')]);
      pruefe('Antippen öffnet gleich die Kamera (Datei-Auswahl mit capture)', !!fc && (await fc.element().getAttribute('capture')) === 'environment');
      pruefe('Studio ist offen', await studioDa(p));
      if (fc) await fc.setFiles(FOTO);
      await p.waitForFunction(() => { const r = document.querySelector('#ksWurzel .ks'); return r && r._ksInst && r._ksInst.quelle; }, null, { timeout: 8000 }).catch(() => {});
      const i = await inst(p);
      pruefe('Foto ist geladen', i && i.foto, i);
      pruefe('Einstellung aus dem Link: Ein-Tipp-Karte, Auslöser frei, Galerie 3/5, Studio zuerst',
        i && i.variante === 'schnell' && i.optionen.ausloeserOrt === 'frei' && i.optionen.galerieOriginale === 3 && i.optionen.galerieBearbeitet === 5 && i.optionen.vorschauStart === 'studio', i && i.optionen);
      pruefe('Nutzer darf: Auslöser und Sucher am Zahnrad, Galerie nicht', i && JSON.stringify(i.optionen.nutzerDarf) === JSON.stringify({ zugang: [], ausloeser: ['studio'], galerie: [], sucher: ['studio'] }), i && i.optionen.nutzerDarf);
      const w = i && i.wetter;
      pruefe('Wetter der App im Studio: Mannheim, 7,7 °C, Heiter, Wind NW, Open-Meteo', w && w.ort.stadt === 'Mannheim' && w.temp === 7.7 && w.lage === 'Heiter' && w.windRichtung === 'NW' && w.modell === 'Open-Meteo', w);
      pruefe('Wetter mit Zeitzone, Druck, UV, Sonnenzeiten', w && w.zeit === '2026-10-20T10:30:00+02:00' && w.druck === 1016.1 && w.uv === 2.7 && w.sonnenaufgang === '07:55' && w.sonnenuntergang === '18:26', w);
      await p.waitForFunction(() => [...document.querySelectorAll('#ksWurzel button')].some(x => x.textContent.trim() === 'Teilen'), null, { timeout: 8000 }).catch(() => {});   // erst „Wird vorbereitet …“
      const teilen = await p.$$eval('#ksWurzel button', bs => bs.filter(x => x.getClientRects().length).map(x => x.textContent.trim()));
      const zahnrad = await p.$('#ksWurzel [data-akt="nutzer-oeffnen"]');
      pruefe('Teilen-Knopf und Zahnrad im Studio', teilen.includes('Teilen') && !!zahnrad, teilen.slice(0, 20));
      pruefe('Kein Textvorschlag von Claude (braucht einen Server)', !teilen.some(t => /Claude|Textvorschlag/.test(t)));
      pruefe('Kein seitliches Scrollen mit Studio', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await p.screenshot({ path: BILDER + '/studio-390-hell.png' });
      await p.click('#studioZu'); await p.waitForTimeout(200);
      pruefe('„Fertig“ schließt das Studio und räumt es ab', await p.evaluate(() => document.getElementById('studio').hidden && !document.querySelector('#ksWurzel .ks') && document.body.style.overflow === ''));
      pruefe('Fokus zurück auf dem Wetterfoto-Knopf', await p.evaluate(() => document.activeElement && document.activeElement.hasAttribute('data-zugang')));
      await p.click('#kopfTeilen'); await p.waitForTimeout(200);
      pruefe('Teilen-Knopf oben öffnet das Studio (ohne Kamera)', await studioDa(p));
      await p.keyboard.press('Escape'); await p.waitForTimeout(200);
      pruefe('Esc schließt das Studio', !(await studioDa(p)));
      pruefe('Keine Fehler in der Konsole', probleme.length === 0, probleme);
      await ctx.close();
    }

    console.log('2) Zugangsknopf an allen Orten (Einstellung unter „Mehr“)');
    {
      const { ctx, p, probleme } = await neueSeite(b);
      await p.click('[data-tab="mehr"]');
      pruefe('Abschnitt „Wetterfoto“ unter Mehr', await p.$('#wf-titel') !== null);
      await p.waitForFunction(() => window.KSStudio);
      const knopfDa = sel => p.$(sel).then(x => !!x);
      await p.click('[data-zo="kopf"]');
      pruefe('Kopfzeile: Knopf rechts außen', await p.evaluate(() => { const k = document.querySelector('#kopf .zugang-kopf'); return !!k && k.previousElementSibling && k.previousElementSibling.id === 'kopfTeilen'; }));
      pruefe('Kopfzeile: Tab-Leiste ohne Wetterfoto (4 Knöpfe)', (await p.$$('#leiste button')).length === 4);
      await p.click('[data-zp="links-aussen"]');
      pruefe('Kopfzeile links außen', await p.evaluate(() => { const k = document.querySelector('#kopf .zugang-kopf'); return !!k && k.nextElementSibling && k.nextElementSibling.id === 'kopfOrte'; }));
      await p.click('[data-zo="schwebend"]');
      pruefe('Schwebend unten rechts, nicht mehr in der Kopfzeile', await knopfDa('body > .zugang-schwebend.zugang-pos-ur') && !(await knopfDa('#kopf .zugang-kopf')));
      const lage = await p.evaluate(() => { const k = document.querySelector('.zugang-schwebend').getBoundingClientRect(), l = document.getElementById('leiste').getBoundingClientRect(); return { k: k.bottom, l: l.top, r: innerWidth - k.right }; });
      pruefe('Schwebend liegt über der Tab-Leiste', lage.k <= lage.l, lage);
      await p.waitForTimeout(500); await p.screenshot({ path: BILDER + '/zugang-schwebend.png' });
      await p.click('[data-zo="mehr"]');
      pruefe('Im Tab „Mehr“: erste Zeile mit Text', await p.evaluate(() => { const k = document.querySelector('#tab-mehr .zugang-mehr [data-zugang]'); return !!k && /Wetterfoto/.test(k.textContent); }));
      pruefe('Im Tab „Mehr“: Aussehen nur Symbol und Text oder Text-Knopf', (await p.$$eval('[data-zs]', bs => bs.map(x => x.dataset.zs))).join() === 'symbolText,pille');
      await p.click('[data-zo="kachel"]');
      await p.click('[data-tab="wetter"]');
      pruefe('Kachel ganz oben auf dem Startbildschirm', await p.evaluate(() => { const r = document.querySelector('#tab-wetter .raster'); return !!r && r.firstElementChild.classList.contains('zugang-kachel'); }));
      await p.waitForTimeout(500); await p.screenshot({ path: BILDER + '/zugang-kachel.png' });
      const [fc] = await Promise.all([p.waitForEvent('filechooser', { timeout: 4000 }).catch(() => null), p.click('.zugang-kachel [data-zugang]')]);
      pruefe('Kachel öffnet Kamera und Studio', !!fc && await studioDa(p));
      await p.click('#studioZu');
      await p.click('[data-tab="mehr"]'); await p.click('[data-zo="tab"]'); await p.click('[data-zp="1"]'); await p.click('[data-zs="symbolText"]');
      const erster = await p.$eval('#leiste button', x => ({ zugang: x.hasAttribute('data-zugang'), text: x.textContent }));
      pruefe('Tab-Leiste Platz 1 mit Symbol und Text', erster.zugang && erster.text === 'Wetterfoto', erster);
      pruefe('Wahl gemerkt (eigene Schlüssel wedda-wf-…, nicht die des Studios)', await p.evaluate(() => localStorage.getItem('wedda-wf-zugangOrt') === '"tab"' && localStorage.getItem('wedda-wf-zugangPlatz') === '"1"' && localStorage.getItem('wedda-wf-zugangAussehen') === '"symbolText"' && localStorage.getItem('ks-nutzer-zugangOrt') === null));
      await p.click('#wfZurueck');
      const zurueck = await p.$$eval('#leiste button', bs => bs.map(x => x.hasAttribute('data-zugang')));
      pruefe('Zurücksetzen: wieder Platz 3', zurueck.indexOf(true) === 2 && await p.evaluate(() => localStorage.getItem('wedda-wf-zugangOrt') === null), zurueck);
      pruefe('Keine Fehler in der Konsole', probleme.length === 0, probleme);
      await ctx.close();
    }

    console.log('3) Gemerkte Wahl beim Start, alte Wege, Direktlink');
    {
      let r = await neueSeite(b, { speicher: { 'wedda-wf-zugangOrt': '"kopf"', 'wedda-wf-zugangPlatz': '"rechts-innen"', 'wedda-wf-zugangAussehen': '"pille"' } });
      pruefe('Gemerkte Wahl gilt beim Start (Kopfzeile rechts innen, Text-Knopf)', await r.p.evaluate(() => { const k = document.querySelector('#kopf .zugang-pille'); return !!k && k.nextElementSibling.id === 'kopfSuche' && k.textContent === 'Wetterfoto'; }));
      await r.ctx.close();
      r = await neueSeite(b, { speicher: { 'wedda-wf-zugangOrt': '"quatsch"', 'wedda-wf-zugangAussehen': '"pille"', 'ks-nutzer-zugangOrt': 'kopf' } });
      pruefe('Ungültige Wahl fällt auf Platz 3 rund zurück; Schlüssel des Konfigurators (ks-nutzer-…) wirken nicht', await r.p.evaluate(() => { const k = document.querySelectorAll('#leiste button')[2]; return k.hasAttribute('data-zugang') && k.classList.contains('zugang-rund'); }));
      await r.ctx.close();
      r = await neueSeite(b);
      const frueh = await r.p.evaluate(() => !window.KSStudio);
      await r.p.click('#leiste [data-zugang]');
      const laedt = await r.p.evaluate(() => !document.getElementById('studio').hidden && /geladen/.test(document.getElementById('ksWurzel').textContent));
      await r.p.waitForFunction(() => document.querySelector('#ksWurzel .ks'), null, { timeout: 8000 }).catch(() => {});
      pruefe('Sehr frühes Antippen: „wird geladen“, dann Studio mit „Foto aufnehmen“', frueh && laedt && await r.p.evaluate(() => [...document.querySelectorAll('#ksWurzel button')].some(x => /Foto aufnehmen/.test(x.textContent))), { frueh, laedt });
      await r.ctx.close();
      r = await neueSeite(b, { adresse: '?kamera=1' });
      await r.p.waitForFunction(() => document.querySelector('#ksWurzel .ks'), null, { timeout: 8000 }).catch(() => {});
      pruefe('?kamera=1 öffnet das Studio', await studioDa(r.p));
      pruefe('Keine Fehler in der Konsole', r.probleme.length === 0, r.probleme);
      await r.ctx.close();
      r = await neueSeite(b, { adresse: '?teilen=alt' });
      await r.p.click('#leiste [data-zugang]'); await r.p.waitForTimeout(300);
      pruefe('?teilen=alt: alter Teilen-Bildschirm zum Vergleich', await r.p.evaluate(() => !document.getElementById('teilen').hidden && document.getElementById('studio').hidden && !window.KSStudio));
      await r.ctx.close();
    }

    console.log('4) Dunkel, quer, große Schrift');
    {
      const { ctx, p, probleme } = await neueSeite(b, { farbe: 'dark' });
      await p.waitForFunction(() => window.KSStudio);
      const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('#leiste [data-zugang]')]); await fc.setFiles(FOTO);
      await p.waitForTimeout(1500);
      await p.screenshot({ path: BILDER + '/studio-390-dunkel.png' });
      const farben = await p.evaluate(() => [getComputedStyle(document.getElementById('studio')).backgroundColor, getComputedStyle(document.getElementById('studioZu')).color]);
      pruefe('Dunkel: Studio-Hintergrund dunkel', /rgb\((\d+), (\d+), (\d+)\)/.test(farben[0]) && +RegExp.$1 < 60, farben);
      pruefe('Keine Fehler in der Konsole', probleme.length === 0, probleme);
      await ctx.close();
      const q = await neueSeite(b, { breite: 844, hoehe: 390 });
      await q.p.waitForFunction(() => window.KSStudio);
      await q.p.click('#kopfTeilen'); await q.p.waitForTimeout(800);
      pruefe('Quer: Studio ohne seitliches Scrollen', await q.p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await q.p.screenshot({ path: BILDER + '/studio-quer.png' });
      await q.ctx.close();
      const g = await neueSeite(b);
      await g.p.addStyleTag({ content: 'html { font-size: 130% !important; }' });
      await g.p.waitForFunction(() => window.KSStudio);
      await g.p.click('[data-tab="mehr"]');
      pruefe('130 % Schrift: Wetterfoto-Einstellungen ohne seitliches Scrollen', await g.p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await g.p.$eval('#wf-titel', e => e.scrollIntoView());
      await g.p.waitForTimeout(500); await g.p.screenshot({ path: BILDER + '/mehr-wetterfoto-130.png' });
      await g.ctx.close();
    }

    console.log('5) Offline (Service Worker)');
    {
      const { ctx, p, probleme } = await neueSeite(b, { sw: true, fremderSpeicher: true });
      await p.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 10000 }).catch(() => {});
      pruefe('Service Worker löscht nur eigene Speicher (andere Apps unter derselben Adresse bleiben)', await p.evaluate(() => caches.has('fremde-app-v1')));
      const imSpeicher = await p.evaluate(async () => { const ks = await caches.keys(); const c = await caches.open(ks.find(k => k.startsWith('wedda-'))); const k = (await c.keys()).map(r => new URL(r.url).pathname); return k.filter(x => /kamera-studio/.test(x)).length; });
      pruefe('Alle 4 Studio-Dateien im Offline-Speicher', imSpeicher === 4, imSpeicher);
      await ctx.setOffline(true);
      await p.reload(); await p.waitForSelector('#leiste [data-zugang]', { timeout: 8000 });
      await p.waitForFunction(() => window.KSStudio, null, { timeout: 8000 }).catch(() => {});
      await p.click('#kopfTeilen'); await p.waitForTimeout(500);
      pruefe('Offline: Studio lädt aus dem Speicher und öffnet', await studioDa(p));
      pruefe('Keine Fehler in der Konsole', probleme.length === 0, probleme);
      await ctx.close();
    }

    console.log('6) Funde der zweiten Meinung');
    {
      // Fokus zurück, auch wenn der Knopf inzwischen neu gezeichnet wurde
      let r = await neueSeite(b, { speicher: { 'wedda-wf-zugangOrt': '"kachel"' } });
      await r.p.waitForFunction(() => window.KSStudio);
      let [fc] = await Promise.all([r.p.waitForEvent('filechooser'), r.p.click('.zugang-kachel [data-zugang]')]); await fc.setFiles(FOTO);
      pruefe('Hintergrund gesperrt, solange das Wetterfoto offen ist', await r.p.evaluate(() => ['kopf', 'inhalt', 'leiste'].every(id => document.getElementById(id).hasAttribute('inert'))));
      const alt = await r.p.evaluate(() => { window.__alt = document.querySelector('.zugang-kachel [data-zugang]'); window.dispatchEvent(new Event('online')); return true; });
      await r.p.waitForFunction(() => !window.__alt.isConnected, null, { timeout: 5000 }).catch(() => {});
      pruefe('Neue Wetterdaten bei offenem Studio: Foto bleibt', alt && (await inst(r.p)).foto);
      await r.p.click('#studioZu');
      pruefe('Fokus nach „Fertig“ auf dem neu gezeichneten Wetterfoto-Knopf', await r.p.evaluate(() => !window.__alt.isConnected && document.activeElement.hasAttribute('data-zugang') && document.activeElement.isConnected));
      pruefe('Hintergrund nach dem Schließen wieder frei', await r.p.evaluate(() => !document.querySelector('[inert]')));
      // Neuladen scheitert, während das Studio offen ist: gemerkte Werte bleiben im Studio
      r.modus.omAus = 'langsam';   // Antwort kommt erst nach 1,5 s und scheitert dann; das Studio öffnet währenddessen
      await r.p.evaluate(() => window.dispatchEvent(new Event('online')));
      await r.p.click('#kopfTeilen');
      const w0 = (await inst(r.p)).wetter;
      await r.p.waitForTimeout(2200);
      const w = (await inst(r.p)).wetter;
      pruefe('Studio öffnet während des Neuladens: gemerkte Werte (7,7 °C)', w0 && w0.temp === 7.7, w0);
      pruefe('Neuladen scheitert: Studio behält die gemerkten Werte', w && w.temp === 7.7, w);
      // Esc mit offenem Blatt schließt nur das Blatt
      await r.p.click('#studioZu');
      [fc] = await Promise.all([r.p.waitForEvent('filechooser'), r.p.click('.zugang-kachel [data-zugang]')]); await fc.setFiles(FOTO);
      await r.p.waitForFunction(() => [...document.querySelectorAll('#ksWurzel button')].some(x => /Dateiart/.test(x.textContent)), null, { timeout: 8000 }).catch(() => {});
      await r.p.click('#ksWurzel button:has-text("Dateiart")');
      await r.p.waitForTimeout(300);
      const blatt = await r.p.evaluate(() => !!document.querySelector('#ksWurzel .ks-blatt'));
      await r.p.keyboard.press('Escape'); await r.p.waitForTimeout(300);
      pruefe('Esc mit offenem Blatt schließt nur das Blatt, nicht das Wetterfoto', blatt && await studioDa(r.p) && await r.p.evaluate(() => !document.querySelector('#ksWurzel .ks-blatt')), { blatt });
      await r.p.keyboard.press('Escape'); await r.p.waitForTimeout(300);
      pruefe('Zweites Esc schließt das Wetterfoto', !(await studioDa(r.p)));
      pruefe('Keine Fehler in der Konsole', r.probleme.length === 0, r.probleme);
      await r.ctx.close();
      // Ohne Wetterdaten: Ortszeit mit Versatz statt UTC
      r = await neueSeite(b, { omAus: true });
      await r.p.waitForFunction(() => window.KSStudio);
      await r.p.click('#kopfTeilen'); await r.p.waitForTimeout(300);
      const z = await r.p.evaluate(() => { const w = document.querySelector('#ksWurzel .ks')._ksInst.wetter; return { zeit: w.zeit, temp: w.temp, h: new Date().getHours() }; });
      pruefe('Ohne Wetterdaten: Ortszeit mit Versatz, keine Wetterwerte', /T\d\d:\d\d:00[+-]\d\d:\d\d$/.test(z.zeit) && +z.zeit.slice(11, 13) === z.h && z.temp === undefined, z);
      await r.ctx.close();
      // Studio-Datei fehlt: Meldung mit „Erneut versuchen“, danach klappt es, ohne doppelte Dateien
      r = await neueSeite(b, { engineSperren: true });
      await r.p.waitForTimeout(2500);   // Vorladen schlägt fehl
      await r.p.click('#kopfTeilen');
      await r.p.waitForSelector('#studioNochmal', { timeout: 5000 }).catch(() => {});
      pruefe('Laden scheitert: Meldung mit „Erneut versuchen“', !!(await r.p.$('#studioNochmal')));
      pruefe('Nach dem Fehlschlag keine halben Studio-Dateien in der Seite', await r.p.evaluate(() => document.querySelectorAll('head [src*="kamera-studio"], head [href*="kamera-studio"]').length === 0));
      await r.ctx.unroute('**/lib/kamera-studio/ks-engine.js');
      await r.p.click('#studioNochmal');
      await r.p.waitForFunction(() => document.querySelector('#ksWurzel .ks'), null, { timeout: 8000 }).catch(() => {});
      pruefe('„Erneut versuchen“ öffnet das Studio, jede Datei genau einmal', await studioDa(r.p) && await r.p.evaluate(() => document.querySelectorAll('head [src*="kamera-studio"], head [href*="kamera-studio"]').length === 4));
      await r.ctx.close();
    }
  } catch (e) { fehler++; console.log('  ✗ Abbruch: ' + (e && e.stack || e)); }
  await b.close(); s.close();
  console.log('\n' + ok + ' Prüfungen bestanden, ' + fehler + ' fehlgeschlagen. Bildschirmfotos: ' + BILDER);
  process.exit(fehler ? 1 : 0);
})();
