// js/feed.js
// Beranda: kartu gaya Instagram, suka (dengan nama dan email), komentar (dengan nama, email, isi), simpan, bagikan.
// Keterangan foto sampul tampil di pojok gambar. Foto penulis diambil dari view public_penulis.
(function () {
  'use strict';

  var UKURAN = 10;
  var JEDA_KOMENTAR_MS = 30000;
  var KATEGORI_CADANGAN = ['Investigasi', 'Ruang Gelap', 'Politik', 'Panggung', 'Ekonomi Gelap', 'Opini', 'Kilas Info'];
  var KOLOM = 'id,title,slug,category,description,cover_url,cover_caption,author_id,author_name,published_at,like_count,comment_count,is_exclusive,is_breaking';
  var REGEX_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  var IKON = {
    hati: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>',
    komen: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.7-.8L3 21l1.9-5.1A8.4 8.4 0 1 1 21 11.5z"/></svg>',
    kirim: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/></svg>',
    simpan: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>'
  };

  var sb = window.LK && window.LK.sb;
  var el = {
    chips: document.getElementById('chips'),
    feed: document.getElementById('feed'),
    status: document.getElementById('status'),
    sentinel: document.getElementById('sentinel'),
    toast: document.getElementById('toast')
  };

  var st = {
    filter: '',
    dari: 0,
    selesai: false,
    sedangMuat: false,
    gen: 0,
    sheetId: null,
    disimpan: new Set(ambilLokal('lk_saved_ids')),
    disukai: new Set(ambilLokal('lk_liked_ids'))
  };

  // Cache foto penulis: id penulis -> url foto ('' kalau tidak punya foto)
  var cachePenulis = {};

  /* ---------- Utilitas ---------- */

  function ambilLokal(kunci) {
    try { return JSON.parse(localStorage.getItem(kunci) || '[]'); }
    catch (e) { return []; }
  }

  function simpanLokal(kunci, himpunan) {
    localStorage.setItem(kunci, JSON.stringify(Array.from(himpunan)));
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

  function tulisStatus(pesan) {
    el.status.textContent = pesan || '';
  }

  function nilai(id) {
    var e = document.getElementById(id);
    return e ? e.value.trim() : '';
  }

  function tampilErr(id, pesan) {
    var e = document.getElementById(id);
    if (e) e.textContent = pesan || '';
  }

  function setSibuk(id, sibuk) {
    var e = document.getElementById(id);
    if (e) e.disabled = !!sibuk;
  }

  function validasiNamaEmail(nama, email) {
    if (nama.length < 3) return 'Nama minimal 3 huruf.';
    if (!REGEX_EMAIL.test(email)) return 'Email belum benar.';
    return '';
  }

  function kartuDari(id) {
    return el.feed.querySelector('.ig-kartu[data-id="' + id + '"]');
  }

  /* ---------- Skeleton ---------- */

  function tampilSkeleton(jumlah) {
    if (el.feed.querySelector('.lk-skel-kartu')) return;
    var n = jumlah || 4;
    var html = '';
    for (var i = 0; i < n; i++) {
      html +=
        '<article class="ig-kartu lk-skel-kartu" aria-hidden="true">' +
          '<div class="ig-kepala">' +
            '<span class="lk-skel-blok lk-skel-av"></span>' +
            '<div class="ig-info">' +
              '<div class="lk-skel-blok lk-skel-baris lk-skel-pendek"></div>' +
              '<div class="lk-skel-blok lk-skel-baris" style="width:65%"></div>' +
            '</div>' +
          '</div>' +
          '<div class="lk-skel-blok lk-skel-media"></div>' +
          '<div class="ig-isi">' +
            '<div class="lk-skel-blok lk-skel-judul"></div>' +
            '<div class="lk-skel-blok lk-skel-baris"></div>' +
            '<div class="lk-skel-blok lk-skel-baris" style="width:74%"></div>' +
          '</div>' +
        '</article>';
    }
    el.feed.insertAdjacentHTML('beforeend', html);
  }

  function hapusSkeleton() {
    el.feed.querySelectorAll('.lk-skel-kartu').forEach(function (k) { k.remove(); });
  }

  /* ---------- Panel bawah ---------- */

  function buatSheet() {
    var bg = document.createElement('div');
    bg.className = 'lk-sheet-bg';
    bg.id = 'sheetBg';

    var sh = document.createElement('div');
    sh.className = 'lk-sheet';
    sh.id = 'sheet';
    sh.setAttribute('role', 'dialog');
    sh.setAttribute('aria-modal', 'true');
    sh.innerHTML = '<div class="lk-grip"></div><div id="sheetIsi"></div>';

    document.body.appendChild(bg);
    document.body.appendChild(sh);

    bg.addEventListener('click', tutupSheet);
    sh.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-tutup]')) tutupSheet();
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') tutupSheet();
    });
  }

  function bukaSheet(html) {
    document.getElementById('sheetIsi').innerHTML = html;
    document.getElementById('sheet').classList.add('on');
    document.getElementById('sheetBg').classList.add('on');
  }

  function tutupSheet() {
    var sh = document.getElementById('sheet');
    var bg = document.getElementById('sheetBg');
    if (sh) sh.classList.remove('on');
    if (bg) bg.classList.remove('on');
    st.sheetId = null;
  }

  function campo(id, label, tipe, placeholder) {
    return '<label class="sh-label">' + label +
      '<input id="' + id + '" type="' + tipe + '" placeholder="' + placeholder +
      '" autocomplete="' + (tipe === 'email' ? 'email' : 'name') + '"></label>';
  }

  /* ---------- Kategori ---------- */

  async function muatKategori() {
    var daftar = [];
    if (sb) {
      var r = await sb.from('categories').select('name').order('sort', { ascending: true });
      if (!r.error && r.data) daftar = r.data.map(function (x) { return x.name; });
    }
    if (!daftar.length) daftar = KATEGORI_CADANGAN;

    var pilihan = [{ nama: 'Semua', nilai: '' }]
      .concat(daftar.map(function (n) { return { nama: n, nilai: n }; }))
      .concat([{ nama: 'Disimpan', nilai: '__simpan' }]);

    el.chips.innerHTML = pilihan.map(function (p) {
      return '<button type="button" class="chip-kat' + (p.nilai === st.filter ? ' on' : '') +
        '" data-filter="' + esc(p.nilai) + '">' + esc(p.nama) + '</button>';
    }).join('');
  }

  /* ---------- Foto penulis ---------- */

  // Mengambil foto penulis untuk daftar berita. Hanya id dan foto yang dibaca (lewat view public_penulis).
  async function ambilPenulis(data) {
    try {
      var ids = Array.from(new Set(data.map(function (a) { return a.author_id; }).filter(Boolean)))
        .filter(function (id) { return !(id in cachePenulis); });

      if (ids.length) {
        var r = await sb.from('public_penulis').select('id,avatar_url').in('id', ids);
        if (!r.error && r.data) {
          r.data.forEach(function (p) { cachePenulis[p.id] = p.avatar_url || ''; });
        }
        ids.forEach(function (id) {
          if (!(id in cachePenulis)) cachePenulis[id] = '';
        });
      }
    } catch (e) {
      console.error('[feed] foto penulis', e);
    }
    return cachePenulis;
  }

  /* ---------- Muat berita ---------- */

  function dasarQuery() {
    var q = sb.from('articles')
      .select(KOLOM)
      .eq('status', 'terbit')
      .eq('is_pin', false)
      .is('deleted_at', null)
      .or('scheduled_at.is.null,scheduled_at.lte.' + new Date().toISOString());

    if (st.rentang) {
      q = q.gte('published_at', st.rentang.dari).lt('published_at', st.rentang.sampai);
    }

    var u = st.urutan || 'terbaru';
    if (u === 'terlama') return q.order('published_at', { ascending: true });
    if (u === 'az') return q.order('title', { ascending: true });
    if (u === 'za') return q.order('title', { ascending: false });
    if (u === 'populer') return q.order('like_count', { ascending: false }).order('published_at', { ascending: false });
    return q.order('published_at', { ascending: false });
  }

  async function muatBerikutnya() {
    if (st.sedangMuat || st.selesai) return;
    if (!sb) {
      tulisStatus('Koneksi ke database belum siap. Periksa config.js.');
      return;
    }

    var gen = st.gen;
    st.sedangMuat = true;
    tulisStatus('Memuat…');
    tampilSkeleton(window.innerWidth < 768 ? 3 : 4);

    try {
      var data, error;

      if (st.filter === '__simpan') {
        var ids = Array.from(st.disimpan);
        st.selesai = true;
        if (!ids.length) {
          hapusSkeleton();
          tulisStatus('Belum ada berita yang kamu simpan.');
          return;
        }
        var rs = await dasarQuery().in('id', ids);
        data = rs.data; error = rs.error;
      } else {
        var q = dasarQuery().range(st.dari, st.dari + UKURAN - 1);
        if (st.filter) q = q.eq('category', st.filter);
        var rb = await q;
        data = rb.data; error = rb.error;
      }

      if (gen !== st.gen) return;
      hapusSkeleton();
      if (error) throw error;

      if (st.filter !== '__simpan') {
        st.dari += UKURAN;
        if (!data || data.length < UKURAN) st.selesai = true;
      }

      if (!data || !data.length) {
        tulisStatus(el.feed.children.length
          ? 'Sudah semua berita ditampilkan.'
          : 'Belum ada berita di kategori ini.');
        return;
      }

      var peta = await ambilPenulis(data);
      if (gen !== st.gen) return;

      el.feed.insertAdjacentHTML('beforeend', data.map(function (a) { return kartu(a, peta); }).join(''));
            sisipIklanFeed();
      tulisStatus(st.selesai ? 'Sudah semua berita ditampilkan.' : '');
    } catch (e) {
      if (gen === st.gen) tulisStatus('Gagal memuat berita. Coba lagi sebentar lagi.');
      if (gen === st.gen) hapusSkeleton();
      console.error('[feed]', e);
    } finally {
      if (gen === st.gen) st.sedangMuat = false;
    }
  }

  function kartu(a, peta) {
    var id = a.id;
    var disukai = st.disukai.has(id);
    var disimpan = st.disimpan.has(id);
    var tujuan = 'baca.html?s=' + encodeURIComponent(a.slug || id);
    var namaPenulis = a.author_name || 'Redaksi';
    var inisial = esc(String(namaPenulis).charAt(0).toUpperCase());
    var fotoPenulis = peta ? peta[a.author_id] : '';

    var avatar = fotoPenulis
      ? '<img class="av av-foto" src="' + esc(fotoPenulis) + '" alt="' + esc(namaPenulis) +
        '" width="34" height="34" loading="lazy" decoding="async">'
      : '<span class="av">' + inisial + '</span>';

    var keterangan = a.cover_caption
      ? '<span class="ig-keterangan">' + esc(a.cover_caption) + '</span>'
      : '';

    var gambar = a.cover_url
      ? '<a href="' + tujuan + '" class="ig-media"><img class="ig-gambar" src="' + esc(a.cover_url) +
        '" alt="' + esc(a.title) + '" width="1200" height="600" loading="lazy" decoding="async">' +
        keterangan + '</a>'
      : '<a href="' + tujuan + '" class="ig-media ig-media-kosong"><span>Langkatalk</span></a>';

    return '' +
      '<article class="ig-kartu" data-id="' + esc(id) + '">' +
        '<header class="ig-kepala">' +
          avatar +
          '<div class="ig-info">' +
            '<b>' + esc(namaPenulis) + '</b>' +
            '<small>' + esc(a.category || 'Umum') + ' • ' + tgl(a.published_at) + '</small>' +
          '</div>' +
          (a.is_breaking ? '<span class="lencana">BREAKING</span>' : '') +
          (a.is_exclusive ? '<span class="lencana">EKSKLUSIF</span>' : '') +
        '</header>' +
        gambar +
        '<div class="ig-aksi">' +
          '<button type="button" class="ig-ikon suka' + (disukai ? ' aktif' : '') + '" data-aksi="suka"' +
            ' aria-label="Suka" aria-pressed="' + disukai + '">' + IKON.hati + '</button>' +
          '<button type="button" class="ig-ikon" data-aksi="komen" aria-label="Komentar">' + IKON.komen + '</button>' +
          '<button type="button" class="ig-ikon" data-aksi="bagi" data-slug="' + esc(a.slug || id) +
            '" aria-label="Bagikan">' + IKON.kirim + '</button>' +
          '<button type="button" class="ig-ikon ig-simpan' + (disimpan ? ' aktif' : '') + '" data-aksi="simpan"' +
            ' aria-label="Simpan">' + IKON.simpan + '</button>' +
        '</div>' +
        '<div class="ig-isi">' +
          '<p class="ig-jumlah"><span data-jumlah-suka>' + (a.like_count || 0) + '</span> suka</p>' +
          '<h2 class="ig-judul"><a href="' + tujuan + '">' + esc(a.title) + '</a></h2>' +
          (a.description ? '<p class="ig-desk">' + esc(a.description) + '</p>' : '') +
          '<button type="button" class="ig-lihat" data-aksi="komen">Lihat ' + (a.comment_count || 0) + ' komentar</button>' +
        '</div>' +
      '</article>';
  }

  /* ---------- Suka ---------- */

  function panggilSuka(id, nama, email) {
    return sb.rpc('suka_berita', {
      p_article_id: id,
      p_device_id: idPerangkat(),
      p_nama: nama,
      p_email: email
    });
  }

  // Menerapkan hasil dari server. Mengembalikan true jika sekarang disukai.
  function terapkanSuka(id, data) {
    var d = Array.isArray(data) ? data[0] : data;
    if (!d) return false;

    if (d.disukai) st.disukai.add(id); else st.disukai.delete(id);
    simpanLokal('lk_liked_ids', st.disukai);

    var kartuEl = kartuDari(id);
    if (kartuEl) {
      var tombol = kartuEl.querySelector('.ig-ikon.suka');
      tombol.classList.toggle('aktif', !!d.disukai);
      tombol.setAttribute('aria-pressed', String(!!d.disukai));
      kartuEl.querySelector('[data-jumlah-suka]').textContent = d.jumlah || 0;
    }
    return !!d.disukai;
  }

  async function tanganiSuka(id) {
    if (!sb) return kabarkan('Koneksi belum siap');

    // Sudah pernah disukai di perangkat ini: batalkan langsung, tanpa form
    if (st.disukai.has(id)) {
      var r = await panggilSuka(id, null, null);
      if (r.error) {
        // Kalau data lokal tidak cocok dengan server, minta nama dan email
        if (/Nama|Email/i.test(r.error.message)) return formSuka(id);
        return kabarkan('Gagal: ' + r.error.message);
      }
      terapkanSuka(id, r.data);
      kabarkan('Suka dibatalkan');
      return;
    }

    formSuka(id);
  }

  function formSuka(id) {
    st.sheetId = id;
    bukaSheet(
      '<h3 class="sh-judul">Suka berita ini</h3>' +
      '<p class="sh-catatan">Isi nama dan email dulu. Data ini hanya untuk redaksi dan tidak ditampilkan ke publik.</p>' +
      '<form id="fSuka" class="sh-form" novalidate>' +
        campo('sNama', 'Nama', 'text', 'Nama kamu (minimal 3 huruf)') +
        campo('sEmail', 'Email', 'email', 'nama@email.com') +
        '<p class="sh-err" id="sErr"></p>' +
        '<div class="sh-tombol">' +
          '<button type="button" class="btn-tutup" data-tutup>Batal</button>' +
          '<button type="submit" class="btn btn-utama" id="sKirim">Suka</button>' +
        '</div>' +
      '</form>'
    );

    document.getElementById('fSuka').addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var nama = nilai('sNama');
      var email = nilai('sEmail').toLowerCase();

      var salah = validasiNamaEmail(nama, email);
      if (salah) return tampilErr('sErr', salah);

      setSibuk('sKirim', true);
      var r = await panggilSuka(id, nama, email);
      setSibuk('sKirim', false);

      if (r.error) return tampilErr('sErr', r.error.message);

      var disukai = terapkanSuka(id, r.data);
      tutupSheet();
      kabarkan(disukai ? 'Berita disukai' : 'Suka dibatalkan');
    });
  }

  /* ---------- Komentar ---------- */

  function formKomen(id) {
    st.sheetId = id;
    bukaSheet(
      '<h3 class="sh-judul">Komentar</h3>' +
      '<div class="k-list" id="kList"><p class="sh-catatan">Memuat komentar…</p></div>' +
      '<form id="fKomen" class="sh-form" novalidate>' +
        campo('kNama', 'Nama', 'text', 'Nama kamu (minimal 3 huruf)') +
        campo('kEmail', 'Email', 'email', 'nama@email.com') +
        '<label class="sh-label">Komentar' +
          '<textarea id="kIsi" rows="3" maxlength="500" placeholder="Tulis komentar (3–500 karakter)"></textarea>' +
        '</label>' +
        '<p class="sh-catatan">Email tidak ditampilkan ke publik. Komentar tampil setelah disetujui redaksi.</p>' +
        '<p class="sh-err" id="kErr"></p>' +
        '<div class="sh-tombol">' +
          '<button type="button" class="btn-tutup" data-tutup>Tutup</button>' +
          '<button type="submit" class="btn btn-utama" id="kKirim">Kirim komentar</button>' +
        '</div>' +
      '</form>'
    );

    muatKomentar(id);
    document.getElementById('fKomen').addEventListener('submit', function (ev) {
      ev.preventDefault();
      kirimKomentar(id);
    });
  }

  async function muatKomentar(id) {
    if (!sb) return;
    var r = await sb.from('public_comments')
      .select('guest_name,body,created_at')
      .eq('article_id', id)
      .order('created_at', { ascending: false })
      .limit(30);

    // Sheet sudah ditutup atau pindah ke berita lain
    if (st.sheetId !== id) return;
    var box = document.getElementById('kList');
    if (!box) return;

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

  async function kirimKomentar(id) {
    var nama = nilai('kNama');
    var email = nilai('kEmail').toLowerCase();
    var isi = nilai('kIsi');

    var salah = validasiNamaEmail(nama, email);
    if (!salah && isi.length < 3) salah = 'Komentar minimal 3 karakter.';
    if (salah) return tampilErr('kErr', salah);

    var kunciJeda = 'lk_cmt_rate_' + id;
    var sisa = JEDA_KOMENTAR_MS - (Date.now() - Number(localStorage.getItem(kunciJeda) || 0));
    if (sisa > 0) {
      return tampilErr('kErr', 'Tunggu ' + Math.ceil(sisa / 1000) + ' detik sebelum mengirim lagi.');
    }

    setSibuk('kKirim', true);
    var r = await sb.from('comments').insert({
      article_id: id,
      guest_name: nama,
      guest_email: email,
      body: isi,
      device_id: idPerangkat(),
      status: 'menunggu'
    });
    setSibuk('kKirim', false);

    if (r.error) return tampilErr('kErr', 'Komentar belum terkirim: ' + r.error.message);

    localStorage.setItem(kunciJeda, String(Date.now()));
    document.getElementById('fKomen').reset();
    tampilErr('kErr', '');
    kabarkan('Komentar terkirim, menunggu persetujuan redaksi');
  }

  /* ---------- Simpan dan bagikan ---------- */

  function simpanBerita(id, tombol, kartuEl) {
    if (st.disimpan.has(id)) {
      st.disimpan.delete(id);
      kabarkan('Dihapus dari daftar simpan');
    } else {
      st.disimpan.add(id);
      kabarkan('Berita disimpan');
    }
    simpanLokal('lk_saved_ids', st.disimpan);

    var on = st.disimpan.has(id);
    tombol.classList.toggle('aktif', on);

    // Di tab Disimpan, berita yang dibuang langsung hilang dari daftar
    if (!on && st.filter === '__simpan') kartuEl.remove();
  }

  function bagi(slug) {
    var url = location.origin + '/api/berita?s=' + encodeURIComponent(slug);
    if (navigator.share) {
      navigator.share({ title: 'Langkatalk', url: url }).catch(function () {});
      return;
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(function () { kabarkan('Tautan disalin'); });
    } else {
      kabarkan(url);
    }
  }

  /* ---------- Kejadian ---------- */

  el.feed.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-aksi]');
    if (!t) return;
    var kartuEl = t.closest('.ig-kartu');
    var id = Number(kartuEl.dataset.id);
    var aksi = t.dataset.aksi;

    if (aksi === 'suka') tanganiSuka(id);
    else if (aksi === 'komen') formKomen(id);
    else if (aksi === 'bagi') bagi(t.dataset.slug);
    else if (aksi === 'simpan') simpanBerita(id, t, kartuEl);
  });

  // Mengosongkan daftar dan memuat ulang dari awal, dengan filter yang sekarang aktif
  function muatUlang() {
    st.gen++;
    st.sedangMuat = false;
    st.dari = 0;
    st.selesai = false;

    el.feed.innerHTML = '';
    tulisStatus('');
    tampilSkeleton(window.innerWidth < 768 ? 3 : 4);
    el.chips.querySelectorAll('.chip-kat').forEach(function (c) {
      c.classList.toggle('on', (c.dataset.filter || '') === (st.filter || ''));
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    muatBerikutnya();
  }

  // Klik chip kategori
  el.chips.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-filter]');
    if (!b) return;
    st.filter = b.dataset.filter;
    document.dispatchEvent(new CustomEvent('lk:kategori', {
      detail: st.filter === '__simpan' ? '' : st.filter
    }));
    muatUlang();
  });

  // Terapkan atau reset dari pop-up filter (js/filter.js)
  document.addEventListener('lk:filter', function (ev) {
    var d = ev.detail || {};
    st.filter = d.kategori || '';
    st.urutan = d.urutan || 'terbaru';
    st.rentang = d.rentang || null;
    muatUlang();
  });

  function pasangPengamat() {
    if (!('IntersectionObserver' in window)) return;
    var pengamat = new IntersectionObserver(function (entri) {
      if (entri[0].isIntersecting) muatBerikutnya();
    }, { rootMargin: '400px 0px' });
    pengamat.observe(el.sentinel);
  }

  /* ---------- Breaking news: slideshow di atas feed ---------- */
  var elBreaking = document.getElementById('breaking');
  var bkIndeks = 0;
  var bkTimer = null;
  var bkJumlah = 0;

  function bkSlide(a) {
    var tujuan = 'baca.html?s=' + encodeURIComponent(a.slug || a.id);
    return '<a class="lk-bk-slide" href="' + tujuan + '">' +
      (a.cover_url
        ? '<img src="' + esc(a.cover_url) + '" alt="' + esc(a.title) + '" width="1200" height="600" decoding="async">'
        : '') +
      '<div class="lk-bk-isi">' +
        '<span class="lk-bk-kat">' + esc(a.category || 'Berita') + '</span>' +
        '<h2>' + esc(a.title) + '</h2>' +
        (a.description ? '<p>' + esc(a.description) + '</p>' : '') +
      '</div>' +
    '</a>';
  }

  async function muatBreaking() {
    if (!elBreaking || !sb) return;
    var iso = new Date().toISOString();
    var batas12Jam = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    var kolom = 'id,title,slug,description,cover_url,category,breaking_urutan,published_at';

    // 1. Breaking: ditandai is_breaking, terbit dalam 12 jam terakhir, urutan 1 sampai 3
    var rb = await sb.from('articles')
      .select(kolom)
      .eq('status', 'terbit')
      .eq('is_breaking', true)
      .is('deleted_at', null)
      .not('breaking_urutan', 'is', null)
      .or('scheduled_at.is.null,scheduled_at.lte.' + iso)
      .order('breaking_urutan', { ascending: true })
      .limit(3);

    var data = (!rb.error && rb.data) ? rb.data.slice(0, 3) : [];

    // 2. Kalau kurang dari 3, isi dengan berita terbaru yang belum tampil
    if (data.length < 3) {
      var rt = await sb.from('articles')
        .select(kolom)
        .eq('status', 'terbit')
        .eq('is_pin', false)
        .is('deleted_at', null)
        .or('scheduled_at.is.null,scheduled_at.lte.' + iso)
        .order('published_at', { ascending: false })
        .limit(8);

      if (!rt.error && rt.data) {
        var sudahAda = new Set(data.map(function (a) { return a.id; }));
        rt.data.forEach(function (a) {
          if (data.length < 3 && !sudahAda.has(a.id)) {
            data.push(a);
            sudahAda.add(a.id);
          }
        });
      }
    }
    if (!data.length) {
      elBreaking.hidden = true;
      elBreaking.innerHTML = '';
      return;
    }

    bkJumlah = data.length;
    elBreaking.hidden = false;
    elBreaking.innerHTML =
      '<span class="lk-bk-label">BREAKING NEWS</span>' +
      '<div class="lk-bk-track" id="bkTrack">' + data.map(bkSlide).join('') + '</div>' +
      (data.length > 1
        ? '<div class="lk-bk-nav">' + data.map(function (_, i) {
            return '<button type="button" class="lk-bk-dot' + (i === 0 ? ' on' : '') +
              '" data-bk-dot="' + i + '" aria-label="Berita ' + (i + 1) + '"></button>';
          }).join('') + '</div>'
        : '');

    pasangSlider();
  }

  function pasangSlider() {
    var track = document.getElementById('bkTrack');
    if (!track) return;
    var dots = elBreaking.querySelectorAll('[data-bk-dot]');

    function aktifkan(i) {
      bkIndeks = i;
      dots.forEach(function (d, k) { d.classList.toggle('on', k === i); });
    }

    function kePosisi(i) {
      track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' });
      aktifkan(i);
    }

    track.addEventListener('scroll', function () {
      var i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
      i = Math.min(Math.max(i, 0), bkJumlah - 1);
      if (i !== bkIndeks) aktifkan(i);
    }, { passive: true });

    elBreaking.addEventListener('click', function (ev) {
      var d = ev.target.closest('[data-bk-dot]');
      if (d) kePosisi(Number(d.dataset.bkDot));
    });

    function hentikan() { clearInterval(bkTimer); }

    function jalankan() {
      hentikan();
      if (bkJumlah < 2) return;
      // PC: ketiga berita tampil sekaligus, tidak berputar
      if (window.matchMedia('(min-width: 1024px)').matches) return;
      bkTimer = setInterval(function () {
        kePosisi((bkIndeks + 1) % bkJumlah);
      }, 5000);
    }

    elBreaking.addEventListener('pointerenter', hentikan);
    elBreaking.addEventListener('pointerleave', jalankan);
    elBreaking.addEventListener('touchstart', hentikan, { passive: true });
    elBreaking.addEventListener('touchend', function () { setTimeout(jalankan, 4000); }, { passive: true });

    jalankan();
  }
    /* ---------- Iklan di beranda ---------- */

  var IKLAN_POSISI = { feed_1: 4, feed_google: 8, feed_2: 12 };
  var iklanBeranda = {};
  var iklanSiap = false;

  function pasangScriptAdsense(client) {
    if (document.getElementById('adsense-js')) return;
    var sc = document.createElement('script');
    sc.id = 'adsense-js';
    sc.async = true;
    sc.crossOrigin = 'anonymous';
    sc.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(client);
    document.head.appendChild(sc);
  }

  function bungkusIklan(id) {
    var s = iklanBeranda[id];
    if (!s) return '';
    var luar = id === 'banner_atas' || id === 'banner_bawah' || id === 'google_atas';
    var kelasLuar = luar ? ' ad-luar' : '';

    if (s.ad_type === 'adsense') {
      if (!s.adsense_client || !s.adsense_slot_id) return '';
      return '<div class="ad-slot ad-google' + kelasLuar + '" data-ad-slot="' + id + '">' +
        '<span class="ad-badge">Iklan</span>' +
        '<ins class="adsbygoogle" style="display:block" data-ad-client="' + esc(s.adsense_client) +
        '" data-ad-slot="' + esc(s.adsense_slot_id) + '" data-ad-format="auto" data-full-width-responsive="true"></ins>' +
      '</div>';
    }

    if (!s.image_url) return '';
    var kelasRasio = id.indexOf('banner') === 0 ? 'ad-4-1' : 'ad-2-1';
    var tinggi = kelasRasio === 'ad-4-1' ? 300 : 600;
    var gambar = '<img src="' + esc(s.image_url) + '" alt="' + esc(s.title || 'Iklan Langkatalk') +
      '" width="1200" height="' + tinggi + '" loading="lazy" decoding="async">';
    var aman = s.link_url && /^https:\/\//i.test(s.link_url);
    var isi = aman
      ? '<a class="ad-manual" href="' + esc(s.link_url) + '" target="_blank" rel="noopener sponsored">' + gambar + '</a>'
      : '<div class="ad-manual">' + gambar + '</div>';
    return '<div class="ad-slot ' + kelasRasio + kelasLuar + '" data-ad-slot="' + id + '">' +
      '<span class="ad-badge">Iklan</span>' + isi + '</div>';
  }

  function aktifkanAdsense() {
    document.querySelectorAll('ins.adsbygoogle').forEach(function (ins) {
      if (ins.dataset.dipasang) return;
      ins.dataset.dipasang = '1';
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
    });
    // Ruang Google yang tidak terisi iklan dihapus, supaya tidak meninggalkan kotak kosong
    setTimeout(function () {
      document.querySelectorAll('.ad-google').forEach(function (wadah) {
        var ins = wadah.querySelector('ins');
        var status = ins ? ins.getAttribute('data-ad-status') : null;
        if (!ins || status === 'unfilled' || (status !== 'filled' && ins.offsetHeight < 10)) {
          wadah.remove();
        }
      });
    }, 4000);
  }

  async function muatIklanBeranda() {
    if (!sb) return;
    var r = await sb.from('ads')
      .select('slot,ad_type,title,image_url,link_url,adsense_client,adsense_slot_id')
      .eq('is_active', true);

    if (!r.error && r.data) {
      r.data.forEach(function (x) { iklanBeranda[x.slot] = x; });
      var google = r.data.find(function (x) {
        return x.ad_type === 'adsense' && x.adsense_client && x.adsense_slot_id;
      });
      if (google) pasangScriptAdsense(google.adsense_client);
    }
    iklanSiap = true;

    // Ruang di atas feed (setelah breaking news)
    ['banner_atas', 'google_atas'].forEach(function (id) {
      var html = bungkusIklan(id);
      if (html) el.feed.insertAdjacentHTML('beforebegin', html);
    });

    // Ruang di atas footer
    var footer = document.querySelector('.lk-footer');
    var bawah = bungkusIklan('banner_bawah');
    if (footer && bawah) footer.insertAdjacentHTML('beforebegin', bawah);

    sisipIklanFeed();
  }

  // Menyisipkan iklan di antara kartu: setelah kartu ke-4, ke-8, dan ke-12
  function sisipIklanFeed() {
    if (!iklanSiap || st.filter === '__simpan') return;
    var kartu = el.feed.querySelectorAll('.ig-kartu');
    Object.keys(IKLAN_POSISI).forEach(function (id) {
      var p = IKLAN_POSISI[id];
      if (kartu.length < p) return;
      if (el.feed.querySelector('[data-ad-slot="' + id + '"]')) return;
      var html = bungkusIklan(id);
      if (html) kartu[p - 1].insertAdjacentHTML('afterend', html);
    });
    aktifkanAdsense();
  }
  async function mulai() {
    buatSheet();
    await muatKategori();
    pasangPengamat();
        muatBreaking();
        muatIklanBeranda();
    muatBerikutnya();
  }

  /* ---------- Pencarian: ikon kaca, panel dari atas ---------- */
  function pasangCari() {
    var header = document.querySelector('.lk-header');
    if (!header || document.getElementById('cariBtn')) return;

    var tombol = document.createElement('button');
    tombol.type = 'button';
    tombol.id = 'cariBtn';
    tombol.className = 'cari-btn';
    tombol.setAttribute('aria-label', 'Cari berita');
    tombol.innerHTML =
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" ' +
      'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';
    header.insertBefore(tombol, header.lastElementChild);

    var panel = document.createElement('div');
    panel.id = 'cariPanel';
    panel.className = 'cari-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'Cari berita');
    panel.innerHTML =
      '<div class="cari-kaca">' +
        '<div class="cari-baris">' +
          '<input id="cariInput" type="search" autocomplete="off" ' +
          'placeholder="Cari judul, isi, atau kata kunci…" aria-label="Kata kunci">' +
          '<button type="button" class="cari-tutup" id="cariTutup" aria-label="Tutup">✕</button>' +
        '</div>' +
        '<div id="cariHasil" class="cari-hasil" aria-live="polite"></div>' +
      '</div>';
    document.body.appendChild(panel);

    var input = document.getElementById('cariInput');
    var hasil = document.getElementById('cariHasil');
    var timer = null;
    var nomor = 0;

    function buka() {
      panel.classList.add('on');
      setTimeout(function () { input.focus(); }, 180);
    }

    function tutup() {
      panel.classList.remove('on');
      input.blur();
    }

    // Membuang karakter yang bisa merusak filter pencarian
    function bersihkanKata(s) {
      return String(s || '').replace(/[(),*%_\\]/g, ' ').replace(/\s+/g, ' ').trim();
    }

    async function cari(kata) {
      var k = bersihkanKata(kata);
      var id = ++nomor;

      if (k.length < 2) {
        hasil.innerHTML = '<p class="cari-info">Ketik minimal 2 huruf untuk mencari.</p>';
        return;
      }
      hasil.innerHTML = '<div class="cari-kerangka"><span></span><span></span><span></span></div>';
      if (!sb) return;

      var r = await sb.from('articles')
        .select('id,title,slug,category,cover_url,published_at')
        .eq('status', 'terbit')
        .is('deleted_at', null)
        .or('scheduled_at.is.null,scheduled_at.lte.' + new Date().toISOString())
        .or('title.ilike.*' + k + '*,description.ilike.*' + k + '*')
        .order('published_at', { ascending: false })
        .limit(12);

      if (id !== nomor) return; // sudah digantikan pencarian yang lebih baru

      if (r.error) {
        hasil.innerHTML = '<p class="cari-info">Pencarian belum bisa dilakukan. Coba lagi.</p>';
        return;
      }
      var data = r.data || [];
      if (!data.length) {
        hasil.innerHTML = '<p class="cari-info">Tidak ada berita untuk “' + esc(k) + '”.</p>';
        return;
      }

      hasil.innerHTML = data.map(function (a) {
        var tujuan = 'baca.html?s=' + encodeURIComponent(a.slug || a.id);
        return '<a class="cari-item" href="' + tujuan + '">' +
          (a.cover_url
            ? '<img src="' + esc(a.cover_url) + '" alt="" loading="lazy" decoding="async">'
            : '<span class="cari-ph"></span>') +
          '<span class="cari-teks"><b>' + esc(a.title) + '</b>' +
          '<small>' + esc(a.category || 'Umum') + ' • ' + tgl(a.published_at) + '</small></span>' +
        '</a>';
      }).join('');
    }

    tombol.addEventListener('click', buka);
    document.getElementById('cariTutup').addEventListener('click', tutup);
    panel.addEventListener('click', function (e) { if (e.target === panel) tutup(); });
    hasil.addEventListener('click', tutup);

    input.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { cari(input.value); }, 280);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.classList.contains('on')) tutup();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        buka();
      }
    });
  }

  pasangCari();
  mulai();
})();
