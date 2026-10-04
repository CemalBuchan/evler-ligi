/* Evler Ligi - hesaplama katmanı. Tüm değerler data/league.json'dan türetilir. */
(function (global) {
  'use strict';

  const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

  function parts(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return { y, m, d };
  }
  function fmtDate(iso) {
    const p = parts(iso);
    return p.d + ' ' + MONTHS[p.m - 1];
  }
  function fmtRange(a, b, withYear) {
    const x = parts(a), y = parts(b);
    const yr = withYear ? ' ' + y.y : '';
    if (x.m === y.m) return x.d + '–' + y.d + ' ' + MONTHS[x.m - 1] + yr;
    return x.d + ' ' + MONTHS[x.m - 1] + ' – ' + y.d + ' ' + MONTHS[y.m - 1] + yr;
  }
  function todayISO() {
    const q = new URLSearchParams(location.search).get('bugun'); // test için: ?bugun=2026-11-10
    if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) return q;
    const n = new Date();
    const pad = (v) => String(v).padStart(2, '0');
    return n.getFullYear() + '-' + pad(n.getMonth() + 1) + '-' + pad(n.getDate());
  }

  function buildIndex(league) {
    const teams = {}, rounds = {};
    league.teams.forEach((t) => { teams[t.id] = t; });
    league.rounds.forEach((r) => { rounds[r.round] = r; });
    return { league, teams, rounds, matches: league.matches };
  }

  /* Maçın puan tablosuna yansıyan sonucu. Girilmemiş / ertelenmiş maç için null. */
  function result(m) {
    if (m.status === 'oynandı' && Number.isInteger(m.homeGoals) && Number.isInteger(m.awayGoals)) {
      const hg = m.homeGoals, ag = m.awayGoals;
      return { hg, ag, hp: hg > ag ? 3 : hg === ag ? 1 : 0, ap: ag > hg ? 3 : hg === ag ? 1 : 0, forfeit: false, double: false };
    }
    if (m.status === 'hükmen') {
      if (m.forfeitWinner && m.forfeitWinner === m.home) return { hg: 3, ag: 0, hp: 3, ap: 0, forfeit: true, double: false };
      if (m.forfeitWinner && m.forfeitWinner === m.away) return { hg: 0, ag: 3, hp: 0, ap: 3, forfeit: true, double: false };
      return { hg: 0, ag: 0, hp: 0, ap: 0, forfeit: true, double: true };
    }
    return null;
  }

  function matchDate(m, I) {
    return m.playedOn || I.rounds[m.round].end;
  }
  function byDate(I) {
    return (a, b) => {
      const da = matchDate(a, I), db = matchDate(b, I);
      return da < db ? -1 : da > db ? 1 : a.id < b.id ? -1 : 1;
    };
  }

  function blank(id) {
    return { id, o: 0, g: 0, b: 0, m: 0, ag: 0, yg: 0, av: 0, p: 0, cs: 0, form: [], tied: false, rank: 0 };
  }

  function accumulate(ids, matches, I) {
    const rows = {};
    ids.forEach((id) => { rows[id] = blank(id); });
    matches
      .filter((m) => rows[m.home] && rows[m.away] && result(m))
      .sort(byDate(I))
      .forEach((m) => {
        const r = result(m);
        [[m.home, r.hg, r.ag, r.hp], [m.away, r.ag, r.hg, r.ap]].forEach(([id, gf, ga, pts]) => {
          const row = rows[id];
          row.o++; row.ag += gf; row.yg += ga; row.p += pts;
          if (ga === 0) row.cs++;
          const out = r.double ? 'M' : gf > ga ? 'G' : gf === ga ? 'B' : 'M';
          if (out === 'G') row.g++; else if (out === 'B') row.b++; else row.m++;
          row.form.push(out);
        });
      });
    ids.forEach((id) => { rows[id].av = rows[id].ag - rows[id].yg; });
    return rows;
  }

  function overrideIndex(id, overrides) {
    for (const list of overrides) {
      const i = list.indexOf(id);
      if (i !== -1) return i;
    }
    return Infinity;
  }

  /* Sıralama: puan, averaj, atılan gol, ikili maçlar (puan, averaj), elle penaltı sonucu. */
  function standings(I) {
    const ids = I.league.teams.map((t) => t.id);
    const rows = accumulate(ids, I.matches, I);
    const overrides = I.league.tiebreakOverrides || [];
    const list = ids.map((id) => rows[id]);
    const key = (r) => [r.p, r.av, r.ag];
    const same = (a, b) => a.every((v, i) => v === b[i]);
    list.sort((a, b) => b.p - a.p || b.av - a.av || b.ag - a.ag);

    const out = [];
    for (let i = 0; i < list.length;) {
      let j = i + 1;
      while (j < list.length && same(key(list[j]), key(list[i]))) j++;
      let group = list.slice(i, j);
      if (group.length > 1) {
        const gids = group.map((r) => r.id);
        const mini = accumulate(gids, I.matches, I);
        group.sort((a, b) => mini[b.id].p - mini[a.id].p || mini[b.id].av - mini[a.id].av);
        // ikili maç sonrası hâlâ eşit olanlar için elle girilen sonuç
        const final = [];
        for (let x = 0; x < group.length;) {
          let y = x + 1;
          const mk = (r) => [mini[r.id].p, mini[r.id].av];
          while (y < group.length && same(mk(group[y]), mk(group[x]))) y++;
          const sub = group.slice(x, y);
          if (sub.length > 1) {
            sub.sort((a, b) => overrideIndex(a.id, overrides) - overrideIndex(b.id, overrides));
            sub.forEach((r, k) => {
              const here = overrideIndex(r.id, overrides);
              const prev = k > 0 ? overrideIndex(sub[k - 1].id, overrides) : null;
              const next = k < sub.length - 1 ? overrideIndex(sub[k + 1].id, overrides) : null;
              if (here === Infinity || here === prev || here === next) r.tied = true;
            });
          }
          final.push(...sub);
          x = y;
        }
        group = final;
      }
      out.push(...group);
      i = j;
    }
    out.forEach((r, k) => { r.rank = k + 1; });
    return out;
  }

  /* Erteleme hakkı: postponedBy dolu olan her maç 1 hak düşer (sonradan oynansa da geri gelmez). */
  function postponeInfo(I) {
    const limit = I.league.postponeLimit || 6;
    const info = {};
    I.league.teams.forEach((t) => { info[t.id] = { used: 0, limit, remaining: limit, over: false }; });
    I.matches.forEach((m) => {
      if (m.postponedBy && info[m.postponedBy]) info[m.postponedBy].used++;
    });
    Object.values(info).forEach((x) => { x.remaining = Math.max(0, x.limit - x.used); x.over = x.used > x.limit; });
    return info;
  }

  function currentRound(I, today) {
    const rs = I.league.rounds;
    if (today < rs[0].start) return { phase: 'before', round: rs[0].round };
    for (const r of rs) if (today >= r.start && today <= r.end) return { phase: 'during', round: r.round };
    const last = rs[rs.length - 1].round;
    if (today <= I.league.makeupPeriod.end) return { phase: 'makeup', round: last };
    return { phase: 'over', round: last };
  }

  function teamMatches(I, id) {
    return I.matches.filter((m) => m.home === id || m.away === id).sort((a, b) => a.round - b.round);
  }
  function nextMatch(I, id) {
    return teamMatches(I, id).find((m) => m.status === 'bekliyor') || null;
  }
  function postponedMatches(I, id) {
    return I.matches.filter((m) => m.status === 'ertelendi' && (!id || m.home === id || m.away === id));
  }
  function recentPlayed(I, n) {
    return I.matches.filter((m) => result(m)).sort(byDate(I)).reverse().slice(0, n);
  }

  global.Lig = {
    fmtDate, fmtRange, todayISO, buildIndex, result, standings, postponeInfo,
    currentRound, teamMatches, nextMatch, postponedMatches, recentPlayed, matchDate,
  };
})(window);
