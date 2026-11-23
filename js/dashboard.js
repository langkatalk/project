// js/dashboard.js
// Ruang Redaksi, tahap 1: masuk, lupa kata sandi, keluar, dan cek peran.
(function () {
  'use strict';

  var sb = window.LK && window.LK.sb;
  var REGEX_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  var NAMA_PERAN = {
    direktur: 'Direktur',
    pemred: 'Pemimpin Redaksi',
    redaktur: 'Redaktur',
    editor: 'Editor',
    reporter: 'Reporter',
    kontributor: 'Kontributor'
  };

  var el = {
    masuk: document.getElementById('layarMasuk'),
    app: document.getElementById('layarApp'),
    profil: document.getElementById('profil'),
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

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function kabarkan(pesan) {
    el.toast.textContent = pesan;
    el.toast.classList.add('on');
    clearTimeout(kabarkan.t);
    kabarkan.t = setTimeout(function () { el.toast.classList.remove('on'); }, 2800);
  }

  function tampilMasuk() {
    el.masuk.hidden = false;
    el.app.hidden = true;
    el.aksi.hidden = true;
  }

  function tampilRedaksi(p) {
    el.masuk.hidden = true;
    el.app.hidden = false;
    el.aksi.hidden = false;

    var peran = NAMA_PERAN[p.role] || p.role || 'Belum ada peran';
    el.profil.innerHTML =
      '<div><b>' + esc(p.full_name || p.username) + '</b>' +
      '<small>@' + esc(p.username) + '</small></div>' +
      '<span class="rd-lencana-peran">' + esc(peran) + '</span>';

    el.isi.innerHTML =
      '<section class="rd-kotak">' +
        '<h2>Selamat datang di Ruang Redaksi</h2>' +
        '<p class="rd-kotak-kosong">Masuk berhasil. Menu naskah, pengguna, komentar, iklan, dan pengaturan akan ditampilkan di sini pada tahap berikutnya.</p>' +
      '</section>';
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
    tampilMasuk();
    kabarkan('Kamu sudah keluar');
  });

  cekSesi();
})();
