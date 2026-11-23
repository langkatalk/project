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
  var SUDAH_DIBUAT = ['naskah', 'komentar', 'log'];
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

  var state = { profil: null, tab: sessionStorage.getItem('lk_tab') || 'naskah', fNaskah: 'semua', fKomen: 'menunggu', naskah: [], komen: [] };

  var el = {
    masuk: document.getElementById('layarMasuk'),
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
    toast: document.getElementById('toast')
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

  function pesan(teks, kelas) {
    isi('<section class="rd-kotak"><p class="' + (kelas || 'rd-kotak-kosong') + '">' + esc(teks) + '</p></section>');
  }

  /* ---------- Menu sesuai peran ---------- */

  function menuUntuk(r) {
    var m = [{ id: 'naskah', nama: 'Naskah' }];
    if (STAF.indexOf(r) !== -1) m.push({ id: 'komentar', nama: 'Komentar' });
    if (r === 'direktur' || r === 'pemred') m.push({ id: 'iklan', nama: 'Iklan' });
    if (r === 'direktur') {
      m.push({ id: 'pengguna', nama: 'Pengguna & Jabatan' });
      m.push({ id: 'pengaturan', nama: 'Pengaturan Situs' });
      m.push({ id: 'builder', nama: 'Builder Level 1' });
      m.push({ id: 'log', nama: 'Log Aktivitas' });
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
    pesan('Menu "' + namaMenu(state.tab) + '" dibuat di tahap berikutnya.');
  }

  /* ---------- Layar masuk dan sesi ---------- */

  function tampilMasuk() {
        sessionStorage.removeItem('lk_tab');
    el.masuk.hidden = false;
    el.app.hidden = true;
    el.aksi.hidden = true;
  }

  function tampilRedaksi(p) {
    state.profil = p;
    el.masuk.hidden = true;
    el.app.hidden = false;
    el.aksi.hidden = false;

    var peran = NAMA_PERAN[p.role] || p.role || 'Belum ada peran';
    el.profil.innerHTML =
      '<div><b>' + esc(p.full_name || p.username) + '</b>' +
      '<small>@' + esc(p.username) + '</small></div>' +
      '<span class="rd-lencana-peran">' + esc(peran) + '</span>';

    bukaTab(state.tab);
  }

  async function ambilProfil(userId) {
    var r = await sb.from('profiles')
      .select('id,username,full_name,role,is_active')
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
    var t;
    if ((t = ev.target.closest('[data-fn]'))) { state.fNaskah = t.dataset.fn; return tampilNaskah(); }
    if ((t = ev.target.closest('[data-fk]'))) { state.fKomen = t.dataset.fk; return muatKomentar(); }
    if ((t = ev.target.closest('[data-act]'))) return jalankanNaskah(t.dataset.act, t.dataset.id, t);
    if ((t = ev.target.closest('[data-kact]'))) return jalankanKomentar(t.dataset.kact, t.dataset.id, t);
  });

  cekSesi();
})();
