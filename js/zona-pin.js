// js/zona-pin.js
// Kartu PANTAU PEMBANGUNAN dan LAPORAN RAKYAT di zona PIN, dari artikel is_pin.
// Gambar mengikuti pengaturan Direktur (tabel pin_kartu). Kalau belum diatur, pakai sampul artikel.
// Kartu PANTAU CUACA juga bisa diberi gambar sendiri; kalau kosong, ilustrasi cuaca tetap dipakai.
(function () {
  'use strict';

  var sb = window.LK && window.LK.sb;
  var zona = document.getElementById('zonaPin');
  var chips = document.getElementById('chips');
  if (!sb || !zona) return;

  var JENIS = [
    { kunci: 'pembangunan', judul: 'PANTAU PEMBANGUNAN' },
    { kunci: 'laporan', judul: 'LAPORAN RAKYAT' }
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

  function kartu(a, jenis) {
    var tujuan = jenis.kunci === 'pembangunan'
      ? 'pantau-pembangunan.html'
      : 'baca.html?s=' + encodeURIComponent(a.slug || a.id);
    var sumber = gambarKartu[jenis.kunci] || a.cover_url;
    var gambar = sumber
      ? '<img src="' + esc(sumber) + '" alt="' + esc(a.title) + '" loading="lazy" decoding="async">'
      : '<span class="pin-kosong" aria-hidden="true">' + esc(jenis.judul.charAt(0)) + '</span>';
    return '<a class="pc-card pc-pin" data-pin="' + jenis.kunci + '" href="' + tujuan + '">' +
      '<div class="pin-gambar">' + gambar + '<span class="pin-badge">PIN OLEH REDAKSI</span></div>' +
      '<div class="pin-teks">' +
        '<p class="pc-label">' + jenis.judul + '</p>' +
        '<h3 class="pin-judul">' + esc(a.title) + '</h3>' +
        (a.description ? '<p class="pc-sub">' + esc(a.description) + '</p>' : '') +
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
      if (a) zona.insertAdjacentHTML('beforeend', kartu(a, j));
    });
    sinkron();
    pasangCuaca();
  }

  // Dipantau sampai ke dalam kartu, karena siaga.js menulis ulang kartu cuaca secara berkala
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
