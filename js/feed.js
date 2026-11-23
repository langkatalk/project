// js/feed.js
// Beranda: kategori, kartu berita, suka, simpan, bagikan, dan muat lagi saat digulir.
// Hanya membaca artikel terbit. Nama kolom dan status sudah disesuaikan dengan database.
(function () {
  var UKURAN = 10;
  var KATEGORI_CADANGAN = ['Investigasi', 'Ruang Gelap', 'Politik', 'Panggung', 'Ekonomi Gelap', 'Opini', 'Kilas Info'];
  // Body tidak diambil di beranda supaya ringan. Isi lengkap dibaca di baca.html.
  var KOLOM = 'id,title,slug,category,description,cover_url,author_name,published_at,like_count,comment_count,is_exclusive,is_breaking';

  var sb = window.LK && window.LK.sb;
  var el = {
    chips: document.getElementById('chips'),
    feed: document.getElementById('feed'),
    status: document.getElementById('status'),
    sentinel: document.getElementById('sentinel'),
    toast: document.getElementById('toast')
  };

  function ambilLokal(kunci) {
    try { return JSON.parse(localStorage.getItem(kunci) || '[]'); }
    catch (e) { return []; }
  }
  function simpanLokal(kunci, himpunan) {
    localStorage.setItem(kunci, JSON.stringify(Array.from(himpunan)));
  }

  var st = {
    filter: '',                 // '' = semua, '__simpan' = yang disimpan, selain itu nama kategori
    dari: 0,
    selesai: false,
    sedangMuat: false,
    gen: 0,                     // penanda permintaan; hasil lama diabaikan jika filter sudah berganti
    disimpan: new Set(ambilLokal('lk_saved_ids')),
    disukai: new Set(ambilLokal('lk_liked_ids'))
  };

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

  // Kategori dari tabel categories. Kalau kosong, pakai daftar cadangan.
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

  // Dasar query: hanya artikel terbit, tidak di trash, dan sudah lewat jadwalnya.
  function dasarQuery() {
    return sb.from('articles')
      .select(KOLOM)
      .eq('status', 'terbit')
      .is('deleted_at', null)
      .or('scheduled_at.is.null,scheduled_at.lte.' + new Date().toISOString())
      .order('published_at', { ascending: false });
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

    try {
      var data = null;
      var error = null;

      if (st.filter === '__simpan') {
        var ids = Array.from(st.disimpan);
        st.selesai = true;
        if (!ids.length) {
          tulisStatus('Belum ada berita yang kamu simpan.');
          return;
        }
        var rSimpan = await dasarQuery().in('id', ids);
        data = rSimpan.data;
        error = rSimpan.error;
      } else {
        var q = dasarQuery().range(st.dari, st.dari + UKURAN - 1);
        if (st.filter) q = q.eq('category', st.filter);
        var rBiasa = await q;
        data = rBiasa.data;
        error = rBiasa.error;
      }

      if (gen !== st.gen) return; // filter sudah berganti, hasil ini tidak dipakai
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

      el.feed.insertAdjacentHTML('beforeend', data.map(kartu).join(''));
      tulisStatus(st.selesai ? 'Sudah semua berita ditampilkan.' : '');
    } catch (e) {
      if (gen === st.gen) tulisStatus('Gagal memuat berita. Coba lagi sebentar lagi.');
      console.error('[feed]', e);
    } finally {
      if (gen === st.gen) st.sedangMuat = false;
    }
  }

  function kartu(a) {
    var id = a.id;
    var suka = st.disukai.has(id);
    var simpan = st.disimpan.has(id);
    var tujuan = 'baca.html?s=' + encodeURIComponent(a.slug || id);
    var inisial = esc(String(a.author_name || 'R').charAt(0).toUpperCase());

    return '' +
      '<article class="kartu-berita" data-id="' + esc(id) + '">' +
        '<header class="kb-kepala">' +
          '<span class="av">' + inisial + '</span>' +
          '<div class="kb-info">' +
            '<b>' + esc(a.author_name || 'Redaksi') + '</b>' +
            '<small>' + esc(a.category || 'Umum') + ' • ' + tgl(a.published_at) + '</small>' +
          '</div>' +
          (a.is_breaking ? '<span class="lencana">BREAKING</span>' : '') +
          (a.is_exclusive ? '<span class="lencana">EKSKLUSIF</span>' : '') +
        '</header>' +
        (a.cover_url
          ? '<a href="' + tujuan + '"><img class="kb-gambar" src="' + esc(a.cover_url) +
            '" alt="' + esc(a.title) + '" loading="lazy" width="1200" height="675"></a>'
          : '') +
        '<div class="kb-isi">' +
          '<h2 class="kb-judul"><a href="' + tujuan + '">' + esc(a.title) + '</a></h2>' +
          '<p class="kb-desk">' + esc(a.description || '') + '</p>' +
        '</div>' +
        '<footer class="kb-aksi">' +
          '<button type="button" class="btn-aksi suka' + (suka ? ' aktif' : '') + '" data-aksi="suka">' +
            (suka ? '♥' : '♡') + ' <span>' + (a.like_count || 0) + '</span></button>' +
          '<a class="btn-aksi" href="' + tujuan + '">💬 ' + (a.comment_count || 0) + '</a>' +
          '<button type="button" class="btn-aksi" data-aksi="bagi" data-slug="' + esc(a.slug || id) + '">↗ Bagikan</button>' +
          '<button type="button" class="btn-aksi simpan' + (simpan ? ' aktif' : '') + '" data-aksi="simpan">' +
            (simpan ? '🔖 Tersimpan' : '🔖 Simpan') + '</button>' +
        '</footer>' +
      '</article>';
  }

  async function suka(id, tombol) {
    if (!sb) return;
    tombol.disabled = true;
    var r = await sb.rpc('toggle_like', { p_article_id: id, p_device_id: idPerangkat() });
    tombol.disabled = false;

    if (r.error) {
      kabarkan('Gagal menyukai: ' + r.error.message);
      return;
    }
    var d = r.data || {};
    if (d.liked) st.disukai.add(id); else st.disukai.delete(id);
    simpanLokal('lk_liked_ids', st.disukai);

    tombol.classList.toggle('aktif', !!d.liked);
    tombol.innerHTML = (d.liked ? '♥' : '♡') + ' <span>' + (d.like_count || 0) + '</span>';
  }

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
    tombol.textContent = on ? '🔖 Tersimpan' : '🔖 Simpan';

    // Di tab Disimpan, berita yang dibuang langsung hilang dari daftar
    if (!on && st.filter === '__simpan') kartuEl.remove();
  }

  function bagi(slug) {
    var url = location.origin + '/baca.html?s=' + encodeURIComponent(slug);
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

  // Klik kartu: suka, simpan, bagikan
  el.feed.addEventListener('click', function (ev) {
    var tombol = ev.target.closest('[data-aksi]');
    if (!tombol) return;
    var kartuEl = tombol.closest('.kartu-berita');
    var id = Number(kartuEl.dataset.id);
    var aksi = tombol.dataset.aksi;

    if (aksi === 'suka') suka(id, tombol);
    else if (aksi === 'simpan') simpanBerita(id, tombol, kartuEl);
    else if (aksi === 'bagi') bagi(tombol.dataset.slug);
  });

  // Ganti kategori
  el.chips.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-filter]');
    if (!b) return;

    st.gen++;               // batalkan permintaan yang sedang jalan
    st.sedangMuat = false;
    st.filter = b.dataset.filter;
    st.dari = 0;
    st.selesai = false;

    el.feed.innerHTML = '';
    tulisStatus('');
    el.chips.querySelectorAll('.chip-kat').forEach(function (c) {
      c.classList.toggle('on', c === b);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    muatBerikutnya();
  });

  // Muat lagi saat pengguna mendekati bagian bawah
  function pasangPengamat() {
    if (!('IntersectionObserver' in window)) return;
    var pengamat = new IntersectionObserver(function (entri) {
      if (entri[0].isIntersecting) muatBerikutnya();
    }, { rootMargin: '400px 0px' });
    pengamat.observe(el.sentinel);
  }

  async function mulai() {
    await muatKategori();
    pasangPengamat();
    muatBerikutnya();
  }

  mulai();
})();
