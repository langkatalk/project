// api/berita.js
// Memberi tag Open Graph (judul, deskripsi, gambar) untuk WhatsApp, Facebook, X, dll.
// Pembaca biasa langsung diarahkan ke baca.html.

var SUPABASE_URL = 'https://wzobvwdsnhnuvcbtalpa.supabase.co';
var PUBLISHABLE_KEY = 'sb_publishable__pEZvRbSE9HHDKTkpEXZMg_LXrH1GXl';
var SITUS = 'https://langkatalk.vercel.app';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function teksDari(html) {
  return String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

module.exports = async function handler(req, res) {
  var slug = String((req.query && req.query.s) || '').trim();
  var tujuan = SITUS + '/baca.html?s=' + encodeURIComponent(slug);
  var url = SITUS + '/api/berita?s=' + encodeURIComponent(slug);

  var a = null;
  if (slug) {
    try {
      var r = await fetch(SUPABASE_URL + '/rest/v1/articles?slug=eq.' + encodeURIComponent(slug) +
        '&status=eq.terbit&deleted_at=is.null' +
        '&select=title,description,body,cover_url,published_at,author_name', {
        headers: { apikey: PUBLISHABLE_KEY, Authorization: 'Bearer ' + PUBLISHABLE_KEY }
      });
      var data = r.ok ? await r.json() : [];
      a = data[0] || null;
    } catch (e) {
      a = null;
    }
  }

  var judul = a ? a.title : 'Langkatalk – Menghubungkan Cerita Langkat';
  var deskripsi = a
    ? (a.description || teksDari(a.body)).slice(0, 200)
    : 'Portal berita investigasi, cerita lokal, dan jurnalisme sosial dari Langkat, Sumatera Utara.';
  var gambar = (a && a.cover_url) ? a.cover_url : SITUS + '/favicon.png';

  var html =
    '<!doctype html><html lang="id"><head><meta charset="utf-8">' +
    '<title>' + esc(judul) + ' – Langkatalk</title>' +
    '<meta name="description" content="' + esc(deskripsi) + '">' +
    '<meta property="og:type" content="article">' +
    '<meta property="og:site_name" content="Langkatalk">' +
    '<meta property="og:title" content="' + esc(judul) + '">' +
    '<meta property="og:description" content="' + esc(deskripsi) + '">' +
    '<meta property="og:image" content="' + esc(gambar) + '">' +
    '<meta property="og:image:width" content="1200">' +
    '<meta property="og:image:height" content="600">' +
    '<meta property="og:url" content="' + esc(url) + '">' +
    '<meta name="twitter:card" content="summary_large_image">' +
    '<meta name="twitter:title" content="' + esc(judul) + '">' +
    '<meta name="twitter:description" content="' + esc(deskripsi) + '">' +
    '<meta name="twitter:image" content="' + esc(gambar) + '">' +
    '<meta http-equiv="refresh" content="0; url=' + esc(tujuan) + '">' +
    '<link rel="canonical" href="' + esc(tujuan) + '">' +
    '</head><body>' +
    '<p><a href="' + esc(tujuan) + '">Buka berita</a></p>' +
    '<script>location.replace(' + JSON.stringify(tujuan) + ');</script>' +
    '</body></html>';

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
  res.status(200).send(html);
};
