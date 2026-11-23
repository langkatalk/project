// js/sandi.js
// Mengatur kata sandi baru setelah klik tautan reset dari email.
// Saat tautan dibuka, form "Atur kata sandi baru" tampil dan menu masuk/dashboard disembunyikan.
(function () {
  'use strict';

  var sb = window.LK && window.LK.sb;
  var pemulihan = /type=recovery/.test(location.hash);

  var el = {
    sandi: document.getElementById('layarSandi'),
    masuk: document.getElementById('layarMasuk'),
    app: document.getElementById('layarApp'),
    aksi: document.getElementById('aksiKanan'),
    form: document.getElementById('formSandi'),
    baru: document.getElementById('sBaru'),
    ulang: document.getElementById('sUlang'),
    err: document.getElementById('sErr'),
    ok: document.getElementById('sOk'),
    kirim: document.getElementById('sKirim'),
    toast: document.getElementById('toast')
  };

  function kabarkan(pesan) {
    el.toast.textContent = pesan;
    el.toast.classList.add('on');
    clearTimeout(kabarkan.t);
    kabarkan.t = setTimeout(function () { el.toast.classList.remove('on'); }, 2800);
  }

  function tampilSandi() {
    el.sandi.hidden = false;
    el.masuk.hidden = true;
    el.app.hidden = true;
    el.aksi.hidden = true;
  }

  function tampilMasuk() {
    el.sandi.hidden = true;
    el.masuk.hidden = false;
    el.app.hidden = true;
    el.aksi.hidden = true;
  }

  // Dashboard (dashboard.js) bisa saja menampilkan dirinya lagi saat sesi dibaca.
  // Kalau mode pemulihan aktif, sembunyikan lagi setiap kali itu terjadi.
  function jagaLayar() {
    if (!pemulihan) return;
    [el.masuk, el.app, el.aksi].forEach(function (n) {
      if (n && !n.hidden) n.hidden = true;
    });
  }
  [el.masuk, el.app, el.aksi].forEach(function (n) {
    if (!n) return;
    new MutationObserver(jagaLayar).observe(n, { attributes: true, attributeFilter: ['hidden'] });
  });

  if (!sb) return;

  sb.auth.onAuthStateChange(function (event) {
    if (event === 'PASSWORD_RECOVERY') {
      pemulihan = true;
      tampilSandi();
    }
  });

  if (pemulihan) tampilSandi();

  el.form.addEventListener('submit', async function (ev) {
    ev.preventDefault();
    el.err.textContent = '';
    el.ok.textContent = '';

    var a = el.baru.value;
    var b = el.ulang.value;

    if (a.length < 8) { el.err.textContent = 'Kata sandi minimal 8 karakter.'; return; }
    if (a !== b) { el.err.textContent = 'Konfirmasi kata sandi belum sama.'; return; }

    el.kirim.disabled = true;
    var r = await sb.auth.updateUser({ password: a });
    el.kirim.disabled = false;

    if (r.error) {
      el.err.textContent = 'Gagal menyimpan: ' + r.error.message;
      return;
    }

    // Selesai: keluar, bersihkan alamat dari token, lalu minta masuk dengan sandi baru
    pemulihan = false;
    history.replaceState(null, '', location.pathname);
    await sb.auth.signOut();
    el.form.reset();
    tampilMasuk();
    kabarkan('Kata sandi berhasil diganti. Silakan masuk.');
  });
})();
