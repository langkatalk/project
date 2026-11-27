// js/seo-artikel.js
// Mengisi judul, deskripsi, gambar sosial, dan data NewsArticle (JSON-LD) untuk setiap berita.
(function () {
  'use strict';

  var sb = window.LK && window.LK.sb;
  if (!sb) return;

  var KUNCI = new URLSearchParams(location.search).get('s') || '';
  if (!KUNCI) return;

  var ASAL = location.origin;

  function setMeta(nama, isi, prop) {
    var sel = prop ? 'meta[property="' + nama + '"]' : 'meta[name="' + nama + '"]';
    var el = document.querySelector(sel);
    if (!el) {
      el = document.createElement('meta');
      if (prop) el.setAttribute('property', nama); else el.setAttribute('name', nama);
      document.head.appendChild(el);
    }
    el.setAttribute('content', isi);
  }

  async function muat() {
    var q = /^\d+$/.test(KUNCI)
      ? sb.from('articles').select('id,title,slug,description,cover_url,category,author_name,published_at,created_at').eq('id', Number(KUNCI)).maybeSingle()
      : sb.from('articles').select('id,title,slug,description,cover_url,category,author_name,published_at,created_at').eq('slug', KUNCI).maybeSingle();
    var r = await q;
    var a = r.data;
    if (!a) return;

    var url = ASAL + '/baca.html?s=' + encodeURIComponent(a.slug || a.id);
    var deskripsi = (a.description || a.title || '').slice(0, 160);
    var gambar = a.cover_url || (ASAL + '/logo-landscape.png');

    document.title = a.title + ' | Langkatalk';
    setMeta('description', deskripsi);
    setMeta('og:title', a.title, true);
    setMeta('og:description', deskripsi, true);
    setMeta('og:image', gambar, true);
    setMeta('og:url', url, true);
    setMeta('og:type', 'article', true);
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', a.title);
    setMeta('twitter:image', gambar);

    var canon = document.querySelector('link[rel="canonical"]');
    if (!canon) {
      canon = document.createElement('link');
      canon.rel = 'canonical';
      document.head.appendChild(canon);
    }
    canon.href = url;

    var data = {
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      'mainEntityOfPage': { '@type': 'WebPage', '@id': url },
      'headline': a.title.slice(0, 110),
      'description': deskripsi,
      'image': [gambar],
      'datePublished': a.published_at || a.created_at,
      'dateModified': a.published_at || a.created_at,
      'articleSection': a.category || 'Berita',
      'author': { '@type': 'Person', 'name': a.author_name || 'Redaksi Langkatalk' },
      'publisher': {
        '@type': 'Organization',
        'name': 'Langkatalk',
        'logo': { '@type': 'ImageObject', 'url': ASAL + '/logo-landscape.png' }
      }
    };

    var skrip = document.createElement('script');
    skrip.type = 'application/ld+json';
    skrip.textContent = JSON.stringify(data);
    document.head.appendChild(skrip);
  }

  muat();
})();
