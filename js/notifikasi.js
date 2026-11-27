// js/notifikasi.js
// Notifikasi redaksi: naskah yang perlu ditangani dan komentar yang menunggu persetujuan.
// Naskah yang tampil sesuai peran. Komentar tampil untuk semua staf.
(function () {
  'use strict';

  var sb = window.LK && window.LK.sb;
  var $ = function (id) { return document.getElementById(id); };

  // Status naskah yang perlu ditangani per peran
  var STATUS_PER_PERAN = {
    direktur: ['diajukan', 'disunting', 'ditinjau'],
    pemred: ['diajukan', 'disunting', 'ditinjau'],
    redaktur: ['disunting'],
    editor: ['diajukan']
  };
  var STAF = ['direktur', 'pemred', 'redaktur', 'editor'];

  var LABEL_STATUS = { diajukan: 'Diajukan', disunting: 'Disunting', ditinjau: 'Ditinjau' };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function tgl(d) {
    return d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' }) : '';
  }

  async function cekSesi() {
    var s = await sb.auth.getSession();
    var user = s.data && s.data.session && s.data.session.user;
    if (!user) return null;
    var p = await sb.from('profiles').select('id,role,is_active').eq('id', user.id).maybeSingle();
    if (!p.data || p.data.is_active === false) return null;
    return p.data;
  }

  function render(naskah, komen) {
    $('ntJumlahNaskah').textContent = naskah.length;
    $('ntJumlahKomen').textContent = komen.length;

    $('ntNaskah').innerHTML = naskah.length
      ? naskah.map(function (a) {
          return '<a class="nt-item" href="redaksi.html" data-tab="naskah">' +
            '<b>' + esc(a.title || '(Tanpa judul)') + '</b>' +
            '<small>' + esc(LABEL_STATUS[a.status] || a.status) + ' • ' + esc(a.category || 'Umum') +
            ' • ' + esc(a.author_name || 'Redaksi') + ' • ' + tgl(a.created_at) + '</small></a>';
        }).join('')
      : '<p class="nt-kosong">Tidak ada naskah yang menunggu tindakan kamu.</p>';

    $('ntKomen').innerHTML = komen.length
      ? komen.map(function (c) {
          return '<a class="nt-item" href="redaksi.html" data-tab="komentar">' +
            '<b>' + esc(c.guest_name) + ': ' + esc((c.body || '').slice(0, 120)) + '</b>' +
            '<small>' + tgl(c.created_at) + '</small></a>';
        }).join('')
      : '<p class="nt-kosong">Tidak ada komentar yang menunggu persetujuan.</p>';
  }

  async function muat(peran) {
    var status = STATUS_PER_PERAN[peran] || [];

    var naskahQ = status.length
      ? sb.from('articles')
          .select('id,title,status,author_name,category,created_at')
          .in('status', status)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] });

    var komenQ = sb.from('comments')
      .select('id,guest_name,body,created_at')
      .eq('status', 'menunggu')
      .order('created_at', { ascending: false })
      .limit(50);

    var r = await Promise.all([naskahQ, komenQ]);
    if (r[0].error || r[1].error) {
      $('ntNaskah').innerHTML = '<p class="nt-err">Gagal memuat notifikasi. Coba lagi sebentar lagi.</p>';
      return;
    }
    render(r[0].data || [], r[1].data || []);
  }

  // Menandai tab yang dituju supaya Ruang Redaksi langsung membukanya
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-tab]');
    if (a) sessionStorage.setItem('lk_tab', a.dataset.tab);
  });

  async function mulai() {
    if (!sb) { $('ntAkses').innerHTML = '<p>Koneksi belum siap.</p>'; return; }
    var p = await cekSesi();
    if (!p) { $('ntAkses').innerHTML = '<p>Masuk dulu lewat <a href="redaksi.html">Ruang Redaksi</a>.</p>'; return; }
    if (STAF.indexOf(p.role) === -1) { $('ntAkses').innerHTML = '<p>Halaman ini untuk redaksi.</p>'; return; }

    $('ntAkses').hidden = true;
    $('ntPanel').hidden = false;
    muat(p.role);
  }

  mulai();
})();
