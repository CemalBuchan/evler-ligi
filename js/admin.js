/* Evler Ligi - admin modu.
 * Sunucu yok: maç düzenlemesi data/league.json'a GitHub API ile commit olarak yazılır.
 * Yazma izni olan GitHub token'ı, kullanıcı adı+parola ile şifrelenmiş halde data/admin.json'da durur
 * (AES-GCM, PBKDF2). Giriş = bu şifreyi çözmek. Düz metin parola/token repoda yoktur.
 * Uyarı: parola basitse şifre kırılabilir; bu, arkadaşlar arası kullanım için bilinçli bir tercihtir. */
(function (global) {
  'use strict';
  const L = global.Lig, V = global.Views;
  const esc = V.esc;
  const KEY = 'evlerligi.admin';
  const FILE = 'data/league.json';
  const STATUSES = [['bekliyor', 'Bekliyor'], ['oynandı', 'Oynandı'], ['ertelendi', 'Ertelendi'], ['hükmen', 'Hükmen']];

  let session = readSession();
  let fab, strip, layer;

  /* ---------- oturum ---------- */
  function stores() {
    const out = [];
    try { out.push(localStorage); } catch (e) { /* kapalı */ }
    try { out.push(sessionStorage); } catch (e) { /* kapalı */ }
    return out;
  }
  function readSession() {
    for (const st of stores()) {
      try {
        const v = st.getItem(KEY);
        if (v) return JSON.parse(v);
      } catch (e) { /* bozuk kayıt */ }
    }
    return null;
  }
  function clearSession() {
    stores().forEach((st) => { try { st.removeItem(KEY); } catch (e) { /* yoksay */ } });
    session = null;
  }
  function storeSession(s, remember) {
    clearSession();
    try { (remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(s)); } catch (e) { /* yoksay */ }
    session = s;
  }
  const active = () => !!session;

  /* ---------- GitHub API ---------- */
  async function api(path, opt) {
    opt = opt || {};
    const res = await fetch('https://api.github.com' + path, {
      method: opt.method || 'GET',
      headers: Object.assign({ Authorization: 'Bearer ' + opt.token, Accept: 'application/vnd.github+json' }, opt.body ? { 'Content-Type': 'application/json' } : {}),
      body: opt.body ? JSON.stringify(opt.body) : undefined,
      cache: 'no-store',
    });
    let data = null;
    try { data = await res.json(); } catch (e) { /* gövde yok */ }
    if (!res.ok) {
      const err = new Error((data && data.message) || String(res.status));
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function inferRepo() {
    const h = location.hostname;
    if (!/\.github\.io$/.test(h)) return '';
    const seg = location.pathname.split('/')[1];
    return h.replace(/\.github\.io$/, '') + '/' + (seg || h);
  }

  const ADMIN_FILE = 'data/admin.json';
  const enc = (t) => new TextEncoder().encode(t);
  const bytesToB64 = (u8) => { let bin = ''; u8.forEach((b) => { bin += String.fromCharCode(b); }); return btoa(bin); };
  const b64ToBytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

  async function deriveKey(user, pass, salt) {
    const base = await crypto.subtle.importKey('raw', enc(user.trim().toLowerCase() + ':' + pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function seal(payload, user, pass) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(user, pass, salt);
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc(JSON.stringify(payload)));
    return { v: 1, salt: bytesToB64(salt), iv: bytesToB64(iv), data: bytesToB64(new Uint8Array(ct)) };
  }
  async function unseal(blob, user, pass) {
    try {
      const key = await deriveKey(user, pass, b64ToBytes(blob.salt));
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(blob.iv) }, key, b64ToBytes(blob.data));
      return JSON.parse(new TextDecoder().decode(pt));
    } catch (e) {
      throw new Error('Kullanıcı adı ya da parola hatalı.');
    }
  }

  function normRepo(repo) {
    repo = repo.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '');
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('Repo "kullanici/repo" biçiminde olmalı.');
    return repo;
  }

  /* Giriş: data/admin.json'daki şifreli token'ı kullanıcı adı+parola ile çöz. */
  async function login(user, pass, remember) {
    if (!global.crypto || !crypto.subtle) throw new Error('Bu tarayıcı şifre çözmeyi desteklemiyor (https gerekir).');
    let blob;
    try {
      const res = await fetch(ADMIN_FILE, { cache: 'no-store' });
      if (!res.ok) throw new Error('yok');
      blob = await res.json();
    } catch (e) {
      throw new Error('Admin henüz kurulmamış. Aşağıdaki "İlk kurulum"u bir kez yap.');
    }
    const p = await unseal(blob, user, pass);
    storeSession({ user: user.trim(), token: p.token, repo: p.repo, branch: p.branch }, remember);
  }

  /* İlk kurulum: token'ı kullanıcı adı+parola ile şifreleyip data/admin.json olarak repoya yazar. */
  async function setup(token, repo, user, pass) {
    if (!global.crypto || !crypto.subtle) throw new Error('Bu tarayıcı şifrelemeyi desteklemiyor (https gerekir).');
    if (user.trim().length < 2 || pass.length < 4) throw new Error('Kullanıcı adı en az 2, parola en az 4 karakter olmalı.');
    repo = normRepo(repo);
    token = token.trim();
    let r;
    try { r = await api('/repos/' + repo, { token }); } catch (e) {
      if (e.status === 401) throw new Error('Token geçersiz ya da süresi dolmuş.');
      if (e.status === 404) throw new Error('Repo bulunamadı ya da token o repoya erişemiyor.');
      throw e;
    }
    if (!(r.permissions && r.permissions.push)) throw new Error('Bu token repoya yazamıyor (Contents: Read and write gerekli).');
    const blob = await seal({ token, repo, branch: r.default_branch }, user, pass);
    let sha;
    try {
      sha = (await api('/repos/' + repo + '/contents/' + ADMIN_FILE + '?ref=' + encodeURIComponent(r.default_branch), { token })).sha;
    } catch (e) { if (e.status !== 404) throw e; }
    await api('/repos/' + repo + '/contents/' + ADMIN_FILE, {
      method: 'PUT', token,
      body: Object.assign({ message: 'Admin erişimi kuruldu', content: utf8encode(JSON.stringify(blob, null, 2) + '\n'), branch: r.default_branch }, sha ? { sha } : {}),
    });
  }

  const utf8decode = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
  function utf8encode(text) {
    let bin = '';
    new TextEncoder().encode(text).forEach((b) => { bin += String.fromCharCode(b); });
    return btoa(bin);
  }

  async function getFile() {
    const d = await api('/repos/' + session.repo + '/contents/' + FILE + '?ref=' + encodeURIComponent(session.branch), { token: session.token });
    return { sha: d.sha, league: JSON.parse(utf8decode(d.content)) };
  }

  /* league.json'u dosyadaki düzende yazar: üst alanlar tek satır, takım/hafta/maç listeleri satır satır. */
  function inline(v) {
    if (Array.isArray(v)) return '[' + v.map(inline).join(', ') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).map((k) => JSON.stringify(k) + ': ' + inline(v[k])).join(', ') + '}';
    return JSON.stringify(v);
  }
  function serialize(d) {
    const keys = Object.keys(d);
    const lines = ['{'];
    keys.forEach((k, i) => {
      const v = d[k], comma = i < keys.length - 1 ? ',' : '';
      if (Array.isArray(v) && v.length && v[0] && typeof v[0] === 'object' && !Array.isArray(v[0])) {
        lines.push('  ' + JSON.stringify(k) + ': [');
        v.forEach((x, j) => lines.push('    ' + inline(x) + (j < v.length - 1 ? ',' : '')));
        lines.push('  ]' + comma);
      } else {
        lines.push('  ' + JSON.stringify(k) + ': ' + inline(v) + comma);
      }
    });
    lines.push('}');
    return lines.join('\n') + '\n';
  }

  /* En güncel dosyayı çek → değişikliği uygula → commit. Çakışmada bir kez yeniden dener. */
  async function commitChange(mutate, message) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const { sha, league } = await getFile();
      mutate(league);
      try {
        await api('/repos/' + session.repo + '/contents/' + FILE, {
          method: 'PUT', token: session.token,
          body: { message, content: utf8encode(serialize(league)), sha, branch: session.branch },
        });
        return league;
      } catch (e) {
        if ((e.status === 409 || e.status === 422) && attempt === 0) continue;
        throw e;
      }
    }
    return null;
  }

  function friendly(e) {
    if (e.status === 401) return 'Oturum geçersiz. Çıkış yapıp tekrar giriş yap.';
    if (e.status === 403 || e.status === 404) return 'Kaydedilemedi: parolanın bu repoda "Contents: Read and write" izni olmalı.';
    if (e.status === 409 || e.status === 422) return 'Dosya aynı anda değişmiş. Tekrar dene.';
    return 'Kaydedilemedi: ' + (e.message || 'bağlantı hatası');
  }

  /* ---------- arayüz parçaları ---------- */
  function ensureChrome() {
    if (fab) return;
    fab = document.createElement('button');
    fab.className = 'admin-fab';
    fab.setAttribute('aria-label', 'Admin modu');
    fab.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5zm-3 8V6a3 3 0 1 1 6 0v3z"/></svg>';
    fab.addEventListener('click', openLogin);
    strip = document.createElement('div');
    strip.className = 'admin-strip';
    strip.hidden = true;
    layer = document.createElement('div');
    layer.className = 'layer';
    layer.hidden = true;
    document.body.append(fab, strip, layer);
    layer.addEventListener('click', (e) => { if (e.target === layer) closeLayer(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !layer.hidden) closeLayer(); });
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-edit]');
      if (b) openEdit(b.dataset.edit);
      if (e.target.closest('[data-logout]')) logout();
    });
  }

  function paintChrome() {
    ensureChrome();
    document.body.classList.toggle('admin-on', active());
    fab.hidden = active();
    strip.hidden = !active();
    strip.innerHTML = active()
      ? '<span><b>ADMIN MODU</b> · ' + esc(session.user) + '</span><button data-logout type="button">Çıkış</button>'
      : '';
  }

  function toast(msg, bad) {
    const t = document.createElement('div');
    t.className = 'toast' + (bad ? ' bad' : '');
    t.setAttribute('role', 'status');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), bad ? 6000 : 4000);
  }

  function openLayer(html) {
    layer.innerHTML = '<div class="sheet" role="dialog" aria-modal="true">' + html + '</div>';
    layer.hidden = false;
    document.body.classList.add('noscroll');
    return layer.firstChild;
  }
  function closeLayer() {
    layer.hidden = true;
    layer.innerHTML = '';
    document.body.classList.remove('noscroll');
  }

  /* ---------- giriş ---------- */
  function openLogin() {
    const sheet = openLayer(
      '<h3>Admin girişi</h3>' +
      '<form id="loginForm" autocomplete="on">' +
      '<label>Kullanıcı adı<input name="user" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" required></label>' +
      '<label>Parola<input name="pass" type="password" autocomplete="current-password" required></label>' +
      '<label class="check"><input name="remember" type="checkbox" checked> Bu cihazda hatırla</label>' +
      '<p class="err" id="loginErr" hidden></p>' +
      '<div class="actions"><button type="button" class="ghost" data-close>Vazgeç</button><button type="submit" class="primary">Giriş yap</button></div>' +
      '</form>' +
      '<details class="setup"><summary>İlk kurulum (sadece bir kez)</summary>' +
      '<form id="setupForm" autocomplete="off">' +
      '<p class="hint">GitHub token\'ını (Contents: Read and write) seçeceğin kullanıcı adı + parola ile şifreler ve repoya kaydeder. README\'de adımlar var.</p>' +
      '<label>GitHub token<input name="token" type="password" autocomplete="off" required></label>' +
      '<label>Repo<input name="repo" type="text" autocapitalize="none" spellcheck="false" value="' + esc(inferRepo()) + '" placeholder="kullanici/evler-ligi" required></label>' +
      '<label>Admin kullanıcı adı<input name="user" type="text" autocomplete="off" autocapitalize="none" required></label>' +
      '<label>Admin parolası<input name="pass" type="text" autocomplete="off" autocapitalize="none" required></label>' +
      '<p class="err" id="setupErr" hidden></p>' +
      '<div class="actions one"><button type="submit" class="primary">Kurulumu yap</button></div>' +
      '</form></details>');
    sheet.querySelector('[data-close]').addEventListener('click', closeLayer);

    const form = sheet.querySelector('#loginForm');
    const err = sheet.querySelector('#loginErr');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = form.elements, btn = form.querySelector('.primary');
      btn.disabled = true; btn.textContent = 'Kontrol ediliyor…'; err.hidden = true;
      try {
        await login(f.user.value, f.pass.value, f.remember.checked);
        const { league } = await getFile();
        closeLayer();
        paintChrome();
        global.EvlerApp.load(league);
        toast('Admin modu açık. Maçlarda "Maçı düzenle" düğmesi çıktı.');
      } catch (ex) {
        let msg = ex.message || 'Giriş yapılamadı.';
        if (ex.status === 401) { clearSession(); msg = 'Kayıtlı token artık geçersiz. İlk kurulumu yeni token ile yenile.'; }
        err.textContent = msg;
        err.hidden = false;
        btn.disabled = false; btn.textContent = 'Giriş yap';
      }
    });

    const sform = sheet.querySelector('#setupForm');
    const serr = sheet.querySelector('#setupErr');
    sform.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = sform.elements, btn = sform.querySelector('.primary');
      btn.disabled = true; btn.textContent = 'Kuruluyor…'; serr.hidden = true;
      try {
        await setup(f.token.value, f.repo.value, f.user.value, f.pass.value);
        sform.reset();
        serr.className = 'hint';
        serr.textContent = 'Kurulum tamam ✓ Site yayınlanınca (~1 dk) yukarıdan giriş yapabilirsin.';
      } catch (ex) {
        serr.className = 'err';
        serr.textContent = ex.message || 'Kurulum yapılamadı.';
      }
      serr.hidden = false;
      btn.disabled = false; btn.textContent = 'Kurulumu yap';
    });
    form.elements.user.focus();
  }

  function logout() {
    clearSession();
    paintChrome();
    // herkesin gördüğü yayındaki veriyle yeniden çiz
    fetch('data/league.json', { cache: 'no-cache' }).then((r) => r.json()).then((d) => global.EvlerApp.load(d)).catch(() => {});
  }

  /* Sayfa açılınca oturum varsa: en güncel veriyi GitHub'dan al (yayın gecikmesine takılma). */
  async function restore() {
    paintChrome();
    if (!session) return;
    try {
      const { league } = await getFile();
      global.EvlerApp.load(league);
    } catch (e) {
      if (e.status === 401) { clearSession(); paintChrome(); global.EvlerApp.load(global.EvlerApp.state().I.league); toast('Admin oturumu sona erdi, tekrar giriş yap.', true); }
    }
  }

  /* ---------- maç düzenleme ---------- */
  function openEdit(id) {
    const S = global.EvlerApp.state();
    const m = S.I.matches.find((x) => x.id === id);
    if (!m) return;
    const f = {
      status: m.status,
      hg: m.homeGoals == null ? 0 : m.homeGoals,
      ag: m.awayGoals == null ? 0 : m.awayGoals,
      sc: {},
      postponedBy: m.postponedBy || '',
      forfeit: m.status === 'hükmen' ? (m.forfeitWinner || 'none') : '',
      playedOn: m.playedOn || '',
      venue: m.venue,
      busy: false,
      err: '',
    };
    (m.scorers || []).forEach((s) => { f.sc[s.team + '|' + s.player] = (f.sc[s.team + '|' + s.player] || 0) + s.goals; });

    const sheet = openLayer('');
    const draw = () => {
      const top = sheet.scrollTop;
      sheet.innerHTML = editHTML(S, m, f);
      sheet.scrollTop = top;
    };
    draw();

    sheet.onclick = (e) => {
      if (f.busy) return;
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.close != null) return closeLayer();
      if (b.dataset.save != null) return save(S, m, f, draw);
      f.err = '';
      if (b.dataset.st) {
        f.status = b.dataset.st;
        if ((f.status === 'oynandı' || f.status === 'hükmen') && !f.playedOn) f.playedOn = S.today;
      } else if (b.dataset.fw) {
        f.forfeit = b.dataset.fw;
      } else if (b.dataset.score) {
        const side = b.dataset.score, d = Number(b.dataset.d);
        const key = side === 'h' ? 'hg' : 'ag';
        if (d < 0 && f[key] <= scorerSum(S, m, f, side)) return;
        f[key] = Math.min(30, f[key] + d);
      } else if (b.dataset.goal) {
        const side = b.dataset.side, d = Number(b.dataset.d), k = b.dataset.goal;
        const cur = f.sc[k] || 0;
        if (d < 0 && cur <= 0) return;
        f.sc[k] = cur + d;
        f[side === 'h' ? 'hg' : 'ag'] = Math.min(30, f[side === 'h' ? 'hg' : 'ag'] + d);
      } else return;
      draw();
    };
    sheet.onchange = (e) => {
      const t = e.target;
      if (t.dataset.f) { f[t.dataset.f] = t.value; f.err = ''; if (t.dataset.f === 'postponedBy') draw(); }
    };
  }

  const teamKey = (team, player) => team + '|' + player;
  function sidePlayers(S, m, f, side) {
    const team = side === 'h' ? m.home : m.away;
    const names = (S.I.teams[team].players || []).slice();
    Object.keys(f.sc).forEach((k) => {
      const [t, p] = k.split('|');
      if (t === team && names.indexOf(p) === -1 && f.sc[k] > 0) names.push(p);
    });
    return names.map((n) => ({ key: teamKey(team, n), name: n }));
  }
  function scorerSum(S, m, f, side) {
    return sidePlayers(S, m, f, side).reduce((a, p) => a + (f.sc[p.key] || 0), 0);
  }

  function stepper(attrs, val) {
    return '<span class="step"><button type="button" ' + attrs + ' data-d="-1" aria-label="Azalt">−</button><output>' + val + '</output><button type="button" ' + attrs + ' data-d="1" aria-label="Arttır">+</button></span>';
  }

  function teamBlock(S, m, f, side) {
    const id = side === 'h' ? m.home : m.away;
    const goals = side === 'h' ? f.hg : f.ag;
    const players = sidePlayers(S, m, f, side);
    const unat = goals - scorerSum(S, m, f, side);
    return '<div class="tblock"><div class="tb-h">' + V.badge(S, id, 'sm') + '<strong>' + esc(S.I.teams[id].name) + '</strong>' +
      '<span class="tb-score">' + stepper('data-score="' + side + '"', goals) + '</span></div>' +
      (players.length
        ? players.map((p) => '<div class="pl"><span>⚽ ' + esc(p.name) + '</span>' + stepper('data-goal="' + esc(p.key) + '" data-side="' + side + '"', f.sc[p.key] || 0) + '</div>').join('')
        : '<p class="hint">Bu takımda oyuncu tanımlı değil.</p>') +
      (unat > 0 ? '<p class="hint">Kimin attığı belli değil: ' + unat + ' (kendi kalesine vb.)</p>' : '') +
      '</div>';
  }

  function editHTML(S, m, f) {
    const home = S.I.teams[m.home], away = S.I.teams[m.away];
    const rd = S.I.rounds[m.round];
    let body = '';
    if (f.status === 'oynandı') {
      body += teamBlock(S, m, f, 'h') + teamBlock(S, m, f, 'a') +
        '<label>Oynandığı tarih<input type="date" data-f="playedOn" value="' + esc(f.playedOn) + '"></label>';
    } else if (f.status === 'ertelendi') {
      const opts = [['', 'Seç…'], [m.home, home.name], [m.away, away.name]].map(([v, t]) =>
        '<option value="' + esc(v) + '"' + (f.postponedBy === v ? ' selected' : '') + '>' + esc(t) + '</option>').join('');
      const p = f.postponedBy && S.post[f.postponedBy];
      body += '<label>Kim erteledi?<select data-f="postponedBy">' + opts + '</select></label>' +
        '<p class="hint">' + (p ? esc(S.I.teams[f.postponedBy].name) + ' için kalan erteleme hakkı: ' + p.remaining + ' / ' + p.limit + '. Kaydedince 1 düşer.' : 'Erteleyen takımın hakkından 1 düşer ve geri gelmez.') + '</p>';
    } else if (f.status === 'hükmen') {
      body += '<div class="seggrp">' + [[m.home, home.name + ' kazandı'], [m.away, away.name + ' kazandı'], ['none', 'İkisi de gelmedi']]
        .map(([v, t]) => '<button type="button" class="seg' + (f.forfeit === v ? ' on' : '') + '" data-fw="' + esc(v) + '">' + esc(t) + '</button>').join('') + '</div>' +
        '<p class="hint">Hükmen: 3-0. İkisi de gelmediyse iki takıma 0 puan.</p>' +
        '<label>Tarih<input type="date" data-f="playedOn" value="' + esc(f.playedOn) + '"></label>';
    } else if (m.status === 'ertelendi') {
      body += '<p class="hint">Maç tekrar "Bekliyor" yapılırsa erteleme kaydı da silinir (yanlış girişi düzeltmek için).</p>';
    }
    const venues = S.I.league.venues.map((v) => '<option' + (f.venue === v ? ' selected' : '') + '>' + esc(v) + '</option>').join('');
    return '<h3>' + esc(home.name) + ' – ' + esc(away.name) + '<small>' + m.round + '. hafta · ' + L.fmtRange(rd.start, rd.end) + ' · ' + esc(m.id) + '</small></h3>' +
      '<div class="seggrp">' + STATUSES.map(([v, t]) => '<button type="button" class="seg' + (f.status === v ? ' on' : '') + '" data-st="' + v + '">' + t + '</button>').join('') + '</div>' +
      body +
      '<label>Maçın evi<select data-f="venue">' + venues + '</select></label>' +
      (f.err ? '<p class="err">' + esc(f.err) + '</p>' : '') +
      '<div class="actions"><button type="button" class="ghost" data-close>Vazgeç</button><button type="button" class="primary" data-save' + (f.busy ? ' disabled' : '') + '>' + (f.busy ? 'Kaydediliyor…' : 'Kaydet') + '</button></div>';
  }

  function buildPatch(S, m, f) {
    const base = { homeGoals: null, awayGoals: null, status: f.status, playedOn: null, forfeitWinner: null, scorers: [], venue: f.venue };
    if (f.status === 'oynandı') {
      base.homeGoals = f.hg; base.awayGoals = f.ag;
      base.playedOn = f.playedOn || null;
      ['h', 'a'].forEach((side) => sidePlayers(S, m, f, side).forEach((p) => {
        if (f.sc[p.key] > 0) base.scorers.push({ team: p.key.split('|')[0], player: p.name, goals: f.sc[p.key] });
      }));
    } else if (f.status === 'hükmen') {
      base.forfeitWinner = f.forfeit === 'none' ? null : f.forfeit;
      base.playedOn = f.playedOn || null;
    }
    if (f.status === 'ertelendi') base.postponedBy = f.postponedBy;
    else if (f.status === 'bekliyor' && m.status === 'ertelendi') base.postponedBy = null;
    return base;
  }

  function summary(S, m, f) {
    const h = S.I.teams[m.home].name, a = S.I.teams[m.away].name;
    if (f.status === 'oynandı') return h + ' ' + f.hg + '-' + f.ag + ' ' + a;
    if (f.status === 'ertelendi') return h + ' - ' + a + ' ertelendi (' + S.I.teams[f.postponedBy].name + ')';
    if (f.status === 'hükmen') return h + ' - ' + a + ' hükmen' + (f.forfeit === 'none' ? ' (iki taraf gelmedi)' : ' (' + S.I.teams[f.forfeit].name + ' kazandı)');
    return h + ' - ' + a + ' sıfırlandı';
  }

  async function save(S, m, f, draw) {
    if (f.status === 'ertelendi' && !f.postponedBy) { f.err = 'Erteleyen takımı seç.'; return draw(); }
    if (f.status === 'hükmen' && !f.forfeit) { f.err = 'Hükmen sonucunu seç.'; return draw(); }
    const patch = buildPatch(S, m, f);
    const msg = 'Maç ' + m.id + ': ' + summary(S, m, f);
    f.busy = true; f.err = ''; draw();
    try {
      const league = await commitChange((l) => {
        const mm = l.matches.find((x) => x.id === m.id);
        if (!mm) throw new Error('Maç dosyada bulunamadı.');
        Object.assign(mm, patch);
      }, msg);
      closeLayer();
      global.EvlerApp.load(league);
      toast('Kaydedildi ✓ Herkese yaklaşık 1 dakika içinde yansır.');
    } catch (e) {
      f.busy = false; f.err = friendly(e); draw();
    }
  }

  global.Admin = { active, restore, serialize, _api: { commitChange } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paintChrome);
  else paintChrome();
})(window);
