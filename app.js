const CONFIG = {
  spreadsheetId: '1nPgDATdA6U3_OHBuJwrXQcOWT0Lq9dU25QkpdlPDE1g',
  resultsSheet: 'ΑΠΟΤΕΛΕΣΜΑΤΑ',
  resultsGid: '1805121888',
  ignoredSheets: ['stats', 'stats2', 'stats-2', 'ΚΑΝΟΝΙΣΜΟΙ'],
  fifa: {
    // Official FIFA public calendar endpoint. On GitHub Pages the browser may block
    // direct cross-origin calls, so V19 also tries safe public CORS relays.
    apiUrls: [
      'https://api.fifa.com/api/v3/calendar/matches?from=2026-06-10T00%3A00%3A00Z&to=2026-07-20T23%3A59%3A59Z&language=en&count=500&idCompetition=17',
      'https://api.fifa.com/api/v3/calendar/matches?from=2026-06-10T00%3A00%3A00Z&to=2026-07-20T23%3A59%3A59Z&language=en&count=500'
    ],
    pageUrl: 'https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures?country=GR&wtw-filter=ALL'
  },
  players: [
    'ΑΝΑΣΤΑΣΙΑΔΗΣ','ΑΡΒΑΝΙΤΟΠΟΥΛΟΣ','ΒΑΡΟΥΝΗΣ','ΒΕΛΟΥΔΟΣ 1','ΒΕΛΟΥΔΟΣ 2','ΓΚΟΥΛΟΥΣΗΣ Ν','ΓΚΟΥΛΟΥΣΗΣ Χ','ΔΗΜΑ','ΖΑΪΡΗΣ Γ','ΖΑΪΡΗΣ Ν','ΖΙΑΚΑΣ','ΗΛΙΟΠΟΥΛΟΣ','ΚΑΤΣΑΪΤΗΣ','ΚΕΛΛΑΡΗΣ Β','ΚΕΛΛΑΡΗΣ Δ','ΚΟΥΤΟΥΛΑΣ','ΚΟΥΤΣΟΥΦΛΑΚΗΣ','ΛΟΥΒΙΤΑΚΗΣ','ΜΑΡ','ΜΗΛΑΣ','ΝΤΑΒΛΟΥΡΟΣ','ΠΡΟΕΣΤΟΣ','ΣΒΟΛΟΠΟΥΛΟΣ Λ','ΣΒΟΛΟΠΟΥΛΟΣ Π','ΣΒΟΛΟΠΟΥΛΟΣ Τ','ΣΚΙΑΣ','ΣΚΟΥΡΤΑΣ Γ','ΣΚΟΥΡΤΑΣ Φ','ΣΦΗΚΑΣ','ΤΡΙΑΝΤΑΦΥΛΛΑΚΗΣ','ΤΣΟΓΚΑΣ','ΧΑΤΖΗΤΙΜΠΑΣ'
  ]
};

const $ = id => document.getElementById(id);
let state = { matches: [], progression: [], leaderboard: [], predictionStats: null, playerSheets: {}, fifaFixtures: [], fifaLoading: false, fifaError: '', fifaSource: '' };
let charts = {};
const FIXED = {
  round32: [3, 38],
  round16: [40, 55],
  quarters: [57, 64],
  semis: [66, 69],
  semiWinners: [71, 72],
  finalTeams: [74, 75],
  thirdPlace: 76,
  champion: 77,
  scorer: 78
};

function clean(v) { return (v ?? '').toString().replace(/\uFEFF/g, '').trim(); }
function esc(v) { return clean(v).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
function isIgnored(name) { return CONFIG.ignoredSheets.map(x => x.toLowerCase()).includes(clean(name).toLowerCase()); }
function initials(name){ return clean(name).split(/\s+/).slice(0,2).map(x=>x[0]).join(''); }
function medal(rank){ return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`; }
function norm(v){ return clean(v).replace(/\s+/g,' ').replace(/\.$/,'').toUpperCase(); }
function validPick(v){ const x = clean(v); return x && x !== '-' && x.toLowerCase() !== 'none'; }
function normalizeOutcome(v){
  // Αποτέλεσμα αγώνα: δέχεται 1, 2 και ισοπαλία με πολλούς πιθανούς χαρακτήρες
  // Latin X, ελληνικό Χ, κυριλλικό Х, multiplication sign × κ.λπ.
  const raw = clean(v);
  const x = raw
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .replace(',', '.')
    .toUpperCase();
  if (x === '1' || x === '1.0') return '1';
  if (x === '2' || x === '2.0') return '2';
  if (x === 'X' || x === 'Χ' || x === 'Х' || x === '×' || x === '✕' || x === '✖') return 'X';
  if (x.includes('ΙΣΟ') || x.includes('DRAW')) return 'X';
  return '';
}
function isPlayedResult(v){ return !!normalizeOutcome(v); }
function sameOutcome(a, b){ const aa = normalizeOutcome(a), bb = normalizeOutcome(b); return !!aa && aa === bb; }

function plainKey(v){
  return clean(v)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[’'`´]/g, '')
    .replace(/[.\-_/(),]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}
const TEAM_ALIASES = {
  'ARGENTINA':'ΑΡΓΕΝΤΙΝΗ', 'ΑΡΓΕΝΙΝΗ':'ΑΡΓΕΝΤΙΝΗ',
  'BRAZIL':'ΒΡΑΖΙΛΙΑ',
  'FRANCE':'ΓΑΛΛΙΑ',
  'SPAIN':'ΙΣΠΑΝΙΑ',
  'PORTUGAL':'ΠΟΡΤΟΓΑΛΙΑ', 'ΠΟΡΤΟΓΑ':'ΠΟΡΤΟΓΑΛΙΑ',
  'ENGLAND':'ΑΓΓΛΙΑ',
  'GERMANY':'ΓΕΡΜΑΝΙΑ',
  'NETHERLANDS':'ΟΛΛΑΝΔΙΑ', 'HOLLAND':'ΟΛΛΑΝΔΙΑ',
  'BELGIUM':'ΒΕΛΓΙΟ',
  'MEXICO':'ΜΕΞΙΚΟ',
  'TURKIYE':'ΤΟΥΡΚΙΑ', 'TURKEY':'ΤΟΥΡΚΙΑ',
  'SWITZERLAND':'ΕΛΒΕΤΙΑ',
  'NORWAY':'ΝΟΡΒΗΓΙΑ',
  'UNITED STATES':'Η.Π.Α.', 'UNITED STATES OF AMERICA':'Η.Π.Α.', 'USA':'Η.Π.Α.', 'USMNT':'Η.Π.Α.', 'ΗΠΑ':'Η.Π.Α.', 'Η Π Α':'Η.Π.Α.',
  'CANADA':'ΚΑΝΑΔΑΣ',
  'MOROCCO':'ΜΑΡΟΚΟ',
  'COLOMBIA':'ΚΟΛΟΜΒΙΑ',
  'CROATIA':'ΚΡΟΑΤΙΑ',
  'URUGUAY':'ΟΥΡΟΥΓΟΥΑΗ', 'ΟΥΡΟΥΓΟΥΗ':'ΟΥΡΟΥΓΟΥΑΗ',
  'KOREA REPUBLIC':'ΝΟΤΙΑ ΚΟΡΕΑ', 'SOUTH KOREA':'ΝΟΤΙΑ ΚΟΡΕΑ', 'REPUBLIC OF KOREA':'ΝΟΤΙΑ ΚΟΡΕΑ', 'KOREA':'ΝΟΤΙΑ ΚΟΡΕΑ', 'Ν ΚΟΡΕΑ':'ΝΟΤΙΑ ΚΟΡΕΑ', 'ΚΟΡΕΑ':'ΝΟΤΙΑ ΚΟΡΕΑ',
  'SENEGAL':'ΣΕΝΕΓΑΛΗ', 'ΣΕΝΑΓΑΛΗ':'ΣΕΝΕΓΑΛΗ',
  'CZECHIA':'ΤΣΕΧΙΑ', 'CZECH REPUBLIC':'ΤΣΕΧΙΑ', 'TΣΕΧΙΑ':'ΤΣΕΧΙΑ',
  'JAPAN':'ΙΑΠΩΝΙΑ',
  'EGYPT':'ΑΙΓΥΠΤΟΣ',
  'ECUADOR':'ΙΣΗΜΕΡΙΝΟΣ', 'ΕΚΟΥΑΔΟΡ':'ΙΣΗΜΕΡΙΝΟΣ',
  'AUSTRIA':'ΑΥΣΤΡΙΑ', 'ΑΣΤΡΙΑ':'ΑΥΣΤΡΙΑ',
  'COTE D IVOIRE':'ΑΚΤΗ ΕΛΕΦΑΝΤΟΣΤΟΥ', 'COTE DIVOIRE':'ΑΚΤΗ ΕΛΕΦΑΝΤΟΣΤΟΥ', 'IVORY COAST':'ΑΚΤΗ ΕΛΕΦΑΝΤΟΣΤΟΥ',
  'ALGERIA':'ΑΛΓΕΡΙΑ',
  'BOSNIA HERZEGOVINA':'ΒΟΣΝΙΑ ΕΡΖΕΓΟΒΙΝΗ', 'BOSNIA AND HERZEGOVINA':'ΒΟΣΝΙΑ ΕΡΖΕΓΟΒΙΝΗ', 'BOSNIA':'ΒΟΣΝΙΑ ΕΡΖΕΓΟΒΙΝΗ', 'ΒΟΣΝΙΑ':'ΒΟΣΝΙΑ ΕΡΖΕΓΟΒΙΝΗ',
  'SCOTLAND':'ΣΚΩΤΙΑ',
  'SWEDEN':'ΣΟΥΗΔΙΑ',
  'PARAGUAY':'ΠΑΡΑΓΟΥΑΗ',
  'IRAN':'ΙΡΑΝ', 'IRAN ISLAMIC REPUBLIC OF':'ΙΡΑΝ',
  'GHANA':'ΓΚΑΝΑ',
  'SAUDI ARABIA':'ΣΑΟΥΔΙΚΗ ΑΡΑΒΙΑ',
  'AUSTRALIA':'ΑΥΣΤΡΑΛΙΑ',
  'DR CONGO':'ΛΑΪΚΗ ΔΗΜΟΚΡΑΤΙΑ ΚΟΝΓΚΟ', 'CONGO DR':'ΛΑΪΚΗ ΔΗΜΟΚΡΑΤΙΑ ΚΟΝΓΚΟ', 'DEMOCRATIC REPUBLIC OF THE CONGO':'ΛΑΪΚΗ ΔΗΜΟΚΡΑΤΙΑ ΚΟΝΓΚΟ', 'CONGO':'ΛΑΪΚΗ ΔΗΜΟΚΡΑΤΙΑ ΚΟΝΓΚΟ', 'ΛΔ ΚΟΓΚΟ':'ΛΑΪΚΗ ΔΗΜΟΚΡΑΤΙΑ ΚΟΝΓΚΟ', 'Λ Δ ΚΟΓΚΟ':'ΛΑΪΚΗ ΔΗΜΟΚΡΑΤΙΑ ΚΟΝΓΚΟ',
  'QATAR':'ΚΑΤΑΡ',
  'TUNISIA':'ΤΥΝΗΣΙΑ',
  'CAPE VERDE':'ΠΡΑΣΙΝΟ ΑΚΡΩΤΗΡΙΟ', 'CABO VERDE':'ΠΡΑΣΙΝΟ ΑΚΡΩΤΗΡΙΟ', 'ΠΡΑΣΙΝΟ ΑΚΡΩΤΗΡΙ':'ΠΡΑΣΙΝΟ ΑΚΡΩΤΗΡΙΟ',
  'UZBEKISTAN':'ΟΥΖΜΠΕΚΙΣΤΑΝ',
  'SOUTH AFRICA':'ΝΟΤΙΑ ΑΦΡΙΚΗ',
  'HAITI':'ΑΪΤΗ', 'HAÏTI':'ΑΪΤΗ',
  'NEW ZEALAND':'ΝΕΑ ΖΗΛΑΝΔΙΑ',
  'CURACAO':'ΚΟΥΡΑΣΑΟ', 'CURAÇAO':'ΚΟΥΡΑΣΑΟ', 'CURAÇAO':'ΚΟΥΡΑΣΑΟ'
};
function canonicalTeam(v){
  const raw = clean(v);
  if (!raw) return '';
  const key = plainKey(raw);
  return TEAM_ALIASES[key] || raw;
}
function canonicalKey(v){ return plainKey(canonicalTeam(v)); }
function resultBreakdown(){
  const out = { '1':0, 'X':0, '2':0, other:0, played:0, total: state.matches.length };
  for (const m of state.matches) {
    const r = normalizeOutcome(m.result);
    if (r) { out.played++; out[r] = (out[r] || 0) + 1; }
    else if (clean(m.result)) out.other++;
  }
  return out;
}

function csvUrls(sheetName) {
  const urls = [];
  // Για το φύλλο ΑΠΟΤΕΛΕΣΜΑΤΑ κρατάμε το gid export, επειδή στο group stage
  // διαβάζει σωστά τα X. Αν όμως το tab ξαναδημιουργηθεί και αλλάξει gid,
  // κάνουμε fallback στο όνομα φύλλου ώστε να μη σπάει όλη η σελίδα.
  if (sheetName === CONFIG.resultsSheet && CONFIG.resultsGid) {
    const params = new URLSearchParams({ format: 'csv', gid: CONFIG.resultsGid, cacheBust: Date.now().toString() });
    urls.push(`https://docs.google.com/spreadsheets/d/${CONFIG.spreadsheetId}/export?${params.toString()}`);
  }
  const base = `https://docs.google.com/spreadsheets/d/${CONFIG.spreadsheetId}/gviz/tq`;
  const params = new URLSearchParams({ tqx: 'out:csv', sheet: sheetName, cacheBust: Date.now().toString() });
  urls.push(`${base}?${params.toString()}`);
  return urls;
}

function parseCsv(text) {
  const rows = []; let row = [], cell = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (ch === '"') { if (inQuotes && next === '"') { cell += '"'; i++; } else inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { row.push(cell); cell = ''; }
    else if ((ch === '\n' || ch === '\r') && !inQuotes) { if (ch === '\r' && next === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

async function fetchSheet(sheetName) {
  let lastError = null;
  for (const url of csvUrls(sheetName)) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (text.includes('<!DOCTYPE html') || text.includes('<html')) throw new Error('HTML αντί για CSV');
      return parseCsv(text);
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(`Δεν μπόρεσα να διαβάσω το φύλλο «${sheetName}»${lastError ? ` (${lastError.message})` : ''}.`);
}

function progressionRound(rowNumber, slot) {
  const s = norm(slot).replace(/\s+/g, '');
  if (!s || s.includes('ΣΥΝΟΛΟ')) return '';
  if (rowNumber >= 3 && rowNumber <= 38) return 'Στους 32';
  if (rowNumber >= 40 && rowNumber <= 55) return 'Στους 16';
  if (rowNumber >= 57 && rowNumber <= 64) return 'Στους 8';
  if (rowNumber >= 66 && rowNumber <= 69) return 'Στους 4';
  if (rowNumber >= 71 && rowNumber <= 72) return 'Μικρός τελικός';
  if (rowNumber >= 74 && rowNumber <= 75) return 'Τελικός';
  if (rowNumber === 76) return 'Νικητής μικρού τελικού';
  if (rowNumber === 77) return 'Πρωταθλητής';
  if (rowNumber === 78) return '1ος σκόρερ';
  return '';
}
function parseResults(rows) {
  const matches = [];
  const progression = [];
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i] || [];
    const rowNumber = i + 1;
    const date = clean(r[0]), time = clean(r[1]), group = clean(r[2]), match = clean(r[3]), result = clean(r[4]), slot = clean(r[5]), qualified = clean(r[6]);
    if (match && !match.toUpperCase().includes('ΒΑΘΜΟΛΟΓΙΑ')) matches.push({ date, time, group, match, result, slot });
    const round = progressionRound(rowNumber, slot);
    if (round && qualified) progression.push({ round, slot, team: qualified, row: rowNumber });
  }
  let leaderboard = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const rank = clean(r[17]), player = clean(r[18]), points = clean(r[19]);
    if (rank && player && !isIgnored(player)) leaderboard.push({ rank: Number(rank) || 999, player, points: Number(points) || 0 });
  }
  if (!leaderboard.length) {
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i] || [];
      const rank = clean(r[8]), player = clean(r[9]), points = clean(r[10]);
      if (rank && player && !isIgnored(player)) leaderboard.push({ rank: Number(rank) || 999, player, points: Number(points) || 0 });
    }
  }
  leaderboard = leaderboard.filter(x => CONFIG.players.includes(x.player)).sort((a, b) => a.rank - b.rank || b.points - a.points || a.player.localeCompare(b.player, 'el'));
  return { matches, progression, leaderboard };
}

function normalizeScorerName(v){
  const x = clean(v).toUpperCase().replace(/\s+/g,' ');
  // Σκόρερ: δεν εφαρμόζουμε ποτέ φίλτρο 1/X/2 εδώ. Ονόματα όπως ΧΑΑΛΑΝΤ είναι έγκυρα.
  const map = {
    'HAALAND':'ΧΑΑΛΑΝΤ',
    'ΧΑΛΑΝΤ':'ΧΑΑΛΑΝΤ',
    'ΧΑΑΛΑΝΔ':'ΧΑΑΛΑΝΤ',
    'EΜΠΑΠΕ':'ΕΜΠΑΠΕ',
    'ΕΜΠΑΜΠΕ':'ΕΜΠΑΠΕ',
    'MBAPPE':'ΕΜΠΑΠΕ',
    'ΜΠΑΠΕ':'ΕΜΠΑΠΕ'
  };
  return map[x] || clean(v);
}
function addCount(map, key, normalizer=null){
  if (!validPick(key)) return;
  const k = normalizer ? normalizer(key) : clean(key);
  if (validPick(k)) map.set(k, (map.get(k) || 0) + 1);
}
function addPick(bucket, key, player, normalizer=null){
  if (!validPick(key)) return;
  const k = normalizer ? normalizer(key) : clean(key);
  if (!bucket.has(k)) bucket.set(k, []);
  if (!bucket.get(k).includes(player)) bucket.get(k).push(player);
}
function topEntries(map, limit=8){ return [...map.entries()].sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0], 'el')).slice(0, limit); }
function findPick(rows, labels){
  const set = labels.map(norm);
  for (const r of rows) if (set.includes(norm(r[3]))) return clean(r[4]);
  return '';
}
function picksByLabels(rows, labels){
  const set = labels.map(norm); const out = [];
  for (const r of rows) if (set.includes(norm(r[3])) && validPick(r[4])) out.push(clean(r[4]));
  return out;
}
function picksBySection(rows, startLabel, endLabel){
  const out = []; let on = false;
  for (const r of rows) {
    const label = norm(r[3]);
    if (label === norm(startLabel)) { on = true; continue; }
    if (label === norm(endLabel)) break;
    if (on && validPick(r[4])) out.push(clean(r[4]));
  }
  return out;
}
function finalPairLabel(a, b){ return [clean(a), clean(b)].filter(Boolean).sort((x,y)=>x.localeCompare(y,'el')).join(' — '); }

function eCell(rows, rowNumber){ return clean((rows[rowNumber - 1] || [])[4]); }
function valuesE(rows, start, end){
  const out = [];
  for (let r = start; r <= end; r++) {
    const v = eCell(rows, r);
    if (validPick(v)) out.push(v);
  }
  return out;
}
function valueByExactLabel(rows, labels){
  const wanted = labels.map(norm);
  for (const r of rows) {
    const label = norm((r || [])[3]);
    if (wanted.includes(label)) return clean((r || [])[4]);
  }
  return '';
}
function valuesByLabelPrefix(rows, prefixes){
  const ps = prefixes.map(norm); const out = [];
  for (const r of rows) {
    const label = norm((r || [])[3]);
    if (ps.some(p => label.startsWith(p)) && validPick((r || [])[4])) out.push(clean((r || [])[4]));
  }
  return out;
}
function parsePlayerAnalytics(player, rows){
  // Label-based extraction first. This avoids row-offset problems in published CSV.
  const champion = valueByExactLabel(rows, ['ΝΙΚΗΤΗΣ']) || eCell(rows, FIXED.champion);
  const scorer = valueByExactLabel(rows, ['1ος ΣΚΟΡΕΡ', '1ΟΣ ΣΚΟΡΕΡ']) || eCell(rows, FIXED.scorer);
  const thirdPlace = valueByExactLabel(rows, ['ΝΙΚΗΤΗΣ ΜΙΚΡΟΥ ΤΕΛΙΚΟΥ']) || eCell(rows, FIXED.thirdPlace);
  let finalists = valuesByLabelPrefix(rows, ['ΝΗΜ']).slice(0,2);
  if (finalists.length < 2) finalists = valuesE(rows, ...FIXED.finalTeams).slice(0,2);
  let semiWinners = valuesByLabelPrefix(rows, ['ΗΗ']).slice(0,2);
  if (semiWinners.length < 2) semiWinners = valuesE(rows, ...FIXED.semiWinners).slice(0,2);
  let semiFinalists = valuesByLabelPrefix(rows, ['ΠΡΟ']).slice(0,4);
  if (semiFinalists.length < 4) semiFinalists = valuesE(rows, ...FIXED.semis).slice(0,4);
  let quarterFinalists = valuesByLabelPrefix(rows, ['16.']).slice(0,8);
  if (quarterFinalists.length < 8) quarterFinalists = valuesE(rows, ...FIXED.quarters).slice(0,8);
  // Για τη φάση των 16 προτιμάμε τις σταθερές γραμμές 40:55.
  // Έτσι δεν επηρεάζεται από Latin/Greek roman labels όπως I/Ι, VI/VΙ κ.λπ.
  const round16 = valuesE(rows, ...FIXED.round16).slice(0,16);
  const round32 = valuesE(rows, ...FIXED.round32).slice(0,36).filter(x => validPick(x) && clean(x) !== '-');
  const finalPair = finalists.length >= 2 ? finalPairLabel(finalists[0], finalists[1]) : '';
  return { player, champion, scorer, round32, round16, quarterFinalists, semiFinalists, semiWinners, finalists, finalPair, thirdPlace };
}

function aggregateAnalytics(analytics){
  const maps = { champions:new Map(), scorers:new Map(), finalists:new Map(), finalPairs:new Map(), semis:new Map(), quarters:new Map(), round16:new Map(), round32:new Map(), semiWinners:new Map(), thirdPlaces:new Map() };
  const picks = { champions:new Map(), scorers:new Map(), finalists:new Map(), finalPairs:new Map(), semis:new Map(), quarters:new Map(), round16:new Map(), round32:new Map(), semiWinners:new Map(), thirdPlaces:new Map() };
  for (const a of analytics) {
    addCount(maps.champions, a.champion); addPick(picks.champions, a.champion, a.player);
    addCount(maps.scorers, a.scorer, normalizeScorerName); addPick(picks.scorers, a.scorer, a.player, normalizeScorerName);
    addCount(maps.finalPairs, a.finalPair); addPick(picks.finalPairs, a.finalPair, a.player);
    addCount(maps.thirdPlaces, a.thirdPlace); addPick(picks.thirdPlaces, a.thirdPlace, a.player);
    a.finalists.forEach(x => { addCount(maps.finalists, x); addPick(picks.finalists, x, a.player); });
    a.semiFinalists.forEach(x => { addCount(maps.semis, x); addPick(picks.semis, x, a.player); });
    a.semiWinners.forEach(x => { addCount(maps.semiWinners, x); addPick(picks.semiWinners, x, a.player); });
    a.quarterFinalists.forEach(x => { addCount(maps.quarters, x); addPick(picks.quarters, x, a.player); });
    a.round16.forEach(x => { addCount(maps.round16, x); addPick(picks.round16, x, a.player); });
    a.round32.forEach(x => { addCount(maps.round32, x); addPick(picks.round32, x, a.player); });
  }
  return { analytics, maps, picks, loadedPlayers: analytics.length };
}

async function loadPredictionStats(force=false){
  if (state.predictionStats && !force) return state.predictionStats;
  $('statsStatus').textContent = 'Φόρτωση φύλλων παικτών και υπολογισμός στατιστικών…';
  const settled = await Promise.allSettled(CONFIG.players.map(async player => {
    const rows = await fetchSheet(player);
    state.playerSheets[player] = rows;
    return parsePlayerAnalytics(player, rows);
  }));
  const analytics = settled.filter(x => x.status === 'fulfilled').map(x => x.value);
  const failed = settled.filter(x => x.status === 'rejected').length;
  state.predictionStats = aggregateAnalytics(analytics);
  renderPredictionStats();
  $('statsStatus').textContent = `Υπολογίστηκαν στατιστικά από ${analytics.length} παίκτες${failed ? ` · ${failed} φύλλα δεν φορτώθηκαν` : ''}.`;
  return state.predictionStats;
}

function renderCards() {
  const rb = resultBreakdown();
  const played = rb.played;
  const top = state.leaderboard[0];
  const maxPoints = Math.max(0, ...state.leaderboard.map(x => x.points));
  const qualified32 = state.progression?.filter(x => x.round === 'Στους 32').length || 0;
  const qualified16 = state.progression?.filter(x => x.round === 'Στους 16').length || 0;
  if ($('sidePlayed')) $('sidePlayed').textContent = played;
  const cards = (!played && (qualified32 || qualified16)) ? [
    ['Παίκτες', state.leaderboard.length || CONFIG.players.length],
    ['Προκρίσεις στους 32', `${qualified32}/32`],
    ['Προκρίσεις στους 16', `${qualified16}/16`],
    ['Πρώτος', top ? `${top.player} · ${maxPoints}` : '-']
  ] : [
    ['Παίκτες', state.leaderboard.length || CONFIG.players.length],
    ['Αγώνες με αποτέλεσμα', played],
    ['Προκρίσεις στους 32', `${qualified32}/32`],
    ['Πρώτος', top ? `${top.player} · ${maxPoints}` : '-']
  ];
  $('summaryCards').innerHTML = cards.map(([label, value]) => `<div class="card"><div class="label">${label}</div><div class="value">${esc(value)}</div></div>`).join('');
}

function podiumCard(x, place, cls='') {
  if (!x) return '<div></div>';
  return `<div class="podium-card ${cls}">
    <div class="medal">${place === 1 ? '🥇' : place === 2 ? '🥈' : '🥉'}</div>
    <div class="avatar">${esc(initials(x.player))}</div>
    <div class="podium-name">${esc(x.player)}</div>
    <div class="podium-points">${esc(x.points)}</div>
    <small>βαθμοί</small>
  </div>`;
}
function renderPodium() { const [first, second, third] = state.leaderboard; $('podium').innerHTML = podiumCard(second,2) + podiumCard(first,1,'first') + podiumCard(third,3); }

function renderTopTen(){
  const leader = state.leaderboard[0]?.points || 0;
  $('topTen').innerHTML = state.leaderboard.slice(0,10).map((x,i)=>{
    const diff = x.points - leader;
    return `<div class="top-row"><div class="top-rank">${medal(i+1)}</div><div class="top-name">${esc(x.player)}</div><div class="top-points">${esc(x.points)} <small>${diff ? diff : '0'}</small></div></div>`;
  }).join('');
}

function renderMovers(){
  const el = $('moversBox');
  if (!el) return;
  const prev = JSON.parse(localStorage.getItem('wc2026Ranks') || '{}');
  const movers = state.leaderboard.map(x => ({...x, prev: prev[x.player], delta: prev[x.player] ? prev[x.player] - x.rank : 0}))
    .filter(x => x.delta !== 0).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta)).slice(0,6);
  el.innerHTML = movers.length ? movers.map(x => `<div class="mover-row ${x.delta>0?'up':'down'}"><span>${x.delta>0?'↑':'↓'} ${Math.abs(x.delta)}</span><b>${esc(x.player)}</b><small>#${x.rank}</small></div>`).join('') : '<div class="empty-state">Οι μεταβολές θα εμφανιστούν μετά την επόμενη ενημέρωση.</div>';
  localStorage.setItem('wc2026Ranks', JSON.stringify(Object.fromEntries(state.leaderboard.map(x=>[x.player,x.rank]))));
}

function renderQuickStats(){
  const rb = resultBreakdown();
  const played = rb.played;
  const top = state.leaderboard[0];
  const tiedFirst = state.leaderboard.filter(x => top && x.points === top.points).length;
  const stats = state.predictionStats;
  const favChampion = stats ? topEntries(stats.maps.champions, 1)[0] : null;
  const p32 = state.progression?.filter(x => x.round === 'Στους 32').length || 0;
  const p16 = state.progression?.filter(x => x.round === 'Στους 16').length || 0;
  $('quickStats').innerHTML = [
    ['Αγώνες', `${played}/${state.matches.length}`],
    ['Προκρίσεις', `32: ${p32}/32 · 16: ${p16}/16`],
    ['Ισοβαθμία στην κορυφή', tiedFirst || '-'],
    ['Δημοφιλής πρωταθλήτρια', favChampion ? `${favChampion[0]} (${favChampion[1]})` : 'Φόρτωση…']
  ].map(([label,value])=>`<div class="stat-line"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('');
}

function renderLeaderboard() {
  const q = clean($('playerSearch').value).toLowerCase();
  const rows = state.leaderboard.filter(x => x.player.toLowerCase().includes(q));
  const max = Math.max(1, ...state.leaderboard.map(x=>x.points));
  const leader = state.leaderboard[0]?.points || 0;
  $('leaderboardTable').innerHTML = `<thead><tr><th>Θέση</th><th>Παίκτης</th><th>Βαθμοί</th><th>Απόσταση από 1ο</th><th>Φόρμα</th></tr></thead><tbody>` +
    rows.map((x) => `<tr><td class="rank">${medal(x.rank)}</td><td class="player-name"><button class="link-btn" onclick="openPlayerModal('${esc(x.player)}')">${esc(x.player)}</button></td><td class="points">${esc(x.points)}</td><td class="diff">${x.points - leader}</td><td><div class="bar-track"><div class="bar-fill" style="width:${Math.max(4, x.points/max*100)}%"></div></div></td></tr>`).join('') + `</tbody>`;
}

function renderGroupFilter() {
  const groups = [...new Set(state.matches.map(m => m.group).filter(Boolean))].sort((a,b)=>a.localeCompare(b, 'el'));
  $('groupFilter').innerHTML = '<option value="">Όλοι οι όμιλοι</option>' + groups.map(g => `<option value="${esc(g)}">${esc(g)}</option>`).join('');
}
function matchInsights(match){
  const exact = [], points = [];
  for (const [player, rows] of Object.entries(state.playerSheets)) {
    for (const r of rows) {
      if (norm((r || [])[0]) === norm(match.match)) {
        const pts = Number(clean((r || [])[2])) || 0;
        let predRaw = clean((r || [])[1]);
        if (!predRaw && normalizeOutcome(match.result) === 'X' && pts > 0) predRaw = 'X';
        if (pts > 0) points.push({ player, pts, pred: predRaw });
        if (sameOutcome(predRaw, match.result)) exact.push(player);
        break;
      }
    }
  }
  return { exact, points };
}

function upcomingPickGroups(match){
  const groups = { '1': [], 'X': [], '2': [], missing: [] };
  for (const player of CONFIG.players) {
    const rows = state.playerSheets[player];
    if (!rows) continue;
    let found = false;
    for (const r of rows) {
      if (norm((r || [])[0]) === norm(match.match)) {
        found = true;
        const raw = clean((r || [])[1]);
        let pred = normalizeOutcome(raw);
        // Google gviz/tq κάνει type inference στη στήλη προβλέψεων των παικτών.
        // Όταν η τιμή είναι X/Χ, μερικές φορές επιστρέφει κενό.
        // Στα group-stage prediction φύλλα όλοι οι παίκτες έχουν συμπληρωμένη πρόβλεψη,
        // άρα κενή τιμή σε βρεμένο αγώνα την αντιμετωπίζουμε ως X.
        if (!pred && !raw) pred = 'X';
        if (pred === '1' || pred === 'X' || pred === '2') groups[pred].push(player);
        else groups.missing.push(player);
        break;
      }
    }
    if (!found) groups.missing.push(player);
  }
  return groups;
}

function roundMeta(round){
  const meta = {
    'Στους 32': { key:'round32', total:32, label:'Στους 32', noun:'ομάδες που πέρασαν στους 32' },
    'Στους 16': { key:'round16', total:16, label:'Στους 16', noun:'ομάδες που πέρασαν στους 16' },
    'Στους 8': { key:'quarters', total:8, label:'Στους 8', noun:'ομάδες που πέρασαν στους 8' },
    'Στους 4': { key:'semis', total:4, label:'Στους 4', noun:'ομάδες που πέρασαν στους 4' },
    'Τελικός': { key:'finalists', total:2, label:'Τελικό', noun:'ομάδες του τελικού' },
    'Πρωταθλητής': { key:'champions', total:1, label:'Πρωταθλητής', noun:'πρωταθλήτρια ομάδα' }
  };
  return meta[round] || null;
}
function activeProgressionRound(){
  // Δείχνουμε το πιο προχωρημένο στάδιο που έχει πραγματικές καταχωρίσεις στη στήλη G.
  const order = ['Πρωταθλητής', 'Τελικός', 'Στους 4', 'Στους 8', 'Στους 16', 'Στους 32'];
  for (const r of order) if ((state.progression || []).some(x => x.round === r)) return r;
  return '';
}
function getPickPlayersForTeam(type, team){
  const map = state.predictionStats?.picks?.[type];
  if (!map) return [];
  const target = canonicalKey(team);
  for (const [label, players] of map.entries()) if (canonicalKey(label) === target) return [...players].sort((a,b)=>a.localeCompare(b,'el'));
  return [];
}
function renderQualificationPicks(round){
  const el = $('upcomingPicks');
  if (!el) return;
  const status = $('upcomingStatus');
  const meta = roundMeta(round);
  const actual = (state.progression || []).filter(x => x.round === round && validPick(x.team));
  const loaded = state.predictionStats?.loadedPlayers || CONFIG.players.filter(p => state.playerSheets[p]).length;
  if (!meta || !actual.length) return false;
  if (status) status.textContent = `Καταχωρισμένες προκρίσεις ${meta.label}: ${actual.length}/${meta.total}. ${loaded ? `Φορτώθηκαν ${loaded}/${CONFIG.players.length} παίκτες.` : 'Φορτώνονται τα φύλλα παικτών…'}`;
  if (!state.predictionStats) {
    el.innerHTML = actual.slice(0, meta.total).map(x => `<div class="upcoming-card skeleton"><div class="upcoming-head"><div><div class="match-meta">${esc(meta.label)} · ${esc(x.slot || '')}</div><div class="match-title">${esc(x.team)}</div></div><span class="upcoming-slot">στήλη G</span></div><div class="empty-state">Φόρτωση παικτών…</div></div>`).join('');
    return true;
  }
  const cards = actual.slice(0, meta.total).map(x => ({...x, players:getPickPlayersForTeam(meta.key, x.team)}));
  window.__qualificationCards = cards;
  const max = Math.max(1, ...cards.map(x => x.players.length));
  el.innerHTML = `<div class="empty-state phase-note">Δεν υπάρχουν πλέον επόμενα ματς από τη φάση των ομίλων. Εδώ εμφανίζονται οι πραγματικές προκρίσεις από τη στήλη G και πόσοι παίκτες τις είχαν προβλέψει.</div>` +
    cards.map((x, idx) => {
      const count = x.players.length;
      const width = Math.max(5, count / max * 100);
      return `<div class="upcoming-card"><div class="upcoming-head"><div><div class="match-meta">${esc(meta.label)} · ${esc(x.slot || '')}</div><div class="match-title">${esc(x.team)}</div></div><span class="upcoming-slot">${count}/${loaded}</span></div><button class="pick-option wide" onclick="openQualificationModal(${idx})"><div class="pick-option-top"><b>Το είχαν προβλέψει</b><span>${count}/${loaded}</span></div><div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div></button></div>`;
    }).join('');
  return true;
}
function openQualificationModal(idx){
  const item = (window.__qualificationCards || [])[idx];
  if (!item) return;
  const round = item.round;
  const meta = roundMeta(round) || { label:round };
  const players = item.players || [];
  const missed = CONFIG.players.filter(p => !players.includes(p)).sort((a,b)=>a.localeCompare(b,'el'));
  openModal(`<p class="small-title">Προκρίσεις ${esc(meta.label)}</p><h2>${esc(item.team)}</h2><p class="modal-sub">${players.length}/${CONFIG.players.length} παίκτες το είχαν προβλέψει</p><h3>Το είχαν</h3><div class="picker-grid">${players.map(p => `<button onclick="closeModal();selectPlayer('${esc(p)}')">${esc(p)}</button>`).join('') || '<em>Κανένας παίκτης.</em>'}</div><h3>Δεν το είχαν</h3><div class="picker-grid muted-grid">${missed.map(p => `<button onclick="closeModal();selectPlayer('${esc(p)}')">${esc(p)}</button>`).join('')}</div>`);
}
window.openQualificationModal = openQualificationModal;


function nextRoundMeta(round){
  const meta = {
    'Στους 32': { pickType:'round16', matchLabel:'Φάση των 32', targetLabel:'Στους 16', verb:'στους 16' },
    'Στους 16': { pickType:'quarters', matchLabel:'Φάση των 16', targetLabel:'Στους 8', verb:'στους 8' },
    'Στους 8': { pickType:'semis', matchLabel:'Προημιτελικά', targetLabel:'Στους 4', verb:'στους 4' },
    'Στους 4': { pickType:'finalists', matchLabel:'Ημιτελικά', targetLabel:'Τελικό', verb:'στον τελικό' },
    'Τελικός': { pickType:'champions', matchLabel:'Τελικός', targetLabel:'Πρωταθλητής', verb:'πρωταθλήτρια' }
  };
  return meta[round] || null;
}
function buildKnockoutFixtures(round){
  const meta = nextRoundMeta(round);
  if (!meta) return [];
  const teams = (state.progression || [])
    .filter(x => x.round === round && validPick(x.team))
    .sort((a,b) => (Number(a.row)||0) - (Number(b.row)||0));
  const fixtures = [];
  for (let i = 0; i < teams.length; i += 2) {
    const a = teams[i];
    const b = teams[i + 1];
    if (a || b) fixtures.push({ round, meta, slot:`${clean(a?.slot || '')}${b?.slot ? ' / ' + clean(b.slot) : ''}`, teamA:a?.team || '', teamB:b?.team || '', rowA:a?.row || '', rowB:b?.row || '' });
  }
  return fixtures;
}
function renderKnockoutFixtures(round){
  const el = $('upcomingPicks');
  if (!el) return false;
  const status = $('upcomingStatus');
  const meta = nextRoundMeta(round);
  if (!meta) return false;
  const fixtures = buildKnockoutFixtures(round);
  if (!fixtures.length) return false;
  const loaded = state.predictionStats?.loadedPlayers || CONFIG.players.filter(p => state.playerSheets[p]).length;
  if (status) status.textContent = `${meta.matchLabel}: ${fixtures.length} ζευγάρια από τη στήλη G. ${loaded ? `Φορτώθηκαν ${loaded}/${CONFIG.players.length} παίκτες.` : 'Φορτώνονται τα φύλλα παικτών…'}`;
  if (!state.predictionStats) {
    el.innerHTML = fixtures.slice(0, 8).map(f => `<div class="upcoming-card skeleton"><div class="upcoming-head"><div><div class="match-meta">${esc(meta.matchLabel)} · ${esc(f.slot)}</div><div class="match-title">${esc(f.teamA || 'TBC')} — ${esc(f.teamB || 'TBC')}</div></div><span class="upcoming-slot">στήλη G</span></div><div class="empty-state">Φόρτωση παικτών…</div></div>`).join('');
    return true;
  }
  const cards = fixtures.map(f => {
    const aPlayers = f.teamA ? getPickPlayersForTeam(meta.pickType, f.teamA) : [];
    const bPlayers = f.teamB ? getPickPlayersForTeam(meta.pickType, f.teamB) : [];
    return {...f, aPlayers, bPlayers};
  });
  window.__knockoutFixtures = cards;
  el.innerHTML = `<div class="empty-state phase-note">Τα επόμενα ζευγάρια δημιουργούνται από τις ομάδες που είναι ήδη γραμμένες στη στήλη G του φύλλου ΑΠΟΤΕΛΕΣΜΑΤΑ. Για επίσημες ώρες/γήπεδα, δες το <a href="https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures?country=GR&wtw-filter=ALL" target="_blank" rel="noopener">πρόγραμμα της FIFA</a>.</div>` +
    cards.map((f, idx) => {
      const max = Math.max(1, f.aPlayers.length, f.bPlayers.length);
      const option = (side, team, players) => {
        const count = players.length;
        const width = Math.max(5, count / max * 100);
        return `<button class="pick-option" onclick="openKnockoutFixtureModal(${idx},'${side}')"><div class="pick-option-top"><b>${esc(team || 'TBC')}</b><span>${count}/${loaded}</span></div><small>το έχουν ${esc(meta.verb)}</small><div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div></button>`;
      };
      return `<div class="upcoming-card"><div class="upcoming-head"><div><div class="match-meta">${esc(meta.matchLabel)} · ${esc(f.slot)}</div><div class="match-title">${esc(f.teamA || 'TBC')} — ${esc(f.teamB || 'TBC')}</div></div><span class="upcoming-slot">${esc(meta.targetLabel)}</span></div><div class="pick-options">${option('A', f.teamA, f.aPlayers)}${option('B', f.teamB, f.bPlayers)}</div></div>`;
    }).join('');
  return true;
}
function openKnockoutFixtureModal(idx, side){
  const item = (window.__knockoutFixtures || [])[idx];
  if (!item) return;
  const team = side === 'A' ? item.teamA : item.teamB;
  const players = side === 'A' ? item.aPlayers : item.bPlayers;
  const missed = CONFIG.players.filter(p => !players.includes(p)).sort((a,b)=>a.localeCompare(b,'el'));
  openModal(`<p class="small-title">${esc(item.meta.matchLabel)}</p><h2>${esc(item.teamA || 'TBC')} — ${esc(item.teamB || 'TBC')}</h2><p class="modal-sub">${esc(team)} · ${players.length}/${CONFIG.players.length} παίκτες το έχουν ${esc(item.meta.verb)}</p><h3>Το έχουν</h3><div class="picker-grid">${players.map(p => `<button onclick="closeModal();selectPlayer('${esc(p)}')">${esc(p)}</button>`).join('') || '<em>Κανένας παίκτης.</em>'}</div><h3>Δεν το έχουν</h3><div class="picker-grid muted-grid">${missed.map(p => `<button onclick="closeModal();selectPlayer('${esc(p)}')">${esc(p)}</button>`).join('')}</div>`);
}
window.openKnockoutFixtureModal = openKnockoutFixtureModal;


function textFromAny(v){
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (Array.isArray(v)) {
    // FIFA localization arrays are usually [{Locale:'en', Description:'...'}]. Prefer English/Greek.
    const preferred = v.find(x => plainKey(x?.Locale || x?.Language || x?.language || '').includes('EN')) ||
      v.find(x => plainKey(x?.Locale || x?.Language || x?.language || '').includes('EL')) || v[0];
    return textFromAny(preferred);
  }
  if (typeof v === 'object') {
    const priority = ['Description','Name','ShortName','ShortClubName','LongName','OfficialName','TeamName','CountryName','DisplayName','Text','Label','Value','Abbreviation'];
    for (const k of priority) if (v[k] != null) {
      const t = textFromAny(v[k]);
      if (t) return t;
    }
    if (v.en) return textFromAny(v.en);
    if (v['en-GB']) return textFromAny(v['en-GB']);
    if (v.el) return textFromAny(v.el);
  }
  return '';
}
function pickFirst(obj, keys){
  for (const k of keys) {
    if (obj && obj[k] != null && clean(textFromAny(obj[k]))) return obj[k];
  }
  return '';
}
function fifaTeamName(match, side){
  const upper = side === 'home' ? 'Home' : 'Away';
  const lower = side === 'home' ? 'home' : 'away';
  const obj = pickFirst(match, [
    upper, `${upper}Team`, `${upper}TeamName`, `${upper}TeamOfficialName`, `${upper}TeamCountry`,
    `${upper}TeamShortName`, `${upper}TeamLongName`, `${upper}TeamDescription`,
    lower, `${lower}_team`, `${lower}Team`, `${lower}TeamName`, `${lower}_team_name`, `${lower}_team_short_name`
  ]);
  const name = textFromAny(obj) || clean(match[`${side}_team`] || match[`${upper}TeamName`] || match[`${lower}_team_name`] || '');
  return canonicalTeam(name);
}
function fifaDate(match){
  const raw = clean(match.Date || match.MatchDate || match.DateUTC || match.MatchDateUTC || match.MatchDateTime || match.MatchDateTimeUTC || match.LocalDate || match.DateLocal || match.local_date || match.date_utc || match.date || match.kickoff || '');
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}
function normalizeFifaMatch(match){
  const stage = textFromAny(pickFirst(match, ['StageName','Stage','stage_name','stage','StageDescription','Phase','RoundName','round_name']));
  const group = textFromAny(pickFirst(match, ['GroupName','Group','group_name','group']));
  const competition = textFromAny(pickFirst(match, ['CompetitionName','Competition','competition_name','CompetitionCode','CompetitionKey']));
  const season = textFromAny(pickFirst(match, ['SeasonName','Season','season_name','SeasonCode','SeasonKey']));
  const venue = textFromAny(pickFirst(match, ['Stadium','StadiumName','Venue','stadium_name','venue_name']));
  const city = textFromAny(pickFirst(match, ['City','CityName','city_name','HostCity','host_city']));
  const status = textFromAny(pickFirst(match, ['MatchStatus','Status','StatusName','match_status','MatchStatusName','status']));
  const date = fifaDate(match);
  const home = fifaTeamName(match, 'home');
  const away = fifaTeamName(match, 'away');
  const matchNo = clean(match.MatchNumber || match.MatchNo || match.match_number || match.IdMatch || match.id_match || match.id || '');
  return { raw:match, date, home, away, stage:clean(stage), group:clean(group), competition:clean(competition), season:clean(season), venue:clean(venue), city:clean(city), status:clean(status), matchNo };
}
function flattenMatchArray(data){
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  for (const key of ['Results','results','Matches','matches','Items','items','data','Data']) {
    if (Array.isArray(data[key])) return data[key];
  }
  // Some JSON wrappers put the array one level deeper.
  for (const val of Object.values(data)) {
    const arr = flattenMatchArray(val);
    if (arr.length) return arr;
  }
  return [];
}
function isWorldCup2026Match(m){
  const blob = plainKey([m.competition, m.season, m.stage, m.raw?.CompetitionName, m.raw?.SeasonName].join(' '));
  const ids = [m.raw?.IdCompetition, m.raw?.idCompetition, m.raw?.CompetitionId, m.raw?.IdCup].map(x=>clean(x));
  if (ids.includes('17')) return true; // FIFA men's World Cup competition id used by FIFA calendar APIs.
  return blob.includes('WORLD CUP') && (blob.includes('2026') || blob.includes('WORLD CUP 26') || blob.includes('CANADA') || blob.includes('MEXICO') || blob.includes('USA'));
}
function isFifaFinished(m){
  const s = plainKey(m.status);
  return ['PLAYED','FINISHED','FULL TIME','FULLTIME','FT','COMPLETED','RESULT','FINAL'].some(x => s.includes(x)) || s === '0' || s === '3';
}
function fifaNextPickMeta(stage){
  const s = plainKey(stage);
  if (s.includes('ROUND OF 32') || s.includes('LAST 32') || s.includes('32')) return { pickType:'round16', targetLabel:'Στους 16', verb:'στους 16' };
  if (s.includes('ROUND OF 16') || s.includes('LAST 16') || s.includes('16')) return { pickType:'quarters', targetLabel:'Στους 8', verb:'στους 8' };
  if (s.includes('QUARTER')) return { pickType:'semis', targetLabel:'Στους 4', verb:'στους 4' };
  if (s.includes('SEMI')) return { pickType:'finalists', targetLabel:'Τελικό', verb:'στον τελικό' };
  if (s.includes('THIRD') || s.includes('3RD') || s.includes('PLACE')) return { pickType:'thirdPlaces', targetLabel:'Νικητής μικρού τελικού', verb:'νικητή μικρού τελικού' };
  if (s.includes('FINAL')) return { pickType:'champions', targetLabel:'Πρωταθλητής', verb:'πρωταθλήτρια' };
  return { pickType:'round16', targetLabel:'Επόμενη φάση', verb:'στην επόμενη φάση' };
}
function formatFifaDate(d){
  if (!d) return '-';
  try { return new Intl.DateTimeFormat('el-GR', { dateStyle:'short', timeStyle:'short' }).format(d); }
  catch { return d.toLocaleString('el-GR'); }
}
function fifaUrlCandidates(){
  return CONFIG.fifa.apiUrls || (CONFIG.fifa.apiUrl ? [CONFIG.fifa.apiUrl] : []);
}
function proxiedUrls(url){
  return [
    { url, label:'FIFA direct' },
    { url:`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, label:'FIFA μέσω AllOrigins' },
    { url:`https://corsproxy.io/?${encodeURIComponent(url)}`, label:'FIFA μέσω corsproxy.io' }
  ];
}
async function fetchJsonWithTimeout(url, ms=12000){
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { cache:'no-store', signal:ctrl.signal, headers:{ 'Accept':'application/json,text/plain,*/*' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const txt = await res.text();
    if (txt.includes('<!DOCTYPE html') || txt.includes('<html')) throw new Error('HTML αντί για JSON');
    return JSON.parse(txt);
  } finally { clearTimeout(t); }
}
async function fetchFifaFixtures(){
  const errors = [];
  for (const baseUrl of fifaUrlCandidates()) {
    for (const source of proxiedUrls(baseUrl)) {
      const url = `${source.url}${source.url.includes('?') ? '&' : '?'}cacheBust=${Date.now()}`;
      try {
        const data = await fetchJsonWithTimeout(url);
        const arr = flattenMatchArray(data).map(normalizeFifaMatch).filter(m => m.home || m.away);
        const filtered = arr.filter(isWorldCup2026Match);
        const finalArr = (filtered.length ? filtered : arr)
          .sort((a,b) => (a.date?.getTime() || 0) - (b.date?.getTime() || 0));
        if (finalArr.length) {
          state.fifaSource = source.label;
          return finalArr;
        }
        errors.push(`${source.label}: δεν βρέθηκαν matches`);
      } catch (err) {
        errors.push(`${source.label}: ${err.message || err}`);
      }
    }
  }
  throw new Error(errors.slice(-3).join(' | ') || 'άγνωστο σφάλμα FIFA API');
}
function loadFifaFixtures(){
  state.fifaLoading = true;
  state.fifaError = '';
  state.fifaSource = '';
  fetchFifaFixtures().then(fixtures => {
    state.fifaFixtures = fixtures;
    state.fifaLoading = false;
    renderUpcomingPicks();
  }).catch(err => {
    state.fifaFixtures = [];
    state.fifaLoading = false;
    state.fifaError = err.message || String(err);
    renderUpcomingPicks();
  });
}
function upcomingFifaFixtures(){
  const now = new Date();
  const grace = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  return (state.fifaFixtures || [])
    .filter(m => (m.home || m.away) && !isFifaFinished(m) && (!m.date || m.date >= grace))
    .sort((a,b) => (a.date?.getTime() || 0) - (b.date?.getTime() || 0))
    .slice(0, 8);
}
function renderFifaUpcomingFixtures(){
  const el = $('upcomingPicks');
  const status = $('upcomingStatus');
  if (!el) return false;
  if (state.fifaLoading && !(state.fifaFixtures || []).length) {
    if (status) status.textContent = 'Φόρτωση επόμενων αγώνων από FIFA…';
    el.innerHTML = '<div class="empty-state">Φορτώνουν οι επόμενοι αγώνες από FIFA. Αν ο browser μπλοκάρει το FIFA API, θα γίνει αυτόματα δοκιμή μέσω proxy.</div>';
    return true;
  }
  const fixtures = upcomingFifaFixtures();
  if (!fixtures.length) {
    if (state.fifaError) {
      if (status) status.textContent = 'Δεν φορτώθηκαν επόμενοι αγώνες από FIFA.';
      el.innerHTML = `<div class="empty-state phase-note"><b>Δεν μπόρεσα να φορτώσω τα ματς από FIFA.</b><br>Σφάλμα: ${esc(state.fifaError)}<br>Άνοιξε το <a href="${CONFIG.fifa.pageUrl}" target="_blank" rel="noopener">επίσημο πρόγραμμα της FIFA</a> ή πάτησε ξανά «Ανανέωση FIFA».</div>`;
      return true;
    }
    return false;
  }
  const loaded = state.predictionStats?.loadedPlayers || CONFIG.players.filter(p => state.playerSheets[p]).length || CONFIG.players.length;
  if (status) status.textContent = `Επόμενοι αγώνες από FIFA: ${fixtures.length}${state.fifaSource ? ` · Πηγή: ${state.fifaSource}` : ''}. ${state.predictionStats ? `Φορτώθηκαν ${loaded}/${CONFIG.players.length} παίκτες.` : 'Φορτώνονται οι προβλέψεις παικτών…'}`;
  const cards = fixtures.map(f => {
    const meta = fifaNextPickMeta(f.stage);
    return {
      ...f,
      meta,
      aPlayers: state.predictionStats && f.home ? getPickPlayersForTeam(meta.pickType, f.home) : [],
      bPlayers: state.predictionStats && f.away ? getPickPlayersForTeam(meta.pickType, f.away) : []
    };
  });
  window.__fifaFixtures = cards;
  el.innerHTML = `<div class="empty-state phase-note">Τα επόμενα ματς έρχονται από FIFA. Οι μπάρες δείχνουν πόσοι παίκτες έχουν κάθε ομάδα να περνάει στην επόμενη φάση του δικού μας παιχνιδιού.</div>` +
    cards.map((f, idx) => {
      const max = Math.max(1, f.aPlayers.length, f.bPlayers.length);
      const option = (side, team, players) => {
        const count = players.length;
        const width = Math.max(5, count / max * 100);
        return `<button class="pick-option" onclick="openFifaFixtureModal(${idx},'${side}')"><div class="pick-option-top"><b>${esc(team || 'TBC')}</b><span>${state.predictionStats ? `${count}/${loaded}` : '…'}</span></div><small>το έχουν ${esc(f.meta.verb)}</small><div class="bar-track"><div class="bar-fill" style="width:${state.predictionStats ? width : 5}%"></div></div></button>`;
      };
      const place = [f.venue, f.city].filter(Boolean).join(' · ');
      const metaLine = [formatFifaDate(f.date), f.stage || 'Knockout', place].filter(Boolean).join(' · ');
      return `<div class="upcoming-card"><div class="upcoming-head"><div><div class="match-meta">${esc(metaLine)}</div><div class="match-title">${esc(f.home || 'TBC')} — ${esc(f.away || 'TBC')}</div></div><span class="upcoming-slot">${esc(f.meta.targetLabel)}</span></div><div class="pick-options">${option('A', f.home, f.aPlayers)}${option('B', f.away, f.bPlayers)}</div></div>`;
    }).join('');
  return true;
}
function openFifaFixtureModal(idx, side){
  const item = (window.__fifaFixtures || [])[idx];
  if (!item) return;
  const team = side === 'A' ? item.home : item.away;
  const players = side === 'A' ? item.aPlayers : item.bPlayers;
  const missed = CONFIG.players.filter(p => !players.includes(p)).sort((a,b)=>a.localeCompare(b,'el'));
  openModal(`<p class="small-title">${esc(item.stage || 'FIFA fixture')}</p><h2>${esc(item.home || 'TBC')} — ${esc(item.away || 'TBC')}</h2><p class="modal-sub">${esc(formatFifaDate(item.date))} · ${esc(team)} · ${players.length}/${CONFIG.players.length} παίκτες το έχουν ${esc(item.meta.verb)}</p><h3>Το έχουν</h3><div class="picker-grid">${players.map(p => `<button onclick="closeModal();selectPlayer('${esc(p)}')">${esc(p)}</button>`).join('') || '<em>Κανένας παίκτης.</em>'}</div><h3>Δεν το έχουν</h3><div class="picker-grid muted-grid">${missed.map(p => `<button onclick="closeModal();selectPlayer('${esc(p)}')">${esc(p)}</button>`).join('')}</div>`);
}
window.openFifaFixtureModal = openFifaFixtureModal;

function renderUpcomingPicks(){
  const el = $('upcomingPicks');
  if (!el) return;
  const status = $('upcomingStatus');
  if (renderFifaUpcomingFixtures()) return;
  const activeRound = activeProgressionRound();
  if (activeRound && renderKnockoutFixtures(activeRound)) return;
  if (activeRound && renderQualificationPicks(activeRound)) return;
  const unplayed = state.matches.filter(m => !isPlayedResult(m.result)).slice(0, 18);
  const loaded = CONFIG.players.filter(p => state.playerSheets[p]).length;
  if (status) status.textContent = loaded ? `Δείχνει τα επόμενα ${unplayed.length} ματς της Α’ φάσης · φορτώθηκαν ${loaded}/${CONFIG.players.length} παίκτες.` : 'Φορτώνονται τα φύλλα παικτών για να εμφανιστούν οι επιλογές 1/X/2.';
  if (!unplayed.length) { el.innerHTML = `<div class="empty-state">Δεν υπάρχουν επόμενα ματς για εμφάνιση.${state.fifaError ? ` Δεν φορτώθηκε το FIFA API: ${esc(state.fifaError)}.` : ''} Μπορείς πάντα να δεις το <a href="${CONFIG.fifa.pageUrl}" target="_blank" rel="noopener">επίσημο πρόγραμμα της FIFA</a>.</div>`; return; }
  if (!loaded) {
    el.innerHTML = unplayed.slice(0,6).map(m => `<div class="upcoming-card skeleton"><div><div class="match-meta">${esc(m.date)} · ${esc(m.group || '-')}</div><div class="match-title">${esc(m.match)}</div></div><div class="empty-state">Φόρτωση επιλογών…</div></div>`).join('');
    return;
  }
  window.__upcomingMatches = unplayed;
  el.innerHTML = unplayed.map((m,idx) => {
    const g = upcomingPickGroups(m);
    const total = CONFIG.players.length;
    const max = Math.max(g['1'].length, g['X'].length, g['2'].length, 1);
    const options = [['1','1'], ['X','X'], ['2','2']].map(([key,label]) => {
      const count = g[key].length;
      const width = Math.max(5, count / max * 100);
      return `<button class="pick-option" onclick="openUpcomingPickModal(${idx},'${key}')"><div class="pick-option-top"><b>${label}</b><span>${count}/${total}</span></div><div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div></button>`;
    }).join('');
    const missing = g.missing.length ? `<div class="upcoming-missing">Χωρίς αναγνωρίσιμη πρόβλεψη: ${g.missing.length}</div>` : '';
    return `<div class="upcoming-card"><div class="upcoming-head"><div><div class="match-meta">${esc(m.date)} · ${esc(m.time || '')} · ${esc(m.group || '-')}</div><div class="match-title">${esc(m.match)}</div></div><span class="upcoming-slot">${esc(m.slot || '')}</span></div><div class="pick-options">${options}</div>${missing}</div>`;
  }).join('');
}
function openUpcomingPickModal(idx, outcome){
  const match = (window.__upcomingMatches || [])[idx];
  if (!match) return;
  const groups = upcomingPickGroups(match);
  const players = groups[outcome] || [];
  const label = outcome === 'X' ? 'Ισοπαλία' : outcome === '1' ? 'Άσος' : 'Διπλό';
  openModal(`<p class="small-title">Upcoming Picks</p><h2>${esc(match.match)}</h2><p class="modal-sub">${esc(label)} · ${players.length}/${CONFIG.players.length} παίκτες</p><div class="picker-grid">${players.map(p => `<button onclick="closeModal();selectPlayer('${esc(p)}')">${esc(p)}</button>`).join('') || '<em>Δεν υπάρχει παίκτης σε αυτή την επιλογή.</em>'}</div>`);
}
window.openUpcomingPickModal = openUpcomingPickModal;
function renderProgressionResults(){
  const items = (state.progression || []).slice(-12).reverse();
  if (!items.length) {
    $('recentMatches').innerHTML = '<div class="empty-state">Δεν έχουν καταχωριστεί ακόμα προκρίσεις στη στήλη G.</div>';
    return;
  }
  $('recentMatches').innerHTML = items.map(x => `<div class="match-card"><div class="match-meta">${esc(x.round)} · ${esc(x.slot || '')}</div><div><div class="match-title">${esc(x.team)}</div><small>καταχώριση από στήλη G</small></div><div class="score-pill">✓</div></div>`).join('');
}
function renderRecentMatches(){
  const recent = state.matches.filter(m => isPlayedResult(m.result)).slice(-6).reverse();
  if (!recent.length && (state.progression || []).length) { renderProgressionResults(); return; }
  $('recentMatches').innerHTML = recent.map((m,idx) => {
    const hasSheets = Object.keys(state.playerSheets).length > 0;
    const ins = hasSheets ? matchInsights(m) : { exact:[], points:[] };
    return `<button class="match-card match-button" onclick="openMatchModal(${idx})"><div class="match-meta">${esc(m.date)} · ${esc(m.group || '-')}</div><div><div class="match-title">${esc(m.match)}</div><small>${hasSheets ? `${ins.points.length}/${CONFIG.players.length} σωστές προβλέψεις` : 'πατήστε μετά τη φόρτωση στατιστικών'}</small></div><div class="score-pill">${esc(m.result)}</div></button>`;
  }).join('');
  window.__recentMatches = recent;
}
function renderMatches() {
  const g = clean($('groupFilter').value);
  const rows = state.matches.filter(m => !g || m.group === g).slice(-12).reverse();
  renderRecentMatches();
}
function renderPlayerSelect() { $('playerSelect').innerHTML = '<option value="">Επιλογή παίκτη</option>' + state.leaderboard.map(p => `<option value="${esc(p.player)}">${esc(p.player)}</option>`).join(''); }

function renderBarList(containerId, entries, total, empty='Δεν υπάρχουν δεδομένα ακόμα.'){
  const el = $(containerId);
  if (!entries || !entries.length) { el.innerHTML = `<div class="empty-state">${esc(empty)}</div>`; return; }
  const max = Math.max(...entries.map(x=>x[1]), 1);
  el.innerHTML = entries.map(([label,count], idx)=>`<div class="bar-row">
    <div class="bar-rank">${idx+1}</div>
    <div class="bar-main"><div class="bar-label"><span>${esc(label)}</span><b>${count}/${total}</b></div><div class="bar-track"><div class="bar-fill" style="width:${Math.max(5,count/max*100)}%"></div></div></div>
  </div>`).join('');
}

function chartDataFromEntries(entries){
  return { labels: entries.map(x => x[0]), data: entries.map(x => x[1]) };
}
function makeChart(canvasId, entries, type='bar'){
  const canvas = $(canvasId);
  if (!canvas || typeof Chart === 'undefined') return;
  if (charts[canvasId]) charts[canvasId].destroy();
  const d = chartDataFromEntries(entries);
  charts[canvasId] = new Chart(canvas, {
    type,
    data: { labels: d.labels, datasets: [{ label: 'Επιλογές', data: d.data, borderWidth: 1, borderRadius: 10 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: type === 'bar' ? 'y' : 'x',
      plugins: { legend: { display:false }, tooltip: { callbacks: { label: ctx => `${ctx.parsed.x ?? ctx.parsed.y} επιλογές` } } },
      scales: {
        x: { ticks: { color:'#c8d7ee', precision:0 }, grid: { color:'rgba(255,255,255,.08)' } },
        y: { ticks: { color:'#c8d7ee' }, grid: { color:'rgba(255,255,255,.05)' } }
      }
    }
  });
}
function pct(count, total){ return total ? Math.round((count / total) * 100) : 0; }
function renderConsensusCards(){
  if (!state.predictionStats) return;
  const { maps, loadedPlayers } = state.predictionStats;
  const champion = topEntries(maps.champions,1)[0];
  const scorer = topEntries(maps.scorers,1)[0];
  const finalist = topEntries(maps.finalists,1)[0];
  const semi = topEntries(maps.semis,1)[0];
  const cards = [
    ['🏆', 'Consensus champion', champion ? `${champion[0]}` : '-', champion ? `${champion[1]}/${loadedPlayers} παίκτες · ${pct(champion[1], loadedPlayers)}%` : ''],
    ['⚽', 'Consensus top scorer', scorer ? `${scorer[0]}` : '-', scorer ? `${scorer[1]}/${loadedPlayers} παίκτες · ${pct(scorer[1], loadedPlayers)}%` : ''],
    ['🥇', 'Most common finalist', finalist ? `${finalist[0]}` : '-', finalist ? `${finalist[1]}/${loadedPlayers*2} επιλογές τελικού` : ''],
    ['🔥', 'Strongest semi pick', semi ? `${semi[0]}` : '-', semi ? `${semi[1]}/${loadedPlayers*4} επιλογές ημιτελικών` : '']
  ];
  const el = $('consensusCards');
  if (el) el.innerHTML = cards.map(([icon,label,value,note]) => `<div class="consensus-card"><div class="consensus-icon">${icon}</div><div><p>${esc(label)}</p><h3>${esc(value)}</h3><small>${esc(note)}</small></div></div>`).join('');
}
function renderDarkHorses(){
  const el = $('darkHorses');
  if (!el || !state.predictionStats) return;
  const { maps } = state.predictionStats;
  const allChampions = [...maps.champions.entries()].sort((a,b)=>a[1]-b[1] || a[0].localeCompare(b[0], 'el')).filter(x => x[1] <= 2);
  const rareSemis = [...maps.semis.entries()].sort((a,b)=>a[1]-b[1] || a[0].localeCompare(b[0], 'el')).filter(x => x[1] <= 3).slice(0,8);
  el.innerHTML = `<div class="dark-card"><p class="small-title">Dark horses</p><h3>Λιγότερο δημοφιλείς αλλά ζωντανές επιλογές</h3><div class="chip-list">${allChampions.slice(0,8).map(([x,c])=>`<span>${esc(x)} · ${c}</span>`).join('') || '<em>Δεν υπάρχουν σπάνιες επιλογές πρωταθλήτριας.</em>'}</div></div>` +
    `<div class="dark-card"><p class="small-title">Rare semi-final picks</p><h3>Ομάδες που λίγοι βλέπουν στους 4</h3><div class="chip-list">${rareSemis.map(([x,c])=>`<span>${esc(x)} · ${c}</span>`).join('') || '<em>Δεν υπάρχουν σπάνιες επιλογές ημιτελικών.</em>'}</div></div>`;
}
function renderPredictionStats(){
  if (!state.predictionStats) return;
  const { maps, loadedPlayers } = state.predictionStats;
  const championEntries = topEntries(maps.champions, 8);
  const scorerEntries = topEntries(maps.scorers, 40); // δείχνουμε ΟΛΕΣ τις επιλογές 1ου σκόρερ, όχι μόνο Top 8
  const finalPairEntries = topEntries(maps.finalPairs, 8);
  const semiEntries = topEntries(maps.semis, 10);
  const quarterEntries = topEntries(maps.quarters, 10);
  renderBarList('championStats', championEntries, loadedPlayers);
  renderBarList('scorerStats', scorerEntries, loadedPlayers);
  renderBarList('finalStats', finalPairEntries, loadedPlayers, 'Δεν έχουν συμπληρωθεί ζευγάρια τελικού.');
  renderBarList('finalistStats', topEntries(maps.finalists, 10), loadedPlayers * 2);
  renderBarList('semiStats', semiEntries, loadedPlayers * 4);
  renderBarList('quarterStats', quarterEntries, loadedPlayers * 8);
  makeChart('championChart', championEntries);
  makeChart('scorerChart', scorerEntries.slice(0, 12));
  makeChart('finalChart', finalPairEntries);
  makeChart('semiChart', semiEntries);
  makeChart('quarterChart', quarterEntries);
  renderConsensusCards();
  renderDarkHorses();
  renderExplorer();
  renderRecentMatches();
  renderQuickStats();
  renderUpcomingPicks();
}


function renderExplorer(){
  const el = $('explorerList');
  if (!el || !state.predictionStats) return;
  const type = $('explorerType')?.value || 'champions';
  const entries = topEntries(state.predictionStats.maps[type], 40);
  const total = type === 'finalists' ? state.predictionStats.loadedPlayers * 2 : type === 'semis' ? state.predictionStats.loadedPlayers * 4 : type === 'quarters' ? state.predictionStats.loadedPlayers * 8 : state.predictionStats.loadedPlayers;
  el.innerHTML = entries.map(([label,count]) => `<button class="pick-card" onclick="openPickModal('${type}','${esc(label)}')"><div><strong>${esc(label)}</strong><small>${count}/${total} επιλογές</small></div><span>Ποιοι; ›</span></button>`).join('') || '<div class="empty-state">Δεν υπάρχουν δεδομένα.</div>';
}
function openModal(html){ $('modalContent').innerHTML = html; $('modal').classList.remove('hidden'); }
function closeModal(){ $('modal').classList.add('hidden'); }
window.closeModal = closeModal;
function openPickModal(type, label){
  const pickers = state.predictionStats?.picks?.[type]?.get(label) || [];
  openModal(`<p class="small-title">Prediction Explorer</p><h2>${esc(label)}</h2><p class="modal-sub">${pickers.length} παίκτες</p><div class="picker-grid">${pickers.map(p => `<button onclick="closeModal();selectPlayer('${esc(p)}')">${esc(p)}</button>`).join('') || '<em>Δεν βρέθηκαν παίκτες.</em>'}</div>`);
}
window.openPickModal = openPickModal;
function openPlayerModal(player){
  const a = state.predictionStats?.analytics?.find(x => x.player === player);
  const lb = state.leaderboard.find(x => x.player === player);
  if (!a) { selectPlayer(player); return; }
  openModal(`<p class="small-title">Player profile</p><h2>👤 ${esc(player)}</h2><div class="mini-profile"><div><span>Θέση</span><b>${lb ? '#'+lb.rank : '-'}</b></div><div><span>Βαθμοί</span><b>${lb ? lb.points : '-'}</b></div><div><span>Πρωταθλήτρια</span><b>${esc(a.champion || '-')}</b></div><div><span>1ος σκόρερ</span><b>${esc(a.scorer || '-')}</b></div></div>${profileAnalyticsHtml(player,a)}<button onclick="closeModal();selectPlayer('${esc(player)}')">Άνοιγμα αναλυτικού προφίλ</button>`);
}
window.openPlayerModal = openPlayerModal;
function openMatchModal(idx){
  const m = (window.__recentMatches || [])[idx];
  if (!m) return;
  const ins = matchInsights(m);
  const best = ins.points.sort((a,b)=>b.pts-a.pts || a.player.localeCompare(b.player,'el')).slice(0,20);
  openModal(`<p class="small-title">Match insights</p><h2>${esc(m.match)}</h2><div class="score-big">${esc(m.result || '-')}</div><div class="mini-profile"><div><span>Σωστές προβλέψεις</span><b>${ins.points.length}/${CONFIG.players.length}</b></div><div><span>Αποτέλεσμα</span><b>${esc(normalizeOutcome(m.result) || '-')}</b></div><div><span>Όμιλος</span><b>${esc(m.group || '-')}</b></div><div><span>Ημερομηνία</span><b>${esc(m.date || '-')}</b></div></div><h3>Παίκτες με σωστή πρόβλεψη</h3><div class="picker-grid">${best.map(x=>`<button onclick="closeModal();selectPlayer('${esc(x.player)}')">${esc(x.player)} · ${x.pts} pts · πρόβλεψη ${esc(x.pred)}</button>`).join('') || '<em>Τα insights θα εμφανιστούν όταν φορτωθούν τα φύλλα παικτών.</em>'}</div>`);
}
window.openMatchModal = openMatchModal;

function profileAnalyticsHtml(sheetName, analytics){
  if (!analytics) return '';
  return `<div class="prediction-cards">
    <div><span>🏆 Πρωταθλήτρια</span><b>${esc(analytics.champion || '-')}</b></div>
    <div><span>⚽ 1ος σκόρερ</span><b>${esc(analytics.scorer || '-')}</b></div>
    <div><span>🏁 Τελικός</span><b>${esc(analytics.finalPair || '-')}</b></div>
    <div><span>🥉 Μικρός τελικός</span><b>${esc(analytics.thirdPlace || '-')}</b></div>
    <div><span>🔥 Ημιτελικά</span><b>${esc(analytics.semiFinalists.join(', ') || '-')}</b></div>
    <div><span>🎯 Στους 8</span><b>${esc(analytics.quarterFinalists.join(', ') || '-')}</b></div>
  </div>`;
}

async function renderPlayer(sheetName) {
  if (!sheetName) { $('playerBox').textContent = 'Διάλεξε παίκτη για να δεις τις προβλέψεις του.'; return; }
  $('playerBox').innerHTML = 'Φόρτωση προβλέψεων…';
  const lb = state.leaderboard.find(x=>x.player===sheetName);
  try {
    const rows = state.playerSheets[sheetName] || await fetchSheet(sheetName);
    state.playerSheets[sheetName] = rows;
    const analytics = parsePlayerAnalytics(sheetName, rows);
    const body = [];
    for (let i = 2; i < rows.length; i++) {
      const r = rows[i] || [];
      const match = clean(r[0]), pred = clean(r[1]), pts = clean(r[2]);
      const slot = clean(r[3]), team = clean(r[4]), progPts = clean(r[5]);
      if (match || pred || team) body.push({ match, pred, pts, slot, team, progPts });
    }
    const scored = body.filter(x => x.pts && !isNaN(Number(x.pts))).length;
    const totalPts = body.reduce((s,x)=>s+(Number(x.pts)||0)+(Number(x.progPts)||0),0);
    $('playerBox').innerHTML = `<div class="player-profile"><div class="profile-stat"><div>Παίκτης</div><strong>${esc(sheetName)}</strong></div><div class="profile-stat"><div>Θέση</div><strong>${lb ? '#'+lb.rank : '-'}</strong></div><div class="profile-stat"><div>Βαθμοί</div><strong>${lb ? lb.points : totalPts}</strong></div><div class="profile-stat"><div>Βαθμολογημένες προβλέψεις</div><strong>${scored}</strong></div></div>${profileAnalyticsHtml(sheetName, analytics)}<div class="table-wrap"><table><thead><tr><th>Αγώνας</th><th>Πρόβλεψη</th><th>Πόντοι</th><th>Θέση</th><th>Ομάδα</th><th>Πόντοι</th></tr></thead><tbody>` +
      body.map(x => `<tr><td>${esc(x.match)}</td><td>${esc(x.pred)}</td><td class="points">${esc(x.pts)}</td><td>${esc(x.slot)}</td><td>${esc(x.team)}</td><td class="points">${esc(x.progPts)}</td></tr>`).join('') + `</tbody></table></div>`;
  } catch (err) { $('playerBox').innerHTML = `<span class="warn">${esc(err.message)}</span><br>Έλεγξε ότι το συγκεκριμένο φύλλο είναι δημοσιευμένο στο web.`; }
}

function selectPlayer(player){
  $('playerSelect').value = player;
  renderPlayer(player);
  document.getElementById('players').scrollIntoView({ behavior:'smooth', block:'start' });
}
window.selectPlayer = selectPlayer;

async function load() {
  $('status').textContent = 'Φόρτωση δεδομένων από Google Sheets…';
  try {
    const rows = await fetchSheet(CONFIG.resultsSheet);
    Object.assign(state, parseResults(rows));
    loadFifaFixtures();
    renderCards(); renderPodium(); renderTopTen(); renderMovers(); renderLeaderboard(); renderGroupFilter(); renderMatches(); renderPlayerSelect(); renderQuickStats(); renderUpcomingPicks();
    $('status').textContent = `Τελευταία ενημέρωση: ${new Date().toLocaleString('el-GR')}`;
    loadPredictionStats(false).catch(err => { $('statsStatus').innerHTML = `<span class="warn">Δεν φορτώθηκαν τα στατιστικά: ${esc(err.message)}</span>`; });
  } catch (err) { $('status').innerHTML = `<span class="warn">${esc(err.message)}</span><br>Πιθανή αιτία: το Google Sheet δεν είναι δημοσιευμένο, άλλαξε το gid του φύλλου «ΑΠΟΤΕΛΕΣΜΑΤΑ», ή το φύλλο δεν επιστρέφει CSV.`; }
}

$('refreshBtn').addEventListener('click', () => { state.predictionStats = null; load(); });
$('statsRefreshBtn').addEventListener('click', () => { state.predictionStats = null; loadPredictionStats(true); });
$('upcomingRefreshBtn')?.addEventListener('click', () => { state.predictionStats = null; loadFifaFixtures(); loadPredictionStats(true); });
$('playerSearch').addEventListener('input', renderLeaderboard);
$('groupFilter').addEventListener('change', renderMatches);
$('playerSelect').addEventListener('change', e => renderPlayer(e.target.value));
$('explorerType').addEventListener('change', renderExplorer);
load();
