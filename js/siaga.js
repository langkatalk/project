// js/siaga.js
// Zona PIN: kartu PANTAU CUACA LANGKAT di section tersendiri di atas feed.
// Klik membuka pantau-cuaca.html. Hanya tampil di chip Semua.
(function () {
  'use strict';

  var LABEL = { biru: 'Aman', kuning: 'Waspada', merah: 'Darurat' };
  var URUTAN = { biru: 1, kuning: 2, merah: 3 };
  var KARTU_ID = 'pantauCuacaKartu';
  var data = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function grup(desc) {
    var t = String(desc || '').toLowerCase();
    if (/petir/.test(t)) return 'petir';
    if (/hujan/.test(t)) return 'hujan';
    if (/berawan|mendung/.test(t)) return 'berawan';
    return 'cerah';
  }

  function tertinggi(kec) {
    return kec.reduce(function (m, k) {
      return URUTAN[k.status] > URUTAN[m] ? k.status : m;
    }, 'biru');
  }

  function kondisi(d) {
    var t = tertinggi(d.kecamatan);
    if (t === 'merah') return 'siklon';
    if (t === 'kuning') return 'waspada';
    var hitung = {};
    d.kecamatan.forEach(function (k) {
      if (k.cuaca && k.cuaca.cuaca) {
        var g = grup(k.cuaca.cuaca);
        hitung[g] = (hitung[g] || 0) + 1;
      }
    });
    var best = 'cerah', n = -1;
    Object.keys(hitung).forEach(function (g) {
      if (hitung[g] > n) { n = hitung[g]; best = g; }
    });
    return best;
  }

  function sinar() {
    var s = '';
    for (var i = 0; i < 8; i++) {
      var a = i * Math.PI / 4;
      s += '<line x1="' + (48 + Math.cos(a) * 28).toFixed(1) + '" y1="' + (48 + Math.sin(a) * 28).toFixed(1) +
           '" x2="' + (48 + Math.cos(a) * 40).toFixed(1) + '" y2="' + (48 + Math.sin(a) * 40).toFixed(1) +
           '" stroke="#FFB020" stroke-width="5" stroke-linecap="round"/>';
    }
    return s;
  }

  var AWAN = '<path d="M26 62a14 14 0 0 1 4-27 18 18 0 0 1 34 4 12 12 0 0 1 2 23z" fill="#EEF3FF" stroke="#8FA8E8" stroke-width="2.5"/>';
  var AWAN_GELAP = '<path d="M26 60a14 14 0 0 1 4-27 18 18 0 0 1 34 4 12 12 0 0 1 2 23z" fill="#C9D3E8" stroke="#5E6F99" stroke-width="2.5"/>';

  var SVG = {
    cerah: '<g class="pc-putar">' + sinar() + '</g><circle cx="48" cy="48" r="18" fill="#FFB020"/>',
    berawan: '<circle cx="36" cy="36" r="12" fill="#FFB020" opacity=".85"/>' + AWAN,
    hujan: AWAN_GELAP +
      '<g stroke="#2D5CF0" stroke-width="4" stroke-linecap="round">' +
      '<line x1="36" y1="70" x2="32" y2="84"/><line x1="50" y1="70" x2="46" y2="84"/><line x1="64" y1="70" x2="60" y2="84"/></g>',
    petir: AWAN_GELAP +
      '<polygon points="50,64 41,80 49,80 45,92 58,74 50,74" fill="#FFB020"/>',
    waspada: AWAN_GELAP +
      '<path d="M48 66 L38 86 H58 Z" fill="#F59E0B"/><rect x="47" y="72" width="2.5" height="7" fill="#fff"/><circle cx="48.2" cy="82" r="1.4" fill="#fff"/>',
    siklon: '<g class="pc-siklon">' +
      '<path d="M48 12a36 36 0 1 1-33 22" fill="none" stroke="#5A2FCF" stroke-width="6" stroke-linecap="round"/>' +
      '<path d="M48 26a22 22 0 1 1-20 13" fill="none" stroke="#2D5CF0" stroke-width="5" stroke-linecap="round"/>' +
      '<circle cx="48" cy="48" r="4" fill="#5A2FCF"/></g>'
  };

  function ilustrasi(k) {
    return '<svg viewBox="0 0 96 96" class="pc-svg" aria-hidden="true">' + (SVG[k] || SVG.cerah) + '</svg>';
  }

  function ambil() {
    return fetch('/api/siaga', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('gagal'); return r.json(); })
      .then(function (j) { data = j; return j; });
  }

  function aktifSemua() {
    var c = document.querySelector('#chips .chip-kat.on');
    return !c || c.dataset.filter === '';
  }

  function isiKartu(a, d) {
    var t = tertinggi(d.kecamatan);
    var pertama = null;
    d.kecamatan.forEach(function (k) {
      if (!pertama && k.peringatan && k.peringatan.length) pertama = k.peringatan[0];
    });
    var sub = pertama ? esc(pertama.judul) : 'Tidak ada peringatan dini untuk Kabupaten Langkat';
    a.className = 'pc-card pc-' + t;
    a.innerHTML =
      '<div class="pc-ikon">' + ilustrasi(kondisi(d)) + '</div>' +
      '<div class="pc-teks">' +
        '<p class="pc-label">PANTAU CUACA LANGKAT</p>' +
        '<h3 class="pc-status">' + LABEL[t] + '</h3>' +
        '<p class="pc-sub">' + sub + '</p>' +
      '</div>';
  }

  function pasang() {
    var zona = document.getElementById('zonaPin');
    if (!zona) return;

    if (!data || !aktifSemua()) {
      var lama = document.getElementById(KARTU_ID);
      if (lama) lama.remove();
      return;
    }

    var ada = document.getElementById(KARTU_ID);
    if (ada) {
      isiKartu(ada, data);
    } else {
      var a = document.createElement('a');
      a.id = KARTU_ID;
      a.href = 'pantau-cuaca.html';
      isiKartu(a, data);
      zona.appendChild(a);
    }
    zona.hidden = false;
  }

  function segarkan() {
    ambil().then(pasang).catch(function () {});
  }

  var chipsEl = document.getElementById('chips');
  if (chipsEl) new MutationObserver(pasang).observe(chipsEl, { subtree: true, attributes: true, attributeFilter: ['class'] });

  window.LKSiaga = {
    ambil: ambil,
    kondisi: kondisi,
    ilustrasi: ilustrasi,
    tertinggi: tertinggi,
    LABEL: LABEL
  };

  segarkan();
  setInterval(segarkan, 5 * 60 * 1000);
})();
