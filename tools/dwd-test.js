#!/usr/bin/env node
/* tools/dwd-test.js – prüft dwd.js mit echten Daten von Open-Meteo und Bright Sky (braucht Netz).
   Aufruf:  node tools/dwd-test.js   Exit-Code 1, wenn ein Test scheitert. */
'use strict';
const assert = require('assert');
const DWD = require('../dwd.js');

const MANNHEIM = { lat: 49.4875, lon: 8.466 }, CORRALEJO = { lat: 28.73079, lon: -13.86749 };
const om = o => fetch('https://api.open-meteo.com/v1/forecast?latitude=' + o.lat + '&longitude=' + o.lon +
  '&current=temperature_2m,apparent_temperature,relative_humidity_2m,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m' +
  '&hourly=temperature_2m,weather_code,is_day,precipitation,precipitation_probability,sunshine_duration,cloud_cover' +
  '&daily=weather_code,temperature_2m_max,temperature_2m_min,sunshine_duration,daylight_duration,cloud_cover_mean,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset' +
  '&forecast_days=8&timezone=auto&wind_speed_unit=kmh&models=best_match').then(r => r.json());

let fehler = 0;
async function test(name, f) {
  try { await f(); console.log('ok   ' + name); } catch (e) { fehler++; console.log('FEHL ' + name + '\n     ' + e.message); }
}
const nah = (a, b, eps) => Math.abs(a - b) <= (eps || 1e-6);

(async () => {
  const [jM, dM] = await Promise.all([om(MANNHEIM), DWD.holen(MANNHEIM)]);

  await test('Mannheim: Bright Sky liefert Vorhersage einer nahen Station', () => {
    assert(dM && dM.vorhersage, 'keine Vorhersage');
    assert(dM.vorhersage.distanz <= DWD.MAX_DIST, 'Station zu weit: ' + dM.vorhersage.distanz);
    assert(Object.keys(dM.vorhersage.stunden).length >= 24 * 7, 'zu wenige Stunden');
    console.log('     Station ' + dM.vorhersage.station + ', ' + (dM.vorhersage.distanz / 1000).toFixed(1) + ' km');
  });

  const neu = DWD.einmischen(jM, dM);
  await test('Mannheim: Stundenwerte kommen vom DWD', () => {
    let n = 0;
    neu.hourly.time.forEach((t, i) => {
      const x = dM.vorhersage.stunden[t]; if (!x) return; n++;
      assert.strictEqual(neu.hourly.temperature_2m[i], x[0], 'Temperatur ' + t);
      if (x[2] != null) assert.strictEqual(neu.hourly.sunshine_duration[i], x[2] * 60, 'Sonne ' + t);
      if (x[4] != null) assert.strictEqual(neu.hourly.precipitation_probability[i], x[4], 'Wahrscheinlichkeit ' + t);
    });
    assert(n >= 24 * 7, 'nur ' + n + ' Stunden ersetzt');
    assert.strictEqual(neu._dwd.station, dM.vorhersage.station);
    assert.notStrictEqual(neu.hourly.temperature_2m, jM.hourly.temperature_2m, 'Original wurde verändert');
  });

  await test('Mannheim: Tageswerte stimmen mit den Stundenwerten überein', () => {
    neu.daily.time.forEach((tag, ti) => {
      const idx = neu.hourly.time.map((t, i) => t.slice(0, 10) === tag ? i : -1).filter(i => i >= 0);
      const w = f => idx.map(i => neu.hourly[f][i]).filter(v => v != null);
      assert(nah(neu.daily.temperature_2m_max[ti], Math.max(...w('temperature_2m'))), 'Max ' + tag);
      assert(nah(neu.daily.temperature_2m_min[ti], Math.min(...w('temperature_2m'))), 'Min ' + tag);
      assert(nah(neu.daily.precipitation_sum[ti], w('precipitation').reduce((s, v) => s + v, 0), 0.051), 'Regen ' + tag);
      assert(nah(neu.daily.sunshine_duration[ti], w('sunshine_duration').reduce((s, v) => s + v, 0)), 'Sonne ' + tag);
      assert(nah(neu.daily.precipitation_probability_max[ti], Math.max(...w('precipitation_probability'))), 'Wahrscheinlichkeit ' + tag);
    });
    const i = 1;
    console.log('     ' + neu.daily.time[i] + ': OM ' + jM.daily.temperature_2m_max[i] + '° / ' + (jM.daily.sunshine_duration[i] / 3600).toFixed(1) + ' h Sonne / ' + jM.daily.precipitation_sum[i] + ' mm' +
      '  →  DWD ' + neu.daily.temperature_2m_max[i] + '° / ' + (neu.daily.sunshine_duration[i] / 3600).toFixed(1) + ' h / ' + neu.daily.precipitation_sum[i] + ' mm / ' + neu.daily.precipitation_probability_max[i] + ' %');
  });

  await test('Mannheim: Aktuell aus frischer Messung, Zeile mit Station', () => {
    assert(dM.messung, 'keine Messung (Station meldet gerade nicht?)');
    const frisch = DWD.einmischen(jM, dM, dM.messung.zeit + 30 * 60e3);
    assert.strictEqual(frisch.current.temperature_2m, dM.messung.t);
    assert(frisch._dwd.messung && frisch._dwd.messung.station, 'Stationsname fehlt');
    console.log('     Gemessen: Station ' + frisch._dwd.messung.station + ', ' + frisch._dwd.messung.uhr + ' Uhr, ' + dM.messung.t + ' °C (Open-Meteo: ' + jM.current.temperature_2m + ' °C)');
  });

  await test('Mannheim: Messung älter als 90 Minuten wird ignoriert', () => {
    const alt = DWD.einmischen(jM, dM, dM.messung.zeit + 91 * 60e3);
    assert.strictEqual(alt.current.temperature_2m, jM.current.temperature_2m);
    assert(!alt._dwd || !alt._dwd.messung);
  });

  await test('Corralejo: kein Abruf, bleibt Open-Meteo', async () => {
    let abgerufen = false;
    const d = await DWD.holen(CORRALEJO, () => { abgerufen = true; return Promise.reject(new Error('x')); });
    assert.strictEqual(d, null); assert(!abgerufen, 'Bright Sky wurde trotzdem gefragt');
    const jC = await om(CORRALEJO);
    assert.strictEqual(DWD.einmischen(jC, d), jC);
  });

  await test('Bright Sky nicht erreichbar oder Fehler 500: null, kein Absturz', async () => {
    assert.strictEqual(await DWD.holen(MANNHEIM, () => Promise.reject(new TypeError('Failed to fetch'))), null);
    assert.strictEqual(await DWD.holen(MANNHEIM, () => Promise.resolve({ ok: false, status: 500 })), null);
    assert.strictEqual(await DWD.holen(MANNHEIM, () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })), null);
  });

  await test('Tagescode: Regen nur mit Menge, trocken → „bedeckt“ zum Aufhellen', () => {
    const t = jM.daily.time[2], stunden = {};
    jM.hourly.time.forEach(z => { if (z.slice(0, 10) === t) stunden[z] = [10, 0, 0, 100, 5, 61]; });
    let d = DWD.einmischen(jM, { vorhersage: { station: 'X', distanz: 1, stunden } });
    assert.strictEqual(d.daily.weather_code[2], jM.daily.weather_code[2] === 45 || jM.daily.weather_code[2] === 48 ? jM.daily.weather_code[2] : 3);
    Object.keys(stunden)[12] && (stunden[Object.keys(stunden)[12]] = [10, 1.2, 0, 100, 80, 63]);
    d = DWD.einmischen(jM, { vorhersage: { station: 'X', distanz: 1, stunden } });
    assert.strictEqual(d.daily.weather_code[2], 63);
    assert.strictEqual(d.daily.precipitation_sum[2], 1.2);
  });

  console.log(fehler ? '\n' + fehler + ' Test(s) gescheitert' : '\nAlle Tests bestanden');
  process.exit(fehler ? 1 : 0);
})();
