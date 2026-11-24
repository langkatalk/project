// js/baca.js
// Halaman detail berita. Membaca ?s=slug (atau id), membersihkan isi, lalu menampilkan
// suka, komentar, simpan, bagikan, dan berita terkait.
// Mode pratinjau: ?pratinjau=ID (hanya untuk redaksi yang sudah masuk).
(function () {
  'use strict';

  var sb = window.LK && window.LK.sb;
  var REGEX_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  var JEDA_KOMENTAR_MS = 30000;
  var KOLOM = 'id,title,slug,category,body,description,source,author_name,published_at,cover_url,cover_caption,meta_title,meta_description,related_ids,status,is_exclusive,is_breaking,allow_comment,like_count,comment_count';
  var PRATINJAU = new URLSearchParams(location.search).get('pratinjau') || '';
  var modePratinjau = /^\d+$/.test(PRATINJAU);

  var TAG_BOLEH = {
    B: 1, I: 1, U: 1, S: 1, SUB: 1, SUP: 1, H1: 1, H2: 1, H3: 1, H4: 1,
    P: 1, BLOCKQUOTE: 1, UL: 1, OL: 1, LI: 1, BR: 1, HR: 1, A: 1, IMG: 1,
    FIGURE: 1, FIGCAPTION: 1, TABLE: 1, THEAD: 1, TBODY: 1, TR: 1, TH: 1, TD: 1,
    DIV: 1, SPAN: 1, IFRAME: 1
  };
  var TAG_BUANG = {
    SCRIPT: 1, STYLE: 1, LINK: 1, META: 1, OBJECT: 1, EMBED: 1,
    FORM: 1, INPUT: 1, BUTTON: 1, SELECT: 1, TEXTAREA: 1
  };
  var EMBED_BOLEH = [
    'youtube.com/embed/', 'youtu.be/', 'tiktok.com/embed/',
    'instagram.com/', 'facebook.com/plugins/', 'platform.twitter.com'
  ];

  var IKON = {
    hati: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>',
    komen: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.7-.8L3 21l1.9-5.1A8.4 8.4 0 1 1 21 11.5z"/></svg>',
    kirim: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/></svg>',
    simpan: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>'
  };

  var el = {
    baca: document.getElementById('baca'),
    toast: document.getElementById('toast')
  };

  var kunci = new URLSearchParams(location.search).get('s') || '';
  var artikel = null;
  var disukai = new Set(ambilLokal('lk_liked_ids'));
  var disimpan = new Set(ambilLokal('lk_saved_ids'));

  /* ---------- Utilitas ---------- */

  function ambilLokal(k) {
    try { return JSON.parse(localStorage.getItem(k) || '[]'); }
    catch (e) { return []; }
  }

  function simpanLokal(k, himpunan) {
    localStorage.setItem(k, JSON.stringify(Array.from(himpunan)));
  }

  function idPerangkat() {
    var id = localStorage.getItem('lk_device_id');
    if (!id) {
      id = (window.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'dev-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem('lk_device_id', id);
    }
    return id;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function tgl(d) {
    return d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  }

  function kabarkan(pesan) {
    el.toast.textContent = pesan;
    el.toast.classList.add('on');
    clearTimeout(kabarkan.t);
    kabarkan.t = setTimeout(function () { el.toast.classList.remove('on'); }, 2500);
  }

  function nilai(id) {
    var e = document.getElementById(id);
    return e ? e.value.trim() : '';
  }

  function tampilErr(id, pesan) {
    var e = document.getElementById(id);
    if (e) e.textContent = pesan || '';
  }

  function sibuk(id, v) {
    var e = document.getElementById(id);
    if (e) e.disabled = !!v;
  }

  function validasi(nama, email) {
    if (nama.length < 3) return 'Nama minimal 3 huruf.';
    if (!REGEX_EMAIL.test(email)) return 'Email belum benar.';
    return '';
  }

  function campo(id, label, tipe, placeholder) {
    return '<label class="sh-label">' + label +
      '<input id="' + id + '" type="' + tipe + '" placeholder="' + placeholder +
      '" autocomplete="' + (tipe === 'email' ? 'email' : 'name') + '"></label>';
  }

  function aturMeta(attr, nama, nilaiMeta) {
    var m = document.querySelector('meta[' + attr + '="' + nama + '"]');
    if (!m) {
      m = document.createElement('meta');
      m.setAttribute(attr, nama);
      document.head.appendChild(m);
    }
    m.setAttribute('content', nilaiMeta);
  }

  // Teks biasa dari HTML, tanpa menjalankan apa pun
  function teksDari(html) {
    var doc = new DOMParser().parseFromString('<div>' + (html || '') + '</div>', 'text/html');
    return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function hitungMenit(html) {
    var kata = teksDari(html).split(' ').filter(Boolean).length;
    return Math.max(1, Math.ceil(kata / 200));
  }

  /* ---------- Membersihkan isi artikel ---------- */

  // Membuang script, event (onclick dll), dan link javascript:.
  // Hanya tag yang diizinkan yang dibiarkan.
  function bersihkanNode(node) {
    Array.from(node.childNodes).forEach(function (n) {
      if (n.nodeType === 3) return;                  // teks biasa aman
      if (n.nodeType !== 1) { n.remove(); return; }  // komentar HTML dll

      if (TAG_BUANG[n.tagName]) { n.remove(); return; }

      if (!TAG_BOLEH[n.tagName]) {
        bersihkanNode(n);                            // bersihkan isinya dulu
        n.replaceWith.apply(n, Array.from(n.childNodes)); // lalu buang pembungkusnya
        return;
      }

      Array.from(n.attributes).forEach(function (a) {
        var nama = a.name.toLowerCase();
        var v = a.value.trim().toLowerCase();
        if (nama.indexOf('on') === 0 || v.indexOf('javascript:') === 0) {
          n.removeAttribute(a.name);
        }
      });

      if (n.tagName === 'A') {
        n.setAttribute('rel', 'noopener nofollow');
        n.setAttribute('target', '_blank');
      }

      if (n.tagName === 'IMG') {
        n.setAttribute('loading', 'lazy');
        n.setAttribute('decoding', 'async');
        if (!n.getAttribute('alt')) n.setAttribute('alt', artikel ? artikel.title : 'Ilustrasi berita');
      }

      if (n.tagName === 'IFRAME') {
        var src = n.getAttribute('src') || '';
        var boleh = EMBED_BOLEH.some(function (h) { return src.indexOf(h) !== -1; });
        if (!boleh) { n.remove(); return; }
        n.setAttribute('loading', 'lazy');
        n.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups');
      }

      bersihkanNode(n);
    });
  }

  function bersihkanHtml(raw) {
    var teks = String(raw || '').trim();
    if (!teks) return '';

    // Isi lama yang hanya teks biasa: pecah per paragraf
    if (!/<[a-z][\s\S]*>/i.test(teks)) {
      return teks.split(/\n{2,}/).filter(Boolean)
        .map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('');
    }

    var doc = new DOMParser().parseFromString('<div>' + teks + '</div>', 'text/html');
    var akar = doc.body.firstChild;
    bersihkanNode(akar);
    return akar.innerHTML;
  }

  /* ---------- SEO ---------- */

  function pasangSeo(a) {
    var deskripsi = (a.description || teksDari(a.body)).slice(0, 160);
    var url = location.origin + '/baca.html?s=' + encodeURIComponent(a.slug || a.id);

    document.title = a.title + ' – Langkatalk';
    aturMeta('name', 'description', deskripsi);
    aturMeta('property', 'og:title', a.title);
    aturMeta('property', 'og:description', deskripsi);
    aturMeta('property', 'og:type', 'article');
    aturMeta('property', 'og:url', url);
    if (a.cover_url) aturMeta('property', 'og:image', a.cover_url);

    var canon = document.querySelector('link[rel="canonical"]');
    if (!canon) {
      canon = document.createElement('link');
      canon.rel = 'canonical';
      document.head.appendChild(canon);
    }
    canon.href = url;

    var ld = document.getElementById('ld-json');
    if (!ld) {
      ld = document.createElement('script');
      ld.type = 'application/ld+json';
      ld.id = 'ld-json';
      document.head.appendChild(ld);
    }
    ld.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      headline: a.title,
      description: deskripsi,
      image: a.cover_url ? [a.cover_url] : [],
      datePublished: a.published_at,
      author: { '@type': 'Person', name: a.author_name || 'Redaksi' },
      publisher: {
        '@type': 'Organization',
        name: 'Langkatalk',
        logo: { '@type': 'ImageObject', url: location.origin + '/favicon.png' }
      }
    });
  }

  /* ---------- Tampilan ---------- */

  function gagal(pesan) {
    el.baca.innerHTML = '<p class="lk-status">' + esc(pesan) + '</p>';
  }

  function formSuka() {
    return '<h2 class="sh-judul">Suka berita ini</h2>' +
      '<p class="sh-catatan">Isi nama dan email. Data ini hanya untuk redaksi dan tidak ditampilkan ke publik.</p>' +
      '<form id="fSuka" class="sh-form" novalidate>' +
        campo('sNama', 'Nama', 'text', 'Nama kamu (minimal 3 huruf)') +
        campo('sEmail', 'Email', 'email', 'nama@email.com') +
        '<p class="sh-err" id="sErr"></p>' +
        '<div class="sh-tombol">' +
          '<button type="submit" class="btn btn-utama" id="sKirim">Suka</button>' +
        '</div>' +
      '</form>';
  }

  function bagianKomentar() {
    var form = artikel.allow_comment === false
      ? '<p class="sh-catatan">Komentar ditutup untuk berita ini.</p>'
      : '<form id="fKomen" class="sh-form" novalidate>' +
          campo('kNama', 'Nama', 'text', 'Nama kamu (minimal 3 huruf)') +
          campo('kEmail', 'Email', 'email', 'nama@email.com') +
          '<label class="sh-label">Komentar' +
            '<textarea id="kIsi" rows="3" maxlength="500" placeholder="Tulis komentar (3–500 karakter)"></textarea>' +
          '</label>' +
          '<p class="sh-catatan">Email tidak ditampilkan ke publik. Komentar tampil setelah disetujui redaksi.</p>' +
          '<p class="sh-err" id="kErr"></p>' +
          '<div class="sh-tombol">' +
            '<button type="submit" class="btn btn-utama" id="kKirim">Kirim komentar</button>' +
          '</div>' +
        '</form>';

    return '<h2 class="sh-judul">Komentar</h2>' +
      '<div class="k-list" id="kList"><p class="sh-catatan">Memuat komentar…</p></div>' +
      form;
  }

  function tampil(a) {
    artikel = a;
    pasangSeo(a);
    if (modePratinjau) aturMeta('name', 'robots', 'noindex,nofollow');

    var html = bersihkanHtml(a.body);
    var menit = hitungMenit(html);
    var disukaiSekarang = disukai.has(a.id);
    var disimpanSekarang = disimpan.has(a.id);

    var gambar = a.cover_url
      ? '<figure class="bc-cover"><div class="ig-media"><img class="ig-gambar" src="' + esc(a.cover_url) +
        '" alt="' + esc(a.title) + '" width="1200" height="600" fetchpriority="high"></div>' +
        '<figcaption class="bc-keterangan">' + esc(a.cover_caption || '') + '</figcaption></figure>'
      : '';

    var banner = modePratinjau
      ? '<div class="bc-pratinjau">PRATINJAU • status: ' + esc(a.status) + '<br>' +
        'Judul SEO: ' + esc(a.meta_title || a.title) + '<br>' +
        'Deskripsi SEO: ' + esc(a.meta_description || a.description || '-') + '</div>'
      : '';

    var aksi = modePratinjau ? '' :
      '<div class="ig-aksi bc-aksi">' +
        '<button type="button" class="ig-ikon suka' + (disukaiSekarang ? ' aktif' : '') + '" data-aksi="suka"' +
          ' aria-label="Suka" aria-pressed="' + disukaiSekarang + '">' + IKON.hati + '</button>' +
        '<button type="button" class="ig-ikon" data-aksi="komen" aria-label="Komentar">' + IKON.komen + '</button>' +
        '<button type="button" class="ig-ikon" data-aksi="bagi" aria-label="Bagikan">' + IKON.kirim + '</button>' +
        '<button type="button" class="ig-ikon ig-simpan' + (disimpanSekarang ? ' aktif' : '') + '" data-aksi="simpan"' +
          ' aria-label="Simpan">' + IKON.simpan + '</button>' +
      '</div>' +
      '<p class="ig-jumlah bc-jumlah"><span data-jumlah-suka>' + (a.like_count || 0) + '</span> suka</p>';

    el.baca.innerHTML =
      banner +
      '<article class="bc-kartu">' +
        gambar +
        '<div class="bc-isi">' +
          '<div class="bc-lencana">' +
            (a.is_breaking ? '<span class="lencana">BREAKING</span>' : '') +
            (a.is_exclusive ? '<span class="lencana">EKSKLUSIF</span>' : '') +
          '</div>' +
          '<h1 class="bc-judul">' + esc(a.title) + '</h1>' +
          '<p class="bc-meta"><b>' + esc(a.author_name || 'Redaksi') + '</b> • ' +
            esc(a.category || 'Umum') + ' • ' + tgl(a.published_at) + ' • ' + menit + ' mnt baca</p>' +
          (a.source ? '<p class="bc-meta">Sumber: ' + esc(a.source) + '</p>' : '') +
        '</div>' +
        aksi +
        '<div class="bc-tubuh">' + html + '</div>' +
        '<div id="bcTerkait"></div>' +
      '</article>' +
      (modePratinjau ? '' :
        '<section class="bc-kartu bc-bagian" id="bagianSuka" hidden>' + formSuka() + '</section>' +
        '<section class="bc-kartu bc-bagian" id="bagianKomentar">' + bagianKomentar() + '</section>');

    if (a.related_ids && a.related_ids.length) muatTerkait(a.related_ids);
  }

  /* ---------- Muat artikel ---------- */

  async function muatArtikel() {
    if (!sb) return gagal('Koneksi ke database belum siap. Periksa config.js.');

    if (modePratinjau) {
      var p = await sb.from('articles').select(KOLOM).eq('id', Number(PRATINJAU)).maybeSingle();
      if (p.error || !p.data) return gagal('Pratinjau hanya bisa dibuka oleh redaksi yang sudah masuk.');
      return tampil(p.data);
    }

    if (!kunci) return gagal('Berita tidak ditemukan.');

    var dasar = sb.from('articles')
      .select(KOLOM)
      .eq('status', 'terbit')
      .is('deleted_at', null)
      .or('scheduled_at.is.null,scheduled_at.lte.' + new Date().toISOString());

    var r = /^\d+$/.test(kunci)
      ? await dasar.eq('id', Number(kunci)).maybeSingle()
      : await dasar.eq('slug', kunci).maybeSingle();

    if (r.error) return gagal('Gagal memuat berita. Coba lagi sebentar.');
    if (!r.data) return gagal('Berita tidak ditemukan atau belum terbit.');

    tampil(r.data);
  }

  async function muatTerkait(ids) {
    var r = await sb.from('articles')
      .select('id,title,slug,cover_url')
      .in('id', ids.map(Number))
      .eq('status', 'terbit')
      .is('deleted_at', null);
    if (r.error || !r.data || !r.data.length) return;

    var box = document.getElementById('bcTerkait');
    if (!box) return;
    box.innerHTML = '<div class="bc-terkait"><h2 class="sh-judul">Berita terkait</h2>' +
      r.data.map(function (x) {
        var href = 'baca.html?s=' + encodeURIComponent(x.slug || x.id);
        return '<a class="bc-terkait-item" href="' + href + '">' +
          (x.cover_url ? '<img src="' + esc(x.cover_url) + '" alt="" loading="lazy">' : '') +
          '<span>' + esc(x.title) + '</span></a>';
      }).join('') + '</div>';
  }

  async function muatKomentar() {
    var box = document.getElementById('kList');
    if (!box || !sb) return;

    var r = await sb.from('public_comments')
      .select('guest_name,body,created_at')
      .eq('article_id', artikel.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (r.error) {
      box.innerHTML = '<p class="sh-catatan">Komentar belum bisa dimuat.</p>';
      return;
    }
    var data = r.data || [];
    box.innerHTML = data.length
      ? data.map(function (c) {
          return '<div class="k-item"><b>' + esc(c.guest_name) + '</b><small>' + tgl(c.created_at) +
            '</small><p>' + esc(c.body) + '</p></div>';
        }).join('')
      : '<p class="sh-catatan">Belum ada komentar. Jadilah yang pertama.</p>';
  }

  // Menghitung kunjungan sekali per jam per perangkat
  function catatDilihat(id) {
    var cache;
    try { cache = JSON.parse(localStorage.getItem('lk_views') || '{}'); }
    catch (e) { cache = {}; }

    if (Date.now() - (cache[id] || 0) < 3600000) return;
    cache[id] = Date.now();
    localStorage.setItem('lk_views', JSON.stringify(cache));

    if (sb) Promise.resolve(sb.rpc('increment_view', { p_article_id: id })).catch(function () {});
  }

  /* ---------- Suka ---------- */

  function panggilSuka(nama, email) {
    return sb.rpc('suka_berita', {
      p_article_id: artikel.id,
      p_device_id: idPerangkat(),
      p_nama: nama,
      p_email: email
    });
  }

  function terapkanSuka(data) {
    var d = Array.isArray(data) ? data[0] : data;
    if (!d) return false;

    if (d.disukai) disukai.add(artikel.id); else disukai.delete(artikel.id);
    simpanLokal('lk_liked_ids', disukai);

    var tombol = el.baca.querySelector('.ig-ikon.suka');
    tombol.classList.toggle('aktif', !!d.disukai);
    tombol.setAttribute('aria-pressed', String(!!d.disukai));
    el.baca.querySelector('[data-jumlah-suka]').textContent = d.jumlah || 0;
    return !!d.disukai;
  }

  async function tanganiSuka() {
    if (!sb) return kabarkan('Koneksi belum siap');

    if (disukai.has(artikel.id)) {
      var r = await panggilSuka(null, null);
      if (!r.error) {
        terapkanSuka(r.data);
        kabarkan('Suka dibatalkan');
        return;
      }
      // Data lokal tidak cocok dengan server: minta nama dan email
      if (!/Nama|Email/i.test(r.error.message)) return kabarkan('Gagal: ' + r.error.message);
    }

    var panel = document.getElementById('bagianSuka');
    panel.hidden = false;
    panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    var input = document.getElementById('sNama');
    if (input) input.focus();
  }

  async function kirimSuka() {
    var nama = nilai('sNama');
    var email = nilai('sEmail').toLowerCase();

    var salah = validasi(nama, email);
    if (salah) return tampilErr('sErr', salah);

    sibuk('sKirim', true);
    var r = await panggilSuka(nama, email);
    sibuk('sKirim', false);

    if (r.error) return tampilErr('sErr', r.error.message);

    var suka = terapkanSuka(r.data);
    document.getElementById('bagianSuka').hidden = true;
    document.getElementById('fSuka').reset();
    kabarkan(suka ? 'Berita disukai' : 'Suka dibatalkan');
  }

  /* ---------- Komentar ---------- */

  async function kirimKomentar() {
    var nama = nilai('kNama');
    var email = nilai('kEmail').toLowerCase();
    var isi = nilai('kIsi');

    var salah = validasi(nama, email);
    if (!salah && isi.length < 3) salah = 'Komentar minimal 3 karakter.';
    if (salah) return tampilErr('kErr', salah);

    var kunciJeda = 'lk_cmt_rate_' + artikel.id;
    var sisa = JEDA_KOMENTAR_MS - (Date.now() - Number(localStorage.getItem(kunciJeda) || 0));
    if (sisa > 0) {
      return tampilErr('kErr', 'Tunggu ' + Math.ceil(sisa / 1000) + ' detik sebelum mengirim lagi.');
    }

    sibuk('kKirim', true);
    var r = await sb.from('comments').insert({
      article_id: artikel.id,
      guest_name: nama,
      guest_email: email,
      body: isi,
      device_id: idPerangkat(),
      status: 'menunggu'
    });
    sibuk('kKirim', false);

    if (r.error) return tampilErr('kErr', 'Komentar belum terkirim: ' + r.error.message);

    localStorage.setItem(kunciJeda, String(Date.now()));
    document.getElementById('fKomen').reset();
    tampilErr('kErr', '');
    kabarkan('Komentar terkirim, menunggu persetujuan redaksi');
  }

  /* ---------- Simpan dan bagikan ---------- */

  function simpanBerita(tombol) {
    var id = artikel.id;
    if (disimpan.has(id)) {
      disimpan.delete(id);
      kabarkan('Dihapus dari daftar simpan');
    } else {
      disimpan.add(id);
      kabarkan('Berita disimpan');
    }
    simpanLokal('lk_saved_ids', disimpan);
    tombol.classList.toggle('aktif', disimpan.has(id));
  }

  function bagi() {
    var url = location.origin + '/api/berita?s=' + encodeURIComponent(artikel.slug || artikel.id);
    if (navigator.share) {
      navigator.share({ title: artikel.title, url: url }).catch(function () {});
      return;
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(function () { kabarkan('Tautan disalin'); });
    } else {
      kabarkan(url);
    }
  }

  /* ---------- Kejadian ---------- */

  el.baca.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-aksi]');
    if (!t || !artikel) return;

    var aksi = t.dataset.aksi;
    if (aksi === 'suka') tanganiSuka();
    else if (aksi === 'komen') document.getElementById('bagianKomentar').scrollIntoView({ behavior: 'smooth' });
    else if (aksi === 'bagi') bagi();
    else if (aksi === 'simpan') simpanBerita(t);
  });

  el.baca.addEventListener('submit', function (ev) {
    if (ev.target.id === 'fSuka') { ev.preventDefault(); kirimSuka(); }
    if (ev.target.id === 'fKomen') { ev.preventDefault(); kirimKomentar(); }
  });

  /* ---------- Mulai ---------- */

  async function mulai() {
    await muatArtikel();
    if (artikel && !modePratinjau) {
      muatKomentar();
      catatDilihat(artikel.id);
    }
  }

  mulai();
})();
