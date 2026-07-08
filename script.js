// ==================== STOCKAGE LOCAL ====================
const STORAGE_KEY = 'tradejournal_trades';
let trades = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
let currentPage = 'dashboard';
let editingTradeId = null;

// ==================== DOM ELEMENTS ====================
const pages = document.querySelectorAll('.page');
const navLinks = document.querySelectorAll('.nav-link');
const statsContainer = document.getElementById('statsContainer');
const tradesBody = document.getElementById('tradesBody');
const tradeModal = document.getElementById('tradeModal');
const tradeForm = document.getElementById('tradeForm');
const modalTitle = document.getElementById('modalTitle');
const searchInput = document.getElementById('searchInput');
const filterStrategy = document.getElementById('filterStrategy');
const filterPair = document.getElementById('filterPair');
const filterResult = document.getElementById('filterResult');

// ==================== INITIALISATION ====================
function init() {
    // Navigation
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            const page = link.dataset.page;
            navigateTo(page);
        });
    });

    // Modal events
    document.getElementById('openAddModal').addEventListener('click', () => openModal());
    document.getElementById('closeModal').addEventListener('click', closeModal);
    tradeForm.addEventListener('submit', saveTrade);

    // Toolbar events
    document.getElementById('exportCSV').addEventListener('click', exportCSV);
    document.getElementById('exportJSON').addEventListener('click', exportJSON);
    document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
    document.getElementById('importFile').addEventListener('change', importData);
    document.getElementById('resetAll').addEventListener('click', resetAll);

    // Auto-calc on input change
    ['tEntry','tExit','tLot','tSL','tTP','tPair','tDirection'].forEach(id => {
        document.getElementById(id).addEventListener('input', computeTradeValues);
    });

    // Search/filter
    searchInput.addEventListener('input', renderJournal);
    filterStrategy.addEventListener('change', renderJournal);
    filterPair.addEventListener('change', renderJournal);
    filterResult.addEventListener('change', renderJournal);

    // First render
    updateFilterOptions();
    navigateTo('dashboard');
}

function navigateTo(page) {
    pages.forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${page}`).classList.add('active');
    navLinks.forEach(l => l.classList.remove('active'));
    document.querySelector(`[data-page="${page}"]`).classList.add('active');
    currentPage = page;
    if (page === 'dashboard') refreshDashboard();
    if (page === 'journal') renderJournal();
    if (page === 'analytics') refreshAnalytics();
}

// ==================== TRADE MANAGEMENT ====================
function openModal(trade = null) {
    tradeModal.classList.remove('hidden');
    if (trade) {
        modalTitle.textContent = 'Modifier le trade';
        editingTradeId = trade.id;
        document.getElementById('tDate').value = trade.date;
        document.getElementById('tTime').value = trade.time || '';
        document.getElementById('tPair').value = trade.pair;
        document.getElementById('tDirection').value = trade.direction;
        document.getElementById('tLot').value = trade.lot;
        document.getElementById('tEntry').value = trade.entry;
        document.getElementById('tSL').value = trade.sl || '';
        document.getElementById('tTP').value = trade.tp || '';
        document.getElementById('tExit').value = trade.exit;
        document.getElementById('tSession').value = trade.session || 'Tokyo';
        document.getElementById('tStrategy').value = trade.strategy || '';
        document.getElementById('tNotes').value = trade.notes || '';
        document.getElementById('tEmotionBefore').value = trade.emotionBefore || 'Confiant';
        document.getElementById('tEmotionAfter').value = trade.emotionAfter || 'Confiant';
        // Screenshot déjà stockée en base64
        if (trade.screenshot) {
            // On ne recharge pas le fichier mais on pourrait afficher une miniature
        }
    } else {
        modalTitle.textContent = 'Ajouter un trade';
        editingTradeId = null;
        tradeForm.reset();
        document.getElementById('tDate').valueAsDate = new Date();
        document.getElementById('tTime').value = new Date().toTimeString().slice(0,5);
        document.getElementById('tLot').value = '1.0';
    }
    computeTradeValues();
}

function closeModal() {
    tradeModal.classList.add('hidden');
    tradeForm.reset();
    editingTradeId = null;
}

function saveTrade(e) {
    e.preventDefault();
    const trade = {
        id: editingTradeId || Date.now(),
        date: document.getElementById('tDate').value,
        time: document.getElementById('tTime').value || '-',
        pair: document.getElementById('tPair').value.toUpperCase(),
        direction: document.getElementById('tDirection').value,
        lot: parseFloat(document.getElementById('tLot').value),
        entry: parseFloat(document.getElementById('tEntry').value),
        sl: parseFloat(document.getElementById('tSL').value) || null,
        tp: parseFloat(document.getElementById('tTP').value) || null,
        exit: parseFloat(document.getElementById('tExit').value),
        session: document.getElementById('tSession').value,
        strategy: document.getElementById('tStrategy').value || '',
        notes: document.getElementById('tNotes').value || '',
        emotionBefore: document.getElementById('tEmotionBefore').value,
        emotionAfter: document.getElementById('tEmotionAfter').value,
        screenshot: editingTradeId ? trades.find(t => t.id === editingTradeId)?.screenshot || null : null
    };
    // Calculer pips, profit, risque%, RR
    const isJPY = trade.pair.includes('JPY');
    const pipValue = isJPY ? 0.01 : 0.0001;
    const pips = trade.direction === 'Long' ? (trade.exit - trade.entry) / pipValue : (trade.entry - trade.exit) / pipValue;
    const profit = pips * trade.lot * 10; // 10 unités par pip pour 1 lot standard
    const riskPercent = trade.sl ? (Math.abs(trade.entry - trade.sl) * trade.lot * 100000 / 10000) : null; // approximation
    const rr = trade.sl && trade.tp ? Math.abs(trade.tp - trade.entry) / Math.abs(trade.entry - trade.sl) : null;

    trade.pips = pips;
    trade.profit = profit;
    trade.riskPercent = riskPercent;
    trade.rr = rr ? rr.toFixed(2) : null;

    // Gérer capture d'écran si nouveau fichier
    const fileInput = document.getElementById('tScreenshot');
    if (fileInput.files.length > 0) {
        const reader = new FileReader();
        reader.onload = function() {
            trade.screenshot = reader.result;
            proceedSave(trade);
        };
        reader.readAsDataURL(fileInput.files[0]);
    } else {
        proceedSave(trade);
    }
}

function proceedSave(trade) {
    if (editingTradeId) {
        const index = trades.findIndex(t => t.id === editingTradeId);
        if (index !== -1) trades[index] = trade;
    } else {
        trades.push(trade);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
    closeModal();
    updateFilterOptions();
    if (currentPage === 'journal') renderJournal();
    refreshDashboard();
    refreshAnalytics();
}

function deleteTrade(id) {
    if (confirm('Supprimer ce trade ?')) {
        trades = trades.filter(t => t.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
        updateFilterOptions();
        renderJournal();
        refreshDashboard();
        refreshAnalytics();
    }
}

// ==================== COMPUTE TRADE VALUES (live) ====================
function computeTradeValues() {
    const entry = parseFloat(document.getElementById('tEntry').value);
    const exit = parseFloat(document.getElementById('tExit').value);
    const lot = parseFloat(document.getElementById('tLot').value);
    const pair = document.getElementById('tPair').value.toUpperCase();
    const direction = document.getElementById('tDirection').value;
    const sl = parseFloat(document.getElementById('tSL').value);
    const tp = parseFloat(document.getElementById('tTP').value);

    if (isNaN(entry) || isNaN(exit) || isNaN(lot)) {
        document.getElementById('tPips').value = '';
        document.getElementById('tProfit').value = '';
        document.getElementById('tRisk').value = '';
        document.getElementById('tRR').value = '';
        return;
    }

    const isJPY = pair.includes('JPY');
    const pipValue = isJPY ? 0.01 : 0.0001;
    const pips = direction === 'Long' ? (exit - entry) / pipValue : (entry - exit) / pipValue;
    const profit = pips * lot * 10;
    const risk = sl ? (Math.abs(entry - sl) * lot * 100000 / 10000) : null; // % risque simplifié
    const rr = sl && tp ? Math.abs(tp - entry) / Math.abs(entry - sl) : null;

    document.getElementById('tPips').value = pips.toFixed(1);
    document.getElementById('tProfit').value = profit.toFixed(2) + ' €';
    document.getElementById('tRisk').value = risk ? risk.toFixed(2) + '%' : '';
    document.getElementById('tRR').value = rr ? rr.toFixed(2) : '';
}

// ==================== JOURNAL RENDERING ====================
function getFilteredTrades() {
    let filtered = [...trades];
    const search = searchInput.value.toLowerCase();
    if (search) filtered = filtered.filter(t => t.pair.toLowerCase().includes(search) || t.strategy.toLowerCase().includes(search) || t.notes.toLowerCase().includes(search));
    const strat = filterStrategy.value;
    if (strat) filtered = filtered.filter(t => t.strategy === strat);
    const pair = filterPair.value;
    if (pair) filtered = filtered.filter(t => t.pair === pair);
    const result = filterResult.value;
    if (result === 'win') filtered = filtered.filter(t => t.profit > 0);
    if (result === 'loss') filtered = filtered.filter(t => t.profit < 0);
    return filtered;
}

function renderJournal() {
    const filtered = getFilteredTrades();
    // Sort by date descending
    filtered.sort((a,b) => b.id - a.id);
    if (filtered.length === 0) {
        tradesBody.innerHTML = '<tr><td colspan="16" style="text-align:center;padding:2rem;">Aucun trade</td></tr>';
        return;
    }
    tradesBody.innerHTML = filtered.map(t => `
        <tr>
            <td>${t.date}</td><td>${t.time}</td><td>${t.pair}</td>
            <td class="${t.direction==='Long'?'text-green-400':'text-red-400'}">${t.direction}</td>
            <td>${t.lot}</td><td>${t.entry}</td><td>${t.sl||'-'}</td><td>${t.tp||'-'}</td><td>${t.exit}</td>
            <td>${t.pips.toFixed(1)}</td>
            <td class="${t.profit>=0?'text-green-400':'text-red-400'}">${t.profit.toFixed(2)}€</td>
            <td>${t.riskPercent ? t.riskPercent.toFixed(2)+'%' : '-'}</td>
            <td>${t.rr||'-'}</td>
            <td>${t.session}</td><td>${t.strategy}</td>
            <td>
                <button class="btn btn-secondary btn-sm" onclick="editTrade(${t.id})"><i class="fas fa-edit"></i></button>
                <button class="btn btn-danger btn-sm" onclick="deleteTrade(${t.id})"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

// Edit trade
window.editTrade = function(id) {
    const trade = trades.find(t => t.id === id);
    if (trade) openModal(trade);
};

// ==================== DASHBOARD STATS ====================
function refreshDashboard() {
    if (trades.length === 0) {
        statsContainer.innerHTML = '<p>Aucune donnée</p>';
        return;
    }
    const totalTrades = trades.length;
    const wins = trades.filter(t => t.profit > 0);
    const losses = trades.filter(t => t.profit < 0);
    const winRate = (wins.length / totalTrades * 100).toFixed(1);
    const totalPnL = trades.reduce((s, t) => s + t.profit, 0);
    const avgWin = wins.length ? (wins.reduce((s,t) => s + t.profit, 0) / wins.length).toFixed(2) : 0;
    const avgLoss = losses.length ? (losses.reduce((s,t) => s + t.profit, 0) / losses.length).toFixed(2) : 0;
    const bestWin = Math.max(...trades.map(t => t.profit));
    const worstLoss = Math.min(...trades.map(t => t.profit));
    const profitFactor = avgLoss != 0 ? Math.abs(avgWin / avgLoss).toFixed(2) : '∞';
    const avgRR = trades.reduce((s,t) => s + (parseFloat(t.rr)||0), 0) / totalTrades;

    // Drawdown
    let peak = 0, maxDD = 0, cum = 0;
    trades.forEach(t => { cum += t.profit; if (cum > peak) peak = cum; const dd = peak - cum; if (dd > maxDD) maxDD = dd; });

    // Winning/losing streaks
    let currentStreak = 0, maxWinStreak = 0, maxLossStreak = 0;
    trades.forEach(t => {
        if (t.profit > 0) { currentStreak = currentStreak > 0 ? currentStreak + 1 : 1; maxWinStreak = Math.max(maxWinStreak, currentStreak); }
        else { currentStreak = currentStreak < 0 ? currentStreak - 1 : -1; maxLossStreak = Math.min(maxLossStreak, currentStreak); }
    });

    statsContainer.innerHTML = `
        <div class="stat-card"><div class="label">Solde</div><div class="value">${(10000 + totalPnL).toFixed(2)} €</div></div>
        <div class="stat-card"><div class="label">P&L Total</div><div class="value ${totalPnL>=0?'text-green-400':'text-red-400'}">${totalPnL.toFixed(2)} €</div></div>
        <div class="stat-card"><div class="label">Win Rate</div><div class="value">${winRate}%</div></div>
        <div class="stat-card"><div class="label">Trades</div><div class="value">${totalTrades}</div></div>
        <div class="stat-card"><div class="label">Profit Factor</div><div class="value">${profitFactor}</div></div>
        <div class="stat-card"><div class="label">R:R moyen</div><div class="value">${avgRR.toFixed(2)}</div></div>
        <div class="stat-card"><div class="label">Gain moyen</div><div class="value text-green-400">${avgWin} €</div></div>
        <div class="stat-card"><div class="label">Perte moyenne</div><div class="value text-red-400">${avgLoss} €</div></div>
        <div class="stat-card"><div class="label">Meilleur trade</div><div class="value text-green-400">${bestWin.toFixed(2)} €</div></div>
        <div class="stat-card"><div class="label">Pire trade</div><div class="value text-red-400">${worstLoss.toFixed(2)} €</div></div>
        <div class="stat-card"><div class="label">Série gains</div><div class="value">${maxWinStreak}</div></div>
        <div class="stat-card"><div class="label">Série pertes</div><div class="value">${Math.abs(maxLossStreak)}</div></div>
    `;

    renderCharts();
}

function renderCharts() {
    // Destroy existing charts if any
    Chart.helpers.each(Chart.instances, instance => instance.destroy());

    // Equity curve
    const sorted = [...trades].sort((a,b) => a.id - b.id);
    let equity = 10000;
    const equityData = sorted.map(t => equity += t.profit);
    new Chart(document.getElementById('equityCurve'), {
        type: 'line', data: { labels: sorted.map((_,i)=>i+1), datasets: [{ label:'Équité', data:equityData, borderColor:'#3B82F6' }] }
    });

    // Balance curve (même que equity si pas de notion de solde initial)
    new Chart(document.getElementById('balanceCurve'), {
        type: 'line', data: { labels: sorted.map((_,i)=>i+1), datasets: [{ label:'Solde', data:equityData, borderColor:'#22C55E' }] }
    });

    // Profit by day
    const days = {};
    trades.forEach(t => { days[t.date] = (days[t.date]||0) + t.profit; });
    const dayLabels = Object.keys(days).sort();
    new Chart(document.getElementById('profitByDay'), {
        type: 'bar', data: { labels:dayLabels, datasets:[{ label:'P&L/jour', data:dayLabels.map(d=>days[d]) }] }
    });

    // Win/Loss pie
    new Chart(document.getElementById('winLossPie'), {
        type: 'doughnut', data: { labels:['Gagnants','Perdants'], datasets:[{ data:[wins.length, losses.length], backgroundColor:['#22C55E','#EF4444'] }] }
    });

    // Profit by week
    const weeks = {};
    trades.forEach(t => { const week = `${t.date.slice(0,4)}-W${Math.ceil(new Date(t.date).getDate()/7)}`; weeks[week] = (weeks[week]||0) + t.profit; });
    new Chart(document.getElementById('profitByWeek'), {
        type: 'bar', data: { labels:Object.keys(weeks), datasets:[{ label:'P&L/semaine', data:Object.values(weeks) }] }
    });

    // Profit by month
    const months = {};
    trades.forEach(t => { const m = t.date.slice(0,7); months[m] = (months[m]||0) + t.profit; });
    new Chart(document.getElementById('profitByMonth'), {
        type: 'bar', data: { labels:Object.keys(months), datasets:[{ label:'P&L/mois', data:Object.values(months) }] }
    });

    // Performance by pair
    const pairs = {};
    trades.forEach(t => { pairs[t.pair] = (pairs[t.pair]||0) + t.profit; });
    new Chart(document.getElementById('performanceByPair'), {
        type: 'bar', data: { labels:Object.keys(pairs), datasets:[{ label:'P&L par paire', data:Object.values(pairs) }] }
    });

    // Performance by session
    const sessions = {};
    trades.forEach(t => { sessions[t.session] = (sessions[t.session]||0) + t.profit; });
    new Chart(document.getElementById('performanceBySession'), {
        type: 'bar', data: { labels:Object.keys(sessions), datasets:[{ label:'P&L par session', data:Object.values(sessions) }] }
    });

    // Performance by weekday
    const weekdays = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi'];
    const dayProfit = [0,0,0,0,0];
    trades.forEach(t => { const d = new Date(t.date).getDay(); if (d>=1 && d<=5) dayProfit[d-1] += t.profit; });
    new Chart(document.getElementById('performanceByWeekday'), {
        type: 'bar', data: { labels:weekdays, datasets:[{ label:'P&L par jour', data:dayProfit }] }
    });

    // Performance by strategy
    const strategies = {};
    trades.forEach(t => { if (t.strategy) { strategies[t.strategy] = (strategies[t.strategy]||0) + t.profit; } });
    new Chart(document.getElementById('performanceByStrategy'), {
        type: 'bar', data: { labels:Object.keys(strategies), datasets:[{ label:'P&L par stratégie', data:Object.values(strategies) }] }
    });
}

// ==================== ANALYTICS ====================
function refreshAnalytics() {
    if (trades.length === 0) return;
    const total = trades.length;
    const wins = trades.filter(t => t.profit > 0).length;
    const losses = total - wins;
    const totalPnL = trades.reduce((s,t)=>s+t.profit,0);
    const avgWin = wins>0 ? trades.filter(t=>t.profit>0).reduce((s,t)=>s+t.profit,0)/wins : 0;
    const avgLoss = losses>0 ? trades.filter(t=>t.profit<0).reduce((s,t)=>s+t.profit,0)/losses : 0;
    const winRate = (wins/total*100).toFixed(1);
    const profitFactor = avgLoss!=0 ? Math.abs(avgWin/avgLoss).toFixed(2) : '∞';
    const expectancy = (winRate/100*avgWin + (1-winRate/100)*avgLoss).toFixed(2);
    const avgRR = trades.reduce((s,t)=>s+(parseFloat(t.rr)||0),0)/total;
    // Drawdown
    let peak=0, maxDD=0, cum=0, currentDD=0;
    trades.forEach(t=>{ cum+=t.profit; if(cum>peak) peak=cum; const dd=peak-cum; if(dd>maxDD)maxDD=dd; currentDD=dd; });

    const monthlyReturn = {}; trades.forEach(t=>{ const m=t.date.slice(0,7); monthlyReturn[m]=(monthlyReturn[m]||0)+t.profit; });
    const weeklyReturn = {}; trades.forEach(t=>{ const w=`${t.date.slice(0,4)}-W${Math.ceil(new Date(t.date).getDate()/7)}`; weeklyReturn[w]=(weeklyReturn[w]||0)+t.profit; });
    const dailyReturn = {}; trades.forEach(t=>{ dailyReturn[t.date]=(dailyReturn[t.date]||0)+t.profit; });

    document.getElementById('analyticsContainer').innerHTML = `
        <div class="stat-card"><div class="label">Win Rate</div><div class="value">${winRate}%</div></div>
        <div class="stat-card"><div class="label">Profit Factor</div><div class="value">${profitFactor}</div></div>
        <div class="stat-card"><div class="label">Espérance</div><div class="value">${expectancy} €</div></div>
        <div cl
