const CONFIG = {
  spreadsheetId: '1nPgDATdA6U3_OHBuJwrXQcOWT0Lq9dU25QkpdlPDE1g',
  resultsSheet: 'ΑΠΟΤΕΛΕΣΜΑΤΑ',
  ignoredSheets: ['stats', 'stats-2'],
  players: [
    'ΑΝΑΣΤΑΣΙΑΔΗΣ','ΑΡΒΑΝΙΤΟΠΟΥΛΟΣ','ΒΑΡΟΥΝΗΣ','ΒΕΛΟΥΔΟΣ 1','ΒΕΛΟΥΔΟΣ 2','ΓΚΟΥΛΟΥΣΗΣ Ν','ΓΚΟΥΛΟΥΣΗΣ Χ','ΔΗΜΑ','ΖΑΪΡΗΣ Γ','ΖΑΪΡΗΣ Ν','ΖΙΑΚΑΣ','ΗΛΙΟΠΟΥΛΟΣ','ΚΑΤΣΑΪΤΗΣ','ΚΕΛΛΑΡΗΣ Β','ΚΕΛΛΑΡΗΣ Δ','ΚΟΥΤΟΥΛΑΣ','ΚΟΥΤΣΟΥΦΛΑΚΗΣ','ΛΟΥΒΙΤΑΚΗΣ','ΜΑΡ','ΜΗΛΑΣ','ΝΤΑΒΛΟΥΡΟΣ','ΠΡΟΕΣΤΟΣ','ΣΒΟΛΟΠΟΥΛΟΣ Λ','ΣΒΟΛΟΠΟΥΛΟΣ Π','ΣΒΟΛΟΠΟΥΛΟΣ Τ','ΣΚΙΑΣ','ΣΚΟΥΡΤΑΣ Γ','ΣΚΟΥΡΤΑΣ Φ','ΣΦΗΚΑΣ','ΤΡΙΑΝΤΑΦΥΛΛΑΚΗΣ','ΤΣΟΓΚΑΣ','ΧΑΤΖΗΤΙΜΠΑΣ'
  ]
};

const $ = (id) => document.getElementById(id);
let state = { rows: [], leaderboard: [], matches: [] };

function sheetCsvUrl(sheetName) {
  return `https://docs.google.com/spreadsheets/d/${CONFIG.spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}&cacheBust=${Date.now()}`;
}

async function fetchCsv(sheetName) {
  const res = await fetch(sheetCsvUrl(sheetName));
  if (!res.ok) throw new Error(`Δεν μπόρεσα να διαβάσω το φύλλο: ${sheetName}`);
  const text = await res.text();
  return Papa.parse(text, { skipEmptyLines: false }).data;
}

function clean(v) { return (v ?? '').toString().trim(); }
function isRealRow(r) { return r.some(c => clean(c) !== ''); }

function parseResults(rows) {
  const matches = [];
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i];
    const date = clean(r[0]), time = clean(r[1]), group = clean(r[2]), match = clean(r[3]), result = clean(r[4]);
    const slot = clean(r[5]), qualified = clean(r[6]);
    if (match) matches.push({ date, time, group, match, result, slot, qualified });
  }

  const leaderboard = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const rank = clean(r[8]), player = clean(r[9]), points = clean(r[10]);
    if (rank && player && !CONFIG.ignoredSheets.includes(player)) leaderboard.push({ rank, player, points });
  }
  return { matches, leaderboard };
}

function renderCards() {
  const played = state.matches.filter(m => m.result).length;
  const top = state.leaderboard[0];
  const groups = new Set(state.matches.map(m => m.group).filter(Boolean)).size;
  $('summaryCards').innerHTML = [
    ['Παίκτες', state.leaderboard.length || CONFIG.players.length],
    ['Αγώνες με αποτέλεσμα', played],
    ['Όμιλοι', groups],
    ['Πρώτος', top ? `${top.player} (${top.points || 0})` : '-']
  ].map(([label, value]) => `<div class="card"><div class="label">${label}</div><div class="value">${value}</div></div>`).join('');
}

function renderLeaderboard() {
  const q = clean($('playerSearch').value).toLowerCase();
  const rows = state.leaderboard.filter(x => x.player.toLowerCase().includes(q));
  $('leaderboardTable').innerHTML = `<thead><tr><th>Θέση</th><th>Παίκτης</th><th>Βαθμοί</th></tr></thead><tbody>` +
    rows.map(x => `<tr><td class="rank">${x.rank}</td><td>${x.player}</td><td class="points">${x.points || 0}</td></tr>`).join('') + '</tbody>';
}

function renderGroupFilter() {
  const groups = [...new Set(state.matches.map(m => m.group).filter(Boolean))].sort((a,b)=>a.localeCompare(b, 'el'));
  $('groupFilter').innerHTML = '<option value="">Όλοι οι όμιλοι</option>' + groups.map(g => `<option>${g}</option>`).join('');
}

function renderMatches() {
  const g = clean($('groupFilter').value);
  const rows = state.matches.filter(m => !g || m.group === g);
  $('matchesTable').innerHTML = `<thead><tr><th>Ημερομηνία</th><th>Ώρα</th><th>Όμιλος</th><th>Αγώνας</th><th>Αποτέλεσμα</th><th>Θέση/Πρόκριση</th></tr></thead><tbody>` +
    rows.map(m => `<tr><td>${m.date}</td><td>${m.time}</td><td><span class="badge">${m.group || '-'}</span></td><td>${m.match}</td><td class="points">${m.result || '-'}</td><td>${m.slot || ''} ${m.qualified || ''}</td></tr>`).join('') + '</tbody>';
}

function renderPlayerSelect() {
  $('playerSelect').innerHTML = '<option value="">Επιλογή παίκτη</option>' + CONFIG.players.map(p => `<option>${p}</option>`).join('');
}

async function renderPlayer(sheetName) {
  if (!sheetName) { $('playerBox').textContent = 'Διάλεξε παίκτη για να δεις τις προβλέψεις του.'; return; }
  $('playerBox').innerHTML = 'Φόρτωση προβλέψεων…';
  try {
    const rows = await fetchCsv(sheetName);
    const body = [];
    for (let i = 2; i < rows.length; i++) {
      const r = rows[i];
      const match = clean(r[0]), pred = clean(r[1]), pts = clean(r[2]), slot = clean(r[3]), team = clean(r[4]), progPts = clean(r[5]);
      if (match || pred || team) body.push({ match, pred, pts, slot, team, progPts });
    }
    $('playerBox').innerHTML = `<div class="table-wrap"><table><thead><tr><th>Αγώνας/Θέση</th><th>Πρόβλεψη</th><th>Πόντοι</th><th>Πρόκριση</th><th>Ομάδα</th><th>Πόντοι</th></tr></thead><tbody>` +
      body.map(x => `<tr><td>${x.match || x.slot}</td><td>${x.pred || ''}</td><td class="points">${x.pts || ''}</td><td>${x.slot || ''}</td><td>${x.team || ''}</td><td class="points">${x.progPts || ''}</td></tr>`).join('') +
      `</tbody></table></div>`;
  } catch (err) {
    $('playerBox').innerHTML = `<span class="warn">${err.message}</span><br>Έλεγξε ότι το Google Sheet είναι δημοσιευμένο στο web και ότι το φύλλο έχει ακριβώς αυτό το όνομα.`;
  }
}

async function load() {
  $('status').textContent = 'Φόρτωση δεδομένων από Google Sheets…';
  try {
    const rows = await fetchCsv(CONFIG.resultsSheet);
    state.rows = rows;
    Object.assign(state, parseResults(rows));
    renderCards(); renderLeaderboard(); renderGroupFilter(); renderMatches(); renderPlayerSelect();
    $('status').textContent = `Τελευταία ενημέρωση: ${new Date().toLocaleString('el-GR')}`;
  } catch (err) {
    $('status').innerHTML = `<span class="warn">${err.message}</span><br>Πιθανή αιτία: το Google Sheet δεν έχει γίνει Publish to web ή δεν επιτρέπεται η δημόσια ανάγνωση.`;
  }
}

$('refreshBtn').addEventListener('click', load);
$('playerSearch').addEventListener('input', renderLeaderboard);
$('groupFilter').addEventListener('change', renderMatches);
$('playerSelect').addEventListener('change', (e) => renderPlayer(e.target.value));
load();
