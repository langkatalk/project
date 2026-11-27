// js/tulis.js
// Halaman Tulis Berita (versi lengkap).
// Editor, keterangan gambar wajib, Baca juga, cover 2:1 dengan keterangan,
// simpan draf, ajukan lewat advance_article, simpan lokal tiap 30 detik,
// dan notifikasi kaca di bawah layar.
(function () {
  'use strict';

  var sb = window.LK && window.LK.sb;
  var ROLE_BOLEH = ['direktur', 'pemred', 'redaktur', 'editor', 'reporter', 'kontributor'];
  var RUBRIK_CADANGAN = ['Investigasi', 'Ruang Gelap', 'Politik', 'Panggung', 'Ekonomi Gelap', 'Opini', 'Kilas Info'];
  var KUNCI_LOKAL = 'lk_tulis_draf_v2';
  var BATAS_MENTAH = 1024 * 1024; // 1 MB, sesuai anchor
  var COVER_W = 1200;
  var COVER_H = 600;
  var COVER_MAX_KB = 300;
  var MIN_KATA_AJUKAN = 50;
  var DOMAIN = 'https://langkatalk.vercel.app';
  var YT_RE = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/;
  var TABEL_HTML = '<table><thead><tr><th>Kolom 1</th><th>Kolom 2</th></tr></thead>' +
    '<tbody><tr><td>Data A</td><td>Data B</td></tr></tbody></table><p><br></p>';

  var st = {
    user: null,
    profil: null,
    artikelId: null,
    tags: [],
    related: [],
    coverUrl: '',
    kotor: false,
    sedang: false,
    terkunci: false,
    terbit: []
  };

  var simpanRange = null;
    var kotakPin = false;

  /* ---------- Utilitas ---------- */

  function $(id) { return document.getElementById(id); }

  function val(id) {
    var e = $(id);
    return e ? String(e.value || '').trim() : '';
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function waktu() {
    return new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }

  function jumlahKata(teks) {
    return teks.split(/\s+/).filter(Boolean).length;
  }

  function buatSlug(teks) {
    var dasar = (teks || '').toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 70) || 'berita';
    return dasar + '-' + Date.now().toString(36);
  }

  /* ---------- Notifikasi kaca (pop-up di bawah layar) ---------- */

  function toast(teks, jenis, lama) {
    var box = $('tlToast');
    if (!box) return;
    box.textContent = teks;
    box.className = 'tl-toast on ' + (jenis || '');
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { box.classList.remove('on'); }, lama || 4500);
  }

  function pesanErr(teks) { toast(teks, 'err', 6000); }
  function pesanOk(teks) { toast(teks, 'ok'); }

  function bersihkanPesan() {
    var box = $('tlToast');
    if (box) box.classList.remove('on');
  }

  function setSibuk(on) {
    st.sedang = on;
    $('btnSimpanDraf').disabled = on;
    $('btnAjukan').disabled = on;
  }

  function pesanTanpaMasuk(teks) {
    $('tanpaPesan').textContent = teks;
    $('layarTanpa').hidden = false;
    $('layarTulis').hidden = true;
    $('tlBawah').hidden = true;
  }

  /* ---------- Sanitasi HTML (dipakai sebelum simpan, pratinjau, dan saat dipulihkan) ---------- */

  function bersihkan(html) {
    var doc = new DOMParser().parseFromString('<div>' + (html || '') + '</div>', 'text/html');
    var akar = doc.body.firstElementChild;
    if (!akar) return '';

    akar.querySelectorAll('script,style,object,embed,form,input,button,textarea,select,meta,link,base,svg,math')
      .forEach(function (n) { n.remove(); });

    akar.querySelectorAll('iframe').forEach(function (f) {
      var src = f.getAttribute('src') || '';
      var aman = /^https:\/\/(www\.youtube(-nocookie)?\.com\/embed\/|www\.tiktok\.com\/embed\/|www\.instagram\.com\/|www\.facebook\.com\/plugins\/)/.test(src);
      if (!aman) f.remove();
    });

    akar.querySelectorAll('*').forEach(function (el) {
      Array.prototype.slice.call(el.attributes).forEach(function (a) {
        var nama = a.name.toLowerCase();
        var nilai = a.value.trim().toLowerCase().replace(/\s/g, '');
        if (nama.indexOf('on') === 0 || nama === 'style') {
          el.removeAttribute(a.name);
        } else if (['href', 'src', 'xlink:href', 'action', 'formaction'].indexOf(nama) !== -1 &&
                   (nilai.indexOf('javascript:') === 0 || nilai.indexOf('data:text') === 0)) {
          el.removeAttribute(a.name);
        }
      });

      if (el.tagName === 'A') {
        el.setAttribute('rel', 'noopener nofollow');
        if (/^https?:\/\//i.test(el.getAttribute('href') || '')) el.setAttribute('target', '_blank');
      }
      if (el.tagName === 'IMG') {
        el.setAttribute('loading', 'lazy');
        el.setAttribute('decoding', 'async');
        if (!el.getAttribute('alt')) el.setAttribute('alt', 'Ilustrasi berita');
      }
      if (el.tagName === 'IFRAME') {
        el.setAttribute('loading', 'lazy');
        el.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups');
      }
    });

    return akar.innerHTML;
  }

  function isiEditor() {
    var sumber = $('cmsHtmlSource');
    var mentah = sumber.classList.contains('on') ? sumber.value : $('cmsEditorArea').innerHTML;
    return bersihkan(mentah).trim();
  }

  function teksEditor() {
    var tmp = document.createElement('div');
    tmp.innerHTML = isiEditor();
    return (tmp.textContent || '').replace(/\s+/g, ' ').trim();
  }
  // Teks dari alat tulis lain dipecah per baris, supaya enter-nya tidak hilang
  function tempelRapi(e) {
    var cd = e.clipboardData;
    if (!cd) return;
    var teks = cd.getData('text/plain');
    if (!teks) return;
    e.preventDefault();
    var isi = teks.replace(/\r\n?/g, '\n').split('\n').map(function (baris) {
      return baris.trim() === '' ? '<p><br></p>' : '<p>' + esc(baris) + '</p>';
    }).join('');
    sisipkan(isi);
  }

  // Setelah naskah diajukan, form kembali kosong untuk berita baru
  function resetBaru(teks) {
    st.artikelId = null;
    st.tags = [];
    st.related = [];
    st.coverUrl = '';
    st.kotor = false;
    st.terkunci = false;
    st.sedang = false;

    ['tTitle', 'tDesc', 'tSource', 'tTopic', 'tMetaTitle', 'tMetaDesc', 'tCoverCaption'].forEach(function (id) {
      $(id).value = '';
    });
    $('tCategory').value = '';
    $('tAllowComment').checked = true;
    $('tShowHome').checked = true;
    $('tAuthor').value = (st.profil && (st.profil.full_name || st.profil.username)) || '';
    if (kotakPin) {
      $('tPinAktif').checked = false;
      $('tPinJenis').value = '';
      sinkronPin();
    }

    var area = $('cmsEditorArea');
    area.innerHTML = '';
    area.style.display = '';
    area.contentEditable = 'true';
    var sumber = $('cmsHtmlSource');
    sumber.value = '';
    sumber.classList.remove('on');

    $('tImgPreview').hidden = true;
    $('tImgInfo').textContent = '';
    $('tCatatanRevisi').hidden = true;
    $('tAutosave').textContent = '';

    renderTag();
    renderTerkait();
    hapusLokal();
    hitungUlang();
    pembaruan();
    st.kotor = false;

    document.querySelectorAll('#layarTulis input, #layarTulis select, #layarTulis textarea, #layarTulis button, #btnSimpanDraf, #btnAjukan')
      .forEach(function (n) { n.disabled = false; });
    setSibuk(false);

    history.replaceState(null, '', 'tulis.html');
    pesanOk(teks);
  }
  /* ---------- Hitungan dan status editor ---------- */

  function hitungUlang() {
    $('tTitleCount').textContent = String(150 - $('tTitle').value.length);
    $('tDescCount').textContent = String(140 - $('tDesc').value.length);
  }

  function pembaruan() {
    st.kotor = true;
    hitungUlang();
    var kata = jumlahKata(teksEditor());
    $('tJumlahKata').textContent = kata + ' kata • ' + Math.max(1, Math.ceil(kata / 200)) + ' menit baca';
  }

  function perbaruiPath() {
    var sel = window.getSelection();
    var node = sel && sel.anchorNode;
    if (node && node.nodeType === 3) node = node.parentNode;
    var area = $('cmsEditorArea');
    var blok = node && node.closest ? node.closest('h1,h2,h3,blockquote,table,ul,ol,p,div') : null;
    $('editorPathBar').textContent = (blok && area.contains(blok)) ? blok.tagName.toLowerCase() : 'p';
  }

  /* ---------- Seleksi dan perintah editor ---------- */

  // Menyimpan posisi kursor di editor, supaya tetap ada saat kotak dialog atau pilihan dibuka
  document.addEventListener('selectionchange', function () {
    var s = window.getSelection();
    if (s && s.rangeCount && $('cmsEditorArea').contains(s.anchorNode)) {
      simpanRange = s.getRangeAt(0).cloneRange();
    }
  });

  function pulihkanSeleksi() {
    var area = $('cmsEditorArea');
    area.focus();
    if (simpanRange) {
      var s = window.getSelection();
      s.removeAllRanges();
      s.addRange(simpanRange);
    }
  }

  function perintah(c, nilai) {
    pulihkanSeleksi();
    document.execCommand(c, false, nilai == null ? null : nilai);
    pembaruan();
  }

  function sisipkan(html) {
    pulihkanSeleksi();
    document.execCommand('insertHTML', false, html);
    pembaruan();
  }

  function aksiLink() {
    var u = (prompt('Tautan (mulai dengan https://)', 'https://') || '').trim();
    if (!u) return;
    if (!/^https?:\/\//i.test(u)) return pesanErr('Tautan harus mulai dengan https://');
    perintah('createLink', u);
  }

  // Gambar di isi berita wajib punya keterangan
  function aksiGambar() {
    var u = (prompt('Alamat gambar (mulai dengan https://)', 'https://') || '').trim();
    if (!u) return;
    if (!/^https:\/\//i.test(u)) return pesanErr('Alamat gambar harus mulai dengan https://');
    var keterangan = (prompt('Keterangan gambar (wajib diisi)', '') || '').trim();
    if (!keterangan) return pesanErr('Gambar tidak disisipkan: keterangan wajib diisi.');
    sisipkan('<figure><img src="' + esc(u) + '" alt="' + esc(keterangan) +
      '" loading="lazy" decoding="async"><figcaption>' + esc(keterangan) + '</figcaption></figure><p><br></p>');
  }

  function aksiVideo() {
    var u = (prompt('Tempel tautan video (YouTube, TikTok, Instagram, atau Facebook)', 'https://') || '').trim();
    if (!u) return;
    var m = u.match(YT_RE);
    if (m) {
      return sisipkan('<p><iframe src="https://www.youtube.com/embed/' + m[1] +
        '" title="Video" allowfullscreen></iframe></p><p><br></p>');
    }
    if (/^https:\/\/(www\.)?(tiktok|instagram|facebook)\.com\//i.test(u)) {
      return sisipkan('<p><a href="' + esc(u) + '">' + esc(u) + '</a></p>');
    }
    pesanErr('Tautan video ini belum didukung. Gunakan YouTube, TikTok, Instagram, atau Facebook.');
  }

  function togglSumber() {
    var area = $('cmsEditorArea');
    var sumber = $('cmsHtmlSource');
    var tombol = document.querySelector('[data-aksi="sumber"]');
    if (sumber.classList.contains('on')) {
      area.innerHTML = bersihkan(sumber.value);
      sumber.classList.remove('on');
      area.style.display = '';
      if (tombol) tombol.classList.remove('on');
    } else {
      sumber.value = bersihkan(area.innerHTML);
      sumber.classList.add('on');
      area.style.display = 'none';
      if (tombol) tombol.classList.add('on');
    }
    pembaruan();
  }

  /* ---------- Baca juga ---------- */

  function bukaBacaJuga() {
    var daftar = $('daftarBacaJuga');
    if (!st.terbit.length) {
      daftar.innerHTML = '<p class="tl-info">Belum ada berita terbit untuk ditautkan.</p>';
    } else {
      daftar.innerHTML = st.terbit.map(function (a) {
        return '<button type="button" class="tl-bj-item" data-id="' + esc(a.id) + '">' +
          (a.cover_url
            ? '<img src="' + esc(a.cover_url) + '" alt="" loading="lazy">'
            : '<span class="tl-bj-kosong"></span>') +
          '<span>' + esc(a.title) + '</span></button>';
      }).join('');
    }
    $('modalBacaJuga').hidden = false;
  }

  function pilihBacaJuga(id) {
    var a = st.terbit.find(function (x) { return String(x.id) === String(id); });
    if (!a) return pesanErr('Berita tidak ditemukan.');
    $('modalBacaJuga').hidden = true;
    sisipkan(
      '<div class="lk-baca-juga"><a href="baca.html?s=' + encodeURIComponent(a.slug || a.id) + '">' +
        (a.cover_url ? '<img src="' + esc(a.cover_url) + '" alt="" loading="lazy">' : '') +
        '<div><span class="lk-bj-label">Baca juga</span><span class="lk-bj-judul">' + esc(a.title) + '</span></div>' +
      '</a></div><p><br></p>'
    );
  }

  function klikToolbar(e) {
    var b = e.target.closest('button');
    if (!b || b.disabled) return;

    if (b.dataset.cmd) return perintah(b.dataset.cmd, b.dataset.nilai || null);
    if (b.dataset.blok) return perintah('formatBlock', b.dataset.blok);

    switch (b.dataset.aksi) {
      case 'link': return aksiLink();
      case 'gambar': return aksiGambar();
      case 'bacajuga': return bukaBacaJuga();
      case 'tabel': return sisipkan(TABEL_HTML);
      case 'video': return aksiVideo();
      case 'sumber': return togglSumber();
    }
  }

  /* ---------- Tag, berita terkait, dan rubrik ---------- */

  function renderTag() {
    $('tTagChips').innerHTML = st.tags.map(function (t, i) {
      return '<span class="tl-chip">#' + esc(t) + ' <button type="button" data-tag="' + i + '" aria-label="Hapus tag">×</button></span>';
    }).join('');
  }

  function tambahTag(teks) {
    teks.split(',')
      .map(function (s) { return s.trim().replace(/^#/, '').toLowerCase(); })
      .filter(Boolean)
      .forEach(function (t) {
        if (st.tags.indexOf(t) === -1 && st.tags.length < 12) st.tags.push(t);
      });
    renderTag();
    st.kotor = true;
  }

  function renderTerkait() {
    $('tRelatedChips').innerHTML = st.related.map(function (id, i) {
      var opsi = $('tRelatedSelect').querySelector('option[value="' + id + '"]');
      var nama = opsi ? opsi.textContent : ('Artikel #' + id);
      return '<span class="tl-chip">' + esc(nama) + ' <button type="button" data-terkait="' + i + '" aria-label="Hapus">×</button></span>';
    }).join('');
  }

  function tambahTerkait() {
    var v = $('tRelatedSelect').value;
    if (!v) return;
    if (st.related.indexOf(v) === -1 && st.related.length < 6) st.related.push(v);
    $('tRelatedSelect').value = '';
    renderTerkait();
    st.kotor = true;
  }

  async function muatRubrik() {
    var daftar = [];
    var r = await sb.from('categories').select('name').order('sort', { ascending: true });
    if (!r.error && r.data && r.data.length) daftar = r.data.map(function (x) { return x.name; });
    if (!daftar.length) daftar = RUBRIK_CADANGAN;
    $('tCategory').innerHTML = '<option value="">Pilih rubrik…</option>' + daftar.map(function (n) {
      return '<option value="' + esc(n) + '">' + esc(n) + '</option>';
    }).join('');
  }

  // Daftar berita terbit: dipakai untuk pilihan "Baca juga" dan "Berita terkait"
  async function muatArtikelTerbit() {
    var r = await sb.from('articles')
      .select('id,title,slug,cover_url')
      .eq('status', 'terbit')
      .is('deleted_at', null)
      .order('published_at', { ascending: false })
      .limit(50);
    if (r.error || !r.data) return;
    st.terbit = r.data;
    $('tRelatedSelect').innerHTML = '<option value="">Pilih berita…</option>' + r.data.map(function (a) {
      return '<option value="' + a.id + '">' + esc(a.title) + '</option>';
    }).join('');
  }

  /* ---------- Cover: potong 2:1, 1200x600, WebP (cadangan JPG) ---------- */

  function muatGambar(url) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('File gambar tidak bisa dibaca.')); };
      img.src = url;
    });
  }

  function keBlob(canvas, tipe, kualitas) {
    return new Promise(function (resolve) { canvas.toBlob(resolve, tipe, kualitas); });
  }

  async function prosesCover(file) {
    var url = URL.createObjectURL(file);
    try {
      var img = await muatGambar(url);
      var sw = img.naturalWidth;
      var sh = img.naturalHeight;
      var sx = 0, sy = 0, cw = sw, ch = sh;
      if (sw / sh > 2) { cw = sh * 2; sx = (sw - cw) / 2; }
      else { ch = sw / 2; sy = (sh - ch) / 2; }

      var canvas = document.createElement('canvas');
      canvas.width = COVER_W;
      canvas.height = COVER_H;
      canvas.getContext('2d').drawImage(img, sx, sy, cw, ch, 0, 0, COVER_W, COVER_H);

      var blob = await keBlob(canvas, 'image/webp', 0.8);
      var ext = 'webp';
      if (!blob || blob.type !== 'image/webp') {
        blob = await keBlob(canvas, 'image/jpeg', 0.8);
        ext = 'jpg';
      }
      if (!blob) throw new Error('Gagal mengompres gambar.');
      return { blob: blob, ext: ext, asliLebar: sw };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function unggahCover(ev) {
    var file = ev.target.files && ev.target.files[0];
    var info = $('tImgInfo');
    if (!file) return;
    bersihkanPesan();

    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      ev.target.value = '';
      return pesanErr('Pilih gambar JPG, PNG, atau WebP.');
    }
    if (file.size > BATAS_MENTAH) {
      ev.target.value = '';
      return pesanErr('Ukuran gambar maks 1 MB. Kecilkan dulu, lalu pilih lagi.');
    }
    if (!sb || !st.user) {
      ev.target.value = '';
      return pesanErr('Sesi berakhir. Masuk ulang di Ruang Redaksi.');
    }

    info.textContent = 'Memproses gambar…';
    try {
      var hasil = await prosesCover(file);
      var kb = Math.round(hasil.blob.size / 1024);
      var path = 'covers/' + st.user.id + '/' + Date.now() + '.' + hasil.ext;

      var up = await sb.storage.from('articles').upload(path, hasil.blob, {
        contentType: hasil.blob.type,
        cacheControl: '31536000',
        upsert: false
      });
      if (up.error) throw new Error('Upload gambar gagal: ' + up.error.message);

      st.coverUrl = sb.storage.from('articles').getPublicUrl(path).data.publicUrl;
      $('tImgEl').src = st.coverUrl;
      $('tImgPreview').hidden = false;

      var pesan = '1200 × 600 px • ' + kb + ' KB • Rasio 2:1 ✓';
      if (hasil.asliLebar < COVER_W) pesan += ' • Gambar asli lebih kecil dari 1200 px, hasilnya kurang tajam.';
      if (kb > COVER_MAX_KB) pesan += ' • Lebih dari ' + COVER_MAX_KB + ' KB, pertimbangkan gambar yang lebih sederhana.';
      info.textContent = pesan;
      st.kotor = true;
    } catch (e) {
      info.textContent = 'Gambar belum terpasang.';
      pesanErr(e.message || 'Gagal memproses gambar.');
    }
    ev.target.value = '';
  }

  /* ---------- Kumpulkan data dan simpan ---------- */

  function kumpulkan() {
    var d = {
      title: val('tTitle'),
      category: $('tCategory').value,
      description: val('tDesc') || null,
      body: isiEditor(),
      cover_url: st.coverUrl || null,
      cover_caption: val('tCoverCaption') || null,
      tags: st.tags.slice(),
      source: val('tSource') || null,
      author_name: val('tAuthor') || (st.profil && (st.profil.full_name || st.profil.username)) || null,
      topic: val('tTopic') || null,
      allow_comment: $('tAllowComment').checked,
      show_on_home: $('tShowHome').checked,
      related_ids: st.related.map(Number),
      meta_title: val('tMetaTitle') || null,
      meta_description: val('tMetaDesc') || null
    };
    // Hanya direktur yang punya kotak PIN, jadi kolom PIN hanya dikirim dari sana
    if (kotakPin) {
      var aktif = $('tPinAktif').checked;
      d.is_pin = aktif;
      d.pin_kunci = aktif ? ($('tPinJenis').value || null) : null;
    }
    return d;
  }

  function simpanLokal() {
    if (!st.user) return;
    try {
      localStorage.setItem(KUNCI_LOKAL, JSON.stringify({
        id: st.artikelId,
        data: kumpulkan(),
        savedAt: Date.now()
      }));
      $('tAutosave').textContent = 'Tersimpan otomatis • ' + waktu();
      st.kotor = false;
    } catch (e) {
      $('tAutosave').textContent = 'Penyimpanan lokal penuh';
    }
  }

  function hapusLokal() {
    try { localStorage.removeItem(KUNCI_LOKAL); } catch (e) {}
  }

  async function simpanNaskah() {
    var data = kumpulkan();
    if (!data.title) throw new Error('Judul wajib diisi.');
    if (data.is_pin && !data.pin_kunci) throw new Error('Pilih jenis PIN dulu (Pantau Pembangunan atau Laporan Rakyat).');

    if (!st.artikelId) {
      var slug = buatSlug(data.title);
      data.slug = slug;
      data.status = 'draf';
      data.author_id = st.user.id;
      data.canonical_url = DOMAIN + '/baca.html?s=' + slug;

      var ins = await sb.from('articles').insert(data).select('id').single();
      if (ins.error) throw new Error('Gagal menyimpan: ' + ins.error.message);
      st.artikelId = ins.data.id;
      history.replaceState(null, '', 'tulis.html?id=' + st.artikelId);
    } else {
      // Status tidak dikirim: status tetap (draf/revisi). Pengajuan lewat advance_article.
      var up = await sb.from('articles').update(data).eq('id', st.artikelId);
      if (up.error) throw new Error('Gagal menyimpan perubahan: ' + up.error.message);
    }

    simpanLokal();
    return st.artikelId;
  }

  async function aksiSimpanDraf() {
    if (st.terkunci || st.sedang) return;
    bersihkanPesan();
    setSibuk(true);
    try {
      await simpanNaskah();
      pesanOk('Draf tersimpan ke server pukul ' + waktu() + '.');
    } catch (e) {
      pesanErr(e.message);
    } finally {
      st.sedang = false;
      if (!st.terkunci) setSibuk(false);
    }
  }

  // Keterangan gambar wajib diisi sebelum diajukan.
  // Gambar di dalam kotak "Baca juga" tidak dihitung, karena itu hanya tautan.
  function cekKeteranganGambar(d) {
    if (d.cover_url && !d.cover_caption) return 'Isi keterangan gambar sampul dulu.';

    var gambar = Array.from($('cmsEditorArea').querySelectorAll('img')).filter(function (im) {
      return !im.closest('.lk-baca-juga');
    });
    for (var i = 0; i < gambar.length; i++) {
      var im = gambar[i];
      var f = im.closest('figure');
      var cap = f && f.querySelector('figcaption');
      if (!cap || !cap.textContent.trim()) {
        im.style.outline = '3px solid #DC2626';
        im.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return 'Gambar ke-' + (i + 1) + ' di isi berita belum ada keterangan (ditandai merah). ' +
          'Tambahkan keterangan di bawahnya, atau hapus gambarnya.';
      }
      im.style.outline = '';
    }
    return '';
  }

  async function aksiAjukan() {
    if (st.terkunci || st.sedang) return;
    bersihkanPesan();

    var d = kumpulkan();
    if (!d.title) return pesanErr('Judul wajib diisi.');
    if (!d.category) return pesanErr('Pilih rubrik dulu.');
    if (!d.description) return pesanErr('Isi deskripsi singkat dulu.');
    var kata = jumlahKata(teksEditor());
    if (kata < MIN_KATA_AJUKAN) {
      return pesanErr('Isi berita minimal ' + MIN_KATA_AJUKAN + ' kata sebelum diajukan. Sekarang ' + kata + ' kata.');
    }
    var salahKet = cekKeteranganGambar(d);
    if (salahKet) return pesanErr(salahKet);
    if (!confirm('Ajukan naskah ini ke redaksi? Setelah diajukan, naskah tidak bisa diubah sampai redaksi meminta revisi.')) return;

    setSibuk(true);
    try {
      await simpanNaskah();
      var r = await sb.rpc('advance_article', { p_id: st.artikelId, p_to: 'diajukan', p_note: null });
      if (r.error) throw new Error('Gagal mengajukan: ' + r.error.message);
      hapusLokal();
      resetBaru('Naskah sudah diajukan ke redaksi. Silakan tulis berita baru.');
    } catch (e) {
      pesanErr(e.message);
    } finally {
      st.sedang = false;
      if (!st.terkunci) setSibuk(false);
    }
  }

  function kunci(teks) {
    st.terkunci = true;
    document.querySelectorAll('#layarTulis input, #layarTulis select, #layarTulis textarea, #layarTulis button, #btnSimpanDraf, #btnAjukan')
      .forEach(function (n) { n.disabled = true; });
    $('cmsEditorArea').contentEditable = 'false';
    pesanOk(teks);
  }

  /* ---------- Isi form (dari draf lokal atau naskah yang sudah ada) ---------- */

  function isiForm(d) {
    $('tTitle').value = d.title || '';
    if (d.category && $('tCategory').querySelector('option[value="' + d.category + '"]')) {
      $('tCategory').value = d.category;
    }
    $('tDesc').value = d.description || '';
    $('tSource').value = d.source || '';
    $('tAuthor').value = d.author_name || $('tAuthor').value;
    $('tTopic').value = d.topic || '';
    $('tMetaTitle').value = d.meta_title || '';
    $('tMetaDesc').value = d.meta_description || '';
    $('tCoverCaption').value = d.cover_caption || '';
    $('tAllowComment').checked = d.allow_comment !== false;
    $('tShowHome').checked = d.show_on_home !== false;
        if (kotakPin) {
      $('tPinAktif').checked = d.is_pin === true;
      $('tPinJenis').value = d.pin_kunci || '';
      sinkronPin();
    }

    st.tags = Array.isArray(d.tags) ? d.tags.slice() : [];
    st.related = Array.isArray(d.related_ids) ? d.related_ids.map(String) : [];
    st.coverUrl = d.cover_url || '';
    if (st.coverUrl) {
      $('tImgEl').src = st.coverUrl;
      $('tImgPreview').hidden = false;
      $('tImgInfo').textContent = 'Gambar sampul sudah terpasang. Pilih gambar lain untuk menggantinya.';
    }

    $('cmsEditorArea').innerHTML = bersihkan(d.body || '');
    renderTag();
    renderTerkait();
    pembaruan();
    st.kotor = false;
  }

  function pulihLokal() {
    var d = null;
    try { d = JSON.parse(localStorage.getItem(KUNCI_LOKAL) || 'null'); } catch (e) { d = null; }
    if (!d || !d.data || (!d.data.title && !d.data.body)) return;

    if (d.id) {
      pesanOk('Ada draf tersimpan di server. Buka lagi dengan alamat tulis.html?id=' + d.id);
      return;
    }
    if (!confirm('Ada draf yang belum sempat dikirim di perangkat ini. Pulihkan?')) return;
    isiForm(d.data);
    pesanOk('Draf dipulihkan dari penyimpanan lokal. Tekan "Simpan draf" untuk menyimpannya ke server.');
  }

  async function muatNaskah(id) {
    var r = await sb.from('articles').select('*').eq('id', id).maybeSingle();
    if (r.error || !r.data) return pesanErr('Naskah tidak ditemukan.');

    var a = r.data;
    if (a.author_id !== st.user.id) return pesanErr('Kamu hanya bisa membuka naskah milikmu sendiri.');

    st.artikelId = a.id;
    isiForm(a);

    if (['draf', 'revisi'].indexOf(a.status) === -1) {
      return kunci('Naskah ini berstatus "' + a.status + '" dan tidak bisa diubah dari halaman ini.');
    }
    if (a.status === 'revisi') {
      var c = $('tCatatanRevisi');
      c.textContent = 'Catatan revisi dari redaksi: ' + (a.review_note || '-') + '. Perbaiki naskah, lalu ajukan lagi.';
      c.hidden = false;
    }
  }

  /* ---------- Pratinjau ---------- */

  function bukaPratinjau() {
    var judul = val('tTitle') || '(Tanpa judul)';
    var gambar = st.coverUrl
      ? '<figure style="margin:0"><img class="tl-pratinjau-gambar" src="' + esc(st.coverUrl) + '" alt="' + esc(judul) + '">' +
        (val('tCoverCaption') ? '<figcaption style="font-style:italic;font-size:13px;color:#6B6890;text-align:center">' + esc(val('tCoverCaption')) + '</figcaption>' : '') +
        '</figure>'
      : '';
    $('pratinjauIsi').innerHTML =
      '<div class="tl-info">' + esc($('tCategory').value || 'Umum') + ' • Oleh ' + esc(val('tAuthor')) + '</div>' +
      '<h2 style="font-family:Sora,sans-serif;font-size:24px;line-height:1.2;margin:8px 0">' + esc(judul) + '</h2>' +
      gambar +
      '<div class="tl-area" style="min-height:0;padding:0">' + isiEditor() + '</div>';
    $('modalPratinjau').hidden = false;
  }

  function tutupPratinjau() {
    $('modalPratinjau').hidden = true;
  }

  /* ---------- Keluar ---------- */

  async function keluar() {
    if (st.kotor) simpanLokal();
    if (sb) await sb.auth.signOut();
    location.href = 'redaksi.html';
  }

  /* ---------- Kejadian ---------- */

  function pasangKejadian() {
    $('tTitle').addEventListener('input', pembaruan);
    $('tDesc').addEventListener('input', pembaruan);
    ['tSource', 'tAuthor', 'tTopic', 'tMetaTitle', 'tMetaDesc', 'tCoverCaption'].forEach(function (id) {
      $(id).addEventListener('input', pembaruan);
    });
    ['tAllowComment', 'tShowHome'].forEach(function (id) {
      $(id).addEventListener('change', pembaruan);
    });
    $('tCategory').addEventListener('change', pembaruan);

    var area = $('cmsEditorArea');
    area.addEventListener('input', pembaruan);
    area.addEventListener('keyup', perbaruiPath);
    area.addEventListener('mouseup', perbaruiPath);
    area.addEventListener('paste', tempelRapi);
    $('cmsHtmlSource').addEventListener('input', pembaruan);

    $('toolbarTulis').addEventListener('click', klikToolbar);

    $('pilihUkuran').addEventListener('change', function (e) {
      if (e.target.value) perintah('fontSize', e.target.value);
      e.target.value = '';
    });
    $('pilihWarna').addEventListener('change', function (e) {
      if (e.target.value) perintah('foreColor', e.target.value);
      e.target.value = '';
    });

    $('tTagInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        tambahTag(this.value);
        this.value = '';
      }
    });
    $('tTagTambah').addEventListener('click', function () {
      tambahTag($('tTagInput').value);
      $('tTagInput').value = '';
    });
    $('tTagChips').addEventListener('click', function (e) {
      var b = e.target.closest('[data-tag]');
      if (!b) return;
      st.tags.splice(Number(b.dataset.tag), 1);
      renderTag();
      st.kotor = true;
    });

    $('tRelatedTambah').addEventListener('click', tambahTerkait);
    $('tRelatedChips').addEventListener('click', function (e) {
      var b = e.target.closest('[data-terkait]');
      if (!b) return;
      st.related.splice(Number(b.dataset.terkait), 1);
      renderTerkait();
      st.kotor = true;
    });

    $('tCoverFile').addEventListener('change', unggahCover);
    $('btnSimpanDraf').addEventListener('click', aksiSimpanDraf);
    $('btnAjukan').addEventListener('click', aksiAjukan);
    $('btnPratinjau').addEventListener('click', bukaPratinjau);
    $('btnTutupPratinjau').addEventListener('click', tutupPratinjau);
    $('modalPratinjau').addEventListener('click', function (e) {
      if (e.target === this) tutupPratinjau();
    });

    $('btnTutupBacaJuga').addEventListener('click', function () { $('modalBacaJuga').hidden = true; });
    $('modalBacaJuga').addEventListener('click', function (e) {
      if (e.target === this) this.hidden = true;
    });
    $('daftarBacaJuga').addEventListener('click', function (e) {
      var b = e.target.closest('[data-id]');
      if (b) pilihBacaJuga(b.dataset.id);
    });

    $('btnKeluar').addEventListener('click', keluar);

    // Peringatan jika tab ditutup saat ada perubahan yang belum tersimpan lokal
    window.addEventListener('beforeunload', function (e) {
      if (st.kotor && !st.terkunci) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }

  /* ---------- Kotak PIN (hanya direktur) ---------- */

  function sinkronPin() {
    $('tPinJenis').disabled = !$('tPinAktif').checked;
  }

  function buatKotakPin() {
    var box = document.createElement('div');
    box.id = 'tPinBox';
    box.style.marginTop = '12px';
    box.innerHTML =
      '<label style="display:flex;gap:8px;align-items:center;font-weight:700">' +
        '<input type="checkbox" id="tPinAktif"> Jadikan PIN</label>' +
      '<select id="tPinJenis" style="margin-top:6px;width:100%">' +
        '<option value="">Pilih jenis…</option>' +
        '<option value="pembangunan">Pantau Pembangunan</option>' +
        '<option value="laporan">Laporan Rakyat</option>' +
      '</select>';
    var acuan = $('tShowHome').closest('label') || $('tShowHome').parentNode;
    acuan.parentNode.insertBefore(box, acuan.nextSibling);
    $('tPinAktif').addEventListener('change', sinkronPin);
    kotakPin = true;
    sinkronPin();
  }
  
  /* ---------- Mulai ---------- */

  async function mulai() {
    if (!sb) return pesanTanpaMasuk('Koneksi ke database belum siap. Periksa config.js.');

    try {
      var s = await sb.auth.getSession();
      var user = s.data && s.data.session && s.data.session.user;
      if (!user) return pesanTanpaMasuk('Silakan masuk dulu di Ruang Redaksi untuk menulis berita.');

      var p = await sb.from('profiles')
        .select('id,username,full_name,role,is_active')
        .eq('id', user.id)
        .maybeSingle();

      if (!p.data || p.data.is_active === false) {
        await sb.auth.signOut();
        return pesanTanpaMasuk('Akun belum aktif atau belum punya profil. Hubungi direktur.');
      }
      if (ROLE_BOLEH.indexOf(p.data.role) === -1) {
        return pesanTanpaMasuk('Peran kamu belum punya izin menulis berita. Hubungi direktur.');
      }

      st.user = user;
      st.profil = p.data;

      $('btnKeluar').hidden = false;
      $('layarTanpa').hidden = true;
      $('layarTulis').hidden = false;
      if (p.data.role === 'direktur') buatKotakPin();
      $('tlBawah').hidden = false;
      $('tAuthor').value = p.data.full_name || p.data.username || '';

      pasangKejadian();
      await Promise.all([muatRubrik(), muatArtikelTerbit()]);

      var id = new URLSearchParams(location.search).get('id');
      if (id) await muatNaskah(id);
      else pulihLokal();

      hitungUlang();
      setInterval(function () { if (st.kotor) simpanLokal(); }, 30000);
    } catch (e) {
      pesanTanpaMasuk('Gagal memuat halaman: ' + (e.message || e));
    }
  }

  mulai();
})();
