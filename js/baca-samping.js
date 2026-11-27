// js/baca-samping.js
// Sidebar (Breaking, Terpopuler, Komentar), tombol kategori, footer kategori, dan tag artikel.
(function () {
  'use strict';

  var sb = window.LK && window.LK.sb;
  if (!sb) return;

  var KUNCI = new URLSearchParams(location.search).get('s') || '';
  var ISO = function () { return new Date().toISOString(); };
  var $ = function (id) { return document.getElementById(id); };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function linkBerita(x) {
    return 'baca.html?s=' + encodeURIComponent(x.slug || x.id);
  }

  function itemBerita(x) {
    return '<a class="bt-item" href="' + linkBerita(x) + '">' +
      (x.cover_url ? '<img src="' + esc(x.cover_url) + '" alt="" loading="lazy">' : '') +
      '<span>' + esc(x.title) + '</span></a>';
  }

  // Kategori: tombol di header dan daftar di footer
  async function muatKategori() {
    var r = await sb.from('categories').select('name').order('sort', { ascending: true });
    var list = (r.data || []).map(function (c) { return c.name; });
    var menu = $('btKatMenu');
    var footer = $('btFKat');
    var links = list.map(function (n) {
      return '<a href="index.html?kategori=' + encodeURIComponent(n) + '">' + esc(n) + '</a>';
    });
    menu.innerHTML = links.join('');
    footer.innerHTML = list.map(function (n) {
      return '<li><a href="index.html?kategori=' + encodeURIComponent(n) + '">' + esc(n) + '</a></li>';
    }).join('');
  }

  function aturMenuKategori() {
    var btn = $('btKat');
    var menu = $('btKatMenu');
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var buka = menu.hidden;
      menu.hidden = !buka;
      btn.setAttribute('aria-expanded', String(buka));
    });
    document.addEventListener('click', function (e) {
      if (!menu.contains(e.target) && e.target !== btn) {
        menu.hidden = true;
        btn.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
    });
  }

  // Breaking: yang ditandai breaking dan terbit 12 jam terakhir. Kalau tidak ada, berita terbaru.
  // Breaking: tampil sampai Direktur melepasnya (urutan dikosongkan). Kalau kosong, berita terbaru.
  async function muatBreaking() {
    var r = await sb.from('articles')
      .select('id,title,slug,cover_url')
      .eq('status', 'terbit').eq('is_breaking', true).is('deleted_at', null)
      .not('breaking_urutan', 'is', null)
      .or('scheduled_at.is.null,scheduled_at.lte.' + ISO())
      .order('breaking_urutan', { ascending: true })
      .limit(5);
    var list = r.data || [];

    if (!list.length) {
      r = await sb.from('articles')
        .select('id,title,slug,cover_url')
        .eq('status', 'terbit').is('deleted_at', null)
        .or('scheduled_at.is.null,scheduled_at.lte.' + ISO())
        .order('published_at', { ascending: false })
        .limit(5);
      list = r.data || [];
    }
    $('btBreaking').innerHTML = list.length ? list.map(itemBerita).join('') : '<p class="bt-kosong">Belum ada berita.</p>';
  }

    if (!list.length) {
      r = await sb.from('articles')
        .select('id,title,slug,cover_url')
        .eq('status', 'terbit').is('deleted_at', null)
        .or('scheduled_at.is.null,scheduled_at.lte.' + ISO())
        .order('published_at', { ascending: false })
        .limit(5);
      list = r.data || [];
    }
    $('btBreaking').innerHTML = list.length ? list.map(itemBerita).join('') : '<p class="bt-kosong">Belum ada berita.</p>';
  }

  // Terpopuler: sementara berdasarkan jumlah suka, 7 hari terakhir (pencatatan pembacaan belum dibuat)
  async function muatPopuler() {
    var batas = new Date(Date.now() - 7 * 86400000).toISOString();
    var r = await sb.from('articles')
      .select('id,title,slug,cover_url,like_count')
      .eq('status', 'terbit').is('deleted_at', null)
      .gte('published_at', batas)
      .or('scheduled_at.is.null,scheduled_at.lte.' + ISO())
      .order('like_count', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(10);
    var list = r.data || [];
    $('btPopuler').innerHTML = list.length ? list.map(itemBerita).join('') : '<p class="bt-kosong">Belum ada data.</p>';
  }

  // Komentar terbaru yang sudah disetujui redaksi
  async function muatKomentarTerbaru() {
    var r = await sb.from('public_comments')
      .select('article_id,guest_name,body,created_at')
      .order('created_at', { ascending: false })
      .limit(6);
    var list = r.data || [];
    $('btKomentar').innerHTML = list.length ? list.map(function (c) {
      return '<a class="bt-komen" href="baca.html?s=' + encodeURIComponent(c.article_id) + '" style="text-decoration:none;display:block">' +
        '<b>' + esc(c.guest_name) + '</b><small>' + new Date(c.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) + '</small>' +
        '<p>' + esc(c.body) + '</p></a>';
    }).join('') : '<p class="bt-kosong">Belum ada komentar.</p>';
  }

  // Tag artikel ditampilkan di bawah isi berita
   // Tag ditempatkan di luar kartu artikel, antara isi berita dan bagian komentar
  async function muatTag() {
    if (!KUNCI) return;
    var q = /^\d+$/.test(KUNCI)
      ? sb.from('articles').select('tags').eq('id', Number(KUNCI)).maybeSingle()
      : sb.from('articles').select('tags').eq('slug', KUNCI).maybeSingle();
    var r = await q;
    var tags = (r.data && r.data.tags) || [];
    if (!tags.length) return;

    var artikelKartu = document.querySelector('#baca article.bc-kartu');
    if (!artikelKartu || $('btTag')) return;
    var box = document.createElement('div');
    box.id = 'btTag';
    box.className = 'bt-tag';
    box.innerHTML = tags.map(function (t) { return '<span>#' + esc(t) + '</span>'; }).join('');
    artikelKartu.insertAdjacentElement('afterend', box);
  }

  // Artikel dirender oleh baca.js setelah halaman siap, jadi tag dipasang saat isinya muncul
  var pengamat = new MutationObserver(function () {
    if (document.querySelector('#baca .bc-tubuh')) {
      pengamat.disconnect();
      muatTag();
    }
  });
  pengamat.observe($('baca'), { childList: true, subtree: true });

  aturMenuKategori();
  muatKategori();
  muatBreaking();
  muatPopuler();
  muatKomentarTerbaru();
})();
