// js/kategori-tambah.js
// Tombol "+ Tambah" di akhir daftar kategori. Hanya tampil untuk akun Direktur.
// Aturan keamanan tetap dijaga database (categories_insert_direktur).
(function () {
  'use strict';

  var sb = window.LK && window.LK.sb;
  var chips = document.getElementById('chips');
  if (!sb || !chips) return;

  var jadiDirektur = false;
  var panel = null;

  async function cekDirektur() {
    var s = await sb.auth.getSession();
    var user = s.data && s.data.session && s.data.session.user;
    if (!user) return false;
    var r = await sb.from('profiles')
      .select('role,is_active')
      .eq('id', user.id)
      .maybeSingle();
    return !!(r.data && r.data.role === 'direktur' && r.data.is_active !== false);
  }

  function pasangTombol() {
    if (!jadiDirektur) return;
    if (chips.querySelector('.chip-tambah')) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip-kat chip-tambah';
    b.textContent = '+ Tambah';
    b.addEventListener('click', bukaForm);
    chips.appendChild(b);
  }

  function bukaForm() {
    if (!panel) buatPanel();
    panel.querySelector('#tkInput').value = '';
    panel.querySelector('#tkErr').textContent = '';
    panel.classList.add('on');
    panel.querySelector('#tkInput').focus();
  }

  function tutupForm() {
    if (panel) panel.classList.remove('on');
  }

  function buatPanel() {
    panel = document.createElement('div');
    panel.id = 'tambahKategoriPanel';
    panel.className = 'filter-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'Tambah kategori');
    panel.innerHTML =
      '<div class="filter-kaca">' +
        '<div class="fk-baris">' +
          '<h3 class="fk-judul">Tambah kategori</h3>' +
          '<button type="button" class="fk-tutup" id="tkTutup" aria-label="Tutup">✕</button>' +
        '</div>' +
        '<div class="fk-blok">' +
          '<p class="fk-label">Nama kategori (3 sampai 30 karakter)</p>' +
          '<input id="tkInput" class="fk-input" type="text" maxlength="30" autocomplete="off">' +
        '</div>' +
        '<p class="fk-err" id="tkErr"></p>' +
        '<div class="fk-tombol">' +
          '<button type="button" class="fk-btn-reset" id="tkBatal">Batal</button>' +
          '<button type="button" class="fk-btn-terapkan" id="tkSimpan">Simpan</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(panel);

    panel.querySelector('#tkTutup').addEventListener('click', tutupForm);
    panel.querySelector('#tkBatal').addEventListener('click', tutupForm);
    panel.querySelector('#tkSimpan').addEventListener('click', simpan);
    panel.addEventListener('click', function (e) {
      if (e.target === panel) tutupForm();
    });
    panel.querySelector('#tkInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') simpan();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.classList.contains('on')) tutupForm();
    });
  }

  async function simpan() {
    var input = panel.querySelector('#tkInput');
    var err = panel.querySelector('#tkErr');
    var tombol = panel.querySelector('#tkSimpan');

    var nama = input.value.trim().replace(/\s+/g, ' ');
    if (nama.length < 3 || nama.length > 30) {
      err.textContent = 'Nama kategori harus 3 sampai 30 karakter.';
      return;
    }

    tombol.disabled = true;
    var terakhir = await sb.from('categories')
      .select('sort')
      .order('sort', { ascending: false })
      .limit(1)
      .maybeSingle();
    var urutanBaru = (terakhir.data && terakhir.data.sort != null) ? terakhir.data.sort + 1 : 1;

    var r = await sb.from('categories').insert({ name: nama, sort: urutanBaru });
    tombol.disabled = false;

    if (r.error) {
      err.textContent = /duplicate|unique/i.test(r.error.message)
        ? 'Kategori ini sudah ada.'
        : 'Gagal menyimpan: ' + r.error.message;
      return;
    }

    tutupForm();
    location.reload();
  }

  // Tombol ikut dipasang ulang setiap kali daftar kategori dirender ulang
  var pengamat = new MutationObserver(pasangTombol);
  pengamat.observe(chips, { childList: true });

  cekDirektur().then(function (ok) {
    jadiDirektur = ok;
    pasangTombol();
  });
})();
