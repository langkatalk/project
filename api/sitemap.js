// api/sitemap.js
// Sitemap XML otomatis dari artikel yang sudah terbit, plus halaman statis.
var SUPABASE_URL = 'https://wzobvwdsnhnuvcbtalpa.supabase.co';
var PUBLISHABLE_KEY = 'sb_publishable__pEZvRbSE9HHDKTkpEXZMg_LXrH1GXl';
var SITUS = 'https://langkatalk.vercel.app';
var HALAMAN_STATIS = ['index.html', 'tentang.html', 'masthead.html', 'privasi.html', 'pedoman.html'];

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function tanggal(d) {
  return new Date(d || Date.now()).toISOString().slice(0, 10);
}

module.exports = async function handler(req, res) {
  var sekarang = new Date().toISOString();
  var url = SUPABASE_URL + '/rest/v1/articles' +
    '?select=slug,id,published_at,updated_at' +
    '&status=eq.terbit&deleted_at=is.null' +
    '&or=' + encodeURIComponent('(scheduled_at.is.null,scheduled_at.lte.' + sekarang + ')') +
    '&order=published_at.desc&limit=5000';

  var baris = [];
  try {
    var r = await fetch(url, {
      headers: { apikey: PUBLISHABLE_KEY, Authorization: 'Bearer ' + PUBLISHABLE_KEY }
    });
    baris = r.ok ? await r.json() : [];
  } catch (e) {
    baris = [];
  }

  var xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  HALAMAN_STATIS.forEach(function (h) {
    xml += '  <url><loc>' + esc(SITUS + '/' + h) + '</loc></url>\n';
  });

  baris.forEach(function (a) {
    xml += '  <url><loc>' + esc(SITUS + '/baca.html?s=' + encodeURIComponent(a.slug || a.id)) + '</loc>' +
      '<lastmod>' + tanggal(a.updated_at || a.published_at) + '</lastmod></url>\n';
  });

  xml += '</urlset>';

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
  res.status(200).send(xml);
};
