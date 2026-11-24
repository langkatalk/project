// js/dashboard.js
// Ruang Redaksi: masuk, menu sesuai peran, Naskah (dengan submenu status), Komentar, dan Log.
// Perubahan status naskah lewat fungsi resmi di database.
(function () {
  'use strict'; 

  var sb = window.LK && window.LK.sb;
  var REGEX_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  var NAMA_PERAN = {
    direktur: 'Direktur', pemred: 'Pemimpin Redaksi', redaktur: 'Redaktur',
    editor: 'Editor', reporter: 'Reporter', kontributor: 'Kontributor'
  };
  var LABEL_STATUS = {
    draf: 'Draf', draft: 'Draf', diajukan: 'Diajukan', disunting: 'Disunting',
    ditinjau: 'Ditinjau', revisi: 'Revisi', terbit: 'Terbit', arsip: 'Arsip'
  };
  var STAF = ['direktur', 'pemred', 'redaktur', 'editor'];
  var SUDAH_DIBUAT = ['naskah', 'komentar', 'log', 'pengguna', 'breaking', 'iklan', 'halaman'];
  var FOTO_SISI = 480;
  var FOTO_MAX_MB = 2;
  var FILTER_NASKAH = [
    { id: 'semua', nama: 'Semua' },
    { id: 'draf', nama: 'Draf' },
    { id: 'proses', nama: 'Diajukan & proses' },
    { id: 'revisi', nama: 'Revisi' },
    { id: 'terbit', nama: 'Terbit' },
    { id: 'arsip', nama: 'Arsip' },
    { id: 'sampah', nama: 'Sampah' }
  ];
  var FILTER_KOMEN = [
    { id: 'menunggu', nama: 'Menunggu' },
    { id: 'disetujui', nama: 'Disetujui' },
    { id: 'ditolak', nama: 'Ditolak' }
  ];

  var state = { profil: null, tab: sessionStorage.getItem('lk_tab') || 'naskah', fNaskah: 'semua', fKomen: 'menunggu', naskah: [], komen: [], pengguna: [] };

  var el = {
    masuk: document.getElementById('layarMasuk'),
    daftar: document.getElementById('layarDaftar'),
    app: document.getElementById('layarApp'),
    profil: document.getElementById('profil'),
    tabs: document.getElementById('tabs'),
    isi: document.getElementById('isi'),
    aksi: document.getElementById('aksiKanan'),
    form: document.getElementById('formMasuk'),
    email: document.getElementById('mEmail'),
    sandi: document.getElementById('mSandi'),
    err: document.getElementById('mErr'),
    kirim: document.getElementById('mKirim'),
    lupa: document.getElementById('btnLupaSandi'),
    keluar: document.getElementById('btnKeluar'),
    toast: document.getElementById('toast'),
    btnKeDaftar: document.getElementById('btnKeDaftar'),
    btnKeMasuk: document.getElementById('btnKeMasuk'),
    formDaftar: document.getElementById('formDaftar'),
    dNama: document.getElementById('dNama'),
    dUsername: document.getElementById('dUsername'),
    dEmail: document.getElementById('dEmail'),
    dSandi: document.getElementById('dSandi'),
    dSandi2: document.getElementById('dSandi2'),
    dFoto: document.getElementById('dFoto'),
    dFotoPreview: document.getElementById('dFotoPreview'),
    dFotoImg: document.getElementById('dFotoImg'),
    dErr: document.getElementById('dErr'),
    dOk: document.getElementById('dOk'),
    dKirim: document.getElementById('dKirim')
  };

  /* ---------- Utilitas ---------- */

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
    kabarkan.t = setTimeout(function () { el.toast.classList.remove('on'); }, 2800);
  }

  function isi(html) { el.isi.innerHTML = html; }

  /* ---------- Foto profil: potong persegi, kompres, unggah ---------- */

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

  async function prosesFoto(file) {
    var url = URL.createObjectURL(file);
    try {
      var img = await muatGambar(url);
      var sw = img.naturalWidth, sh = img.naturalHeight;
      var sisi = Math.min(sw, sh);
      var sx = (sw - sisi) / 2, sy = (sh - sisi) / 2;

      var canvas = document.createElement('canvas');
      canvas.width = FOTO_SISI;
      canvas.height = FOTO_SISI;
      canvas.getContext('2d').drawImage(img, sx, sy, sisi, sisi, 0, 0, FOTO_SISI, FOTO_SISI);

      var blob = await keBlob(canvas, 'image/webp', 0.85);
      var ext = 'webp';
      if (!blob || blob.type !== 'image/webp') {
        blob = await keBlob(canvas, 'image/jpeg', 0.85);
        ext = 'jpg';
      }
      if (!blob) throw new Error('Gagal memproses foto.');
      return { blob: blob, ext: ext };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  // Dipakai folder sendiri si pengunggah (uploaderId), siapa pun targetnya —
  // kebijakan storage hanya mengizinkan menulis ke folder milik sendiri.
  async function unggahFoto(file, uploaderId) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      throw new Error('Pilih gambar JPG, PNG, atau WebP.');
    }
    if (file.size > FOTO_MAX_MB * 1024 * 1024) {
      throw new Error('Ukuran foto maksimal ' + FOTO_MAX_MB + ' MB.');
    }
    var hasil = await prosesFoto(file);
    var path = 'avatars/' + uploaderId + '/' + Date.now() + '.' + hasil.ext;
    var up = await sb.storage.from('articles').upload(path, hasil.blob, {
      contentType: hasil.blob.type,
      cacheControl: '31536000',
      upsert: false
    });
    if (up.error) throw new Error('Unggah foto gagal: ' + up.error.message);
    return sb.storage.from('articles').getPublicUrl(path).data.publicUrl;
  }

  function pesan(teks, kelas) {
    isi('<section class="rd-kotak"><p class="' + (kelas || 'rd-kotak-kosong') + '">' + esc(teks) + '</p></section>');
  }

  /* ---------- Menu sesuai peran ---------- */

  function menuUntuk(r) {
    var m = [{ id: 'naskah', nama: 'Naskah' }];
    if (STAF.indexOf(r) !== -1) m.push({ id: 'komentar', nama: 'Komentar' });
    if (r === 'direktur' || r === 'pemred') m.push({ id: 'iklan', nama: 'Iklan' });
    if (r === 'direktur') {
      m.push({ id: 'pengguna', nama: 'Manajemen Akses' });
      m.push({ id: 'pengaturan', nama: 'Pengaturan Situs' });
      m.push({ id: 'builder', nama: 'Builder Level 1' });
      m.push({ id: 'log', nama: 'Log Aktivitas' });
      m.push({ id: 'halaman', nama: 'Halaman Legal' });
    }
    if (r === 'direktur' || r === 'pemred') {
      m.push({ id: 'galeri', nama: 'Galeri' });
      m.push({ id: 'notifikasi', nama: 'Notifikasi' });
      m.push({ id: 'breaking', nama: 'Breaking News' });
      m.push({ id: 'web', nama: 'Manajemen Web' });
    }
    return m;
  }

  function namaMenu(id) {
    var m = menuUntuk(state.profil.role).find(function (x) { return x.id === id; });
    return m ? m.nama : id;
  }

  function gambarTab() {
    el.tabs.innerHTML = menuUntuk(state.profil.role).map(function (m) {
      var kelas = (m.id === state.tab ? ' on' : '') + (SUDAH_DIBUAT.indexOf(m.id) === -1 ? ' segera' : '');
      return '<button type="button" data-tab="' + m.id + '" class="' + kelas.trim() + '">' + esc(m.nama) + '</button>';
    }).join('');
  }

  function bukaTab(id) {
    var ada = menuUntuk(state.profil.role).some(function (m) { return m.id === id; });
    state.tab = ada ? id : 'naskah';
        sessionStorage.setItem('lk_tab', state.tab);
    gambarTab();

    if (state.tab === 'naskah') return muatNaskah();
    if (state.tab === 'komentar') return muatKomentar();
    if (state.tab === 'log') return muatLog();
    if (state.tab === 'pengguna') return muatPengguna();
    if (state.tab === 'breaking') return muatBreaking();
    if (state.tab === 'iklan') return muatIklan();
    pesan('Menu "' + namaMenu(state.tab) + '" dibuat di tahap berikutnya.');
  }

  /* ---------- Layar masuk dan sesi ---------- */

  function tampilMasuk() {
        sessionStorage.removeItem('lk_tab');
    el.masuk.hidden = false;
    if (el.daftar) el.daftar.hidden = true;
    el.app.hidden = true;
    el.aksi.hidden = true;
  }

function tampilRedaksi(p) {
    state.profil = p;
    el.masuk.hidden = true;
    el.app.hidden = false;
    el.aksi.hidden = false;

    var peran = NAMA_PERAN[p.role] || p.role || 'Belum ada peran';
    var isiFoto = p.avatar_url
      ? '<img class="rd-av-foto rd-av-sedang" src="' + esc(p.avatar_url) + '" alt="Profil ' + esc(p.full_name || p.username || 'pengguna') + '">'
      : '<span class="rd-av rd-av-sedang">' + esc((p.full_name || p.username || '?').trim().charAt(0).toUpperCase()) + '</span>';
    var foto = '<a href="profil.html" title="Buka profil saya" style="display:inline-flex;align-items:center;text-decoration:none;flex-shrink:0">' + isiFoto + '</a>';

    el.profil.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px">' +
        foto +
        '<div><b>' + esc(p.full_name || p.username) + '</b>' +
        '<small>@' + esc(p.username) + '</small></div>' +
      '</div>' +
      '<span class="rd-lencana-peran">' + esc(peran) + '</span>';

    bukaTab(state.tab);
  }

  async function ambilProfil(userId) {
    var r = await sb.from('profiles')
      .select('id,username,full_name,role,is_active,avatar_url')
      .eq('id', userId)
      .maybeSingle();
    return r.data || null;
  }

  async function cekSesi() {
    if (!sb) return tampilMasuk();

    var s = await sb.auth.getSession();
    var user = s.data && s.data.session && s.data.session.user;
    if (!user) return tampilMasuk();

    var p = await ambilProfil(user.id);

    // Kalau belum ada profil tapi akun ini baru saja mendaftar lewat formulir
    // "Daftar Penulis" (datanya tersimpan di user_metadata saat signUp), buat
    // profilnya sekarang. Ini menutup kasus saat konfirmasi email aktif: profil
    // baru dibuat setelah pengguna benar-benar masuk, bukan saat mendaftar.
    if (!p) {
      var meta = user.user_metadata || {};
      if (meta.username && meta.full_name) {
        var buat = await sb.rpc('daftar_penulis', {
          p_username: meta.username, p_full_name: meta.full_name, p_avatar_url: null
        });
        if (!buat.error) p = await ambilProfil(user.id);
      }
    }

    if (!p) {
      await sb.auth.signOut();
      el.err.textContent = 'Profil akun belum tersedia. Hubungi direktur.';
      return tampilMasuk();
    }
    if (p.is_active === false) {
      await sb.auth.signOut();
      el.err.textContent = 'Akun kamu sedang dinonaktifkan.';
      return tampilMasuk();
    }
    tampilRedaksi(p);
  }

  /* ---------- Naskah ---------- */

  function cocokFilter(a, f) {
    var sampah = !!a.deleted_at;
    var st = a.status || 'draf';
    if (f === 'sampah') return sampah;
    if (sampah) return false;
    if (f === 'semua') return true;
    if (f === 'draf') return st === 'draf' || st === 'draft';
    if (f === 'proses') return ['diajukan', 'disunting', 'ditinjau'].indexOf(st) !== -1;
    if (f === 'revisi') return st === 'revisi';
    if (f === 'terbit') return st === 'terbit';
    if (f === 'arsip') return st === 'arsip';
    return false;
  }

  async function muatNaskah() {
    pesan('Memuat naskah…');
    var r = await sb.from('articles')
      .select('id,title,status,category,author_id,author_name,created_at,is_exclusive,is_breaking,hak_jawab,review_note,deleted_at')
      .order('created_at', { ascending: false })
      .limit(200);

    if (r.error) return pesan('Gagal memuat naskah: ' + r.error.message, 'rd-err');
    state.naskah = r.data || [];
    tampilNaskah();
  }

  function tampilNaskah() {
    var semua = state.naskah;
    var chips = FILTER_NASKAH.map(function (f) {
      var n = semua.filter(function (a) { return cocokFilter(a, f.id); }).length;
      return '<button type="button" class="rd-chip' + (f.id === state.fNaskah ? ' on' : '') +
        '" data-fn="' + f.id + '">' + esc(f.nama) + ' <span>' + n + '</span></button>';
    }).join('');

    var tampil = semua.filter(function (a) { return cocokFilter(a, state.fNaskah); });

    isi(
      '<section class="rd-kotak">' +
        '<h2>Naskah</h2>' +
        '<div class="rd-chips">' + chips + '</div>' +
        (tampil.length
          ? tampil.map(barisNaskah).join('')
          : '<p class="rd-kotak-kosong">Tidak ada naskah di kategori ini.</p>') +
      '</section>'
    );
  }

  function barisNaskah(a) {
    var st = a.status || 'draf';
    var lencana = a.deleted_at
      ? '<span class="rd-status arsip">Sampah</span>'
      : '<span class="rd-status ' + esc(st) + '">' + esc(LABEL_STATUS[st] || st) + '</span>';
    lencana += (a.is_exclusive ? ' <span class="rd-status eksklusif">EKSKLUSIF</span>' : '') +
               (a.is_breaking ? ' <span class="rd-status breaking">BREAKING</span>' : '');

    return '<article class="rd-baris">' +
      '<p class="rd-baris-judul">' + esc(a.title || '(Tanpa judul)') + '</p>' +
      '<p class="rd-baris-meta">' + esc(a.category || 'Umum') + ' • ' + esc(a.author_name || 'Redaksi') +
        ' • ' + tgl(a.created_at) + '</p>' +
      '<div>' + lencana + '</div>' +
      (a.review_note ? '<p class="rd-baris-meta">Catatan revisi: ' + esc(a.review_note) + '</p>' : '') +
      (a.hak_jawab ? '<p class="rd-baris-meta">Hak jawab: ' + esc(a.hak_jawab) + '</p>' : '') +
      '<div class="rd-baris-aksi">' + aksiNaskah(a) + '</div>' +
    '</article>';
  }

  // Tombol mengikuti peran dan status. Aturan sebenarnya tetap dijaga database.
  function aksiNaskah(a) {
    var p = state.profil;
    var r = p.role;
    var st = a.status || 'draf';
    var saya = a.author_id === p.id;
    var staf = STAF.indexOf(r) !== -1;
    var b = [];

    function t(act, teks, kelas) {
      return '<button type="button" class="btn-xs ' + (kelas || '') + '" data-act="' + act +
        '" data-id="' + a.id + '">' + esc(teks) + '</button>';
    }

    if (a.deleted_at) {
      if (r === 'direktur' || r === 'pemred' || (saya && st !== 'terbit')) {
        b.push(t('pulihkan_sampah', 'Pulihkan dari sampah', 'utama'));
      }
      return b.join('');
    }
        if (st !== 'terbit') b.push('<a class="btn-xs" href="baca.html?pratinjau=' + a.id + '" target="_blank" rel="noopener">Pratinjau</a>');
    if ((st === 'draf' || st === 'draft' || st === 'revisi') && (saya || r === 'direktur')) {
      b.push(t('ajukan', 'Ajukan', 'utama'));
    }
    if (st === 'diajukan' && (r === 'editor' || r === 'direktur')) {
      b.push(t('sunting', 'Mulai sunting', 'utama'));
    }
    if (st === 'disunting' && (r === 'redaktur' || r === 'direktur')) {
      b.push(t('tinjau', 'Teruskan ke pemred', 'utama'));
    }
    if (st === 'ditinjau' && (r === 'pemred' || r === 'direktur')) {
      b.push(t('terbitkan', 'Terbitkan', 'setuju'));
    }
    if (['diajukan', 'disunting', 'ditinjau'].indexOf(st) !== -1 && staf) {
      b.push(t('revisi', 'Minta revisi', 'tolak'));
    }
    if (st === 'terbit' && (r === 'pemred' || r === 'direktur')) {
      b.push(t('arsipkan', 'Tarik ke arsip', 'keluar'));
    }
    if (st === 'arsip' && (saya || r === 'pemred' || r === 'direktur')) {
      b.push(t('pulihkan', 'Pulihkan ke Diajukan', 'utama'));
    }
    if (a.is_exclusive && (r === 'pemred' || r === 'direktur')) {
      b.push(t('hakjawab', a.hak_jawab ? 'Ubah hak jawab' : 'Isi hak jawab', ''));
    }
    if (st !== 'terbit' && ((saya && (st === 'draf' || st === 'draft')) || r === 'direktur')) {
      b.push(t('ke_sampah', 'Ke sampah', 'tolak'));
    }
    return b.join('');
  }

  async function jalankanNaskah(act, id, tombol) {
    var a = state.naskah.find(function (x) { return String(x.id) === String(id); });
    if (!a) return kabarkan('Naskah tidak ditemukan');

    var panggil = null;
    function pindah(to, note) {
      return sb.rpc('advance_article', { p_id: a.id, p_to: to, p_note: note || null });
    }

    if (act === 'ajukan') panggil = pindah('diajukan');
    else if (act === 'sunting') panggil = pindah('disunting');
    else if (act === 'tinjau') panggil = pindah('ditinjau');
    else if (act === 'terbitkan') {
      if (!confirm('Terbitkan naskah ini sekarang?')) return;
      panggil = pindah('terbit');
    }
    else if (act === 'revisi') {
      var catatan = prompt('Tulis catatan revisi untuk penulis (wajib):');
      if (catatan === null) return;
      if (!catatan.trim()) return kabarkan('Catatan revisi wajib diisi');
      panggil = pindah('revisi', catatan.trim());
    }
    else if (act === 'arsipkan') {
      if (!confirm('Tarik naskah ini dari situs ke arsip?')) return;
      panggil = sb.rpc('unpublish_article', { p_id: a.id, p_note: null });
    }
    else if (act === 'pulihkan') panggil = sb.rpc('pulihkan_arsip', { p_id: a.id });
    else if (act === 'hakjawab') {
      var teks = prompt('Isi hak jawab (kosongkan lalu OK untuk menghapus):', a.hak_jawab || '');
      if (teks === null) return;
      panggil = sb.rpc('set_hak_jawab', { p_id: a.id, p_teks: teks });
    }
    else if (act === 'ke_sampah') {
      if (!confirm('Pindahkan naskah ini ke sampah?')) return;
      panggil = sb.from('articles').update({ deleted_at: new Date().toISOString() }).eq('id', a.id);
    }
    else if (act === 'pulihkan_sampah') {
      panggil = sb.from('articles').update({ deleted_at: null }).eq('id', a.id);
    }

    if (!panggil) return;

    tombol.disabled = true;
    var r = await panggil;
    tombol.disabled = false;

    if (r.error) return kabarkan(r.error.message);
    kabarkan('Berhasil diperbarui');
    muatNaskah();
  }

  /* ---------- Komentar ---------- */

  async function muatKomentar() {
    pesan('Memuat komentar…');
    var lihatKontak = state.profil.role === 'direktur' || state.profil.role === 'pemred';
    var kolom = 'id,article_id,guest_name,body,status,created_at' + (lihatKontak ? ',guest_email,guest_phone' : '');

    var r = await sb.from('comments')
      .select(kolom + ',articles(title)')
      .eq('status', state.fKomen)
      .order('created_at', { ascending: false })
      .limit(100);

    if (r.error) {
      r = await sb.from('comments')
        .select(kolom)
        .eq('status', state.fKomen)
        .order('created_at', { ascending: false })
        .limit(100);
    }
    if (r.error) return pesan('Gagal memuat komentar: ' + r.error.message, 'rd-err');

    state.komen = r.data || [];
    tampilKomentar();
  }

  function tampilKomentar() {
    var lihatKontak = state.profil.role === 'direktur' || state.profil.role === 'pemred';

    var chips = FILTER_KOMEN.map(function (f) {
      return '<button type="button" class="rd-chip' + (f.id === state.fKomen ? ' on' : '') +
        '" data-fk="' + f.id + '">' + esc(f.nama) + '</button>';
    }).join('');

    var daftar = state.komen.map(function (c) {
      var judul = c.articles && c.articles.title ? c.articles.title : 'Berita #' + c.article_id;
      var kontak = lihatKontak
        ? '<p class="rd-baris-meta">Email: ' + esc(c.guest_email || '-') + ' • HP: ' + esc(c.guest_phone || '-') + '</p>'
        : '';
      var aksi = '';
      if (c.status !== 'disetujui') {
        aksi += '<button type="button" class="btn-xs setuju" data-kact="setuju" data-id="' + c.id + '">Setujui</button>';
      }
      if (c.status !== 'ditolak') {
        aksi += '<button type="button" class="btn-xs tolak" data-kact="tolak" data-id="' + c.id + '">Tolak</button>';
      }
      return '<article class="rd-baris">' +
        '<p class="rd-baris-judul">' + esc(c.guest_name) + ' <span class="rd-baris-meta">• ' + tgl(c.created_at) + '</span></p>' +
        '<p class="rd-baris-meta">Untuk: ' + esc(judul) + '</p>' +
        kontak +
        '<p class="rd-baris-isi">' + esc(c.body) + '</p>' +
        '<div class="rd-baris-aksi">' + aksi + '</div>' +
      '</article>';
    }).join('');

    isi(
      '<section class="rd-kotak">' +
        '<h2>Komentar</h2>' +
        '<div class="rd-chips">' + chips + '</div>' +
        (daftar || '<p class="rd-kotak-kosong">Tidak ada komentar di kategori ini.</p>') +
      '</section>'
    );
  }

  async function jalankanKomentar(act, id, tombol) {
    tombol.disabled = true;
    var fungsi = act === 'setuju' ? 'approve_comment' : 'reject_comment';
    var r = await sb.rpc(fungsi, { p_id: Number(id) });
    tombol.disabled = false;

    if (r.error) return kabarkan('Gagal: ' + r.error.message);
    kabarkan(act === 'setuju' ? 'Komentar disetujui' : 'Komentar ditolak');
    muatKomentar();
  }

  /* ---------- Log ---------- */

  async function muatLog() {
    pesan('Memuat log…');
    var r = await sb.from('audit_logs')
      .select('created_at,actor_name,actor_role,action,target_type,target_id')
      .order('created_at', { ascending: false })
      .limit(100);

    if (r.error) return pesan('Gagal memuat log: ' + r.error.message, 'rd-err');

    var data = r.data || [];
    isi(
      '<section class="rd-kotak"><h2>Log Aktivitas</h2>' +
        (data.length
          ? data.map(function (l) {
              return '<article class="rd-baris">' +
                '<p class="rd-baris-judul">' + esc(l.action) + '</p>' +
                '<p class="rd-baris-meta">' + tgl(l.created_at) + ' • ' + esc(l.actor_name || '-') +
                  ' (' + esc(l.actor_role || '-') + ')</p>' +
                '<p class="rd-baris-meta">' + esc(l.target_type || '') + ' #' + esc(l.target_id || '-') + '</p>' +
              '</article>';
            }).join('')
          : '<p class="rd-kotak-kosong">Belum ada log.</p>') +
      '</section>'
    );
  }

  /* ---------- Manajemen Akses ---------- */

  var JABATAN_LIST = ['direktur', 'pemred', 'redaktur', 'editor', 'reporter', 'kontributor'];
  var MEJA_LIST = ['Investigasi', 'Ruang Gelap', 'Politik', 'Panggung', 'Ekonomi Gelap', 'Opini'];
  var STATUS_LABEL = { aktif: 'Aktif', nonaktif: 'Nonaktif', menunggu: 'Menunggu Konfirmasi', ditangguhkan: 'Ditangguhkan' };
  var BADGE_JABATAN = {
    direktur: 'ba-direktur', pemred: 'ba-pemred', redaktur: 'ba-redaktur',
    editor: 'ba-editor', reporter: 'ba-reporter', kontributor: 'ba-kontributor'
  };
  var filterAkses = { cari: '', peran: '', status: '' };

  function statusDari(u) {
    return u.status_akun || (u.is_active === false ? 'nonaktif' : 'aktif');
  }

  function cariUser(id) {
    return state.pengguna.find(function (x) { return String(x.id) === String(id); }) || null;
  }

  function nilaiIsian(id) {
    var e = document.getElementById(id);
    return e ? String(e.value || '').trim() : '';
  }

  function mdGagal(teks) {
    var e = document.getElementById('mdErr');
    if (e) e.textContent = teks;
  }

  function tokenSaya() {
    return sb.auth.getSession().then(function (s) {
      return s.data && s.data.session ? s.data.session.access_token : null;
    });
  }

  function opsiJabatan(mode) {
    var daftar = mode === 'pemred' ? ['kontributor', 'reporter'] : JABATAN_LIST;
    return daftar.map(function (k) {
      return '<option value="' + k + '">' + esc(NAMA_PERAN[k]) + '</option>';
    }).join('');
  }

  function opsiMeja() {
    return '<option value="">(tidak ada)</option>' + MEJA_LIST.map(function (m) {
      return '<option value="' + esc(m) + '">' + esc(m) + '</option>';
    }).join('');
  }

  /* ---------- Modal umum ---------- */

  function tutupModal() {
    var m = document.getElementById('rdModal');
    if (m) m.remove();
  }

  function bukaModal(judul, isiHtml, onSimpan, onBatal) {
    tutupModal();
    var bg = document.createElement('div');
    bg.className = 'rd-modal-bg';
    bg.id = 'rdModal';
    bg.innerHTML =
      '<div class="rd-modal" role="dialog" aria-modal="true">' +
        '<h2>' + esc(judul) + '</h2>' +
        isiHtml +
        '<p class="rd-err" id="mdErr"></p>' +
        '<div class="rd-tombol-baris" style="justify-content:flex-end">' +
          '<button type="button" class="btn-xs" id="mdBatal">' + (onSimpan ? 'Batal' : 'Tutup') + '</button>' +
          (onSimpan ? '<button type="button" class="btn-xs utama" id="mdSimpan">Simpan</button>' : '') +
        '</div>' +
      '</div>';
    document.body.appendChild(bg);

    function batal() {
      tutupModal();
      if (onBatal) onBatal();
    }
    document.getElementById('mdBatal').onclick = batal;
    bg.addEventListener('click', function (e) { if (e.target === bg) batal(); });
    if (onSimpan) document.getElementById('mdSimpan').onclick = onSimpan;
  }

  /* ---------- Muat dan tampilkan ---------- */

  async function muatPengguna() {
    pesan('Memuat pengguna…');
    var r = await sb.from('profiles')
      .select('id,username,full_name,role,is_active,status_akun,avatar_url,desk,email,created_at')
      .order('created_at', { ascending: true });
    if (r.error) return pesan('Gagal memuat pengguna: ' + r.error.message, 'rd-err');
    state.pengguna = r.data || [];

    var u = await sb.from('usulan_akses')
      .select('id,dibuat_at,dibuat_oleh,data,alasan,status,catatan_putusan')
      .order('dibuat_at', { ascending: false })
      .limit(50);
    state.usulan = u.error ? [] : (u.data || []);

    tampilPengguna();
  }

  function cocokAkses(u) {
    var q = filterAkses.cari.toLowerCase();
    if (q && [u.full_name, u.username, u.email].join(' ').toLowerCase().indexOf(q) === -1) return false;
    if (filterAkses.peran && u.role !== filterAkses.peran) return false;
    if (filterAkses.status && statusDari(u) !== filterAkses.status) return false;
    return true;
  }

  function barisAkses(u) {
    var saya = u.id === state.profil.id;
    var direktur = state.profil.role === 'direktur';
    var status = statusDari(u);
    var inisial = (u.full_name || u.username || '?').trim().charAt(0).toUpperCase();
    var foto = u.avatar_url
      ? '<img class="rd-av-foto" src="' + esc(u.avatar_url) + '" alt="">'
      : '<span class="rd-av">' + esc(inisial) + '</span>';

    var pilihJabatan = (direktur && !saya)
      ? '<select class="rd-pilih" data-mk="jabatan" aria-label="Ubah jabatan">' + JABATAN_LIST.map(function (k) {
          return '<option value="' + k + '"' + (k === u.role ? ' selected' : '') + '>' + esc(NAMA_PERAN[k]) + '</option>';
        }).join('') + '</select>'
      : '';

    var tombol = '';
    if (direktur && !saya) {
      tombol =
        '<button type="button" class="btn-xs" data-mk="detail">Detail</button>' +
        '<button type="button" class="btn-xs" data-mk="status">' + (status === 'aktif' ? 'Nonaktifkan' : 'Aktifkan') + '</button>' +
        '<button type="button" class="btn-xs" data-mk="reset">Reset sandi</button>';
    }

    return '<article class="rd-baris rd-akses" data-uid="' + esc(u.id) + '">' +
      '<div class="rd-akses-atas">' + foto +
        '<div class="rd-akses-info">' +
          '<p class="rd-baris-judul">' + esc(u.full_name || '(Tanpa nama)') + (saya ? ' <span class="rd-baris-meta">(Kamu)</span>' : '') + '</p>' +
          '<p class="rd-baris-meta">@' + esc(u.username || '-') + ' • ' + esc(u.email || '-') + '</p>' +
        '</div>' +
        '<span class="rd-badge ' + (BADGE_JABATAN[u.role] || '') + '">' + esc(NAMA_PERAN[u.role] || u.role) + '</span>' +
      '</div>' +
      '<div class="rd-akses-meta">' +
        '<span class="rd-status ' + esc(status) + '">' + esc(STATUS_LABEL[status] || status) + '</span>' +
        '<span class="rd-baris-meta">Bergabung ' + esc(tgl(u.created_at)) + '</span>' +
      '</div>' +
      ((pilihJabatan || tombol) ? '<div class="rd-baris-aksi">' + pilihJabatan + tombol + '</div>' : '') +
    '</article>';
  }

  function barisUsulan(x) {
    var d = x.data || {};
    var pengaju = cariUser(x.dibuat_oleh);
    var namaPengaju = pengaju ? (pengaju.full_name || pengaju.username) : 'Tidak diketahui';
    var kelasStatus = x.status === 'menunggu' ? 'menunggu' : (x.status === 'disetujui' ? 'aktif' : 'ditangguhkan');
    var aksi = (state.profil.role === 'direktur' && x.status === 'menunggu')
      ? '<button type="button" class="btn-xs setuju" data-mk="setujui-usulan" data-id="' + x.id + '">Setujui & buat akun</button>' +
        '<button type="button" class="btn-xs tolak" data-mk="tolak-usulan" data-id="' + x.id + '">Tolak</button>'
      : '';

    return '<article class="rd-baris">' +
      '<p class="rd-baris-judul">' + esc(d.nama || '-') + ' <span class="rd-baris-meta">@' + esc(d.username || '-') + '</span></p>' +
      '<p class="rd-baris-meta">Jabatan: ' + esc(NAMA_PERAN[d.role] || d.role || '-') + ' • Meja: ' + esc(d.desk || '-') + '</p>' +
      '<p class="rd-baris-meta">Diusulkan oleh ' + esc(namaPengaju) + ' • ' + esc(tgl(x.dibuat_at)) + '</p>' +
      '<p class="rd-baris-meta">Alasan: ' + esc(x.alasan || '-') + '</p>' +
      '<div><span class="rd-status ' + kelasStatus + '">' + esc(x.status) + '</span></div>' +
      (x.catatan_putusan ? '<p class="rd-baris-meta">Catatan direktur: ' + esc(x.catatan_putusan) + '</p>' : '') +
      (aksi ? '<div class="rd-baris-aksi">' + aksi + '</div>' : '') +
    '</article>';
  }

  function renderDaftarAkses() {
    var box = document.getElementById('akDaftar');
    if (!box) return;
    var hasil = state.pengguna.filter(cocokAkses);
    box.innerHTML = hasil.length
      ? hasil.map(barisAkses).join('')
      : '<p class="rd-kotak-kosong">Tidak ada pengguna yang cocok.</p>';
  }

  function tampilPengguna() {
    var direktur = state.profil.role === 'direktur';
    var tombolBuat = direktur
      ? '<button type="button" class="btn btn-utama btn-kecil" data-mk="buat-akun">+ Buat Akun</button>'
      : '<button type="button" class="btn btn-utama btn-kecil" data-mk="usul-akun">+ Usulkan Akun</button>';

    var usulanHtml = state.usulan.length
      ? '<section class="rd-kotak"><h2>Usulan akun</h2>' + state.usulan.map(barisUsulan).join('') + '</section>'
      : '';

    isi(
      '<section class="rd-kotak">' +
        '<div class="rd-akses-judul"><h2>Manajemen Akses</h2>' + tombolBuat + '</div>' +
        '<div class="rd-filter-baris">' +
          '<input id="akCari" type="search" placeholder="Cari nama, email, atau username" value="' + esc(filterAkses.cari) + '">' +
          '<select id="akPeran"><option value="">Semua jabatan</option>' +
            JABATAN_LIST.map(function (k) {
              return '<option value="' + k + '"' + (filterAkses.peran === k ? ' selected' : '') + '>' + esc(NAMA_PERAN[k]) + '</option>';
            }).join('') +
          '</select>' +
          '<select id="akStatus"><option value="">Semua status</option>' +
            Object.keys(STATUS_LABEL).map(function (k) {
              return '<option value="' + k + '"' + (filterAkses.status === k ? ' selected' : '') + '>' + esc(STATUS_LABEL[k]) + '</option>';
            }).join('') +
          '</select>' +
        '</div>' +
        '<div id="akDaftar"></div>' +
      '</section>' +
      usulanHtml
    );
    renderDaftarAkses();
  }

  /* ---------- Buat akun dan usulan ---------- */

  function modalBuatAkun(mode) {
    var direktur = mode === 'direktur';
    var html =
      '<label class="rd-label">Nama lengkap<input id="baNama" type="text"></label>' +
      '<label class="rd-label">Nama pengguna (huruf kecil, angka, titik, garis bawah)<input id="baUser" type="text"></label>' +
      '<label class="rd-label">Email<input id="baEmail" type="email"></label>' +
      (direktur
        ? '<label class="rd-label">Kata sandi awal (minimal 8 karakter)<input id="baSandi" type="password" autocomplete="new-password"></label>'
        : '') +
      '<label class="rd-label">Jabatan<select id="baRole">' + opsiJabatan(mode) + '</select></label>' +
      '<label class="rd-label">Meja<select id="baDesk">' + opsiMeja() + '</select></label>' +
      '<label class="rd-label">Alasan (wajib, minimal 10 karakter)<textarea id="baAlasan"></textarea></label>';

    bukaModal(direktur ? 'Buat Akun Baru' : 'Usulkan Akun Baru', html, async function () {
      var nama = nilaiIsian('baNama');
      var username = nilaiIsian('baUser').toLowerCase();
      var email = nilaiIsian('baEmail').toLowerCase();
      var role = nilaiIsian('baRole');
      var desk = nilaiIsian('baDesk') || null;
      var alasan = nilaiIsian('baAlasan');

      if (nama.length < 3) return mdGagal('Nama minimal 3 karakter.');
      if (!/^[a-z0-9_.]{3,24}$/.test(username)) return mdGagal('Nama pengguna 3-24 karakter: huruf kecil, angka, titik, garis bawah.');
      if (!REGEX_EMAIL.test(email)) return mdGagal('Email belum benar.');
      if (alasan.length < 10) return mdGagal('Alasan minimal 10 karakter.');

      if (direktur) {
        var sandi = nilaiIsian('baSandi');
        if (sandi.length < 8) return mdGagal('Kata sandi awal minimal 8 karakter.');
        var token = await tokenSaya();
        if (!token) return mdGagal('Sesi berakhir. Masuk ulang.');
        var r = await fetch('/api/buat-akun', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ full_name: nama, username: username, email: email, password: sandi, role: role, desk: desk, alasan: alasan })
        });
        var hasil = await r.json().catch(function () { return {}; });
        if (!r.ok) return mdGagal(hasil.pesan || 'Gagal membuat akun.');
        tutupModal();
        kabarkan(hasil.pesan || 'Akun dibuat');
        return muatPengguna();
      }

      var u = await sb.rpc('ajukan_buat_akun', {
        p_nama: nama, p_username: username, p_email: email,
        p_role: role, p_desk: desk, p_alasan: alasan
      });
      if (u.error) return mdGagal(u.error.message);
      tutupModal();
      kabarkan('Usulan dikirim ke direktur');
      return muatPengguna();
    });
  }

  function modalSetujuiUsulan(id) {
    var x = state.usulan.find(function (z) { return String(z.id) === String(id); });
    if (!x) return kabarkan('Usulan tidak ditemukan');
    var d = x.data || {};

    var html =
      '<p class="rd-baris-meta">' + esc(d.nama) + ' (@' + esc(d.username) + ') • ' + esc(d.email) +
        ' • ' + esc(NAMA_PERAN[d.role] || d.role) + '</p>' +
      '<label class="rd-label">Kata sandi awal (minimal 8 karakter)<input id="baSandi" type="password" autocomplete="new-password"></label>';

    bukaModal('Setujui usulan akun', html, async function () {
      var sandi = nilaiIsian('baSandi');
      if (sandi.length < 8) return mdGagal('Kata sandi awal minimal 8 karakter.');

      var token = await tokenSaya();
      if (!token) return mdGagal('Sesi berakhir. Masuk ulang.');

      var r = await fetch('/api/buat-akun', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          full_name: d.nama, username: d.username, email: d.email, password: sandi,
          role: d.role, desk: d.desk || null, alasan: x.alasan
        })
      });
      var hasil = await r.json().catch(function () { return {}; });
      if (!r.ok) return mdGagal(hasil.pesan || 'Gagal membuat akun.');

      var p = await sb.rpc('putuskan_usulan', { p_id: x.id, p_setuju: true, p_catatan: 'Akun sudah dibuat' });
      tutupModal();
      kabarkan(p.error
        ? 'Akun dibuat, tapi status usulan gagal diperbarui: ' + p.error.message
        : (hasil.pesan || 'Akun dibuat'));
      return muatPengguna();
    });
  }

  function modalTolakUsulan(id) {
    var html = '<label class="rd-label">Alasan penolakan (wajib, minimal 10 karakter)<textarea id="baAlasan"></textarea></label>';
    bukaModal('Tolak usulan akun', html, async function () {
      var catatan = nilaiIsian('baAlasan');
      if (catatan.length < 10) return mdGagal('Alasan minimal 10 karakter.');
      var p = await sb.rpc('putuskan_usulan', { p_id: Number(id), p_setuju: false, p_catatan: catatan });
      if (p.error) return mdGagal(p.error.message);
      tutupModal();
      kabarkan('Usulan ditolak');
      return muatPengguna();
    });
  }

  /* ---------- Ubah jabatan, status, detail, reset ---------- */

  function modalJabatan(u, roleBaru, selectEl) {
    var html =
      '<label class="rd-label">Nama<input value="' + esc(u.full_name || u.username) + '" disabled></label>' +
      '<label class="rd-label">Jabatan lama<input value="' + esc(NAMA_PERAN[u.role] || u.role) + '" disabled></label>' +
      '<label class="rd-label">Jabatan baru<input value="' + esc(NAMA_PERAN[roleBaru] || roleBaru) + '" disabled></label>' +
      '<label class="rd-label">Alasan (wajib, minimal 10 karakter)<textarea id="baAlasan"></textarea></label>';

    bukaModal('Ubah jabatan', html, async function () {
      var alasan = nilaiIsian('baAlasan');
      if (alasan.length < 10) return mdGagal('Alasan minimal 10 karakter.');
      var r = await sb.rpc('atur_jabatan', { p_target: u.id, p_role: roleBaru, p_alasan: alasan });
      if (r.error) return mdGagal(r.error.message);
      tutupModal();
      kabarkan('Jabatan diubah');
      return muatPengguna();
    }, function () {
      selectEl.value = u.role;
    });
  }

  function modalStatus(u) {
    var aktifSekarang = statusDari(u) === 'aktif';
    var html =
      '<p class="rd-baris-meta">' + esc(u.full_name || u.username) + '</p>' +
      '<label class="rd-label">Alasan (wajib, minimal 10 karakter)<textarea id="baAlasan"></textarea></label>';

    bukaModal((aktifSekarang ? 'Nonaktifkan' : 'Aktifkan') + ' akun', html, async function () {
      var alasan = nilaiIsian('baAlasan');
      if (alasan.length < 10) return mdGagal('Alasan minimal 10 karakter.');
      var r = await sb.rpc('atur_status_akun', { p_target: u.id, p_aktif: !aktifSekarang, p_alasan: alasan });
      if (r.error) return mdGagal(r.error.message);
      tutupModal();
      kabarkan('Status akun diperbarui');
      return muatPengguna();
    });
  }

  async function modalDetail(u) {
    var r = await sb.rpc('data_pribadi_pengguna', { p_id: u.id });
    var d = (!r.error && r.data && r.data[0]) || null;

    var html =
      '<p class="rd-baris-meta">Email: ' + esc(u.email || '-') + '</p>' +
      '<p class="rd-baris-meta">Meja: ' + esc(u.desk || '-') + '</p>' +
      '<p class="rd-baris-meta">Bergabung: ' + esc(tgl(u.created_at)) + '</p>' +
      (d
        ? '<p class="rd-baris-meta">No. HP: ' + esc(d.phone || '-') + '</p>' +
          '<p class="rd-baris-meta">Tanggal lahir: ' + esc(d.birth_date || '-') + '</p>' +
          '<p class="rd-baris-meta">Alamat: ' + esc(d.address || '-') + '</p>'
        : '<p class="rd-err">Data pribadi belum bisa dibaca' + (r.error ? ': ' + esc(r.error.message) : '') + '</p>');

    bukaModal('Detail: ' + (u.full_name || u.username), html, null);
  }

  async function kirimResetSandi(u) {
    if (!u.email) return kabarkan('Email pengguna kosong');
    if (!confirm('Kirim link reset kata sandi ke ' + u.email + '?')) return;
    var r = await sb.auth.resetPasswordForEmail(u.email, { redirectTo: location.origin + '/redaksi.html' });
    kabarkan(r.error ? 'Gagal: ' + r.error.message : 'Link reset dikirim ke email pengguna');
  }

  /* ---------- Kejadian Manajemen Akses ---------- */

  el.isi.addEventListener('input', function (ev) {
    if (ev.target.id === 'akCari') {
      filterAkses.cari = ev.target.value;
      renderDaftarAkses();
    }
  });

  el.isi.addEventListener('change', function (ev) {
    if (ev.target.id === 'akPeran') { filterAkses.peran = ev.target.value; return renderDaftarAkses(); }
    if (ev.target.id === 'akStatus') { filterAkses.status = ev.target.value; return renderDaftarAkses(); }
    if (ev.target.dataset && ev.target.dataset.mk === 'jabatan') {
      var baris = ev.target.closest('.rd-akses');
      var u = baris ? cariUser(baris.dataset.uid) : null;
      if (u) modalJabatan(u, ev.target.value, ev.target);
    }
  });

  el.isi.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-mk]');
    if (!t) return;
    var aksi = t.dataset.mk;

    if (aksi === 'buat-akun') return modalBuatAkun('direktur');
    if (aksi === 'usul-akun') return modalBuatAkun('pemred');
    if (aksi === 'setujui-usulan') return modalSetujuiUsulan(t.dataset.id);
    if (aksi === 'tolak-usulan') return modalTolakUsulan(t.dataset.id);

    var baris = t.closest('.rd-akses');
    var u = baris ? cariUser(baris.dataset.uid) : null;
    if (!u) return;
    if (aksi === 'detail') return modalDetail(u);
    if (aksi === 'status') return modalStatus(u);
    if (aksi === 'reset') return kirimResetSandi(u);
  });

  async function simpanPengguna(baris) {
    var uid = baris.dataset.uid;
    var u = state.pengguna.find(function (x) { return x.id === uid; });
    if (!u) return;

    var role = baris.querySelector('.pg-role').value;
    var aktif = baris.querySelector('.pg-aktif').checked;
    var file = baris.querySelector('.pg-foto').files[0];
    var tombol = baris.querySelector('.pg-simpan');

    tombol.disabled = true;
    tombol.textContent = 'Menyimpan…';
    try {
      var avatarUrl = null;
      if (file) avatarUrl = await unggahFoto(file, state.profil.id);

      var r = await sb.rpc('atur_pengguna', {
        p_id: uid, p_role: role, p_is_active: aktif,
        p_username: u.username, p_full_name: u.full_name, p_desk: u.desk || null,
        p_avatar_url: avatarUrl
      });
      if (r.error) throw new Error(r.error.message);

      kabarkan('Data pengguna disimpan');
      muatPengguna();
    } catch (e) {
      kabarkan('Gagal: ' + (e.message || e));
      tombol.disabled = false;
      tombol.textContent = 'Simpan';
    }
  }

  /* ---------- Kejadian ---------- */

  el.form.addEventListener('submit', async function (ev) {
    ev.preventDefault();
    el.err.textContent = '';

    if (!sb) { el.err.textContent = 'Koneksi ke database belum siap.'; return; }

    var email = el.email.value.trim().toLowerCase();
    var sandi = el.sandi.value;

    if (!REGEX_EMAIL.test(email)) { el.err.textContent = 'Email belum benar.'; return; }
    if (!sandi) { el.err.textContent = 'Kata sandi belum diisi.'; return; }

    el.kirim.disabled = true;
    var r = await sb.auth.signInWithPassword({ email: email, password: sandi });
    el.kirim.disabled = false;

    if (r.error) {
      el.err.textContent = /not confirmed/i.test(r.error.message)
        ? 'Email belum dikonfirmasi. Hubungi direktur.'
        : 'Email atau kata sandi salah.';
      return;
    }

    el.sandi.value = '';
    state.tab = 'naskah';
    await cekSesi();
  });

  el.lupa.addEventListener('click', async function () {
    el.err.textContent = '';
    if (!sb) { el.err.textContent = 'Koneksi ke database belum siap.'; return; }

    var email = el.email.value.trim().toLowerCase();
    if (!REGEX_EMAIL.test(email)) {
      el.err.textContent = 'Isi email dulu, lalu klik "Lupa kata sandi".';
      return;
    }

    var r = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: location.origin + '/redaksi.html'
    });
    if (r.error) {
      el.err.textContent = 'Tautan belum bisa dikirim. Coba lagi nanti.';
      return;
    }
    kabarkan('Tautan reset dikirim ke email kamu');
  });

  el.keluar.addEventListener('click', async function () {
    if (sb) await sb.auth.signOut();
    state.profil = null;
    state.naskah = [];
    state.komen = [];
    state.tab = 'naskah';
    tampilMasuk();
    kabarkan('Kamu sudah keluar');
  });

  el.tabs.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-tab]');
    if (t) bukaTab(t.dataset.tab);
  });

  el.isi.addEventListener('click', function (ev) {
     // FIX GANTI FOTO: langsung upload begitu pilih foto, jangan nunggu Simpan.
  // Ini yang bikin tadi gak ada notif & gak ada yang berubah.
  el.isi.addEventListener('change', async function (ev) {
    if (!ev.target.classList.contains('pg-foto')) return;
    var input = ev.target;
    var file = input.files && input.files[0];
    if (!file) return;

    var baris = input.closest('.rd-pengguna');
    if (!baris) return;
    var uid = baris.dataset.uid;
    var u = state.pengguna.find(function (x) { return x.id === uid; });
    if (!u) return;

    var sayaSendiri = uid === state.profil.id;
    var label = baris.querySelector('.pg-label-foto');
    var teksAwal = label ? label.childNodes[0].textContent : 'Ganti foto';

    // 1. Langsung tampilkan preview biar keliatan berubah, jangan nunggu upload kelar
    var imgLama = baris.querySelector('.rd-av-foto, .rd-av');
    var previewUrl = URL.createObjectURL(file);
    if (imgLama) {
      var imgBaru = document.createElement('img');
      imgBaru.className = 'rd-av-foto';
      imgBaru.src = previewUrl;
      imgBaru.alt = '';
      imgLama.replaceWith(imgBaru);
    }

    // 2. Kasih notif langsung, biar gak dikira gak ada apa-apa
    kabarkan('Mengunggah foto…');
    if (label) label.childNodes[0].textContent = 'Mengunggah…';

    try {
      var url = await unggahFoto(file, state.profil.id);

      if (sayaSendiri) {
        // Akun sendiri: pakai fungsi sendiri, jangan pakai atur_pengguna (itu ditolak kalau direktur ubah diri sendiri)
        var r1 = await sb.rpc('perbarui_profil_sendiri', { p_full_name: null, p_username: null, p_avatar_url: url });
        if (r1.error) throw new Error(r1.error.message);
        state.profil.avatar_url = url;
      } else {
        // Akun orang lain: pakai fungsi direktur
        var r2 = await sb.rpc('atur_pengguna', {
          p_id: uid, p_role: u.role, p_is_active: u.is_active !== false,
          p_username: u.username, p_full_name: u.full_name, p_desk: u.desk || null,
          p_avatar_url: url
        });
        if (r2.error) throw new Error(r2.error.message);
      }

      kabarkan('Foto profil diperbarui');
      // Refresh list + header biar foto baru muncul di semua tempat
      muatPengguna();
      if (sayaSendiri) tampilRedaksi(state.profil);
    } catch (e) {
      kabarkan('Gagal: ' + (e.message || e));
      // Kalau gagal, balikin preview ke foto lama
      muatPengguna();
    } finally {
      if (label) label.childNodes[0].textContent = teksAwal;
      input.value = ''; // Biar bisa pilih foto yang sama lagi kalau mau coba ulang
      URL.revokeObjectURL(previewUrl);
    }
  });
    var t;
    if ((t = ev.target.closest('[data-fn]'))) { state.fNaskah = t.dataset.fn; return tampilNaskah(); }
    if ((t = ev.target.closest('[data-fk]'))) { state.fKomen = t.dataset.fk; return muatKomentar(); }
    if ((t = ev.target.closest('[data-act]'))) return jalankanNaskah(t.dataset.act, t.dataset.id, t);
    if ((t = ev.target.closest('[data-kact]'))) return jalankanKomentar(t.dataset.kact, t.dataset.id, t);
    if ((t = ev.target.closest('.pg-simpan'))) return simpanPengguna(t.closest('.rd-pengguna'));
  });

  // Tombol "Ubah foto saya" ada di header profil (#profil), dibuat ulang tiap masuk.
el.profil.addEventListener('change', async function (ev) {
  if (ev.target.id !== 'fotoSaya') return;
  var file = ev.target.files && ev.target.files[0];
  if (!file) return;
  try {
    kabarkan('Mengunggah foto…');
    var url = await unggahFoto(file, state.profil.id);
    var r = await sb.rpc('perbarui_profil_sendiri', { p_full_name: null, p_username: null, p_avatar_url: url });
    if (r.error) throw new Error(r.error.message);
    state.profil.avatar_url = url;
    kabarkan('Foto profil diperbarui');
    tampilRedaksi(state.profil);
  } catch (e) {
    kabarkan('Gagal: ' + (e.message || e));
  }
});

    /* ---------- Breaking News ---------- */

  async function muatBreaking() {
    pesan('Memuat breaking news…');
    var r = await sb.from('articles')
      .select('id,title,category,status,breaking_urutan,is_breaking,published_at,cover_url,deleted_at')
      .eq('status', 'terbit')
      .is('deleted_at', null)
      .order('published_at', { ascending: false })
      .limit(100);
    if (r.error) return pesan('Gagal memuat naskah terbit: ' + r.error.message, 'rd-err');
    state.breaking = r.data || [];
    tampilBreaking();
  }

  function tampilBreaking() {
    var aktif = (state.breaking || []).filter(function (a) { return a.breaking_urutan; });

    var slot = [1, 2, 3].map(function (n) {
      var a = aktif.find(function (x) { return x.breaking_urutan === n; });
      return '<div class="rd-bk-slot">' +
        '<span class="rd-bk-nomor">' + n + '</span>' +
        (a ? '<span class="rd-bk-judul">' + esc(a.title) + '</span>'
           : '<span class="rd-bk-kosong">Belum dipilih</span>') +
      '</div>';
    }).join('');

    var daftar = (state.breaking || []).map(barisBreaking).join('');

    isi(
      '<section class="rd-kotak">' +
        '<h2>Breaking News</h2>' +
        '<p class="rd-catatan">Pilih hingga tiga berita. Urutan 1 tampil paling besar di beranda, urutan 2 dan 3 tampil sebagai geser. Berita breaking tetap tampil di feed.</p>' +
        '<div class="rd-bk-slots">' + slot + '</div>' +
      '</section>' +
      '<section class="rd-kotak">' +
        '<h2>Naskah terbit</h2>' +
        (daftar || '<p class="rd-kotak-kosong">Belum ada naskah terbit.</p>') +
      '</section>'
    );
  }

  function barisBreaking(a) {
    var awal = a.breaking_urutan || '';
    var pilihan = '<option value="">Lepas</option>' + [1, 2, 3].map(function (n) {
      return '<option value="' + n + '"' + (a.breaking_urutan === n ? ' selected' : '') + '>Urutan ' + n + '</option>';
    }).join('');

    return '<article class="rd-baris">' +
      '<p class="rd-baris-judul">' + esc(a.title || '(Tanpa judul)') + '</p>' +
      '<p class="rd-baris-meta">' + esc(a.category || 'Umum') + ' • ' + tgl(a.published_at) + '</p>' +
      '<div class="rd-baris-aksi">' +
        '<select class="rd-pilih" data-bk="pilih" data-id="' + esc(a.id) + '" data-awal="' + awal +
          '" aria-label="Urutan breaking news">' + pilihan + '</select>' +
      '</div>' +
    '</article>';
  }

  async function ubahBreaking(id, nilai, pilihEl) {
    var urutan = nilai ? Number(nilai) : null;
    var awal = pilihEl.dataset.awal || '';

    pilihEl.disabled = true;
    var r = await sb.rpc('set_breaking', { p_id: Number(id), p_urutan: urutan });
    pilihEl.disabled = false;

    if (r.error) {
      kabarkan('Gagal: ' + r.error.message);
      pilihEl.value = awal;
      return;
    }
    kabarkan(urutan ? 'Breaking news urutan ' + urutan + ' diperbarui' : 'Berita dilepas dari breaking news');
    muatBreaking();
  }

  el.isi.addEventListener('change', function (ev) {
    var t = ev.target.closest ? ev.target.closest('[data-bk="pilih"]') : null;
    if (t) ubahBreaking(t.dataset.id, t.value, t);
  });

  /* ---------- Iklan ---------- */

  var SLOT_IKLAN = [
    { id: 'banner_atas', nama: 'Banner atas', tipe: 'manual', w: 1200, h: 300, catatan: 'Di bawah breaking news, lebar penuh (4:1)' },
    { id: 'feed_1', nama: 'Sisipan feed 1', tipe: 'manual', w: 1200, h: 600, catatan: 'Setelah kartu ke-4 (2:1)' },
    { id: 'feed_2', nama: 'Sisipan feed 2', tipe: 'manual', w: 1200, h: 600, catatan: 'Setelah kartu ke-12 (2:1)' },
    { id: 'banner_bawah', nama: 'Banner bawah', tipe: 'manual', w: 1200, h: 300, catatan: 'Di atas footer (4:1)' },
    { id: 'google_atas', nama: 'Google Ads atas', tipe: 'adsense', catatan: 'Di bawah breaking news. Tersembunyi jika tidak aktif' },
    { id: 'feed_google', nama: 'Google Ads feed', tipe: 'adsense', catatan: 'Setelah kartu ke-8. Tersembunyi jika tidak aktif' }
  ];

  async function muatIklan() {
    pesan('Memuat iklan…');
    var r = await sb.from('ads').select('*').order('created_at', { ascending: true });
    if (r.error) return pesan('Gagal memuat iklan: ' + r.error.message, 'rd-err');
    state.iklan = r.data || [];
    tampilIklan();
  }

  function tampilIklan() {
    var direktur = state.profil.role === 'direktur';
    isi(
      '<section class="rd-kotak"><h2>Iklan</h2>' +
        '<p class="rd-catatan">' + (direktur
          ? 'Foto iklan otomatis dipotong dan dikompres sesuai ukuran ruang. Ruang yang tidak aktif tidak menyisakan tempat di beranda.'
          : 'Kamu hanya bisa melihat iklan. Pengelolaan iklan dilakukan oleh direktur.') + '</p>' +
        SLOT_IKLAN.map(kartuSlot).join('') +
      '</section>'
    );
  }

  function kartuSlot(s) {
    var b = (state.iklan || []).find(function (x) { return x.slot === s.id; }) || null;
    var aktif = !!(b && b.is_active);
    var direktur = state.profil.role === 'direktur';

    var pratinjau = '';
    if (s.tipe === 'manual') {
      var kelasRasio = (s.w / s.h) === 4 ? 'ik-4-1' : 'ik-2-1';
      pratinjau = '<div class="ik-pratinjau ' + kelasRasio + '">' +
        (b && b.image_url
          ? '<img class="ik-gambar" src="' + esc(b.image_url) + '" alt="' + esc(b.title || s.nama) + '">'
          : '<div class="ik-kosong">Belum ada foto</div>') +
      '</div>';
    }

    var form = '';
    if (direktur) {
      form = (s.tipe === 'manual' ? formManual(s, b) : formGoogle(b)) +
        '<div class="ik-aksi">' +
          '<label class="rd-cek"><input type="checkbox" data-ik="aktif"' + (aktif ? ' checked' : '') + '> Aktifkan</label>' +
          '<button type="button" class="btn-xs utama" data-ik="simpan">Simpan</button>' +
        '</div>';
    }

    return '<article class="rd-baris ik-kartu" data-slot="' + s.id + '">' +
      '<div class="ik-atas">' +
        '<div><p class="rd-baris-judul">' + esc(s.nama) + '</p>' +
        '<p class="rd-baris-meta">' + esc(s.catatan) + '</p></div>' +
        '<span class="rd-status ' + (aktif ? 'terbit' : 'arsip') + '">' + (aktif ? 'Aktif' : 'Nonaktif') + '</span>' +
      '</div>' +
      pratinjau +
      form +
    '</article>';
  }

  function formManual(s, b) {
    return '<div class="ik-form">' +
      '<label class="rd-label">Judul iklan' +
        '<input data-ik="judul" type="text" value="' + esc((b && b.title) || '') + '"></label>' +
      '<label class="rd-label">Tautan tujuan (mulai dengan https://)' +
        '<input data-ik="link" type="url" placeholder="https://..." value="' + esc((b && b.link_url) || '') + '"></label>' +
      '<label class="rd-label">Foto iklan (akan dipotong ' + s.w + ' × ' + s.h + ' px)' +
        '<input data-ik="file" type="file" accept="image/jpeg,image/png,image/webp"></label>' +
    '</div>';
  }

  function formGoogle(b) {
    return '<div class="ik-form">' +
      '<label class="rd-label">ID Publisher AdSense (ca-pub-...)' +
        '<input data-ik="pub" type="text" placeholder="ca-pub-1234567890123456" value="' + esc((b && b.adsense_client) || '') + '"></label>' +
      '<label class="rd-label">ID slot iklan (angka)' +
        '<input data-ik="slotid" type="text" placeholder="1234567890" value="' + esc((b && b.adsense_slot_id) || '') + '"></label>' +
    '</div>';
  }

  // Foto iklan: potong sesuai rasio ruang, kompres WebP (cadangan JPG)
  async function unggahIklan(file, w, h) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      throw new Error('Pilih gambar JPG, PNG, atau WebP.');
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new Error('Ukuran foto maksimal 2 MB sebelum dikompres.');
    }
    var url = URL.createObjectURL(file);
    try {
      var img = await muatGambar(url);
      var sw = img.naturalWidth, sh = img.naturalHeight;
      var rasio = w / h;
      var cw = sw, ch = sh, sx = 0, sy = 0;
      if (sw / sh > rasio) { cw = sh * rasio; sx = (sw - cw) / 2; }
      else { ch = sw / rasio; sy = (sh - ch) / 2; }

      var canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, sx, sy, cw, ch, 0, 0, w, h);

      var blob = await keBlob(canvas, 'image/webp', 0.82);
      var ext = 'webp';
      if (!blob || blob.type !== 'image/webp') {
        blob = await keBlob(canvas, 'image/jpeg', 0.82);
        ext = 'jpg';
      }
      if (!blob) throw new Error('Gagal memproses gambar.');

      var path = 'ads/' + state.profil.id + '/' + Date.now() + '.' + ext;
      var up = await sb.storage.from('articles').upload(path, blob, {
        contentType: blob.type,
        cacheControl: '31536000',
        upsert: false
      });
      if (up.error) throw new Error('Unggah gambar gagal: ' + up.error.message);
      return sb.storage.from('articles').getPublicUrl(path).data.publicUrl;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function simpanSlot(kartuEl, tombol) {
    var s = SLOT_IKLAN.find(function (x) { return x.id === kartuEl.dataset.slot; });
    if (!s) return;
    var b = (state.iklan || []).find(function (x) { return x.slot === s.id; }) || null;
    var aktif = kartuEl.querySelector('[data-ik="aktif"]').checked;
    var data = { slot: s.id, ad_type: s.tipe, is_active: aktif };

    try {
      if (s.tipe === 'manual') {
        var judul = kartuEl.querySelector('[data-ik="judul"]').value.trim();
        var link = kartuEl.querySelector('[data-ik="link"]').value.trim();
        var file = kartuEl.querySelector('[data-ik="file"]').files[0];

        if (link && !/^https:\/\//i.test(link)) throw new Error('Tautan tujuan harus mulai dengan https://');

        data.title = judul || null;
        data.link_url = link || null;
        data.image_url = file
          ? await unggahIklan(file, s.w, s.h)
          : (b ? b.image_url : null);

        if (aktif && !data.image_url) throw new Error('Pasang foto iklan dulu sebelum diaktifkan.');
      } else {
        var pub = kartuEl.querySelector('[data-ik="pub"]').value.trim();
        var sid = kartuEl.querySelector('[data-ik="slotid"]').value.trim();

        if (aktif && !(/^ca-pub-\d+$/.test(pub) && /^\d+$/.test(sid))) {
          throw new Error('Isi ID Publisher (ca-pub-...) dan ID slot dengan benar sebelum diaktifkan.');
        }
        data.adsense_client = pub || null;
        data.adsense_slot_id = sid || null;
      }
    } catch (e) {
      return kabarkan(e.message || 'Periksa isian iklan');
    }

    tombol.disabled = true;
    var r = b
      ? await sb.from('ads').update(data).eq('id', b.id)
      : await sb.from('ads').insert(data);
    tombol.disabled = false;

    if (r.error) return kabarkan('Gagal menyimpan: ' + r.error.message);
    kabarkan(aktif ? 'Iklan disimpan dan aktif' : 'Iklan disimpan (nonaktif)');
    muatIklan();
  }

  el.isi.addEventListener('click', function (ev) {
    var t = ev.target.closest ? ev.target.closest('[data-ik="simpan"]') : null;
    if (t) simpanSlot(t.closest('.ik-kartu'), t);
  });

  el.isi.addEventListener('change', function (ev) {
    if (!ev.target.dataset || ev.target.dataset.ik !== 'file') return;
    var kartuEl = ev.target.closest('.ik-kartu');
    var wadah = kartuEl ? kartuEl.querySelector('.ik-pratinjau') : null;
    var f = ev.target.files && ev.target.files[0];
    if (!f || !wadah) return;
    wadah.innerHTML = '<img class="ik-gambar" alt="Pratinjau">';
    wadah.firstChild.src = URL.createObjectURL(f);
  });
  cekSesi();
})();
