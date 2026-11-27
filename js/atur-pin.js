// js/atur-pin.js
// Atur Zona PIN (hanya direktur): urutan, ukuran, masa aktif, tampil, judul, deskripsi, tujuan, dan PIN baru.
(function () {
  'use strict';

  var sb = window.LK && window.LK.sb;
  var $ = function (id) { return document.getElementById(id); };
  var BAWAAN = { cuaca: 1, pembangunan: 1, laporan: 1 };
  var UKURAN = [['besar', 'Besar'], ['sedang', 'Sedang'], ['kecil', 'Kecil']];
  var MASA = [['tetap', 'Tetap seperti sekarang'], ['selamanya', 'Selamanya'], ['24jam', '24 jam dari sekarang'], ['7hari', '7 hari dari sekarang']];
  var daftar = [];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function tgl(d) {
    return d ? new Date(d).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) : '';
  }

  // Notifikasi pop-up kaca di bawah layar, hilang otomatis
  function pesan(err, ok) {
    var teks = err || ok;
    if (!teks) return;
    var box = document.getElementById('pnToast');
    if (!box) {
      box = document.createElement('div');
      box.id = 'pnToast';
      box.className = 'pn-toast';
      box.setAttribute('role', 'status');
      document.body.appendChild(box);
    }
    box.textContent = teks;
    box.className = 'pn-toast on ' + (err ? 'err' : 'ok');
    clearTimeout(pesan.t);
    pesan.t = setTimeout(function () { box.classList.remove('on'); }, 3200);
  }

  function opsi(list, nilai) {
    return list.map(function (o) {
      return '<option value="' + o[0] + '"' + (o[0] === nilai ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
    }).join('');
  }

  function tujuanValid(t) {
    return !t || /^https:\/\//i.test(t) || /^[a-z0-9\-]+\.html(\?.*)?$/i.test(t);
  }

  function berakhirDari(masa, sebelumnya) {
    var hari = masa === '24jam' ? 1 : (masa === '7hari' ? 7 : 0);
    if (hari) return new Date(Date.now() + hari * 86400000).toISOString();
    if (masa === 'selamanya') return null;
    return sebelumnya || null;
  }

  async function cekDirektur() {
    var s = await sb.auth.getSession();
    var user = s.data && s.data.session && s.data.session.user;
    if (!user) return { masuk: false };
    var p = await sb.from('profiles').select('role,is_active').eq('id', user.id).maybeSingle();
    return { masuk: true, direktur: !!(p.data && p.data.role === 'direktur' && p.data.is_active !== false) };
  }

  async function muat() {
    var r = await sb.from('pin_kartu').select('*').order('urutan', { ascending: true });
    if (r.error) return pesan('Gagal memuat: ' + r.error.message);
    daftar = r.data || [];
    render();
  }

  function kartu(p, i) {
    var bawaan = !!BAWAAN[p.kunci];
    var masa = p.berakhir_at ? 'sampai ' + tgl(p.berakhir_at) : 'selamanya';
    var sudahLewat = p.berakhir_at && new Date(p.berakhir_at) < new Date();
    return '<article class="pn-kartu" data-kunci="' + esc(p.kunci) + '">' +
      '<div class="pn-atas">' +
        '<div class="pn-gambar">' + (p.gambar_url ? '<img src="' + esc(p.gambar_url) + '" alt="">' : '<span>Tanpa gambar</span>') + '</div>' +
        '<div class="pn-info"><b>' + esc(p.judul || p.kunci) + '</b>' +
          '<small>' + (bawaan ? 'PIN bawaan' : 'PIN tambahan') + ' • ' + (p.aktif ? 'Tampil' : 'Disembunyikan') +
          (sudahLewat ? ' • sudah lewat masa aktif' : '') + ' • masa aktif: ' + esc(masa) + '</small></div>' +
        '<div class="pn-urut">' +
          '<button type="button" data-aksi="naik" data-i="' + i + '"' + (i === 0 ? ' disabled' : '') + '>▲</button> ' +
          '<button type="button" data-aksi="turun" data-i="' + i + '"' + (i === daftar.length - 1 ? ' disabled' : '') + '>▼</button>' +
        '</div>' +
      '</div>' +
      '<label class="pn-label">Judul<input class="pn-input" data-f="judul" value="' + esc(p.judul || '') + '"></label>' +
      '<label class="pn-label">Deskripsi singkat<input class="pn-input" data-f="deskripsi" value="' + esc(p.deskripsi || '') + '"></label>' +
      (p.kunci === 'cuaca' ? '' :
        '<label class="pn-label">Tujuan saat diklik<input class="pn-input" data-f="tujuan" value="' + esc(p.tujuan || '') + '" placeholder="contoh: halaman-saya.html"></label>') +
      '<div class="pn-baris">' +
        '<label class="pn-label">Ukuran<select class="pn-input" data-f="ukuran">' + opsi(UKURAN, p.ukuran) + '</select></label>' +
        '<label class="pn-label">Masa aktif<select class="pn-input" data-f="masa">' + opsi(MASA, 'tetap') + '</select></label>' +
        '<label class="pn-cek"><input type="checkbox" data-f="aktif"' + (p.aktif ? ' checked' : '') + '> Tampilkan</label>' +
      '</div>' +
      '<div class="pn-aksi">' +
        '<button type="button" class="pn-tombol" data-aksi="simpan" data-kunci="' + esc(p.kunci) + '">Simpan</button>' +
        (bawaan ? '' : '<button type="button" class="pn-hapus" data-aksi="hapus" data-kunci="' + esc(p.kunci) + '">Hapus</button>') +
      '</div>' +
    '</article>';
  }

  function render() {
    $('pnDaftar').innerHTML = daftar.map(kartu).join('') || '<p class="pn-catatan">Belum ada PIN.</p>';
  }

  async function simpan(kunci, kartuEl) {
    var p = daftar.find(function (x) { return x.kunci === kunci; });
    if (!p) return;

    var ambil = function (f) {
      var e = kartuEl.querySelector('[data-f="' + f + '"]');
      if (!e) return null;
      return e.type === 'checkbox' ? e.checked : e.value.trim();
    };

    var judul = ambil('judul');
    if (judul.length < 2) return pesan('Judul minimal 2 karakter.');
    var tujuan = ambil('tujuan') || null;
    if (!tujuanValid(tujuan)) return pesan('Tujuan harus alamat https:// atau nama halaman .html (contoh: halaman.html).');

    var data = {
      judul: judul,
      deskripsi: ambil('deskripsi') || null,
      ukuran: ambil('ukuran'),
      aktif: ambil('aktif'),
      berakhir_at: berakhirDari(ambil('masa'), p.berakhir_at)
    };
    if (p.kunci !== 'cuaca') data.tujuan = tujuan;

    var r = await sb.from('pin_kartu').update(data).eq('kunci', kunci);
    if (r.error) return pesan('Gagal menyimpan: ' + r.error.message);
    pesan('', 'PIN "' + judul + '" disimpan.');
    muat();
  }

  // Tukar urutan dua PIN, lalu tulis ulang urutan seluruh daftar supaya tidak ada yang sama
  async function tukar(i, arah) {
    var j = i + arah;
    if (j < 0 || j >= daftar.length) return;
    var baru = daftar.slice();
    var tmp = baru[i]; baru[i] = baru[j]; baru[j] = tmp;

    var hasil = await Promise.all(baru.map(function (p, k) {
      return sb.from('pin_kartu').update({ urutan: k + 1 }).eq('kunci', p.kunci);
    }));
    var gagal = hasil.find(function (x) { return x.error; });
    if (gagal) return pesan('Gagal mengubah urutan: ' + gagal.error.message);
    muat();
  }

  async function hapus(kunci) {
    if (!confirm('Hapus PIN ini dari Zona PIN?')) return;
    var r = await sb.from('pin_kartu').delete().eq('kunci', kunci);
    if (r.error) return pesan('Gagal menghapus: ' + r.error.message);
    pesan('', 'PIN dihapus.');
    muat();
  }

  function fotoKeBlob(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var W = 1200, H = 600, rasio = W / H;
        var sw = img.naturalWidth, sh = img.naturalHeight, cw = sw, ch = sh, sx = 0, sy = 0;
        if (sw / sh > rasio) { cw = sh * rasio; sx = (sw - cw) / 2; } else { ch = sw / rasio; sy = (sh - ch) / 2; }
        var c = document.createElement('canvas');
        c.width = W; c.height = H;
        c.getContext('2d').drawImage(img, sx, sy, cw, ch, 0, 0, W, H);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? resolve(b) : reject(new Error('Gagal memproses gambar.')); }, 'image/webp', 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('File gambar tidak bisa dibaca.')); };
      img.src = url;
    });
  }

  async function tambah() {
    pesan('', '');
    var judul = $('pnBaruJudul').value.trim();
    var tujuan = $('pnBaruTujuan').value.trim();
    if (judul.length < 2) return pesan('Judul minimal 2 karakter.');
    if (!tujuan || !tujuanValid(tujuan)) return pesan('Isi tujuan: alamat https:// atau nama halaman .html.');

    var kunci = 'pin-' + Date.now().toString(36);
    var gambarUrl = null;
    var file = $('pnBaruFoto').files[0];
    try {
      if (file) {
        if (!/^image\//.test(file.type)) return pesan('Pilih file gambar.');
        var blob = await fotoKeBlob(file);
        var up = await sb.storage.from('pin-kartu').upload(kunci + '.webp', blob, { contentType: 'image/webp', cacheControl: '31536000', upsert: false });
        if (up.error) return pesan('Unggah gambar gagal: ' + up.error.message);
        gambarUrl = sb.storage.from('pin-kartu').getPublicUrl(kunci + '.webp').data.publicUrl;
      }
    } catch (e) {
      return pesan(e.message);
    }

    var urutan = daftar.length ? Math.max.apply(null, daftar.map(function (p) { return p.urutan || 0; })) + 1 : 1;
    var r = await sb.from('pin_kartu').insert({
      kunci: kunci,
      judul: judul,
      deskripsi: $('pnBaruDeskripsi').value.trim() || null,
      tujuan: tujuan,
      gambar_url: gambarUrl,
      ukuran: $('pnBaruUkuran').value,
      aktif: $('pnBaruAktif').checked,
      berakhir_at: berakhirDari($('pnBaruMasa').value, null),
      urutan: urutan
    });
    if (r.error) return pesan('Gagal menambah PIN: ' + r.error.message);

    $('pnBaruJudul').value = '';
    $('pnBaruDeskripsi').value = '';
    $('pnBaruTujuan').value = '';
    $('pnBaruFoto').value = '';
    pesan('', 'PIN "' + judul + '" ditambahkan.');
    muat();
  }

  $('pnDaftar').addEventListener('click', function (e) {
    var t = e.target.closest('[data-aksi]');
    if (!t) return;
    var aksi = t.dataset.aksi;
    if (aksi === 'simpan') return simpan(t.dataset.kunci, t.closest('.pn-kartu'));
    if (aksi === 'hapus') return hapus(t.dataset.kunci);
    if (aksi === 'naik') return tukar(Number(t.dataset.i), -1);
    if (aksi === 'turun') return tukar(Number(t.dataset.i), 1);
  });

  $('pnBaruSimpan').addEventListener('click', tambah);

  async function mulai() {
    if (!sb) { $('pnAkses').innerHTML = '<p>Koneksi belum siap.</p>'; return; }
    var c = await cekDirektur();
    if (!c.masuk) { $('pnAkses').innerHTML = '<p>Masuk dulu lewat <a href="redaksi.html">Ruang Redaksi</a>.</p>'; return; }
    if (!c.direktur) { $('pnAkses').innerHTML = '<p>Halaman ini hanya untuk direktur.</p>'; return; }

    $('pnAkses').hidden = true;
    $('pnPanel').hidden = false;
    muat();
  }

  mulai();
})();
