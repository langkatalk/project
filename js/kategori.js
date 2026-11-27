// js/kategori.js
// Pengelolaan kategori (hanya direktur). Perubahan lewat fungsi database yang sudah dijaga peran direktur.
(function () {
  'use strict';

  var sb = window.LK && window.LK.sb;
  var $ = function (id) { return document.getElementById(id); };
  var daftar = [];
  var buka = null; // nama kategori yang sedang dibuka panel hapusnya

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function pesan(err, ok) {
    $('ktErr').textContent = err || '';
    $('ktOk').textContent = ok || '';
  }

  async function cekDirektur() {
    var s = await sb.auth.getSession();
    var user = s.data && s.data.session && s.data.session.user;
    if (!user) return { masuk: false };
    var p = await sb.from('profiles').select('role,is_active').eq('id', user.id).maybeSingle();
    return { masuk: true, direktur: !!(p.data && p.data.role === 'direktur' && p.data.is_active !== false) };
  }

  async function muat() {
    var c = await sb.from('categories').select('name,sort').order('sort', { ascending: true });
    if (c.error) return pesan('Gagal memuat kategori: ' + c.error.message);

    var j = await sb.rpc('kategori_jumlah_artikel');
    var jumlah = {};
    (j.data || []).forEach(function (x) { jumlah[x.nama] = Number(x.jumlah); });

    daftar = (c.data || []).map(function (x) {
      return { nama: x.name, urut: x.sort, jumlah: jumlah[x.name] || 0 };
    });
    render();
  }

  function render() {
    $('ktDaftar').innerHTML = daftar.map(function (k, i) {
      var panel = '';
      if (buka === k.nama) {
        var lainnya = daftar.filter(function (x) { return x.nama !== k.nama; });
        panel = '<div class="kt-panel">' +
          '<span>' + (k.jumlah ? k.jumlah + ' artikel akan dipindahkan ke: ' : 'Tidak ada artikel. Pilih kategori tujuan: ') + '</span>' +
          '<select class="kt-select" id="ktTujuan">' +
            lainnya.map(function (x) { return '<option value="' + esc(x.nama) + '">' + esc(x.nama) + '</option>'; }).join('') +
          '</select>' +
          '<button type="button" class="kt-btn bahaya" data-aksi="hapus-ya" data-nama="' + esc(k.nama) + '">Hapus kategori</button>' +
          '<button type="button" class="kt-btn" data-aksi="hapus-batal">Batal</button>' +
        '</div>';
      }

      return '<div class="kt-baris">' +
        '<span class="kt-nomor">' + (i + 1) + '</span>' +
        '<span class="kt-nama">' + esc(k.nama) + '</span>' +
        '<span class="kt-jumlah">' + k.jumlah + ' artikel</span>' +
        '<button type="button" class="kt-btn" data-aksi="naik" data-i="' + i + '"' + (i === 0 ? ' disabled' : '') + '>▲</button>' +
        '<button type="button" class="kt-btn" data-aksi="turun" data-i="' + i + '"' + (i === daftar.length - 1 ? ' disabled' : '') + '>▼</button>' +
        '<button type="button" class="kt-btn" data-aksi="ubah" data-nama="' + esc(k.nama) + '">Ubah nama</button>' +
        '<button type="button" class="kt-btn bahaya" data-aksi="hapus" data-nama="' + esc(k.nama) + '">Hapus</button>' +
        panel +
      '</div>';
    }).join('') || '<p class="kt-catatan">Belum ada kategori.</p>';
  }

  async function susun(urutanBaru) {
    var r = await sb.rpc('kategori_susun', { p_urutan: urutanBaru });
    if (r.error) return pesan(r.error.message);
    pesan('', 'Urutan disimpan.');
    muat();
  }

  async function tambah() {
    pesan('', '');
    var nama = $('ktBaru').value.trim().replace(/\s+/g, ' ');
    if (nama.length < 2 || nama.length > 40) return pesan('Nama kategori harus 2 sampai 40 karakter.');
    if (daftar.some(function (k) { return k.nama.toLowerCase() === nama.toLowerCase(); })) {
      return pesan('Kategori "' + nama + '" sudah ada.');
    }
    var urut = daftar.length ? Math.max.apply(null, daftar.map(function (k) { return k.urut || 0; })) + 1 : 1;
    var r = await sb.from('categories').insert({ name: nama, sort: urut });
    if (r.error) return pesan('Gagal menambah: ' + r.error.message);
    $('ktBaru').value = '';
    pesan('', 'Kategori "' + nama + '" ditambahkan.');
    muat();
  }

  async function ubahNama(lama) {
    var baru = prompt('Nama baru untuk "' + lama + '":', lama);
    if (baru === null) return;
    var r = await sb.rpc('kategori_ubah_nama', { p_lama: lama, p_baru: baru });
    if (r.error) return pesan(r.error.message);
    pesan('', 'Nama diubah. Artikel yang memakai nama lama ikut diperbarui.');
    muat();
  }

  async function hapusYa(nama) {
    var tujuan = $('ktTujuan') ? $('ktTujuan').value : '';
    if (!tujuan) return pesan('Pilih kategori tujuan dulu.');
    var r = await sb.rpc('kategori_hapus', { p_nama: nama, p_pindah_ke: tujuan });
    if (r.error) return pesan(r.error.message);
    buka = null;
    pesan('', 'Kategori "' + nama + '" dihapus. ' + (r.data || 0) + ' artikel dipindahkan ke "' + tujuan + '".');
    muat();
  }

  $('ktDaftar').addEventListener('click', function (e) {
    var t = e.target.closest('[data-aksi]');
    if (!t) return;
    var aksi = t.dataset.aksi;
    var i = Number(t.dataset.i);
    pesan('', '');

    if (aksi === 'naik' && i > 0) {
      var a = daftar.map(function (k) { return k.nama; });
      var tmp = a[i]; a[i] = a[i - 1]; a[i - 1] = tmp;
      return susun(a);
    }
    if (aksi === 'turun' && i < daftar.length - 1) {
      var b = daftar.map(function (k) { return k.nama; });
      var tmp2 = b[i]; b[i] = b[i + 1]; b[i + 1] = tmp2;
      return susun(b);
    }
    if (aksi === 'ubah') return ubahNama(t.dataset.nama);
    if (aksi === 'hapus') { buka = t.dataset.nama; return render(); }
    if (aksi === 'hapus-batal') { buka = null; return render(); }
    if (aksi === 'hapus-ya') return hapusYa(t.dataset.nama);
  });

  $('ktTambah').addEventListener('click', tambah);
  $('ktBaru').addEventListener('keydown', function (e) { if (e.key === 'Enter') tambah(); });

  async function mulai() {
    if (!sb) { $('ktAkses').innerHTML = '<p>Koneksi belum siap.</p>'; return; }
    var c = await cekDirektur();
    if (!c.masuk) { $('ktAkses').innerHTML = '<p>Masuk dulu lewat <a href="redaksi.html">Ruang Redaksi</a>.</p>'; return; }
    if (!c.direktur) { $('ktAkses').innerHTML = '<p>Halaman ini hanya untuk direktur.</p>'; return; }

    $('ktAkses').hidden = true;
    $('ktPanel').hidden = false;
    muat();
  }

  mulai();
})();
