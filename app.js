const CONFIG = {
  spreadsheetId: '1nPgDATdA6U3_OHBuJwrXQcOWT0Lq9dU25QkpdlPDE1g',
  resultsSheet: 'ΑΠΟΤΕΛΕΣΜΑΤΑ',
  ignoredSheets: ['stats', 'stats2', 'stats-2', 'ΚΑΝΟΝΙΣΜΟΙ'],
  players: [
    'ΑΝΑΣΤΑΣΙΑΔΗΣ','ΑΡΒΑΝΙΤΟΠΟΥΛΟΣ','ΒΑΡΟΥΝΗΣ','ΒΕΛΟΥΔΟΣ 1','ΒΕΛΟΥΔΟΣ 2','ΓΚΟΥΛΟΥΣΗΣ Ν','ΓΚΟΥΛΟΥΣΗΣ Χ','ΔΗΜΑ','ΖΑΪΡΗΣ Γ','ΖΑΪΡΗΣ Ν','ΖΙΑΚΑΣ','ΗΛΙΟΠΟΥΛΟΣ','ΚΑΤΣΑΪΤΗΣ','ΚΕΛΛΑΡΗΣ Β','ΚΕΛΛΑΡΗΣ Δ','ΚΟΥΤΟΥΛΑΣ','ΚΟΥΤΣΟΥΦΛΑΚΗΣ','ΛΟΥΒΙΤΑΚΗΣ','ΜΑΡ','ΜΗΛΑΣ','ΝΤΑΒΛΟΥΡΟΣ','ΠΡΟΕΣΤΟΣ','ΣΒΟΛΟΠΟΥΛΟΣ Λ','ΣΒΟΛΟΠΟΥΛΟΣ Π','ΣΒΟΛΟΠΟΥΛΟΣ Τ','ΣΚΙΑΣ','ΣΚΟΥΡΤΑΣ Γ','ΣΚΟΥΡΤΑΣ Φ','ΣΦΗΚΑΣ','ΤΡΙΑΝΤΑΦΥΛΛΑΚΗΣ','ΤΣΟΓΚΑΣ','ΧΑΤΖΗΤΙΜΠΑΣ'
  ]
};

const $ = id => document.getElementById(id);
let state = { matches: [], leaderboard: [], predictionStats: null, playerSheets: {} };

function clean(v) { return (v ?? '').toString().replace(/\uFEFF/g, '').trim(); }
function esc(v) { return clean(v).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
function isIgnored(name) { return CONFIG.ignoredSheets.map(x => x.toLowerCase()).includes(clean(name).toLowerCase()); }
function initials(name){ return clean(name).split(/\s+/).slice(0,2).map(x=>x[0]).join(''); }
function medal(rank){ return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`; }
function norm(v){ return clean(v).replace(/\s+/g,' ').replace(/\.$/,'').toUpperCase(); }
function validPick(v){ const x = clean(v); return x && x !== '-' && x.toLowerCase() !== 'none'; }

function csvUrl(sheetName) {
  const base = `https://docs.google.com/spreadsheets/d/${CONFIG.spreadsheetId}/gviz/tq`;
  const params = new URLSearchParams({ tqx: 'out:csv', sheet: sheetName, cacheBust: Date.now().toString() });
  return `${base}?${params.toString()}`;
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
  const res = await fetch(csvUrl(sheetName), { cache: 'no-store' });
  if (!res.ok) throw new Error(`Δεν μπόρεσα να διαβάσω το φύλλο «${sheetName}».`);
  const text = await res.text();
  if (text.includes('<!DOCTYPE html') || text.includes('<html')) throw new Error(`Το Google Sheet δεν επιστρέφει CSV για το φύλλο «${sheetName}».`);
  return parseCsv(text);
}

function parseResults(rows) {
  const matches = [];
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i] || [];
    const date = clean(r[0]), time = clean(r[1]), group = clean(r[2]), match = clean(r[3]), result = clean(r[4]), slot = clean(r[5]);
    if (match && !match.toUpperCase().includes('ΒΑΘΜΟΛΟΓΙΑ')) matches.push({ date, time, group, match, result, slot });
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
  return { matches, leaderboard };
}

function addCount(map, key){ if (validPick(key)) map.set(clean(key), (map.get(clean(key)) || 0) + 1); }
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

function parsePlayerAnalytics(player, rows){
  const champion = findPick(rows, ['ΝΙΚΗΤΗΣ']);
  const scorer = findPick(rows, ['1ος ΣΚΟΡΕΡ', '1ΟΣ ΣΚΟΡΕΡ']);
  const finalists = picksByLabels(rows, ['ΝΗΜ 1', 'ΝΗΜ 2']);
  const semiFinalists = picksBySection(rows, 'ΣΤΟΥΣ 4', 'ΜΙΚΡΟΣ ΤΕΛΙΚΟΣ');
  const quarterFinalists = picksBySection(rows, 'ΣΤΟΥΣ 8', 'ΣΤΟΥΣ 4');
  const finalPair = finalists.length >= 2 ? finalPairLabel(finalists[0], finalists[1]) : '';
  const thirdPlace = findPick(rows, ['ΝΙΚΗΤΗΣ ΜΙΚΡΟΥ ΤΕΛΙΚΟΥ']);
  return { player, champion, scorer, finalists, finalPair, semiFinalists, quarterFinalists, thirdPlace };
}

function aggregateAnalytics(analytics){
  const maps = { champions:new Map(), scorers:new Map(), finalists:new Map(), finalPairs:new Map(), semis:new Map(), quarters:new Map(), thirdPlaces:new Map() };
  for (const a of analytics) {
    addCount(maps.champions, a.champion);
    addCount(maps.scorers, a.scorer);
    addCount(maps.finalPairs, a.finalPair);
    addCount(maps.thirdPlaces, a.thirdPlace);
    a.finalists.forEach(x => addCount(maps.finalists, x));
    a.semiFinalists.forEach(x => addCount(maps.semis, x));
    a.quarterFinalists.forEach(x => addCount(maps.quarters, x));
  }
  return { analytics, maps, loadedPlayers: analytics.length };
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
  const played = state.matches.filter(m => m.result).length;
  const top = state.leaderboard[0];
  const maxPoints = Math.max(0, ...state.leaderboard.map(x => x.points));
  const groups = new Set(state.matches.map(m => m.group).filter(Boolean)).size;
  if ($('sidePlayed')) $('sidePlayed').textContent = played;
  $('summaryCards').innerHTML = [
    ['Παίκτες', state.leaderboard.length || CONFIG.players.length],
    ['Αγώνες με αποτέλεσμα', played],
    ['Όμιλοι', groups],
    ['Πρώτος', top ? `${top.player} · ${maxPoints}` : '-']
  ].map(([label, value]) => `<div class="card"><div class="label">${label}</div><div class="value">${esc(value)}</div></div>`).join('');
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

function renderQuickStats(){
  const played = state.matches.filter(m=>m.result).length;
  const top = state.leaderboard[0];
  const tiedFirst = state.leaderboard.filter(x => top && x.points === top.points).length;
  const stats = state.predictionStats;
  const favChampion = stats ? topEntries(stats.maps.champions, 1)[0] : null;
  $('quickStats').innerHTML = [
    ['Αγώνες', `${played}/${state.matches.length}`],
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
    rows.map((x) => `<tr><td class="rank">${medal(x.rank)}</td><td class="player-name"><button class="link-btn" onclick="selectPlayer('${esc(x.player)}')">${esc(x.player)}</button></td><td class="points">${esc(x.points)}</td><td class="diff">${x.points - leader}</td><td><div class="bar-track"><div class="bar-fill" style="width:${Math.max(4, x.points/max*100)}%"></div></div></td></tr>`).join('') + `</tbody>`;
}

function renderGroupFilter() {
  const groups = [...new Set(state.matches.map(m => m.group).filter(Boolean))].sort((a,b)=>a.localeCompare(b, 'el'));
  $('groupFilter').innerHTML = '<option value="">Όλοι οι όμιλοι</option>' + groups.map(g => `<option value="${esc(g)}">${esc(g)}</option>`).join('');
}
function renderRecentMatches(){
  const recent = state.matches.filter(m => m.result).slice(-6).reverse();
  $('recentMatches').innerHTML = recent.map(m => `<div class="match-card"><div class="match-meta">${esc(m.date)} · ${esc(m.group || '-')}</div><div class="match-title">${esc(m.match)}</div><div class="score-pill">${esc(m.result)}</div></div>`).join('');
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

function renderPredictionStats(){
  if (!state.predictionStats) return;
  const { maps, loadedPlayers } = state.predictionStats;
  renderBarList('championStats', topEntries(maps.champions, 8), loadedPlayers);
  renderBarList('scorerStats', topEntries(maps.scorers, 8), loadedPlayers);
  renderBarList('finalStats', topEntries(maps.finalPairs, 8), loadedPlayers, 'Δεν έχουν συμπληρωθεί ζευγάρια τελικού.');
  renderBarList('finalistStats', topEntries(maps.finalists, 10), loadedPlayers * 2);
  renderBarList('semiStats', topEntries(maps.semis, 12), loadedPlayers * 4);
  renderBarList('quarterStats', topEntries(maps.quarters, 12), loadedPlayers * 8);
  renderQuickStats();
}

function profileAnalyticsHtml(sheetName, analytics){
  if (!analytics) return '';
  return `<div class="prediction-cards">
    <div><span>🏆 Πρωταθλήτρια</span><b>${esc(analytics.champion || '-')}</b></div>
    <div><span>⚽ 1ος σκόρερ</span><b>${esc(analytics.scorer || '-')}</b></div>
    <div><span>🏁 Τελικός</span><b>${esc(analytics.finalPair || '-')}</b></div>
    <div><span>🔥 Ημιτελικά</span><b>${esc(analytics.semiFinalists.join(', ') || '-')}</b></div>
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
    renderCards(); renderPodium(); renderTopTen(); renderLeaderboard(); renderGroupFilter(); renderMatches(); renderPlayerSelect(); renderQuickStats();
    $('status').textContent = `Τελευταία ενημέρωση: ${new Date().toLocaleString('el-GR')}`;
    loadPredictionStats(false).catch(err => { $('statsStatus').innerHTML = `<span class="warn">Δεν φορτώθηκαν τα στατιστικά: ${esc(err.message)}</span>`; });
  } catch (err) { $('status').innerHTML = `<span class="warn">${esc(err.message)}</span><br>Πιθανή αιτία: το Google Sheet δεν έχει γίνει Publish to web ή το φύλλο «ΑΠΟΤΕΛΕΣΜΑΤΑ» δεν είναι δημοσιευμένο.`; }
}

$('refreshBtn').addEventListener('click', () => { state.predictionStats = null; load(); });
$('statsRefreshBtn').addEventListener('click', () => { state.predictionStats = null; loadPredictionStats(true); });
$('playerSearch').addEventListener('input', renderLeaderboard);
$('groupFilter').addEventListener('change', renderMatches);
$('playerSelect').addEventListener('change', e => renderPlayer(e.target.value));
load();
