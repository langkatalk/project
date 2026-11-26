// js/zona-pin.js
// Kartu PANTAU PEMBANGUNAN dan LAPORAN RAKYAT di zona PIN.
// Kalau belum ada artikel PIN untuk kartu itu, kartu tetap tampil dengan keterangan.
// Laporan Rakyat belum punya halaman, jadi tautannya ke laporan-rakyat.html (404).
// Gambar mengikuti pengaturan Direktur (tabel pin_kartu). Kalau kosong, pakai sampul artikel.
(function () {
  'use strict';

  var sb = window.LK && window.LK.sb;
  var zona = document.getElementById('zonaPin');
  var chips = document.getElementById('chips');
  if (!sb || !zona) return;

  var JENIS = [
    { kunci: 'pembangunan', judul: 'PANTAU PEMBANGUNAN', kosong: 'Ikut mengawal pembangunan Kabupaten Langkat.' },
    { kunci: 'laporan', judul: 'LAPORAN RAKYAT', kosong: 'Segera hadir.' }
  ];
  var gambarKartu = {};

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function aktifSemua() {
    var c = chips && chips.querySelector('.chip-kat.on');
    return !c || c.dataset.filter === '';
  }

  function sinkron() {
    zona.hidden = !aktifSemua() || zona.children.length === 0;
  }

  async function ambilGambarKartu() {
    var r = await sb.from('pin_kartu').select('kunci,gambar_url');
    if (!r.error && r.data) {
      gambarKartu = {};
      r.data.forEach(function (x) { gambarKartu[x.kunci] = x.gambar_url; });
    }
  }

  async function ambilPin() {
    var iso = new Date().toISOString();
    var r = await sb.from('articles')
      .select('id,title,slug,description,cover_url,pin_kunci,published_at')
      .eq('is_pin', true)
      .eq('status', 'terbit')
      .is('deleted_at', null)
      .or('scheduled_at.is.null,scheduled_at.lte.' + iso)
      .order('published_at', { ascending: false })
      .limit(20);
    return (!r.error && r.data) ? r.data : [];
  }

  function tujuanKartu(kunci, a) {
    if (kunci === 'pembangunan') return 'pantau-pembangunan.html';
    if (kunci === 'laporan') return 'laporan-rakyat.html';
    return 'baca.html?s=' + encodeURIComponent(a.slug || a.id);
  }

  function gambarHtml(src, alt) {
    return src
      ? '<img src="' + esc(src) + '" alt="' + esc(alt) + '" loading="lazy" decoding="async">'
      : '<span class="pin-kosong" aria-hidden="true">' + esc(alt.charAt(0)) + '</span>';
  }

  // Kartu dari artikel PIN
  function kartu(a, jenis) {
    var src = gambarKartu[jenis.kunci] || a.cover_url;
    return '<a class="pc-card pc-pin" data-pin="' + jenis.kunci + '" href="' + tujuanKartu(jenis.kunci, a) + '">' +
      '<div class="pin-gambar">' + gambarHtml(src, jenis.judul) + '<span class="pin-badge">PIN OLEH REDAKSI</span></div>' +
      '<div class="pin-teks">' +
        '<p class="pc-label">' + jenis.judul + '</p>' +
        '<h3 class="pin-judul">' + esc(a.title) + '</h3>' +
        (a.description ? '<p class="pc-sub">' + esc(a.description) + '</p>' : '') +
      '</div>' +
    '</a>';
  }

  // Kartu tanpa artikel PIN (tetap tampil dengan keterangan)
  function kartuKosong(jenis) {
    var src = gambarKartu[jenis.kunci];
    return '<a class="pc-card pc-pin" data-pin="' + jenis.kunci + '" href="' + tujuanKartu(jenis.kunci, {}) + '">' +
      '<div class="pin-gambar">' + gambarHtml(src, jenis.judul) + '<span class="pin-badge">PIN OLEH REDAKSI</span></div>' +
      '<div class="pin-teks">' +
        '<p class="pc-label">' + jenis.judul + '</p>' +
        '<h3 class="pin-judul">' + jenis.judul + '</h3>' +
        '<p class="pc-sub">' + jenis.kosong + '</p>' +
      '</div>' +
    '</a>';
  }

  // Gambar kartu cuaca: dipakai hanya kalau sudah diatur Direktur
  function pasangCuaca() {
    var card = document.getElementById('pantauCuacaKartu');
    var url = gambarKartu.cuaca;
    if (!card || !url) return;
    var g = card.querySelector('.pin-gambar');
    if (!g) return;
    var img = g.querySelector('img');
    if (img && img.getAttribute('src') === url) return;
    g.innerHTML = '<img src="' + esc(url) + '" alt="" loading="lazy" decoding="async">' +
      '<span class="pin-badge">PIN OLEH REDAKSI</span>';
  }

  async function render() {
    zona.querySelectorAll('[data-pin]').forEach(function (n) { n.remove(); });
    if (!aktifSemua()) { sinkron(); return; }

    await ambilGambarKartu();
    var data = await ambilPin();
    JENIS.forEach(function (j) {
      var a = data.find(function (x) { return x.pin_kunci === j.kunci; });
      zona.insertAdjacentHTML('beforeend', a ? kartu(a, j) : kartuKosong(j));
    });
    sinkron();
    pasangCuaca();
  }

  new MutationObserver(function () {
    sinkron();
    pasangCuaca();
  }).observe(zona, { childList: true, subtree: true });

  document.addEventListener('lk:kategori', render);
  document.addEventListener('lk:filter', render);
  setInterval(render, 5 * 60 * 1000);

  ambilGambarKartu().then(pasangCuaca);
  render();
})();
