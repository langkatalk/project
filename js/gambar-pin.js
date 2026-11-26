// js/gambar-pin.js
// Direktur mengganti gambar kartu di beranda: Pantau Cuaca, Pantau Pembangunan, Laporan Rakyat.
// Gambar otomatis dipotong 1200x600 (2:1), WebP, maks 300 KB.
(function () {
  'use strict';

  var sb = window.LK && window.LK.sb;
  var box = document.getElementById('gambarPin');
  if (!sb || !box) return;

  var NAMA = { cuaca: 'PANTAU CUACA LANGKAT', pembangunan: 'PANTAU PEMBANGUNAN', laporan: 'LAPORAN RAKYAT' };
  var BAWAAN = {
    cuaca: 'Ilustrasi cuaca sesuai kondisi',
    pembangunan: 'Gambar sampul artikel PIN',
    laporan: 'Gambar sampul artikel PIN'
  };
  var MAKS = 300 * 1024;

  box.innerHTML =
    '<h3 class="ap-label">Gambar kartu di beranda</h3>' +
    '<p>Gambar otomatis dipotong 1200×600 (2:1), format WebP, maksimal 300 KB. Setelah disimpan, kartu di beranda langsung berganti.</p>' +
    '<div id="gpList"></div>' +
    '<p class="ap-err" id="gpErr"></p>' +
    '<p class="ap-ok" id="gpOk"></p>';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function render(rows) {
    var map = {};
    rows.forEach(function (r) { map[r.kunci] = r.gambar_url; });
    document.getElementById('gpList').innerHTML = ['cuaca', 'pembangunan', 'laporan'].map(function (k) {
      var u = map[k];
      return '<div class="ap-kaca" style="margin-top:10px;padding:14px">' +
        '<p style="font-weight:800;margin:0 0 8px">' + NAMA[k] + '</p>' +
        '<div style="aspect-ratio:2/1;max-width:360px;border-radius:14px;overflow:hidden;background:#EEF3FF;margin-bottom:8px">' +
          (u
            ? '<img src="' + esc(u) + '" alt="" style="width:100%;height:100%;object-fit:cover;display:block">'
            : '<p style="padding:12px;margin:0;color:#5b5478;font-size:13px">' + BAWAAN[k] + '</p>') +
        '</div>' +
        '<input type="file" accept="image/*" class="gpFile" data-kunci="' + k + '" style="margin-bottom:8px"><br>' +
        '<button type="button" class="ap-tombol ap-tombol-kecil gpSimpan" data-kunci="' + k + '" disabled>Simpan gambar</button> ' +
        (u ? '<button type="button" class="ap-tombol ap-tombol-kecil gpHapus" data-kunci="' + k + '" style="background:#E4DEFF;color:#1d1640">Kembali ke bawaan</button>' : '') +
        '</div>';
    }).join('');
    bind();
  }

  function gambarKeKanvas(file) {
    return new Promise(function (res, rej) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        var W = 1200, H = 600, rasio = W / H;
        var sr = img.width / img.height, sw, sh, sx, sy;
        if (sr > rasio) { sh = img.height; sw = sh * rasio; sx = (img.width - sw) / 2; sy = 0; }
        else { sw = img.width; sh = sw / rasio; sx = 0; sy = (img.height - sh) / 2; }
        var c = document.createElement('canvas');
        c.width = W; c.height = H;
        c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
        URL.revokeObjectURL(url);
        res(c);
      };
      img.onerror = function () { rej(new Error('File gambar tidak bisa dibaca.')); };
      img.src = url;
    });
  }

  function keBlob(c, kualitas) {
    return new Promise(function (r) { c.toBlob(r, 'image/webp', kualitas); });
  }

  async function simpanGambar(kunci, file) {
    var c = await gambarKeKanvas(file);
    var blob = null;
    var kualitas = [0.85, 0.75, 0.65, 0.55];
    for (var i = 0; i < kualitas.length; i++) {
      blob = await keBlob(c, kualitas[i]);
      if (blob && blob.size <= MAKS) break;
    }
    if (!blob || blob.size > MAKS) throw new Error('Gambar masih lebih dari 300 KB. Pilih gambar yang lebih sederhana.');

    var path = kunci + '.webp';
    var up = await sb.storage.from('pin-kartu').upload(path, blob, { upsert: true, contentType: 'image/webp', cacheControl: '3600' });
    if (up.error) throw new Error(up.error.message);

    var url = sb.storage.from('pin-kartu').getPublicUrl(path).data.publicUrl + '?v=' + Date.now();
    var r = await sb.from('pin_kartu').update({ gambar_url: url, diubah_pada: new Date().toISOString() }).eq('kunci', kunci);
    if (r.error) throw new Error(r.error.message);
    return url;
  }

  async function hapusGambar(kunci) {
    var r = await sb.from('pin_kartu').update({ gambar_url: null, diubah_pada: new Date().toISOString() }).eq('kunci', kunci);
    if (r.error) throw new Error(r.error.message);
  }

  function pesan(err, ok) {
    document.getElementById('gpErr').textContent = err || '';
    document.getElementById('gpOk').textContent = ok || '';
  }

  async function muat() {
    var r = await sb.from('pin_kartu').select('kunci,gambar_url');
    if (r.error) { pesan('Gagal memuat: ' + r.error.message, ''); return; }
    render(r.data || []);
  }

  function bind() {
    document.querySelectorAll('.gpFile').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var tombol = document.querySelector('.gpSimpan[data-kunci="' + inp.dataset.kunci + '"]');
        if (tombol) tombol.disabled = !inp.files[0];
      });
    });

    document.querySelectorAll('.gpSimpan').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var k = btn.dataset.kunci;
        var file = document.querySelector('.gpFile[data-kunci="' + k + '"]').files[0];
        if (!file) return;
        btn.disabled = true;
        pesan('', 'Menyimpan gambar ' + NAMA[k] + '…');
        try {
          await simpanGambar(k, file);
          pesan('', 'Gambar ' + NAMA[k] + ' berhasil diganti.');
          await muat();
        } catch (e) {
          pesan(e.message, '');
          btn.disabled = false;
        }
      });
    });

    document.querySelectorAll('.gpHapus').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var k = btn.dataset.kunci;
        try {
          await hapusGambar(k);
          pesan('', NAMA[k] + ' kembali ke gambar bawaan.');
          await muat();
        } catch (e) {
          pesan(e.message, '');
        }
      });
    });
  }

  muat();
})();
