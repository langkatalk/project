// api/rss.js
// Feed RSS 20 berita terbaru, untuk pembaca RSS dan layanan agregator.
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
  var sekarang = new Date().toISOString();
  var url = SUPABASE_URL + '/rest/v1/articles' +
    '?select=id,slug,title,description,body,cover_url,author_name,category,published_at' +
    '&status=eq.terbit&deleted_at=is.null&is_pin=eq.false' +
    '&or=' + encodeURIComponent('(scheduled_at.is.null,scheduled_at.lte.' + sekarang + ')') +
    '&order=published_at.desc&limit=20';

  var data = [];
  try {
    var r = await fetch(url, {
      headers: { apikey: PUBLISHABLE_KEY, Authorization: 'Bearer ' + PUBLISHABLE_KEY }
    });
    data = r.ok ? await r.json() : [];
  } catch (e) {
    data = [];
  }

  var item = data.map(function (a) {
    var link = SITUS + '/baca.html?s=' + encodeURIComponent(a.slug || a.id);
    var ringkas = (a.description || teksDari(a.body)).slice(0, 300);
    return '  <item>\n' +
      '    <title>' + esc(a.title) + '</title>\n' +
      '    <link>' + esc(link) + '</link>\n' +
      '    <guid isPermaLink="true">' + esc(link) + '</guid>\n' +
      '    <pubDate>' + new Date(a.published_at).toUTCString() + '</pubDate>\n' +
      '    <category>' + esc(a.category || 'Umum') + '</category>\n' +
      '    <description>' + esc(ringkas) + '</description>\n' +
      (a.cover_url
        ? '    <media:content url="' + esc(a.cover_url) + '" medium="image" width="1200" height="600"/>\n'
        : '') +
      '  </item>\n';
  }).join('');

  var xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">\n' +
    '<channel>\n' +
    '  <title>Langkatalk</title>\n' +
    '  <link>' + esc(SITUS) + '</link>\n' +
    '  <description>Portal berita investigasi, cerita lokal, dan jurnalisme sosial dari Langkat, Sumatera Utara.</description>\n' +
    '  <language>id-ID</language>\n' +
    '  <lastBuildDate>' + new Date().toUTCString() + '</lastBuildDate>\n' +
    item +
    '</channel>\n</rss>';

  res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=600');
  res.status(200).send(xml);
};
