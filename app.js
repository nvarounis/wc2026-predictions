const CONFIG = {
  spreadsheetId: '1nPgDATdA6U3_OHBuJwrXQcOWT0Lq9dU25QkpdlPDE1g',
  resultsSheet: 'ΑΠΟΤΕΛΕΣΜΑΤΑ',
  ignoredSheets: ['stats', 'stats2', 'stats-2', 'ΚΑΝΟΝΙΣΜΟΙ'],
  players: [
    'ΑΝΑΣΤΑΣΙΑΔΗΣ','ΑΡΒΑΝΙΤΟΠΟΥΛΟΣ','ΒΑΡΟΥΝΗΣ','ΒΕΛΟΥΔΟΣ 1','ΒΕΛΟΥΔΟΣ 2','ΓΚΟΥΛΟΥΣΗΣ Ν','ΓΚΟΥΛΟΥΣΗΣ Χ','ΔΗΜΑ','ΖΑΪΡΗΣ Γ','ΖΑΪΡΗΣ Ν','ΖΙΑΚΑΣ','ΗΛΙΟΠΟΥΛΟΣ','ΚΑΤΣΑΪΤΗΣ','ΚΕΛΛΑΡΗΣ Β','ΚΕΛΛΑΡΗΣ Δ','ΚΟΥΤΟΥΛΑΣ','ΚΟΥΤΣΟΥΦΛΑΚΗΣ','ΛΟΥΒΙΤΑΚΗΣ','ΜΑΡ','ΜΗΛΑΣ','ΝΤΑΒΛΟΥΡΟΣ','ΠΡΟΕΣΤΟΣ','ΣΒΟΛΟΠΟΥΛΟΣ Λ','ΣΒΟΛΟΠΟΥΛΟΣ Π','ΣΒΟΛΟΠΟΥΛΟΣ Τ','ΣΚΙΑΣ','ΣΚΟΥΡΤΑΣ Γ','ΣΚΟΥΡΤΑΣ Φ','ΣΦΗΚΑΣ','ΤΡΙΑΝΤΑΦΥΛΛΑΚΗΣ','ΤΣΟΓΚΑΣ','ΧΑΤΖΗΤΙΜΠΑΣ'
  ]
};

const $ = id => document.getElementById(id);
let state = { matches: [], leaderboard: [] };

function clean(v) { return (v ?? '').toString().replace(/\uFEFF/g, '').trim(); }
function esc(v) { return clean(v).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
function isIgnored(name) { return CONFIG.ignoredSheets.map(x => x.toLowerCase()).includes(clean(name).toLowerCase()); }

function csvUrl(sheetName) {
  const base = `https://docs.google.com/spreadsheets/d/${CONFIG.spreadsheetId}/gviz/tq`;
  const params = new URLSearchParams({ tqx: 'out:csv', sheet: sheetName, cacheBust: Date.now().toString() });
  return `${base}?${params.toString()}`;
}

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (ch === '"') {
      if (inQuotes && next === '"') { cell += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      row.push(cell); cell = '';
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && next === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else {
      cell += ch;
    }
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

  // Στο αρχείο σου η καθαρή τελική κατάταξη βρίσκεται στις στήλες R:T.
  // Αν λείπει, γίνεται fallback στις στήλες I:K.
  let leaderboard = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const rank = clean(r[17]), player = clean(r[18]), points = clean(r[19]);
    if (rank && player && !isIgnored(player)) leaderboard.push({ rank, player, points: Number(points) || 0 });
  }
  if (!leaderboard.length) {
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i] || [];
      const rank = clean(r[8]), player = clean(r[9]), points = clean(r[10]);
      if (rank && player && !isIgnored(player)) leaderboard.push({ rank, player, points: Number(points) || 0 });
    }
  }
  leaderboard = leaderboard
    .filter(x => CONFIG.players.includes(x.player))
    .sort((a, b) => (Number(a.rank) || 999) - (Number(b.rank) || 999));
  return { matches, leaderboard };
}

function renderCards() {
  const played = state.matches.filter(m => m.result).length;
  const top = state.leaderboard[0];
  const maxPoints = Math.max(0, ...state.leaderboard.map(x => x.points));
  const groups = new Set(state.matches.map(m => m.group).filter(Boolean)).size;
  $('summaryCards').innerHTML = [
    ['Παίκτες', state.leaderboard.length || CONFIG.players.length],
    ['Αγώνες με αποτέλεσμα', played],
    ['Όμιλοι', groups],
    ['Πρώτος', top ? `${top.player} · ${maxPoints}` : '-']
  ].map(([label, value]) => `<div class="card"><div class="label">${label}</div><div class="value">${esc(value)}</div></div>`).join('');
}

function renderPodium() {
  const [first, second, third] = state.leaderboard;
  const card = (x, medal, cls='') => x ? `<div class="podium-card ${cls}"><div class="medal">${medal}</div><div class="podium-name">${esc(x.player)}</div><div class="podium-points">${esc(x.points)} βαθμοί</div></div>` : '';
  $('podium').innerHTML = card(second, '🥈') + card(first, '🥇', 'first') + card(third, '🥉');
}

function renderLeaderboard() {
  const q = clean($('playerSearch').value).toLowerCase();
  const rows = state.leaderboard.filter(x => x.player.toLowerCase().includes(q));
  $('leaderboardTable').innerHTML = `<thead><tr><th>Θέση</th><th>Παίκτης</th><th>Βαθμοί</th></tr></thead><tbody>` +
    rows.map(x => `<tr><td class="rank">#${esc(x.rank)}</td><td class="player-name">${esc(x.player)}</td><td class="points">${esc(x.points)}</td></tr>`).join('') +
    `</tbody>`;
}

function renderGroupFilter() {
  const groups = [...new Set(state.matches.map(m => m.group).filter(Boolean))].sort((a,b)=>a.localeCompare(b, 'el'));
  $('groupFilter').innerHTML = '<option value="">Όλοι οι όμιλοι</option>' + groups.map(g => `<option value="${esc(g)}">${esc(g)}</option>`).join('');
}

function renderMatches() {
  const g = clean($('groupFilter').value);
  const rows = state.matches.filter(m => !g || m.group === g);
  $('matchesTable').innerHTML = `<thead><tr><th>Ημερομηνία</th><th>Ώρα</th><th>Όμιλος</th><th>Αγώνας</th><th>Αποτέλεσμα</th><th>Θέση</th></tr></thead><tbody>` +
    rows.map(m => `<tr><td>${esc(m.date)}</td><td>${esc(m.time)}</td><td><span class="badge">${esc(m.group || '-')}</span></td><td>${esc(m.match)}</td><td class="result">${esc(m.result || '-')}</td><td>${esc(m.slot || '')}</td></tr>`).join('') +
    `</tbody>`;
}

function renderPlayerSelect() {
  $('playerSelect').innerHTML = '<option value="">Επιλογή παίκτη</option>' + CONFIG.players.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('');
}

async function renderPlayer(sheetName) {
  if (!sheetName) { $('playerBox').textContent = 'Διάλεξε παίκτη για να δεις τις προβλέψεις του.'; return; }
  $('playerBox').innerHTML = 'Φόρτωση προβλέψεων…';
  try {
    const rows = await fetchSheet(sheetName);
    const body = [];
    for (let i = 2; i < rows.length; i++) {
      const r = rows[i] || [];
      const match = clean(r[0]), pred = clean(r[1]), pts = clean(r[2]);
      const slot = clean(r[3]), team = clean(r[4]), progPts = clean(r[5]);
      if (match || pred || team) body.push({ match, pred, pts, slot, team, progPts });
    }
    $('playerBox').innerHTML = `<div class="table-wrap"><table><thead><tr><th>Αγώνας</th><th>Πρόβλεψη</th><th>Πόντοι</th><th>Θέση</th><th>Ομάδα</th><th>Πόντοι</th></tr></thead><tbody>` +
      body.map(x => `<tr><td>${esc(x.match)}</td><td>${esc(x.pred)}</td><td class="points">${esc(x.pts)}</td><td>${esc(x.slot)}</td><td>${esc(x.team)}</td><td class="points">${esc(x.progPts)}</td></tr>`).join('') +
      `</tbody></table></div>`;
  } catch (err) {
    $('playerBox').innerHTML = `<span class="warn">${esc(err.message)}</span><br>Έλεγξε ότι το συγκεκριμένο φύλλο είναι δημοσιευμένο στο web.`;
  }
}

async function load() {
  $('status').textContent = 'Φόρτωση δεδομένων από Google Sheets…';
  try {
    const rows = await fetchSheet(CONFIG.resultsSheet);
    Object.assign(state, parseResults(rows));
    renderCards(); renderPodium(); renderLeaderboard(); renderGroupFilter(); renderMatches(); renderPlayerSelect();
    $('status').textContent = `Τελευταία ενημέρωση: ${new Date().toLocaleString('el-GR')}`;
  } catch (err) {
    $('status').innerHTML = `<span class="warn">${esc(err.message)}</span><br>Πιθανή αιτία: το Google Sheet δεν έχει γίνει Publish to web ή το φύλλο «ΑΠΟΤΕΛΕΣΜΑΤΑ» δεν είναι δημοσιευμένο.`;
  }
}

$('refreshBtn').addEventListener('click', load);
$('playerSearch').addEventListener('input', renderLeaderboard);
$('groupFilter').addEventListener('change', renderMatches);
$('playerSelect').addEventListener('change', e => renderPlayer(e.target.value));
load();
