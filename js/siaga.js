// js/siaga.js
// Menampilkan Siaga Langkat di atas feed, lalu memperbarui datanya setiap 5 menit.
(function () {
  'use strict';

  var feed = document.getElementById('feed');
  if (!feed || document.getElementById('siagaLangkat')) return;

  var wadah = document.createElement('section');
  wadah.id = 'siagaLangkat';
  wadah.className = 'siaga';
  wadah.setAttribute('aria-label', 'Siaga Langkat');
  wadah.setAttribute('aria-live', 'polite');
  feed.parentNode.insertBefore(wadah, feed);

  var URUTAN = { biru: 1, kuning: 2, merah: 3 };
  var LABEL = { biru: 'Aman', kuning: 'Waspada', merah: 'Darurat' };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function jamSekarang() {
    return new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Jakarta'
    }) + ' WIB';
  }

  function tanggalHari() {
    return new Date().toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta'
    });
  }

  function kartu(k) {
    var c = k.cuaca;
    var suhu = c && c.suhu != null ? c.suhu + '°C' : '–';
    var desk = c && c.cuaca ? esc(c.cuaca) : 'Data belum tersedia';
    var ikon = c && c.ikon ? '<img src="' + esc(c.ikon) + '" alt="" width="40" height="40" loading="lazy">' : '';
    var peringatan = k.peringatan && k.peringatan.length
      ? '<p class="sk-peringatan">' + esc(k.peringatan[0].judul) + '</p>'
      : '';
    return '<article class="sk sk-' + k.status + '">' +
      '<div class="sk-atas"><h3>' + esc(k.nama) + '</h3>' +
      '<span class="sk-pil">' + LABEL[k.status] + '</span></div>' +
      '<div class="sk-cuaca">' + ikon +
      '<div><p class="sk-suhu">' + suhu + '</p><p class="sk-desk">' + desk + '</p></div></div>' +
      peringatan +
      '</article>';
  }

  function gambar(data) {
    var urut = data.kecamatan.slice().sort(function (a, b) {
      return URUTAN[b.status] - URUTAN[a.status];
    });
    var tertinggi = data.kecamatan.reduce(function (m, k) {
      return URUTAN[k.status] > URUTAN[m] ? k.status : m;
    }, 'biru');
    var terdampak = data.kecamatan.filter(function (k) { return k.status !== 'biru'; }).length;
    var sub = terdampak
      ? terdampak + ' kecamatan terdampak peringatan dini'
      : 'Tidak ada peringatan dini untuk Kabupaten Langkat';
    var dimuat = new Date(data.diperbarui).toLocaleTimeString('id-ID', {
      hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta'
    });

    wadah.innerHTML =
      '<div class="siaga-kaca sk-banner sb-' + tertinggi + '">' +
        '<div><p class="sb-label">SIAGA LANGKAT</p>' +
        '<h2 class="sb-judul">' + LABEL[tertinggi] + '</h2>' +
        '<p class="sb-sub">' + sub + '</p></div>' +
        '<div><p class="sb-jam" id="siagaJam">' + jamSekarang() + '</p>' +
        '<p class="sb-tgl">' + tanggalHari() + '</p></div>' +
      '</div>' +
      '<div class="sk-grid">' + urut.map(kartu).join('') + '</div>' +
      '<p class="siaga-sumber">Sumber: BMKG. Prakiraan diperbarui oleh BMKG secara berkala. ' +
      'Terakhir dimuat ' + dimuat + ' WIB.</p>';
  }

  function kerangka() {
    wadah.innerHTML = '<div class="siaga-kaca"><p class="siaga-memuat">Memuat data BMKG…</p></div>';
  }

  function muat() {
    fetch('/api/siaga', { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('gagal');
        return r.json();
      })
      .then(gambar)
      .catch(function () {
        if (!wadah.querySelector('.sk-grid')) {
          wadah.innerHTML = '<div class="siaga-kaca"><p class="siaga-memuat">' +
            'Data BMKG belum bisa dimuat. Coba lagi sebentar lagi.</p></div>';
        }
      });
  }

  kerangka();
  muat();
  setInterval(muat, 5 * 60 * 1000);
  setInterval(function () {
    var j = document.getElementById('siagaJam');
    if (j) j.textContent = jamSekarang();
  }, 1000);
})();
