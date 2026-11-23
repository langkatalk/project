/* Langkatalk v4 — Logika Bersama (Supabase, Feed, Like, Komen, Share, Simpan, Nav) */
const $ = (id) => document.getElementById(id);

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

const stripHtmlText = (html) => String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  : '';

const fmtTime = (d) => d
  ? new Date(d).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  : '';

const readMinutes = (txt) => Math.max(1, Math.ceil(stripHtmlText(txt).split(/\s+/).filter(Boolean).length / 200));

function resolveSupabaseConfig() {
  const raw = window.APP_CONFIG || window.LANGKATALK_CONFIG || {};
  const supaUrl = (raw.SUPABASE_URL || '').trim();
  const pubKey = (raw.SUPABASE_PUBLISHABLE_KEY || raw.SUPABASE_ANON_KEY || '').trim();
  const useProxy = raw.USE_PROXY !== false;
  const proxyPath = (raw.PROXY_PATH || '/supabase').replace(/\/+$/, '');
  const apiUrl = useProxy ? `${location.origin}${proxyPath}` : supaUrl;
  const hasValidKey = !!pubKey && pubKey.length >= 20 && !pubKey.includes('GANTI_') && !pubKey.startsWith('TEMPEL_');
  const hasValidUrl = !!apiUrl && !apiUrl.includes('GANTI_');
  return { apiUrl, pubKey, ready: Boolean(window.supabase && hasValidUrl && hasValidKey) };
}

const ltCfg = resolveSupabaseConfig();
const ltReady = ltCfg.ready;
const ltSb = ltReady ? window.supabase.createClient(ltCfg.apiUrl, ltCfg.pubKey) : null;

function getDeviceId() {
  let id = localStorage.getItem('lk_device_id');
  if (!id) {
    id = (crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem('lk_device_id', id);
  }
  return id;
}

const getJsonStore = (k, def) => {
  try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(def)); }
  catch { return def; }
};
const setJsonStore = (k, v) => localStorage.setItem(k, JSON.stringify(v));

const LT_CATS = ['Investigasi', 'Ruang Gelap', 'Politik', 'Panggung', 'Ekonomi Gelap', 'Opini'];
const LT_ROLES = {
  direktur: 'Direktur',
  pemred: 'Pemimpin Redaksi',
  redaktur: 'Redaktur',
  editor: 'Editor',
  reporter: 'Reporter',
  kontributor: 'Kontributor'
};

const ltState = {
  deviceId: getDeviceId(),
  likedIds: new Set(getJsonStore('lk_liked_ids', [])),
  savedIds: new Set(getJsonStore('lk_saved_ids', [])),
  me: null,
  cat: '',
  tag: '',
  q: '',
  ads: [],
  settings: {}
};

function toast(msg) {
  const el = $('ts');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('on'), 3000);
}

function updateSeoMeta({ title, description, image, url, type = 'website', jsonLd = null }) {
  if (title) document.title = title;
  const setMeta = (sel, attr, val) => {
    const el = document.querySelector(sel);
    if (el && val) el.setAttribute(attr, val);
  };
  setMeta('meta[name="description"]', 'content', description);
  setMeta('meta[property="og:title"]', 'content', title);
  setMeta('meta[property="og:description"]', 'content', description);
  setMeta('meta[property="og:image"]', 'content', image || 'logo.png');
  setMeta('meta[property="og:type"]', 'content', type);
  setMeta('link[rel="canonical"]', 'href', url || location.href);
  const ld = $('ld-json');
  if (ld) ld.textContent = jsonLd ? JSON.stringify(jsonLd) : '{}';
}

async function loadCurrentUser() {
  if (!ltReady) return null;
  try {
    const { data: sess } = await ltSb.auth.getSession();
    const u = sess && sess.session && sess.session.user;
    if (!u) { ltState.me = null; return null; }
    const { data: prof } = await ltSb.from('profiles').select('id,full_name,role,username').eq('id', u.id).maybeSingle();
    ltState.me = prof ? { id: prof.id, n: prof.full_name, r: prof.role, u: prof.username } : null;
  } catch {
    ltState.me = null;
  }
  return ltState.me;
}

async function loadSiteExtras() {
  if (!ltReady) return;
  try {
    const [adsRes, setRes] = await Promise.all([
      ltSb.from('ads').select('*').eq('is_active', true),
      ltSb.from('site_settings').select('key,value')
    ]);
    ltState.ads = adsRes.data || [];
    ltState.settings = {};
    (setRes.data || []).forEach((row) => { ltState.settings[row.key] = row.value; });
  } catch {
    ltState.ads = [];
  }
}

function renderAdSlotHtml(slotName) {
  const ad = ltState.ads.find((x) => x.slot === slotName);
  if (!ad) return '';
  if (ad.ad_type === 'adsense' && ad.adsense_slot_id) {
    const client = ad.adsense_client || ltState.settings.adsense_client || '';
    if (!client) return '';
    return `<div class="ad-slot"><span class="ad-badge">Iklan</span><ins class="adsbygoogle" style="display:block" data-ad-client="${esc(client)}" data-ad-slot="${esc(ad.adsense_slot_id)}" data-ad-format="auto" data-full-width-responsive="true"></ins></div>`;
  }
  if (ad.image_url) {
    const img = `<img src="${esc(ad.image_url)}" alt="${esc(ad.title || 'Iklan Langkatalk')}" loading="lazy" decoding="async">`;
    return `<div class="ad-slot"><span class="ad-badge">Iklan</span>${ad.link_url ? `<a href="${esc(ad.link_url)}" target="_blank" rel="noopener noreferrer">${img}</a>` : img}</div>`;
  }
  return '';
}

async function fetchPublishedArticles(limit = 60) {
  if (!ltReady) return [];
  const res = await ltSb.from('articles')
    .select('id,title,slug,category,body,description,tags,author_name,published_at,is_exclusive,evidence_level,cover_image,like_count,comment_count,view_count,allow_comment,right_of_reply')
    .eq('status', 'terbit')
    .order('published_at', { ascending: false })
    .limit(limit);
  return res.data || [];
}

function sanitizeArticleHtml(rawHtml) {
  const allowedTags = new Set(['B', 'I', 'U', 'S', 'SUB', 'SUP', 'H1', 'H2', 'H3', 'P', 'BLOCKQUOTE', 'UL', 'OL', 'LI', 'BR', 'HR', 'A', 'IMG', 'FIGURE', 'FIGCAPTION', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'DIV', 'SPAN', 'IFRAME']);
  const allowedEmbeds = ['youtube.com/embed/', 'youtu.be/', 'tiktok.com/embed/', 'instagram.com/', 'facebook.com/plugins/', 'platform.twitter.com'];
  const doc = new DOMParser().parseFromString(`<div>${rawHtml || ''}</div>`, 'text/html');
  const root = doc.body.firstChild;

  const cleanNode = (node) => {
    [...node.children].forEach((child) => {
      if (!allowedTags.has(child.tagName)) {
        child.replaceWith(...child.childNodes);
        return;
      }
      [...child.attributes].forEach((attr) => {
        const name = attr.name.toLowerCase();
        const val = attr.value.trim();
        if (name.startsWith('on') || val.toLowerCase().startsWith('javascript:')) {
          child.removeAttribute(attr.name);
        }
      });
      if (child.tagName === 'A') {
        const href = child.getAttribute('href') || '';
        if (!href || href.toLowerCase().startsWith('javascript:')) child.removeAttribute('href');
        else {
          child.setAttribute('rel', 'noopener nofollow');
          child.setAttribute('target', '_blank');
        }
      }
      if (child.tagName === 'IMG') {
        child.setAttribute('loading', 'lazy');
        child.setAttribute('decoding', 'async');
      }
      if (child.tagName === 'IFRAME') {
        const src = child.getAttribute('src') || '';
        if (!allowedEmbeds.some((ok) => src.includes(ok))) {
          child.remove();
          return;
        }
        child.setAttribute('loading', 'lazy');
        child.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups');
      }
      cleanNode(child);
    });
  };

  cleanNode(root);
  return root.innerHTML;
}

function formatArticleBodyHtml(body, title = 'Langkatalk') {
  const raw = String(body || '').trim();
  if (!raw) return '';
  if (/<[a-z][\s\S]*>/i.test(raw)) {
    const safe = sanitizeArticleHtml(raw);
    return safe.replace(/<img(?![^>]*alt=)/gi, `<img alt="${esc(title)}"`);
  }
  return raw.split(/\n{2,}/).filter(Boolean).map((p) => `<p>${esc(p)}</p>`).join('');
}

function recordArticleViewOnce(articleId) {
  if (!ltReady || !articleId) return;
  const cache = getJsonStore('lk_views', {});
  if (!cache[articleId] || Date.now() - cache[articleId] > 3600000) {
    cache[articleId] = Date.now();
    setJsonStore('lk_views', cache);
    ltSb.rpc('increment_view', { p_article_id: articleId }).catch(() => {});
  }
}

async function toggleArticleLike(ev, articleId, forceLikeOnly = false) {
  if (ev) ev.stopPropagation();
  if (!ltReady) return;
  if (forceLikeOnly && ltState.likedIds.has(articleId)) return;

  document.querySelectorAll(`[data-like-btn="${articleId}"]`).forEach((btn) => {
    btn.classList.remove('pop');
    void btn.offsetWidth;
    btn.classList.add('pop');
  });

  const res = await ltSb.rpc('toggle_like', { p_article_id: articleId, p_device_id: ltState.deviceId });
  if (res.error) { toast(res.error.message); return; }

  const { liked, like_count } = res.data || {};
  if (liked) ltState.likedIds.add(articleId);
  else ltState.likedIds.delete(articleId);
  setJsonStore('lk_liked_ids', Array.from(ltState.likedIds));

  if (typeof allPublished !== 'undefined') {
    const found = allPublished.find((x) => x.id === articleId);
    if (found) found.like_count = like_count;
  }

  document.querySelectorAll(`[data-like-btn="${articleId}"]`).forEach((el) => {
    el.classList.toggle('liked', !!liked);
    el.innerHTML = `${liked ? '♥' : '♡'} <span>${like_count ?? 0}</span>`;
  });
}

let _lastTap = 0;
function handleDoubleTapLike(ev, articleId) {
  ev.stopPropagation();
  const now = Date.now();
  if (now - _lastTap < 300) {
    const box = ev.currentTarget;
    const heart = document.createElement('div');
    heart.className = 'big-heart-burst';
    heart.textContent = '♥';
    box.appendChild(heart);
    setTimeout(() => heart.remove(), 620);
    toggleArticleLike(null, articleId, true);
  }
  _lastTap = now;
}

function toggleArticleSave(ev, articleId) {
  if (ev) ev.stopPropagation();
  if (ltState.savedIds.has(articleId)) {
    ltState.savedIds.delete(articleId);
    toast('Dihapus dari daftar simpan');
  } else {
    ltState.savedIds.add(articleId);
    toast('Berita disimpan');
  }
  setJsonStore('lk_saved_ids', Array.from(ltState.savedIds));
  document.querySelectorAll(`[data-save-btn="${articleId}"]`).forEach((el) => {
    const saved = ltState.savedIds.has(articleId);
    el.classList.toggle('saved', saved);
    el.innerHTML = `🔖 <span>${saved ? 'Tersimpan' : 'Simpan'}</span>`;
  });
}

function openShareSheet(ev, slugOrId, title) {
  if (ev) ev.stopPropagation();
  const url = `${location.origin}/index.html#/baca/${encodeURIComponent(slugOrId)}`;
  const encU = encodeURIComponent(url);
  const encT = encodeURIComponent(`${title} — Langkatalk`);
  $('box').innerHTML = `
    <div class="sheet-handle"></div>
    <h3 style="font-size:18px;font-weight:800;margin-bottom:6px">Bagikan Cerita</h3>
    <p class="mt" style="margin-bottom:10px">${esc(title)}</p>
    <input type="text" readonly value="${esc(url)}" onclick="this.select()">
    <div class="share-grid">
      <button type="button" class="go sm" onclick="navigator.clipboard?.writeText('${esc(url)}');toast('Link disalin')">Salin Link</button>
      <a class="gh" href="https://wa.me/?text=${encT}%20${encU}" target="_blank" rel="noopener">WhatsApp</a>
      <a class="gh" href="https://www.facebook.com/sharer/sharer.php?u=${encU}" target="_blank" rel="noopener">Facebook</a>
      <a class="gh" href="https://twitter.com/intent/tweet?text=${encT}&url=${encU}" target="_blank" rel="noopener">X / Twitter</a>
      <a class="gh" href="https://t.me/share/url?url=${encU}&text=${encT}" target="_blank" rel="noopener" style="grid-column:1/-1">Telegram</a>
    </div>
    <div class="acts"><button type="button" class="gh" style="width:100%" onclick="$('dlg').classList.remove('on')">Tutup</button></div>
  `;
  $('dlg').classList.add('on');
}

async function openCommentSheet(articleId, articleTitle, allowComment = true) {
  $('box').innerHTML = `
    <div class="sheet-handle"></div>
    <h3 style="font-size:18px;font-weight:800;margin-bottom:4px">Komentar</h3>
    <p class="mt" style="margin-bottom:12px">${esc(articleTitle)}</p>
    <div id="sheet-cmt-list" class="mt">Memuat komentar…</div>
    ${allowComment ? `
      <form id="f-sheet-cmt" style="margin-top:14px;border-top:1px solid var(--line);padding-top:12px" novalidate>
        <div class="f"><label for="sc-name">Nama *</label><input type="text" id="sc-name" placeholder="Nama kamu (min. 3 huruf)" required></div>
        <div class="f"><label for="sc-phone">No. HP * <span class="mt">(tidak tampil publik)</span></label><input type="tel" id="sc-phone" placeholder="08xxxxxxxxxx" required></div>
        <div class="f">
          <div style="display:flex;justify-content:space-between"><label for="sc-body">Komentar *</label><span class="mt" id="sc-cnt">0/500</span></div>
          <textarea id="sc-body" maxlength="500" placeholder="Tulis komentar 3–500 karakter..." oninput="$('sc-cnt').textContent=this.value.length+'/500'" required></textarea>
        </div>
        <label class="tog" style="margin-bottom:12px"><input type="checkbox" id="sc-agree" required><span>Setuju moderasi redaksi</span></label>
        <p class="err" id="sc-err"></p>
        <p class="ok-msg" id="sc-ok"></p>
        <div class="acts">
          <button type="submit" class="go sm">Kirim Komentar</button>
          <button type="button" class="gh" onclick="$('dlg').classList.remove('on')">Tutup</button>
        </div>
      </form>
    ` : `<p class="mt" style="margin-top:12px">Komentar ditutup untuk berita ini.</p><div class="acts"><button type="button" class="gh" onclick="$('dlg').classList.remove('on')">Tutup</button></div>`}
  `;
  $('dlg').classList.add('on');

  if (ltReady) {
    const { data } = await ltSb.from('public_comments').select('*').eq('article_id', articleId).order('created_at', { ascending: false });
    const listEl = $('sheet-cmt-list');
    if (listEl) {
      const items = data || [];
      listEl.innerHTML = items.length
        ? items.map((c) => `<div class="cmt-item"><span class="av">${esc((c.guest_name || 'P').charAt(0).toUpperCase())}</span><div><b>${esc(c.guest_name)}</b> <span class="mt">• ${fmtTime(c.created_at)}</span><p>${esc(c.body)}</p></div></div>`).join('')
        : '<p class="mt">Belum ada komentar tampil.</p>';
    }
  }

  const form = $('f-sheet-cmt');
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const name = $('sc-name').value.trim();
      const phone = $('sc-phone').value.replace(/[\s\-()]/g, '');
      const body = $('sc-body').value.trim();
      $('sc-err').textContent = '';
      $('sc-ok').textContent = '';

      if (name.length < 3) { $('sc-err').textContent = 'Nama minimal 3 karakter.'; return; }
      if (!/^(08|\+62)[0-9]{8,13}$/.test(phone)) { $('sc-err').textContent = 'No. HP harus 10–15 digit (08 atau +62).'; return; }
      if (body.length < 3 || body.length > 500) { $('sc-err').textContent = 'Komentar wajib 3–500 karakter.'; return; }
      if (!$('sc-agree').checked) { $('sc-err').textContent = 'Centang persetujuan dulu.'; return; }

      const rk = `lk_cmt_rate_${articleId}`;
      if (Date.now() - Number(localStorage.getItem(rk) || 0) < 30000) {
        $('sc-err').textContent = 'Tunggu 30 detik sebelum mengirim komentar lagi.';
        return;
      }

      const ins = await ltSb.from('comments').insert({
        article_id: articleId, guest_name: name, guest_phone: phone, body, device_id: ltState.deviceId, status: 'menunggu'
      });
      if (ins.error) { $('sc-err').textContent = ins.error.message; return; }
      localStorage.setItem(rk, String(Date.now()));
      form.reset();
      $('sc-cnt').textContent = '0/500';
      $('sc-ok').textContent = 'Komen terkirim, menunggu moderasi redaksi.';
      toast('Komen terkirim');
    };
  }
}

function openSearchSheet() {
  $('box').innerHTML = `
    <div class="sheet-handle"></div>
    <h3 style="font-size:18px;font-weight:800;margin-bottom:10px">Cari Berita Langkatalk</h3>
    <input type="text" id="sheet-srch" placeholder="Ketik kata kunci berita..." value="${esc(ltState.q)}" oninput="ltState.q=this.value.trim();if(typeof paintFeedList==='function')paintFeedList()">
    <div class="acts" style="margin-top:14px">
      <button type="button" class="go sm" onclick="$('dlg').classList.remove('on')">Selesai</button>
      ${ltState.q ? `<button type="button" class="gh" onclick="ltState.q='';if(typeof paintFeedList==='function')paintFeedList();$('dlg').classList.remove('on')">Reset</button>` : ''}
    </div>
  `;
  $('dlg').classList.add('on');
  setTimeout(() => $('sheet-srch')?.focus(), 80);
}

function toggleSidePanel(open) {
  $('drawer-bg')?.classList.toggle('on', open);
  $('drawer')?.classList.toggle('on', open);
}

function selectFeedCategory(slug) {
  ltState.cat = slug;
  ltState.tag = '';
  const isFeedPage = location.pathname.endsWith('index.html') || location.pathname === '/' || location.pathname === '';
  if (!isFeedPage) {
    location.href = 'index.html';
    return;
  }
  if (location.hash && !location.hash.startsWith('#/')) location.hash = '#/';
  if (typeof paintFeedList === 'function') paintFeedList();
}

function renderPublicShell(innerHtml) {
  const isSaved = ltState.cat === '__saved';
  const authLabel = ltState.me ? esc(ltState.me.n.split(' ')[0]) : 'Masuk';
  const authHref = ltState.me ? 'redaksi.html' : 'redaksi.html';

  return `
    <header class="ph">
      <div class="wrap">
        <a class="logo-link" href="index.html" onclick="ltState.cat='';ltState.tag='';ltState.q=''">
          <img src="favicon.png" alt="Langkatalk" width="28" height="28">
          <span>
            <span class="lt-wordmark">Langkatalk</span>
            <span class="lt-tagline">Menghubungkan Cerita Langkat</span>
          </span>
        </a>
        <a class="go sm" href="${authHref}">${authLabel}</a>
      </div>
    </header>

    <div class="cats-strip">
      <button type="button" class="cat-pill ${!ltState.cat && !isSaved ? 'on' : ''}" onclick="selectFeedCategory('')">Semua</button>
      ${LT_CATS.map((c) => `<button type="button" class="cat-pill ${ltState.cat === c ? 'on' : ''}" onclick="selectFeedCategory('${c}')">${c}</button>`).join('')}
      <button type="button" class="cat-pill ${isSaved ? 'on' : ''}" onclick="selectFeedCategory('__saved')">Disimpan (${ltState.savedIds.size})</button>
    </div>

    <div class="drawer-bg" id="drawer-bg" onclick="toggleSidePanel(false)"></div>
    <aside class="drawer" id="drawer">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span class="lt-wordmark">Langkatalk</span>
        <button type="button" class="gh sm" onclick="toggleSidePanel(false)">✕</button>
      </div>
      <div class="panel" style="padding:12px;margin-bottom:10px">
        <div style="font-weight:700;color:var(--ink)">${ltState.me ? esc(ltState.me.n) : 'Warga Langkat'}</div>
        <div class="mt" style="margin-bottom:8px">${ltState.me ? LT_ROLES[ltState.me.r] : 'Belum masuk'}</div>
        <a class="go sm" style="width:100%" href="redaksi.html" onclick="toggleSidePanel(false)">${ltState.me ? 'Buka Dashboard' : 'Masuk Redaksi'}</a>
      </div>
      <button type="button" class="${!ltState.cat ? 'on' : ''}" onclick="toggleSidePanel(false);selectFeedCategory('')">Semua Cerita</button>
      ${LT_CATS.map((c) => `<button type="button" class="${ltState.cat === c ? 'on' : ''}" onclick="toggleSidePanel(false);selectFeedCategory('${c}')">${c}</button>`).join('')}
      <button type="button" class="${isSaved ? 'on' : ''}" onclick="toggleSidePanel(false);selectFeedCategory('__saved')">Disimpan (${ltState.savedIds.size})</button>
      <hr style="border:0;border-top:1px solid var(--line);width:100%;margin:8px 0">
      <a href="redaksi.html#about">Tentang Kami</a>
      <a href="redaksi.html#redaksi">Susunan Redaksi</a>
      <a href="redaksi.html#pt">Info PT & Legalitas</a>
      <a href="redaksi.html#iklan">Info Iklan</a>
      <div class="mt" style="margin-top:auto;padding-top:12px;border-top:1px solid var(--line)">Dari hulu ke hilir, dari bukit ke layar.</div>
    </aside>

    <main>${innerHtml}</main>

    <nav class="lt-bottom-nav" aria-label="Navigasi bawah">
      <button type="button" class="lt-bnav-btn ${!isSaved ? 'on' : ''}" onclick="ltState.cat='';ltState.tag='';ltState.q='';location.href='index.html'">
        <span>🏠</span><span>Beranda</span>
      </button>
      <button type="button" class="lt-bnav-btn" onclick="openSearchSheet()">
        <span>🔍</span><span>Cari</span>
      </button>
      <button type="button" class="lt-bnav-btn" aria-label="Tulis Berita" onclick="location.href='tulis.html'">
        <span class="lt-fab-mid">+</span>
      </button>
      <button type="button" class="lt-bnav-btn ${isSaved ? 'on' : ''}" onclick="selectFeedCategory('__saved')">
        <span>🔖</span><span>Disimpan</span>
      </button>
      <button type="button" class="lt-bnav-btn" onclick="toggleSidePanel(true)">
        <span>☰</span><span>Menu</span>
      </button>
    </nav>

    <footer class="pf">
      <div class="wrap pf-grid">
        <div><b style="color:var(--ink)">Langkatalk</b> • Menghubungkan Cerita Langkat — <i>Bongkar Atraksi Ruang Gelap</i></div>
        <div class="pf-links">
          <a href="index.html">Beranda</a>
          <a href="tulis.html">Tulis</a>
          <a href="redaksi.html">Redaksi</a>
        </div>
      </div>
    </footer>
  `;
}

document.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'dlg') $('dlg')?.classList.remove('on');
});

(function bindEdgeSwipe() {
  let sx = 0;
  addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
  addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - sx;
    if (sx < 28 && dx > 70) toggleSidePanel(true);
    if (dx < -70) toggleSidePanel(false);
  }, { passive: true });
})();
