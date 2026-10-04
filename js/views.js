/* Evler Ligi - sayfa çizimleri. Her fonksiyon HTML metni döndürür. */
(function (global) {
  'use strict';
  const L = global.Lig;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const PIN = '<svg class="pin" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"/></svg>';

  function textOn(hex) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
    const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    return lum > 0.62 ? '#0a1a10' : '#ffffff';
  }

  function badge(S, id, size) {
    const t = S.I.teams[id];
    if (!t) return '';
    const [c1, c2] = t.colors;
    return '<span class="badge ' + (size || 'md') + '" style="--c1:' + c1 + ';--c2:' + c2 + ';--tx:' + textOn(c1) + '" aria-hidden="true"><span>' + esc(t.short) + '</span></span>';
  }
  const teamName = (S, id) => (S.I.teams[id] ? S.I.teams[id].name : id);
  const teamLink = (S, id, cls) => '<a class="tn ' + (cls || '') + '" href="#/takim/' + esc(id) + '">' + esc(teamName(S, id)) + '</a>';

  function formDots(form) {
    const last = form.slice(-5);
    if (!last.length) return '<span class="form none">—</span>';
    return '<span class="form">' + last.map((f) => '<i class="f-' + f + '">' + f + '</i>').join('') + '</span>';
  }

  /* ---------- maç satırı ---------- */
  function matchRow(S, m, opt) {
    opt = opt || {};
    const r = L.result(m);
    const rd = S.I.rounds[m.round];
    const mine = S.my && (m.home === S.my || m.away === S.my);
    let mid;
    if (r) mid = '<span class="sc">' + r.hg + '<i>–</i>' + r.ag + '</span>';
    else if (m.status === 'ertelendi') mid = '<span class="sc pp">ERT</span>';
    else mid = '<span class="sc vs">VS</span>';

    const tags = [];
    if (m.status === 'hükmen') tags.push('<span class="tag t-hukmen">' + (r && r.double ? 'Hükmen · iki taraf da gelmedi' : 'Hükmen ' + esc(teamName(S, m.forfeitWinner)) + ' kazandı') + '</span>');
    if (m.status === 'ertelendi') {
      const who = m.postponedBy ? ' · ' + esc(teamName(S, m.postponedBy)) : '';
      const over = m.postponedBy && S.post[m.postponedBy] && S.post[m.postponedBy].over;
      tags.push('<span class="tag t-ert">' + (over ? '⚠ ' : '') + 'Ertelendi' + who + '</span>');
    } else if (m.postponedBy && m.status === 'oynandı') {
      tags.push('<span class="tag t-ert soft">Ertelenmişti</span>');
    }
    const when = m.playedOn ? 'Oynandı ' + L.fmtDate(m.playedOn) : L.fmtRange(rd.start, rd.end);
    const cls = ['match', 'st-' + (m.status === 'oynandı' ? 'oynandi' : m.status === 'hükmen' ? 'hukmen' : m.status === 'ertelendi' ? 'ertelendi' : 'bekliyor')];
    if (mine) cls.push('is-mine');
    const hw = r && r.hg > r.ag, aw = r && r.ag > r.hg;
    const edit = S.admin ? '<button class="edit" data-edit="' + esc(m.id) + '">✎ Maçı düzenle</button>' : '';
    return '<div class="' + cls.join(' ') + '">' +
      '<div class="side home' + (hw ? ' win' : '') + '">' + badge(S, m.home, 'sm') + teamLink(S, m.home) + '</div>' +
      mid +
      '<div class="side away' + (aw ? ' win' : '') + '">' + teamLink(S, m.away) + badge(S, m.away, 'sm') + '</div>' +
      scorersRow(m) +
      '<div class="meta">' + PIN + '<b>' + esc(m.venue) + '</b>' +
      (rd.devre === 3 ? '<em>tarafsız</em>' : '') +
      '<span class="dot">·</span><span>' + (opt.showRound ? m.round + '. hafta · ' : '') + when + '</span>' + tags.join('') + '</div>' + edit +
      '</div>';
  }

  /* Maç satırının altındaki golcüler: ev sahibi solda, deplasman sağda. */
  function scorersRow(m) {
    if (m.status !== 'oynandı' || !m.scorers || !m.scorers.length) return '';
    const fmt = (team) => m.scorers.filter((x) => x.team === team && x.goals > 0)
      .map((x) => esc(x.player) + (x.goals > 1 ? ' ×' + x.goals : '')).join(', ');
    const h = fmt(m.home), a = fmt(m.away);
    if (!h && !a) return '';
    return '<div class="gs home">' + (h ? '⚽ ' + h : '') + '</div><span></span><div class="gs away">' + (a ? a + ' ⚽' : '') + '</div>';
  }

  /* Gol krallığı listesi. */
  function scorerList(S, rows) {
    return '<div class="sclist">' + rows.map((r) =>
      '<a class="scr' + (r.goals ? '' : ' zero') + '" href="#/takim/' + esc(r.team) + '"><span class="c-rk">' + r.rank + '</span>' +
      badge(S, r.team, 'sm') + '<span class="scn"><b>' + esc(r.player) + '</b><small>' + esc(teamName(S, r.team)) + '</small></span>' +
      '<span class="scg">' + r.goals + '<small>gol</small></span></a>').join('') + '</div>';
  }

  /* ---------- puan tablosu ---------- */
  function tableHTML(S, rows, opt) {
    opt = opt || {};
    const full = !opt.mini;
    const head = full
      ? '<tr><th class="c-rk">#</th><th class="c-tm">Takım</th><th>O</th><th>G</th><th>B</th><th>M</th><th>AG</th><th>YG</th><th>AV</th><th class="c-p">P</th></tr>'
      : '<tr><th class="c-rk">#</th><th class="c-tm">Takım</th><th>O</th><th>AV</th><th class="c-p">P</th></tr>';
    const body = rows.map((r) => {
      const t = S.I.teams[r.id];
      const av = r.av > 0 ? '+' + r.av : String(r.av);
      const cls = (S.my === r.id ? 'mine ' : '') + (r.rank === 1 ? 'lead' : '');
      const team = '<a href="#/takim/' + esc(r.id) + '" class="tcell">' + badge(S, r.id, 'sm') +
        '<span class="tcol"><span class="tname">' + esc(t.name) + (r.tied ? ' <sup title="Eşitlik elle belirlenecek">=</sup>' : '') + '</span>' +
        (full ? formDots(r.form) : '') + '</span></a>';
      return '<tr class="' + cls + '"><td class="c-rk">' + r.rank + '</td><td class="c-tm">' + team + '</td>' +
        (full
          ? '<td>' + r.o + '</td><td>' + r.g + '</td><td>' + r.b + '</td><td>' + r.m + '</td><td>' + r.ag + '</td><td>' + r.yg + '</td><td>' + av + '</td><td class="c-p">' + r.p + '</td>'
          : '<td>' + r.o + '</td><td>' + av + '</td><td class="c-p">' + r.p + '</td>') + '</tr>';
    }).join('');
    return '<div class="tablewrap"><table class="std ' + (full ? '' : 'mini') + '"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>';
  }

  function section(title, inner, extra) {
    return '<section class="sec"><div class="sec-h"><h2>' + title + '</h2>' + (extra || '') + '</div>' + inner + '</section>';
  }

  function pips(info) {
    let s = '';
    const total = Math.max(info.limit, info.used);
    for (let i = 0; i < total; i++) s += '<i class="' + (i < info.used ? 'on' : '') + (i >= info.limit ? ' extra' : '') + '"></i>';
    return '<span class="pips" aria-hidden="true">' + s + '</span>';
  }
  function postponeNote(S, id) {
    const p = S.post[id];
    return p.over
      ? '<p class="warn">⚠ Erteleme hakkı aşıldı: ' + p.used + ' erteleme yapıldı, sezon limiti ' + p.limit + '.</p>'
      : '';
  }

  /* ---------- Ana sayfa ---------- */
  function home(S) {
    let out = '';
    if (S.my) out += myCard(S);

    const c = S.cur;
    const rd = S.I.rounds[c.round];
    let title, sub, list;
    if (c.phase === 'during') { title = 'Şu anki hafta'; }
    else if (c.phase === 'before') { title = 'Sezon yakında başlıyor'; }
    else if (c.phase === 'makeup') { title = 'Telafi dönemi'; }
    else { title = 'Sezon sona erdi'; }

    if (c.phase === 'during' || c.phase === 'before') {
      sub = '<p class="sub"><b>' + c.round + '. hafta</b> · ' + L.fmtRange(rd.start, rd.end, true) + (c.phase === 'before' ? ' · ilk hafta' : '') + '</p>';
      list = '<div class="matches">' + S.I.matches.filter((m) => m.round === c.round).map((m) => matchRow(S, m)).join('') + '</div>';
    } else {
      const mk = S.I.league.makeupPeriod;
      const pend = S.I.matches.filter((m) => m.status === 'ertelendi' || m.status === 'bekliyor');
      sub = '<p class="sub">Telafi dönemi: <b>' + L.fmtRange(mk.start, mk.end, true) + '</b></p>';
      list = pend.length
        ? '<div class="matches">' + pend.map((m) => matchRow(S, m, { showRound: true })).join('') + '</div>'
        : '<p class="empty">Bekleyen maç yok.</p>';
    }
    out += section(title, sub + list);

    out += section('Puan durumu · ilk 3', tableHTML(S, S.table.slice(0, 3), { mini: true }) +
      '<a class="more" href="#/tablo">Tüm tablo →</a>');

    const top = S.scorers.filter((r) => r.goals > 0).slice(0, 3);
    if (top.length) out += section('Gol krallığı · ilk 3', scorerList(S, top) + '<a class="more" href="#/tablo">Tüm liste →</a>');

    const rec = L.recentPlayed(S.I, 5);
    out += section('Son oynanan maçlar', rec.length
      ? '<div class="matches">' + rec.map((m) => matchRow(S, m, { showRound: true })).join('') + '</div>'
      : '<p class="empty">Henüz oynanan maç yok.</p>');

    const pp = L.postponedMatches(S.I);
    if (pp.length && (c.phase === 'during' || c.phase === 'before')) {
      out += section('Ertelenen maçlar', '<p class="sub">Telafi dönemi sonuna kadar oynanmalı: <b>' + L.fmtDate(S.I.league.makeupPeriod.end) + ' ' + S.I.league.makeupPeriod.end.slice(0, 4) + '</b></p><div class="matches">' + pp.map((m) => matchRow(S, m, { showRound: true })).join('') + '</div>');
    }
    return out;
  }

  function myCard(S) {
    const t = S.I.teams[S.my];
    const row = S.table.find((r) => r.id === S.my);
    const nm = L.nextMatch(S.I, S.my);
    const p = S.post[S.my];
    return '<section class="mycard"><a class="mc-head" href="#/takim/' + esc(S.my) + '">' + badge(S, S.my, 'lg') +
      '<span class="mc-t"><small>Takımım</small><strong>' + esc(t.name) + '</strong></span>' +
      '<span class="mc-r"><b>' + row.rank + '.</b><small>' + row.p + ' puan</small></span></a>' +
      (nm ? '<div class="mc-next"><small>Sıradaki maç</small>' + matchRow(S, nm, { showRound: true }) + '</div>' : '') +
      '<div class="mc-foot">Kalan erteleme hakkı <b>' + p.remaining + '</b> / ' + p.limit + ' ' + pips(p) + '</div>' +
      postponeNote(S, S.my) + '</section>';
  }

  /* ---------- Fikstür ---------- */
  function fixture(S, filter) {
    const chips = '<div class="chips" role="group" aria-label="Takım filtresi"><button class="chip' + (filter === 'all' ? ' on' : '') + '" data-filter="all">Tümü</button>' +
      S.I.league.teams.map((t) => '<button class="chip' + (filter === t.id ? ' on' : '') + '" data-filter="' + esc(t.id) + '">' + badge(S, t.id, 'xs') + esc(t.name) + '</button>').join('') + '</div>';
    const over = S.I.league.teams.filter((t) => S.post[t.id].over);
    let out = '<h1 class="ph">Fikstür</h1>' + chips;
    if (over.length) {
      out += '<p class="warn">⚠ Erteleme hakkını aşan takım: ' + over.map((t) => esc(t.name) + ' (' + S.post[t.id].used + '/' + S.post[t.id].limit + ')').join(', ') + '</p>';
    }
    const devreName = { 1: '1. Devre', 2: '2. Devre', 3: '3. Devre · tarafsız evler' };
    let lastDevre = 0;
    S.I.league.rounds.forEach((r) => {
      const ms = S.I.matches.filter((m) => m.round === r.round && (filter === 'all' || m.home === filter || m.away === filter));
      if (!ms.length) return;
      if (r.devre !== lastDevre) {
        out += '<h2 class="devre">' + devreName[r.devre] + '</h2>';
        lastDevre = r.devre;
      }
      const isCur = r.round === S.cur.round && (S.cur.phase === 'during' || S.cur.phase === 'before');
      const tag = isCur ? '<span class="now">' + (S.cur.phase === 'before' ? 'Sıradaki hafta' : 'Şu anki hafta') + '</span>' : '';
      out += '<section class="round' + (isCur ? ' current' : '') + '" id="hafta-' + r.round + '"><div class="round-h"><span class="rn">' + r.round + '. Hafta</span><span class="rd">' + L.fmtRange(r.start, r.end, true) + '</span>' + tag + '</div>' +
        '<div class="matches">' + ms.map((m) => matchRow(S, m)).join('') + '</div></section>';
    });
    const mk = S.I.league.makeupPeriod;
    out += '<p class="note">Telafi dönemi: ' + L.fmtRange(mk.start, mk.end, true) + '</p>';
    return out;
  }

  /* ---------- Puan tablosu sayfası ---------- */
  function tablePage(S) {
    return '<h1 class="ph">Puan tablosu</h1>' + tableHTML(S, S.table) +
      '<p class="legend">O oynanan · G galibiyet · B beraberlik · M mağlubiyet · AG atılan · YG yenilen · AV averaj · P puan</p>' +
      '<p class="legend">Eşitlikte sıra: puan → averaj → atılan gol → ikili maçlar → penaltı sonucu.' +
      (S.table.some((r) => r.tied) ? ' <b>=</b> işaretli takımlar arasındaki eşitlik elle (penaltı) belirlenecek.' : '') + '</p>' +
      section('Gol krallığı', S.scorers.some((r) => r.goals > 0) ? scorerList(S, S.scorers) : '<p class="empty">Henüz gol atan yok.</p>');
  }

  /* ---------- Takım ---------- */
  function teamPicker(S) {
    return '<h1 class="ph">Takımını seç</h1><p class="sub">Seçtiğin takım bu telefonda hatırlanır.</p><div class="pickgrid">' +
      S.I.league.teams.map((t) => '<button class="pickcard" data-pick="' + esc(t.id) + '">' + badge(S, t.id, 'lg') + '<strong>' + esc(t.name) + '</strong><small>Ev: ' + esc(t.home) + '</small></button>').join('') + '</div>';
  }

  function chip(S, m, id) {
    const r = L.result(m);
    if (!r) return m.status === 'ertelendi' ? '<span class="res r-pp">ERT</span>' : '<span class="res r-wait">–</span>';
    const home = m.home === id;
    const gf = home ? r.hg : r.ag, ga = home ? r.ag : r.hg;
    const o = r.double ? 'M' : gf > ga ? 'G' : gf === ga ? 'B' : 'M';
    return '<span class="res f-' + o + '">' + gf + '–' + ga + '</span>';
  }

  function team(S, id) {
    const t = S.I.teams[id];
    if (!t) return '<p class="empty">Takım bulunamadı.</p>';
    const row = S.table.find((r) => r.id === id);
    const p = S.post[id];
    const nm = L.nextMatch(S.I, id);
    const pend = L.postponedMatches(S.I, id);
    const o = row.o || 0;
    const avg = (v) => (o ? (v / o).toFixed(2).replace('.', ',') : '–');
    const av = row.av > 0 ? '+' + row.av : String(row.av);
    const players = t.players && t.players.length
      ? '<ul class="players">' + t.players.map((n) => {
        const g = S.scorers.find((r) => r.team === id && r.player === n);
        return '<li><span>' + esc(n) + '</span><b>' + (g ? g.goals : 0) + ' gol</b></li>';
      }).join('') + '</ul>'
      : '<p class="empty">Oyuncular henüz eklenmedi.</p>';
    const mk = S.my === id;

    let out = '<div class="thead" style="--c1:' + t.colors[0] + ';--c2:' + t.colors[1] + '">' + badge(S, id, 'xl') +
      '<div class="th-t"><h1>' + esc(t.name) + '</h1><p>' + PIN + ' Ev: <b>' + esc(t.home) + '</b></p></div>' +
      '<div class="th-r"><b>' + row.rank + '.</b><small>' + row.p + ' puan</small></div></div>';
    out += mk ? '<p class="mine-note">✓ Bu senin takımın</p>' : '<button class="btn" data-pick="' + esc(id) + '">Bunu takımım yap</button>';

    out += section('Sıradaki maç', nm ? '<div class="matches">' + matchRow(S, nm, { showRound: true }) + '</div>' : '<p class="empty">Bekleyen maç kalmadı.</p>');

    out += section('Erteleme hakkı', '<div class="pp-box"><div class="pp-n"><b>' + p.remaining + '</b><small>/ ' + p.limit + ' kaldı</small></div>' + pips(p) + '</div>' +
      postponeNote(S, id) +
      (pend.length ? '<p class="sub">Telafi bekleyen maç: ' + pend.length + '</p>' : ''));

    out += section('İstatistikler',
      '<div class="stats">' +
      [['O', row.o], ['G', row.g], ['B', row.b], ['M', row.m], ['AG', row.ag], ['YG', row.yg], ['AV', av], ['P', row.p]]
        .map(([k, v]) => '<div><b>' + v + '</b><small>' + k + '</small></div>').join('') + '</div>' +
      '<div class="stats s3"><div><b>' + avg(row.ag) + '</b><small>Maç başı atılan</small></div><div><b>' + avg(row.yg) + '</b><small>Maç başı yenilen</small></div><div><b>' + row.cs + '</b><small>Gol yemeden</small></div></div>' +
      '<div class="formrow"><small>Form</small>' + formDots(row.form) + '</div>');

    out += section('Oyuncular', players);

    const all = L.teamMatches(S.I, id);
    out += section('Tüm maçlar', '<div class="tm-list">' + all.map((m) => {
      const home = m.home === id;
      const opp = home ? m.away : m.home;
      const rd = S.I.rounds[m.round];
      const st = m.status === 'hükmen' ? ' · hükmen' : m.status === 'ertelendi' ? ' · ertelendi' + (m.postponedBy ? ' (' + esc(teamName(S, m.postponedBy)) + ')' : '') : m.postponedBy ? ' · ertelenmişti' : '';
      return '<div class="tm"><span class="tm-r">H' + m.round + '</span>' + badge(S, opp, 'xs') +
        '<span class="tm-o"><a href="#/takim/' + esc(opp) + '">' + (home ? '' : '@ ') + esc(teamName(S, opp)) + '</a>' +
        '<small>' + esc(m.venue) + ' · ' + L.fmtRange(rd.start, rd.end) + st + '</small></span>' + chip(S, m, id) + '</div>';
    }).join('') + '</div>');
    return out;
  }

  /* ---------- Kurallar ---------- */
  function rules(S) {
    const mk = S.I.league.makeupPeriod;
    const lim = S.I.league.postponeLimit;
    return '<h1 class="ph">Kurallar</h1>' +
      section('Format', '<ul class="rules"><li>6 takım, <b>3 devre</b>: herkes herkesle 3 kez oynar. Toplam 15 hafta, 45 maç.</li>' +
        '<li>Her hafta 12 gün sürer. İlk yazılan takım ev sahibidir.</li>' +
        '<li>1. ve 2. devrede maç ev sahibinin evinde, 3. devrede fikstürde yazan tarafsız evde oynanır.</li>' +
        '<li>Galibiyet 3, beraberlik 1, mağlubiyet 0 puan. Şimdilik sadece lig şampiyonu belirlenir, play-off kararı lig ortasında verilecek.</li></ul>') +
      section('Maç ayarları', '<ul class="rules"><li>Devre süresi <b>10 dk</b>, kamera <b>Tele Broadcast</b>, zorluk <b>Efsanevi</b>.</li>' +
        '<li>Sakatlık, kart ve ofsayt <b>açık</b>.</li><li>Güncel kadrolar; taktik ve kadro değişikliği serbest.</li></ul>') +
      section('Gün ve saat', '<ul class="rules"><li>Gün ve saati iki takım kendi arasında ayarlar.</li><li>Maç, o haftanın tarih aralığında oynanmalıdır.</li></ul>') +
      section('Erteleme ve hükmen', '<ul class="rules"><li>Her takımın sezon boyunca toplam <b>' + lim + ' erteleme hakkı</b> vardır.</li>' +
        '<li>Takımdan bir oyuncu bile gelemiyorsa maç ertelenir ve hak düşer. Sonradan oynansa da hak geri gelmez.</li>' +
        '<li>Ertelenen maç en geç telafi döneminde oynanır: <b>' + L.fmtRange(mk.start, mk.end, true) + '</b>.</li>' +
        '<li>Oynanmazsa engelleyen taraf <b>3-0 hükmen mağlup</b> sayılır. İki taraf da gelmezse ikisine de <b>0 puan</b>.</li>' +
        '<li>Erteleme hakkı ' + lim + '\'yı geçen takım fikstürde ve takım sayfasında uyarıyla gösterilir.</li></ul>') +
      section('Maç sırasında', '<ul class="rules"><li>Oyun sadece top oyun dışındayken durdurulur. Takım başına maç başı <b>3 durdurma</b> hakkı vardır.</li>' +
        '<li>Oyun çökerse maç kalan süre ve aynı skorla yeniden başlar.</li>' +
        '<li>Skor ekranının fotoğrafı gruba atılmazsa maç <b>kayda geçmez</b>.</li></ul>') +
      section('Sıralama', '<ul class="rules"><li>Puan → averaj → atılan gol → eşit takımlar arası ikili maçlar (puan, sonra averaj) → penaltı sonucu.</li></ul>');
  }

  global.Views = { esc, home, fixture, tablePage, team, teamPicker, rules, badge };
})(window);
