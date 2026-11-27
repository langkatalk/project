// js/zona-pin.js
// Zona PIN di beranda. Urutan, ukuran, tampil, masa aktif, dan judul diatur direktur lewat Atur Zona PIN.
// PIN artikel (pembangunan dan laporan) memakai artikel yang ditandai PIN, kalau ada.
(function () {
  'use strict';

  var sb = window.LK && window.LK.sb;
  var zona = document.getElementById('zonaPin');
  var chips = document.getElementById('chips');
  if (!sb || !zona) return;

  var rows = [];        // PIN yang aktif dan belum lewat masa aktifnya, sudah diurutkan
  var gambarKartu = {}; // gambar per kunci (untuk PIN cuaca)
  var artikelPin = {};  // artikel PIN terbaru per kunci (pembangunan, laporan)
  var cuacaAda = false;

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
    var adaTampil = Array.prototype.some.call(zona.children, function (c) { return c.style.display !== 'none'; });
    zona.hidden = !aktifSemua() || !adaTampil;
  }

  async function ambilPin() {
    var r = await sb.from('pin_kartu').select('*').order('urutan', { ascending: true });
    var semua = (r.data || []);
    var sekarang = new Date();
    rows = semua.filter(function (p) {
      return p.aktif && (!p.berakhir_at || new Date(p.berakhir_at) > sekarang);
    });
    gambarKartu = {};
    semua.forEach(function (p) { gambarKartu[p.kunci] = p.gambar_url; });
  }

  async function ambilArtikelPin() {
    var iso = new Date().toISOString();
    var r = await sb.from('articles')
      .select('id,title,slug,description,cover_url,pin_kunci,published_at')
      .eq('is_pin', true)
      .eq('status', 'terbit')
      .is('deleted_at', null)
      .or('scheduled_at.is.null,scheduled_at.lte.' + iso)
      .order('published_at', { ascending: false })
      .limit(50);
    artikelPin = {};
    (r.data || []).forEach(function (a) {
      if (a.pin_kunci && !artikelPin[a.pin_kunci]) artikelPin[a.pin_kunci] = a;
    });
  }

  function gambarHtml(src, alt) {
    return src
      ? '<img src="' + esc(src) + '" alt="' + esc(alt) + '" loading="lazy" decoding="async">'
      : '<span class="pin-kosong" aria-hidden="true">' + esc(String(alt).charAt(0)) + '</span>';
  }

  function kartuDari(p, a) {
    var href = p.tujuan ? p.tujuan : (a ? 'baca.html?s=' + encodeURIComponent(a.slug || a.id) : '#');
    var src = p.gambar_url || (a && a.cover_url) || '';
    var judul = p.judul || (a ? a.title : p.kunci);
    var deskripsi = p.deskripsi || (a && a.description) || '';
    return '<a class="pc-card pc-pin pin-' + esc(p.ukuran || 'sedang') + '" data-pin="' + esc(p.kunci) + '" data-gen="1" href="' + esc(href) + '">' +
      '<div class="pin-gambar">' + gambarHtml(src, judul) + '<span class="pin-badge">PIN OLEH REDAKSI</span></div>' +
      '<div class="pin-teks">' +
        '<p class="pc-label">' + esc(judul) + '</p>' +
        (a ? '<h3 class="pin-judul">' + esc(a.title) + '</h3>' : '') +
        (deskripsi ? '<p class="pc-sub">' + esc(deskripsi) + '</p>' : '') +
      '</div>' +
    '</a>';
  }

  // Gambar kartu cuaca: dipakai hanya kalau sudah diatur di Atur Zona PIN
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

  function render() {
    zona.querySelectorAll('[data-gen]').forEach(function (n) { n.remove(); });

    var cuacaEl = document.getElementById('pantauCuacaKartu');
    var cuacaAktif = rows.some(function (p) { return p.kunci === 'cuaca'; });

    rows.forEach(function (p) {
      if (p.kunci === 'cuaca') {
        if (cuacaEl) {
          cuacaEl.dataset.pin = 'cuaca';
          cuacaEl.className = cuacaEl.className.replace(/\bpin-(besar|sedang|kecil)\b/g, '').trim() +
            ' pin-' + (p.ukuran || 'sedang');
          cuacaEl.style.display = '';
          zona.appendChild(cuacaEl);
        }
        return;
      }
      zona.insertAdjacentHTML('beforeend', kartuDari(p, artikelPin[p.kunci] || null));
    });

    if (cuacaEl && !cuacaAktif) cuacaEl.style.display = 'none';
    sinkron();
    pasangCuaca();
  }

  async function segarkan() {
    await Promise.all([ambilPin(), ambilArtikelPin()]);
    render();
  }

  // Kartu cuaca dibuat ulang oleh siaga.js. Saat muncul pertama kali, susun ulang zona.
  new MutationObserver(function () {
    var c = document.getElementById('pantauCuacaKartu');
    if (c && !cuacaAda) {
      cuacaAda = true;
      render();
      return;
    }
    if (!c) cuacaAda = false;
    sinkron();
    pasangCuaca();
  }).observe(zona, { childList: true, subtree: true });

  document.addEventListener('lk:kategori', segarkan);
  document.addEventListener('lk:filter', segarkan);
  setInterval(segarkan, 5 * 60 * 1000);

  segarkan();
})();
