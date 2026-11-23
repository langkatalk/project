// js/dashboard.js
// Ruang Redaksi: masuk, kerangka tab, dan tab Naskah & Status.
// Semua perubahan status lewat fungsi resmi di database.
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
    ditinjau: 'Ditinjau', revisi: 'Revisi', terbit: 'Terbit', arsip: 'Arsip',
    scheduled: 'Terjadwal'
  };
  var STAF = ['direktur', 'pemred', 'redaktur', 'editor'];

  var state = { profil: null, tab: 'naskah', filter: '', daftar: [] };

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

  function isiPesan(teks, kelas) {
    el.isi.innerHTML = '<section class="rd-kotak"><p class="' + (kelas || 'rd-kotak-kosong') + '">' + esc(teks) + '</p></section>';
  }

  /* ---------- Layar masuk dan sesi ---------- */

  function tampilMasuk() {
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

    gambarTab();
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

  /* ---------- Tab ---------- */

  function daftarTab() {
    var r = state.profil.role;
    var t = [{ id: 'naskah', nama: 'Naskah & Status' }];
    if (STAF.indexOf(r) !== -1) t.push({ id: 'komentar', nama: 'Komentar' });
    if (r === 'direktur') t.push({ id: 'pengguna', nama: 'Pengguna & Peran' });
    if (r === 'direktur' || r === 'pemred') t.push({ id: 'iklan', nama: 'Iklan' });
    if (r === 'direktur') t.push({ id: 'pengaturan', nama: 'Pengaturan Situs' });
    return t;
  }

  function gambarTab() {
    el.tabs.innerHTML = daftarTab().map(function (t) {
      return '<button type="button" data-tab="' + t.id + '" class="' + (t.id === state.tab ? 'on' : '') + '">' +
        esc(t.nama) + '</button>';
    }).join('');
  }

  function bukaTab(id) {
    var ada = daftarTab().some(function (t) { return t.id === id; });
    state.tab = ada ? id : 'naskah';
    gambarTab();

    if (state.tab === 'naskah') return muatNaskah();
    isiPesan('Bagian ini dibuat di tahap berikutnya.');
  }

  /* ---------- Tab Naskah & Status ---------- */

  async function muatNaskah() {
    isiPesan('Memuat naskah…');

    var r = await sb.from('articles')
      .select('id,title,status,category,author_id,author_name,created_at,published_at,is_exclusive,is_breaking,right_of_reply,hak_jawab,review_note')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(100);

    if (r.error) return isiPesan('Gagal memuat naskah: ' + r.error.message, 'rd-err');

    state.daftar = r.data || [];
    tampilNaskah();
  }

  function tampilNaskah() {
    var semua = state.daftar;
    var hitung = function (daftarStatus) {
      return semua.filter(function (a) { return daftarStatus.indexOf(a.status) !== -1; }).length;
    };
    var tampil = state.filter
      ? semua.filter(function (a) { return a.status === state.filter; })
      : semua;

    var opsi = ['', 'draf', 'diajukan', 'disunting', 'ditinjau', 'revisi', 'terbit', 'arsip'];
    var pilihan = opsi.map(function (o) {
      return '<option value="' + o + '"' + (o === state.filter ? ' selected' : '') + '>' +
        (o ? esc(LABEL_STATUS[o]) : 'Semua status') + '</option>';
    }).join('');

    el.isi.innerHTML =
      '<div class="rd-ringkas">' +
        '<div class="rd-angka"><small>Naskah</small><b>' + semua.length + '</b></div>' +
        '<div class="rd-angka"><small>Terbit</small><b>' + hitung(['terbit']) + '</b></div>' +
        '<div class="rd-angka"><small>Dalam proses</small><b>' + hitung(['diajukan', 'disunting', 'ditinjau', 'revisi']) + '</b></div>' +
        '<div class="rd-angka"><small>Draf</small><b>' + hitung(['draf', 'draft']) + '</b></div>' +
      '</div>' +
      '<section class="rd-kotak">' +
        '<div class="rd-tombol-baris" style="justify-content:space-between;align-items:center;margin-bottom:12px">' +
          '<h2 style="margin:0">Daftar naskah</h2>' +
          '<select id="filterStatus" class="rd-filter">' + pilihan + '</select>' +
        '</div>' +
        (tampil.length
          ? tampil.map(baris).join('')
          : '<p class="rd-kotak-kosong">Belum ada naskah untuk filter ini.</p>') +
      '</section>';
  }

  function baris(a) {
    var st = a.status || 'draf';
    var lencana = '<span class="rd-status ' + esc(st) + '">' + esc(LABEL_STATUS[st] || st) + '</span>' +
      (a.is_exclusive ? '<span class="rd-status eksklusif">EKSKLUSIF</span>' : '') +
      (a.is_breaking ? '<span class="rd-status breaking">BREAKING</span>' : '');

    return '<article class="rd-baris">' +
      '<p class="rd-baris-judul">' + esc(a.title || '(Tanpa judul)') + '</p>' +
      '<p class="rd-baris-meta">' + esc(a.category || 'Umum') + ' • ' + esc(a.author_name || 'Redaksi') +
        ' • ' + tgl(a.created_at) + '</p>' +
      '<div>' + lencana + '</div>' +
      (a.review_note ? '<p class="rd-baris-meta">Catatan revisi: ' + esc(a.review_note) + '</p>' : '') +
      (a.hak_jawab ? '<p class="rd-baris-meta">Hak jawab: ' + esc(a.hak_jawab) + '</p>' : '') +
      '<div class="rd-baris-aksi">' + aksiUntuk(a) + '</div>' +
    '</article>';
  }

  // Tombol yang muncul sesuai peran dan status (mengikuti aturan di database)
  function aksiUntuk(a) {
    var p = state.profil;
    var r = p.role;
    var st = a.status;
    var saya = a.author_id === p.id;
    var b = [];

    function tombol(act, teks, kelas) {
      return '<button type="button" class="btn-xs ' + (kelas || '') + '" data-act="' + act +
        '" data-id="' + a.id + '">' + esc(teks) + '</button>';
    }

    if ((st === 'draf' || st === 'draft' || st === 'revisi') && (saya || r === 'direktur')) {
      b.push(tombol('ajukan', 'Ajukan', 'utama'));
    }
    if (st === 'diajukan' && (r === 'editor' || r === 'direktur')) {
      b.push(tombol('sunting', 'Mulai sunting', 'utama'));
    }
    if (st === 'disunting' && (r === 'redaktur' || r === 'direktur')) {
      b.push(tombol('tinjau', 'Teruskan ke pemred', 'utama'));
    }
    if (st === 'ditinjau' && (r === 'pemred' || r === 'direktur')) {
      b.push(tombol('terbitkan', 'Terbitkan', 'setuju'));
    }
    if (['diajukan', 'disunting', 'ditinjau'].indexOf(st) !== -1 && STAF.indexOf(r) !== -1) {
      b.push(tombol('revisi', 'Minta revisi', 'tolak'));
    }
    if (st === 'terbit' && (r === 'pemred' || r === 'direktur')) {
      b.push(tombol('arsipkan', 'Tarik ke arsip', 'keluar'));
    }
    if (st === 'arsip' && (saya || r === 'pemred' || r === 'direktur')) {
      b.push(tombol('pulihkan', 'Pulihkan', 'utama'));
    }
    if (a.is_exclusive && (r === 'pemred' || r === 'direktur')) {
      b.push(tombol('hakjawab', a.hak_jawab ? 'Ubah hak jawab' : 'Isi hak jawab', ''));
    }
    if ((st === 'draf' || st === 'draft') && saya) {
      b.push(tombol('hapus', 'Hapus', 'tolak'));
    }
    return b.join('');
  }

  async function jalankanAksi(act, id, tombolEl) {
    var a = state.daftar.find(function (x) { return String(x.id) === String(id); });
    if (!a) return kabarkan('Naskah tidak ditemukan');

    var panggil = null;

    if (act === 'ajukan') {
      panggil = sb.rpc('advance_article', { p_id: a.id, p_to: 'diajukan', p_note: null });
    } else if (act === 'sunting') {
      panggil = sb.rpc('advance_article', { p_id: a.id, p_to: 'disunting', p_note: null });
    } else if (act === 'tinjau') {
      panggil = sb.rpc('advance_article', { p_id: a.id, p_to: 'ditinjau', p_note: null });
    } else if (act === 'terbitkan') {
      if (!confirm('Terbitkan naskah ini sekarang?')) return;
      panggil = sb.rpc('advance_article', { p_id: a.id, p_to: 'terbit', p_note: null });
    } else if (act === 'revisi') {
      var catatan = prompt('Tulis catatan revisi untuk penulis (wajib):');
      if (catatan === null) return;
      if (!catatan.trim()) return kabarkan('Catatan revisi wajib diisi');
      panggil = sb.rpc('advance_article', { p_id: a.id, p_to: 'revisi', p_note: catatan.trim() });
    } else if (act === 'arsipkan') {
      if (!confirm('Tarik naskah ini dari situs ke arsip?')) return;
      panggil = sb.rpc('unpublish_article', { p_id: a.id, p_note: null });
    } else if (act === 'pulihkan') {
      panggil = sb.rpc('pulihkan_arsip', { p_id: a.id });
    } else if (act === 'hakjawab') {
      var teks = prompt('Isi hak jawab (kosongkan lalu OK untuk menghapus):', a.hak_jawab || '');
      if (teks === null) return;
      panggil = sb.rpc('set_hak_jawab', { p_id: a.id, p_teks: teks });
    } else if (act === 'hapus') {
      if (!confirm('Pindahkan draf ini ke sampah?')) return;
      panggil = sb.from('articles').update({ deleted_at: new Date().toISOString() }).eq('id', a.id);
    }

    if (!panggil) return;

    tombolEl.disabled = true;
    var r = await panggil;
    tombolEl.disabled = false;

    if (r.error) {
      kabarkan(r.error.message);
      return;
    }
    kabarkan('Berhasil diperbarui');
    muatNaskah();
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
    state.daftar = [];
    tampilMasuk();
    kabarkan('Kamu sudah keluar');
  });

  el.tabs.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-tab]');
    if (t) bukaTab(t.dataset.tab);
  });

  el.isi.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-act]');
    if (t) jalankanAksi(t.dataset.act, t.dataset.id, t);
  });

  el.isi.addEventListener('change', function (ev) {
    if (ev.target.id === 'filterStatus') {
      state.filter = ev.target.value;
      tampilNaskah();
    }
  });

  cekSesi();
})();
