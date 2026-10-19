/* dwd.js – DWD-Vorhersage (MOSMIX) und Stationsmessung über Bright Sky (brightsky.dev, DWD-Daten CC BY 4.0, ohne Schlüssel)
   Open-Meteo bleibt das Grundgerüst. Liegt eine DWD-Vorhersagestation nah genug, ersetzen ihre Stundenwerte Temperatur, Regen,
   Sonne, Bewölkung, Regenwahrscheinlichkeit und Wettercode; die Tageswerte werden daraus neu berechnet.
   „Aktuell“ nimmt die Messung der nächsten Station, wenn sie frisch genug ist. Läuft im Browser (window.WeddaDWD) und in Node (Tests). */
(function (wurzel) {
  'use strict';

  var BRIGHTSKY = 'https://api.brightsky.dev/';
  var MAX_DIST = 25000;                 // Meter bis zur Station
  var MESSUNG_MAX_ALTER = 90 * 60e3;    // ältere Messungen werden ignoriert
  var ZEITLIMIT = 8000;                 // Bright Sky darf den Start höchstens so lange aufhalten
  var TZ = 'Europe/Berlin';

  // Grob Deutschland und Nachbarn, nur dort hat MOSMIX dichte Stationen; spart den Abruf für Fuerteventura
  function inReichweite(o) { return o.lat >= 47 && o.lat <= 55.2 && o.lon >= 5.5 && o.lon <= 15.5; }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function isoDatum(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  // „RHEINBR.MANNHEIM“ → „Rheinbr.Mannheim“; gemischte Schreibung bleibt
  function stationsName(n) {
    n = String(n || '');
    return n === n.toUpperCase() ? n.toLowerCase().replace(/(^|[\s.\-\/(])(\S)/g, function (a, v, b) { return v + b.toUpperCase(); }) : n;
  }

  // Bright Sky (condition, icon) → WMO-Code wie bei Open-Meteo (aus WetterProCamera übernommen)
  function wmo(bed, ikon, wolken, nied) {
    var c = bed || '', i = ikon || '', n = nied || 0;
    if (c === 'thunderstorm' || i === 'thunderstorm') return 95;
    if (c === 'hail' || i === 'hail') return 96;
    if (c === 'snow' || i === 'snow') return n >= 1.5 ? 75 : n >= 0.5 ? 73 : 71;
    if (c === 'sleet' || i === 'sleet') return 66;
    if (c === 'rain' || i === 'rain') return n >= 4 ? 65 : n >= 1 ? 63 : 61;
    if (c === 'fog' || i === 'fog') return 45;
    if (i.indexOf('clear') === 0) return wolken != null && wolken > 12 ? 1 : 0;
    if (i.indexOf('partly-cloudy') === 0) return 2;
    if (i === 'cloudy') return 3;
    return wolken == null ? 3 : wolken < 15 ? 0 : wolken < 40 ? 1 : wolken < 75 ? 2 : 3;
  }
  // Gefühlte Temperatur (Formel des australischen Wetterdienstes: Temperatur, Feuchte, Wind in km/h)
  function gefuehlt(t, feuchte, kmh) {
    if (t == null || feuchte == null || kmh == null) return null;
    var e = feuchte / 100 * 6.105 * Math.exp(17.27 * t / (237.7 + t));
    return t + .33 * e - .7 * (kmh / 3.6) - 4;
  }

  // Vorhersage auf das Nötige kürzen (passt so in localStorage): nur Zeilen von Vorhersagestationen bis MAX_DIST
  // stunden['JJJJ-MM-TTTHH:MM'] = [Temperatur, Regen mm, Sonne min, Wolken %, Regenwahrscheinlichkeit %, WMO-Code]
  function vorhersageKurz(antw) {
    var quellen = {}, naechste = null;
    ((antw && antw.sources) || []).forEach(function (s) {
      if (s.observation_type !== 'forecast' || !(s.distance <= MAX_DIST)) return;
      quellen[s.id] = s; if (!naechste || s.distance < naechste.distance) naechste = s;
    });
    var stunden = {}, n = 0;
    ((antw && antw.weather) || []).forEach(function (x) {
      if (!quellen[x.source_id] || x.temperature == null) return;
      stunden[x.timestamp.slice(0, 16)] = [x.temperature, x.precipitation, x.sunshine, x.cloud_cover, x.precipitation_probability, wmo(x.condition, x.icon, x.cloud_cover, x.precipitation)];
      n++;
    });
    return n >= 24 ? { station: stationsName(naechste.station_name), distanz: naechste.distance, stunden: stunden } : null;
  }
  function messungKurz(akt) {
    var w = akt && akt.weather, s = w && akt.sources && akt.sources.filter(function (q) { return q.id === w.source_id; })[0];
    if (!w || !s || !(s.distance <= MAX_DIST) || w.temperature == null || !w.timestamp) return null;
    return {
      zeit: Date.parse(w.timestamp), uhr: w.timestamp.slice(11, 16), station: stationsName(s.station_name),
      t: w.temperature, feuchte: w.relative_humidity, wind: w.wind_speed_10, richtung: w.wind_direction_10, boeen: w.wind_gust_speed_10, regen: w.precipitation_60
    };
  }

  function json(adresse, holer) {
    var steuer = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var uhr = setTimeout(function () { if (steuer) steuer.abort(); }, ZEITLIMIT);
    return holer(adresse, steuer ? { signal: steuer.signal } : {}).then(function (r) {
      clearTimeout(uhr); if (!r.ok) throw new Error('Bright Sky: HTTP ' + r.status); return r.json();
    }, function (e) { clearTimeout(uhr); throw e; });
  }
  // Liefert {vorhersage, messung} (jeweils gekürzt oder null) oder null, wenn es für den Ort nichts gibt. Wirft nie.
  function holen(o, holer) {
    holer = holer || (typeof fetch !== 'undefined' && fetch.bind(wurzel));
    if (!holer || !inReichweite(o)) return Promise.resolve(null);
    var q = 'lat=' + o.lat + '&lon=' + o.lon + '&max_dist=' + MAX_DIST + '&tz=' + encodeURIComponent(TZ);
    var heute = new Date();
    var v = json(BRIGHTSKY + 'weather?' + q + '&date=' + isoDatum(heute) + '&last_date=' + isoDatum(new Date(heute.getTime() + 9 * 864e5)), holer).then(vorhersageKurz, function () { return null; });
    var m = json(BRIGHTSKY + 'current_weather?' + q, holer).then(messungKurz, function () { return null; });
    return Promise.all([v, m]).then(function (r) { return r[0] || r[1] ? { vorhersage: r[0], messung: r[1] } : null; });
  }

  function kopie(a) { return a ? a.slice() : []; }
  // Open-Meteo-Antwort j mit den DWD-Werten mischen. Gibt eine neue Antwort zurück (j bleibt unverändert) samt _dwd = {station, messung}.
  // Die Zeitangaben von Open-Meteo (timezone=auto) und Bright Sky (tz=Europe/Berlin) sind für deutsche Orte dieselbe Ortszeit.
  function einmischen(j, dwd, jetzt) {
    if (!j || !j.hourly || !dwd) return j;
    var v = dwd.vorhersage, m = dwd.messung, info = {};
    var h = {}, d = {}, c = {}, k;
    for (k in j.hourly) h[k] = j.hourly[k];
    for (k in j.daily) d[k] = j.daily[k];
    for (k in j.current) c[k] = j.current[k];

    if (v && v.stunden) {
      ['temperature_2m', 'precipitation', 'sunshine_duration', 'cloud_cover', 'weather_code', 'precipitation_probability'].forEach(function (f) { h[f] = kopie(j.hourly[f]); });
      while (h.precipitation_probability.length < h.time.length) h.precipitation_probability.push(null);
      var ersetzt = h.time.map(function (t, i) {
        var x = v.stunden[t]; if (!x) return false;
        h.temperature_2m[i] = x[0];
        if (x[1] != null) h.precipitation[i] = x[1];
        if (x[2] != null) h.sunshine_duration[i] = x[2] * 60;
        if (x[3] != null) h.cloud_cover[i] = x[3];
        if (x[4] != null) h.precipitation_probability[i] = x[4];
        h.weather_code[i] = x[5];
        return true;
      });
      if (ersetzt.some(Boolean) && d.time) {
        ['temperature_2m_max', 'temperature_2m_min', 'precipitation_sum', 'sunshine_duration', 'cloud_cover_mean', 'precipitation_probability_max', 'weather_code'].forEach(function (f) { d[f] = kopie(j.daily[f]); });
        d.time.forEach(function (tag, ti) {
          var idx = []; h.time.forEach(function (t, i) { if (t.slice(0, 10) === tag) idx.push(i); });
          if (!idx.some(function (i) { return ersetzt[i]; })) return;
          var werte = function (f) { return idx.map(function (i) { return h[f][i]; }).filter(function (x) { return x != null; }); };
          var summe = function (f) { return werte(f).reduce(function (s, x) { return s + x; }, 0); };
          var t = werte('temperature_2m'), wo = werte('cloud_cover'), pp = werte('precipitation_probability');
          d.temperature_2m_max[ti] = Math.max.apply(null, t); d.temperature_2m_min[ti] = Math.min.apply(null, t);
          d.precipitation_sum[ti] = Math.round(summe('precipitation') * 10) / 10;
          d.sunshine_duration[ti] = summe('sunshine_duration');
          if (wo.length) d.cloud_cover_mean[ti] = Math.round(summe('cloud_cover') / wo.length);
          if (pp.length) d.precipitation_probability_max[ti] = Math.max.apply(null, pp);
          // Tagescode: kräftigstes Niederschlagswetter mit Menge; trocken: „bedeckt“ (Nebel bleibt), aufgehellt wird in app.js nach Sonnenstunden
          var nass = idx.filter(function (i) { return h.weather_code[i] >= 51 && h.precipitation[i] >= 0.1; }).map(function (i) { return h.weather_code[i]; });
          var om = j.daily.weather_code[ti];
          d.weather_code[ti] = nass.length ? Math.max.apply(null, nass) : om === 45 || om === 48 ? om : 3;
        });
      }
      info.station = v.station;
    }

    if (m && (jetzt || Date.now()) - m.zeit <= MESSUNG_MAX_ALTER && m.zeit <= (jetzt || Date.now()) + 10 * 60e3) {
      var wert = function (x, ersatz) { return x == null ? ersatz : x; };
      c.temperature_2m = m.t;
      c.relative_humidity_2m = wert(m.feuchte, c.relative_humidity_2m);
      c.wind_speed_10m = wert(m.wind, c.wind_speed_10m);
      c.wind_direction_10m = wert(m.richtung, c.wind_direction_10m);
      c.wind_gusts_10m = wert(m.boeen, c.wind_gusts_10m);
      c.precipitation = wert(m.regen, c.precipitation);
      c.apparent_temperature = wert(gefuehlt(c.temperature_2m, c.relative_humidity_2m, c.wind_speed_10m), c.apparent_temperature);
      info.messung = { station: m.station, uhr: m.uhr };
    }

    var neu = {}; for (k in j) neu[k] = j[k];
    neu.hourly = h; neu.daily = d; neu.current = c;
    if (info.station || info.messung) neu._dwd = info;
    return neu;
  }

  var api = { holen: holen, einmischen: einmischen, vorhersageKurz: vorhersageKurz, messungKurz: messungKurz, inReichweite: inReichweite, MAX_DIST: MAX_DIST, MESSUNG_MAX_ALTER: MESSUNG_MAX_ALTER };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else wurzel.WeddaDWD = api;
})(typeof window !== 'undefined' ? window : this);
