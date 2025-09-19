// --- CONFIG & GLOBAL STATE ---
const firebaseConfig = {
    apiKey: "AIzaSyB-gLlgyPKNf4z1cfl1Z1N1qu79FvO_3A8",
    authDomain: "ftbapp-ded2c.firebaseapp.com",
    databaseURL: "https://ftbapp-ded2c-default-rtdb.europe-west1.firebasedatabase.app/",
    projectId: "ftbapp-ded2c",
    storageBucket: "ftbapp-ded2c.appspot.com",
    messagingSenderId: "239337886217",
    appId: "1:239337886217:web:9b67dffaba23d6e86dded8"
};
const ADMIN_USERNAME = 'kuba';

firebase.initializeApp(firebaseConfig);
const database = firebase.database();
let currentPlayer = null, allUsers = {}, allMatches = [], resetModal;
let appData = {};

// --- AUTH & INIT ---
async function register() {
    const btn = document.getElementById('registerBtn');
    toggleButtonState(btn, true, 'Registruji...');
    const username = document.getElementById('username').value.trim().toLowerCase();
    const pin = document.getElementById('pin').value.trim();
    const favoriteTeam = document.getElementById('favoriteTeam').value.trim();

    if (username.length < 3) { showToast('Jméno musí mít alespoň 3 znaky!', 'danger'); toggleButtonState(btn, false); return; }
    if (!/^\d{4}$/.test(pin)) { showToast('PIN musí být 4 číslice!', 'danger'); toggleButtonState(btn, false); return; }
    
    try {
        const snapshot = await database.ref(`users/${username}`).once('value');
        if (snapshot.exists()) {
            showToast('Uživatel s tímto jménem již existuje!', 'danger');
        } else {
            const updates = {};
            updates[`/users/${username}`] = { pin, registeredAt: new Date().toISOString() };
            if (favoriteTeam) {
                updates[`/profiles/${username}/favoriteTeam`] = favoriteTeam;
            }
            await database.ref().update(updates);

            sessionStorage.setItem('currentPlayer', username);
            showToast(`Registrace úspěšná, vítej ${username}! 🎉`, 'success');
            await initApp();
        }
    } catch (error) { handleFirebaseError(error); } 
    finally { toggleButtonState(btn, false, 'Registrovat se'); }
}

async function login() {
    const btn = document.getElementById('loginBtn');
    toggleButtonState(btn, true, 'Přihlašuji...');
    const username = document.getElementById('username').value.trim().toLowerCase();
    const pin = document.getElementById('pin').value.trim();
    if (!username || !pin) { showToast('Zadejte jméno a PIN.', 'warning'); toggleButtonState(btn, false); return; }

    try {
        const snapshot = await database.ref(`users/${username}/pin`).once('value');
        if (snapshot.val() === pin) {
            sessionStorage.setItem('currentPlayer', username);
            await initApp();
        } else {
            showToast('Špatné jméno nebo PIN!', 'danger');
        }
    } catch (error) { handleFirebaseError(error); } 
    finally { toggleButtonState(btn, false, 'Přihlásit se'); }
}
function logout() { sessionStorage.removeItem('currentPlayer'); location.reload(); }

async function initApp() {
    currentPlayer = sessionStorage.getItem('currentPlayer');
    if (!currentPlayer) {
        document.getElementById('loading-screen').classList.add('d-none');
        document.getElementById('login-page').classList.remove('d-none');
        return;
    }
    
    document.getElementById('login-page').classList.add('d-none');
    document.getElementById('loading-screen').classList.remove('d-none');
    
    document.getElementById('logged-in-user').textContent = currentPlayer;
    if (currentPlayer === ADMIN_USERNAME) {
        document.getElementById('admin-nav-item').classList.remove('d-none');
        const mobileNavContent = document.querySelector('.mobile-nav-content');
        if (mobileNavContent && !document.getElementById('mobile-admin-nav-item')) {
            const adminMobileLinkHTML = `<a href="#" data-section="admin" id="mobile-admin-nav-item" style="color: var(--danger-color);"><i class="fas fa-shield-alt"></i><span>Admin</span></a>`;
            mobileNavContent.insertAdjacentHTML('beforeend', adminMobileLinkHTML);
        }
    }
    
    setupNavigation();
    
    try {
        allMatches = await loadMatchesFromFile();
        setupFirebaseListeners();
        showSection('dashboard');
        document.getElementById('loading-screen').classList.add('d-none');
        document.getElementById('main-app').classList.remove('d-none');
    } catch (error) {
        document.getElementById('loading-screen').innerHTML = `<div class="p-4 text-center"><h3 class="text-danger">Chyba aplikace</h3><p>${error.message}</p></div>`;
    }
}

function setupFirebaseListeners() {
    database.ref().on('value', snapshot => {
        appData = snapshot.val() || {};
        allUsers = appData.users || {};
        renderAllSections();
    }, handleFirebaseError);
}

async function loadMatchesFromFile() {
    try {
        const response = await fetch('matches.txt');
        if (!response.ok) {
            if (response.status === 404) {
                 console.warn('Soubor `matches.txt` nebyl nalezen. Sekce Zápasy bude prázdná.');
                 return []; // Return empty array, don't throw error
            }
            throw new Error(`Chyba při načítání souboru zápasů (HTTP status: ${response.status}).`);
        }
        const text = await response.text();
        if (!text.trim()) return [];

        const lines = text.split('\n').filter(line => line.trim() !== '');
        let currentRound = 'Neznámé kolo';
        const rounds = [];
        let roundIndex = -1;

        lines.forEach(line => {
            const isRoundTitle = !line.toLowerCase().includes('vs.');
            if (isRoundTitle) {
                currentRound = line.trim();
                rounds.push({ round: currentRound, matches: [] });
                roundIndex++;
            } else {
                if (roundIndex === -1) {
                    rounds.push({ round: currentRound, matches: [] });
                    roundIndex = 0;
                }
                const matchIndex = rounds[roundIndex].matches.length;
                rounds[roundIndex].matches.push({ id: `r${roundIndex}m${matchIndex}`, name: line.trim() });
            }
        });
        return rounds;
    } catch(e) {
        console.error("Failed to load or parse matches.txt:", e);
        showToast("Nepodařilo se načíst soubor se zápasy.", 'danger');
        return [];
    }
}

// --- RENDER FUNCTIONS ---
function renderAllSections() {
    const activeSection = document.querySelector('.app-section:not(.d-none)');
    if (!activeSection) return;
    const sectionId = activeSection.id.replace('-section', '');
    
    const renderMap = {
        'dashboard': renderDashboard, 'matches': renderMatches,
        'leaderboard': renderLeaderboard, 'profile': renderProfile,
        'admin': renderAdminPanel,
    };

    if (renderMap[sectionId]) {
        renderMap[sectionId](appData);
        if (sectionId === 'admin' && currentPlayer !== ADMIN_USERNAME) showSection('dashboard');
    }
}

function renderDashboard(data) {
    const myPoints = data.points?.[currentPlayer] || 0;
    const myBet = data.totalBets?.[currentPlayer] || 0;
    const totalPool = Object.values(data.totalBets || {}).reduce((sum, bet) => sum + (Number(bet) || 0), 0);
    
    const { monthName, progressPercentage } = getMonthProgress();
    const hotTip = getHotTip(data);

    document.getElementById('dashboard-section').innerHTML = `
        <h2 class="mb-4">Dashboard</h2>
        <div class="row">
            <div class="col-lg-8">
                <div class="row">
                    <div class="col-md-6 mb-4">
                        <div class="card p-3 h-100">
                            <div class="card-body d-flex flex-column">
                                <h5><i class="fas fa-user-circle me-2 text-primary"></i>Můj přehled</h5>
                                <div class="text-center my-auto">
                                    <p class="display-5 fw-bold mb-0">${myPoints}</p><small class="text-muted">BODŮ</small>
                                    <hr class="my-2">
                                    <p class="display-6 fw-bold mb-0">${myBet.toLocaleString('cs-CZ')} <small class="fs-6">Kč</small></p><small class="text-muted">VSAZENO</small>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6 mb-4">
                        <div class="card p-3 h-100 bg-primary text-white">
                            <div class="card-body d-flex flex-column">
                                <h5><i class="fas fa-coins me-2"></i>Celkový bank</h5>
                                <div class="text-center my-auto">
                                    <p class="display-4 fw-bold mb-0">${totalPool.toLocaleString('cs-CZ')} <small class="fs-4">Kč</small></p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                 <div class="row">
                    <div class="col-md-6 mb-4">
                        <div class="card h-100">
                            <div class="card-body p-4 competition-progress-card">
                                <div class="progress-circle-container">
                                     <div class="progress-circle" style="--progress: ${progressPercentage};"></div>
                                     <div class="progress-circle-value">${progressPercentage}%</div>
                                </div>
                                <div>
                                    <h5 class="mb-1">Soutěžní kolo</h5>
                                    <p class="fw-bold fs-4 mb-0">${monthName}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                     <div class="col-md-6 mb-4">
                        <div class="card h-100 hot-tip-card">
                            <div class="card-body p-4">
                                <h5 class="mb-2"><i class="fas fa-fire me-2"></i>Horký Tip</h5>
                                <p class="fw-bold mb-1">${hotTip.name}</p>
                                <small>${hotTip.count > 0 ? `Nejčastěji tipováno (${hotTip.count}x)`: 'Buď první, kdo si tipne!'}</small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-lg-4 mb-4">
                <a href="https://www.livesport.cz" target="_blank" class="card text-decoration-none h-100 bg-success text-white">
                    <div class="card-body text-center d-flex flex-column justify-content-center">
                        <i class="fa-solid fa-bolt fa-3x mb-3"></i>
                        <h4 class="mb-0">Live Výsledky</h4>
                        <p class="mb-0 opacity-75">Livesport.cz</p>
                    </div>
                </a>
            </div>
        </div>`;
    // Animate progress circle after render
    setTimeout(() => {
        const circle = document.querySelector('.progress-circle');
        if (circle) circle.style.setProperty('--progress', progressPercentage);
    }, 100);
}

function renderLeaderboard(data) {
    const points = data.points || {};
    const totalBets = data.totalBets || {};
    const profiles = data.profiles || {};
    const evaluations = data.evaluations || {};

    const playerList = Object.keys(allUsers).map(username => ({
        username, 
        points: points[username] || 0, 
        totalBet: totalBets[username] || 0,
        favoriteTeam: profiles[username]?.favoriteTeam || '',
        formStreak: calculatePlayerForm(username, evaluations, allMatches)
    })).sort((a, b) => b.points - a.points || b.totalBet - a.totalBet);
    
    let tableBodyHTML = '';
    if (playerList.length > 0) {
        playerList.forEach((player, index) => {
            const formIcon = player.formStreak >= 3 ? `<i class="fas fa-fire form-streak" title="Série ${player.formStreak} správných tipů"></i>` : '';
            tableBodyHTML += `
                <tr class="${player.username === currentPlayer ? 'table-light' : ''}">
                    <td class="fw-bold text-center">${index + 1}</td>
                    <td>
                        <div class="d-flex align-items-center">
                            ${generateAvatar(player.username)}
                            <span class="ms-3 fw-bold">${player.username}</span>
                            ${formIcon}
                        </div>
                    </td>
                    <td class="leaderboard-team team-col">${player.favoriteTeam}</td>
                    <td class="text-center">${player.points}</td>
                    <td>${player.totalBet.toLocaleString('cs-CZ')} Kč</td>
                </tr>`;
        });
    } else {
        tableBodyHTML = '<tr><td colspan="5" class="text-center p-5"><p class="mb-0 text-muted">Zatím žádní hráči v žebříčku.</p></td></tr>';
    }

    document.getElementById('leaderboard-section').innerHTML = `<h2 class="mb-4">Žebříček hráčů</h2><div class="card"><div class="card-body p-0"><div class="table-responsive"><table class="table table-hover mb-0"><thead><tr><th class="text-center">#</th><th>Hráč</th><th class="team-col">Tým</th><th class="text-center">Body</th><th>Sázka</th></tr></thead><tbody>${tableBodyHTML}</tbody></table></div></div></div>`;
}

function renderMatches(data) {
    let html = `<h2 class="mb-4">Zápasy a tipy</h2>`;
    if (!allMatches || allMatches.length === 0) {
        html += '<div class="card card-body text-center"><i class="fa-solid fa-calendar-times fa-2x text-muted mb-3"></i><p class="mb-0 text-muted">Aktuálně nejsou k dispozici žádné zápasy.</p><p class="small text-muted">Ujistěte se, že soubor `matches.txt` existuje a je nahraný.</p></div>';
        document.getElementById('matches-section').innerHTML = html;
        return;
    }

    const allTips = data.tips || {}, allBets = data.bets || {}, allEvals = data.evaluations || {}, matchResults = data.matchResults || {};
    html += '<div class="accordion" id="roundsAccordion">';

    allMatches.forEach((round, roundIndex) => {
        html += `<div class="accordion-item mb-3"><h2 class="accordion-header"><button class="accordion-button ${roundIndex === 0 ? '' : 'collapsed'}" type="button" data-bs-toggle="collapse" data-bs-target="#collapse${roundIndex}">${round.round}</button></h2><div id="collapse${roundIndex}" class="accordion-collapse collapse ${roundIndex === 0 ? 'show' : ''}" data-bs-parent="#roundsAccordion"><div class="accordion-body">`;
        round.matches.forEach(match => {
            const officialResult = matchResults[match.id], isEvaluated = officialResult !== undefined;
            const myTip = allTips[currentPlayer]?.[match.id], myBet = allBets[currentPlayer]?.[match.id] ?? '';
            html += `<div class="card mb-3"><div class="card-body"><div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3"><h5 class="mb-0"><i class="fas fa-futbol me-2"></i>${match.name}</h5><div class="d-flex align-items-center gap-2">${isEvaluated ? `<span class="badge bg-primary-subtle text-primary-emphasis rounded-pill p-2">Výsledek: ${officialResult}</span>` : ''}<button class="btn btn-sm btn-outline-primary" onclick="openPerplexityAnalysis('${match.name}')"><i class="fas fa-search me-1"></i>Analýza</button></div></div><div class="p-3 rounded my-tip-row"><div class="row align-items-center gx-3"><div class="col-12 col-md-5 mb-2 mb-md-0"><div class="btn-group w-100 tip-btn-group" role="group"><button type="button" class="btn ${myTip === 1 ? 'active' : ''}" onclick="saveTip('${match.id}', 1)" ${isEvaluated ? 'disabled' : ''}>1</button><button type="button" class="btn ${myTip === 0 ? 'active' : ''}" onclick="saveTip('${match.id}', 0)" ${isEvaluated ? 'disabled' : ''}>0</button><button type="button" class="btn ${myTip === 2 ? 'active' : ''}" onclick="saveTip('${match.id}', 2)" ${isEvaluated ? 'disabled' : ''}>2</button></div></div><div class="col-12 col-md-7"><div class="input-group"><input type="number" class="form-control" placeholder="Sázka" min="0" max="1000" step="10" value="${myBet}" onchange="saveBet('${match.id}', this.value)" ${isEvaluated ? 'disabled' : ''}><span class="input-group-text">Kč</span></div></div></div></div><small class="text-muted mt-3 d-block">Tipy ostatních hráčů:</small><div class="mt-2">`;
            const otherUsers = Object.keys(allUsers).filter(u => u !== currentPlayer);
            if(otherUsers.length > 0) {
                otherUsers.forEach(username => {
                    const tip = allTips[username]?.[match.id] ?? '?', bet = allBets[username]?.[match.id] ?? '0', evaluation = allEvals[username]?.[match.id] ?? 'nevyhodnoceno';
                    html += `<div class="other-player-tip-card">
                                <div class="d-flex align-items-center justify-content-between">
                                    <div class="d-flex align-items-center">${generateAvatar(username)}<span class="ms-2 fw-bold">${username}</span></div>
                                    <span class="evaluation-status-display status-${evaluation}">${evaluation.toUpperCase()}</span>
                                </div>
                                <hr class="my-2">
                                <div class="d-flex justify-content-between">
                                    <div class="text-center">
                                        <small class="text-muted">Tip</small>
                                        <p class="fw-bold mb-0">${tip}</p>
                                    </div>
                                    <div class="text-center">
                                        <small class="text-muted">Sázka</small>
                                        <p class="fw-bold mb-0">${bet} Kč</p>
                                    </div>
                                </div>
                            </div>`;
                });
            } else {
                html += `<p class="text-muted small text-center mt-2">Zatím žádné další tipy.</p>`;
            }
            html += `</div></div></div>`;
        });
        html += `</div></div></div>`;
    });
    html += '</div>';
    document.getElementById('matches-section').innerHTML = html;
}

function renderProfile(data) {
    const profile = data.profiles?.[currentPlayer] || {};
    const favoriteTeam = profile.favoriteTeam || '';
    
    // Calculate stats
    const myTips = data.tips?.[currentPlayer] || {};
    const myEvals = data.evaluations?.[currentPlayer] || {};
    const totalTips = Object.keys(myTips).length;
    const correctTips = Object.values(myEvals).filter(e => e === 'ok').length;
    const successRate = totalTips > 0 ? ((correctTips / totalTips) * 100).toFixed(0) : 0;
    
    const tipCounts = { '1': 0, '0': 0, '2': 0, '?': 0 };
    Object.values(myTips).forEach(tip => {
        tipCounts[tip] = (tipCounts[tip] || 0) + 1;
    });
    const favoriteTip = Object.keys(tipCounts).reduce((a, b) => tipCounts[a] > tipCounts[b] ? a : b);


    document.getElementById('profile-section').innerHTML = `
        <h2 class="mb-4">Můj profil</h2>
        <div class="row">
            <div class="col-lg-8">
                <div class="card mb-4">
                    <div class="card-body p-4">
                        <h3><i class="fas fa-user-edit me-2"></i>Úprava údajů</h3>
                        <div class="mb-3">
                            <label for="my-team" class="form-label">Můj fanouškovský tým:</label>
                            <input type="text" class="form-control" id="my-team" value="${favoriteTeam}" placeholder="Např. AC Sparta Praha">
                        </div>
                        <div class="mb-3">
                            <label for="my-pin" class="form-label">Změna PIN (nový 4-místný PIN):</label>
                            <input type="password" class="form-control" id="my-pin" placeholder="••••" maxlength="4" inputmode="numeric">
                        </div>
                        <button class="btn btn-primary" onclick="saveProfile()"><i class="fas fa-save me-1"></i>Uložit profil</button>
                    </div>
                </div>
            </div>
            <div class="col-lg-4">
                <div class="card">
                    <div class="card-body p-4">
                        <h3><i class="fas fa-chart-pie me-2"></i>Moje statistiky</h3>
                        <div class="stat-card mb-3">
                             <div class="stat-icon"><i class="fas fa-bullseye"></i></div>
                             <div class="stat-value">${successRate}%</div>
                             <div class="stat-label">Úspěšnost tipů</div>
                        </div>
                         <div class="stat-card mb-3">
                             <div class="stat-icon"><i class="fas fa-list-ol"></i></div>
                             <div class="stat-value">${totalTips}</div>
                             <div class="stat-label">Celkem tipů</div>
                        </div>
                         <div class="stat-card">
                             <div class="stat-icon"><i class="fas fa-star"></i></div>
                             <div class="stat-value">${favoriteTip}</div>
                             <div class="stat-label">Nejčastější tip</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
}

function renderAdminPanel(data) {
    const matchResults = data.matchResults || {};
    let unevaluatedMatchesHTML = '';
    if (allMatches) {
        allMatches.forEach(round => {
            round.matches.forEach(match => {
                if (matchResults[match.id] === undefined) {
                    unevaluatedMatchesHTML += `<div class="d-flex justify-content-between align-items-center mb-2 p-2 border rounded flex-wrap"><span class="me-3">${match.name}</span><div class="btn-group"><button class="btn btn-sm btn-success" onclick="adminEvaluateMatch('${match.id}', 1)">1</button><button class="btn btn-sm btn-warning text-dark" onclick="adminEvaluateMatch('${match.id}', 0)">0</button><button class="btn btn-sm btn-danger" onclick="adminEvaluateMatch('${match.id}', 2)">2</button></div></div>`;
                }
            });
        });
    }
    if (unevaluatedMatchesHTML === '') unevaluatedMatchesHTML = '<p class="text-muted">Všechny zápasy jsou vyhodnoceny.</p>';
    document.getElementById('admin-section').innerHTML = `<div class="admin-controls card p-4"><h2 class="mb-4"><i class="fas fa-cogs me-2"></i>Administrace</h2><div class="card mb-4"><div class="card-body p-4"><h3><i class="fas fa-check-double me-2"></i>Vyhodnocení zápasů</h3>${unevaluatedMatchesHTML}</div></div><div class="card"><div class="card-body p-4"><h3><i class="fas fa-redo-alt me-2"></i>Měsíční Reset</h3><p class="text-muted">Resetuje body, sázky a vyhodnocení. Tuto akci nelze vrátit!</p><button class="btn btn-danger" onclick="showResetModal()"><i class="fas fa-exclamation-triangle me-1"></i>Resetovat Soutěž</button></div></div></div>`;
}

// --- ACTIONS ---
function saveTip(matchId, tip) { database.ref(`tips/${currentPlayer}/${matchId}`).set(Number(tip)).then(() => showToast('Tip uložen!', 'success')).catch(handleFirebaseError); }

function saveBet(matchId, bet) {
    const value = bet === "" ? null : parseInt(bet, 10);
    if (value !== null && (isNaN(value) || value < 0 || value > 1000)) return showToast('Sázka musí být mezi 0 a 1000 Kč!', 'danger');
    
    const betRef = database.ref(`bets/${currentPlayer}/${matchId}`);
    betRef.set(value)
        .then(() => {
            showToast('Sázka uložena!', 'success');
            return database.ref(`bets/${currentPlayer}`).once('value');
        })
        .then(snapshot => {
            const allPlayerBets = snapshot.val() || {};
            const totalBet = Object.values(allPlayerBets).reduce((sum, b) => sum + (Number(b) || 0), 0);
            return database.ref(`totalBets/${currentPlayer}`).set(totalBet);
        })
        .catch(handleFirebaseError);
}

function saveProfile() {
    const favoriteTeam = document.getElementById('my-team').value.trim();
    const pin = document.getElementById('my-pin').value.trim();
    if (pin && !/^\d{4}$/.test(pin)) return showToast('PIN musí být 4 číslice!', 'danger');
    
    const updates = {};
    updates[`/profiles/${currentPlayer}/favoriteTeam`] = favoriteTeam;
    if (pin) updates[`/users/${currentPlayer}/pin`] = pin;

    database.ref().update(updates).then(() => {
        showToast('Profil uložen!', 'success');
        if (pin) document.getElementById('my-pin').value = '';
    }).catch(handleFirebaseError);
}

function showResetModal() { if(resetModal) resetModal.show(); }

function confirmReset() {
    const pathsToRemove = ['points', 'totalBets', 'bets', 'tips', 'evaluations', 'matchResults'];
    const updates = {};
    pathsToRemove.forEach(path => updates[path] = null);
    database.ref().update(updates)
        .then(() => { if(resetModal) resetModal.hide(); showToast('Soutěž byla úspěšně resetována!', 'success'); })
        .catch(handleFirebaseError);
}

async function adminEvaluateMatch(matchId, result) {
    try {
        await database.ref(`matchResults/${matchId}`).set(result);
        const tipsSnapshot = await database.ref('tips').once('value');
        const allTips = tipsSnapshot.val() || {};
        
        const updates = {};
        const pointPromises = Object.keys(allUsers).map(async (username) => {
            const userTip = allTips[username]?.[matchId];
            if (userTip !== undefined) {
                const isCorrect = parseInt(userTip, 10) === result;
                updates[`/evaluations/${username}/${matchId}`] = isCorrect ? 'ok' : 'spatne';
                if (isCorrect) {
                    const pointsRef = database.ref(`points/${username}`);
                    return pointsRef.transaction(currentPoints => (currentPoints || 0) + 3);
                }
            }
            return Promise.resolve();
        });
        
        await database.ref().update(updates);
        await Promise.all(pointPromises);
        
        showToast('Zápas úspěšně vyhodnocen a body připsány!', 'success');
    } catch(error) {
        handleFirebaseError(error);
    }
}

// --- UTILITIES ---
function setupNavigation() {
    const navLinks = document.querySelectorAll('.sidebar-nav a, .mobile-nav a');
    navLinks.forEach(link => link.addEventListener('click', e => {
        e.preventDefault(); const section = e.currentTarget.dataset.section; showSection(section);
        navLinks.forEach(l => l.classList.remove('active'));
        document.querySelectorAll(`a[data-section="${section}"]`).forEach(l => l.classList.add('active'));
    }));
}

function showSection(sectionId) {
    document.querySelectorAll('.app-section').forEach(s => s.classList.add('d-none'));
    const sectionEl = document.getElementById(`${sectionId}-section`);
    if(sectionEl) {
        sectionEl.classList.remove('d-none');
        renderAllSections();
    }
}

function generateAvatar(username) {
    const colors = ['#0d6efd', '#6f42c1', '#d63384', '#dc3545', '#fd7e14', '#198754', '#20c997', '#0dcaf0'];
    const initial = username.charAt(0).toUpperCase();
    const charCodeSum = username.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const color = colors[charCodeSum % colors.length];
    return `<div class="leaderboard-avatar" style="background-color: ${color}">${initial}</div>`;
}

function showToast(message, type = 'info') {
    const toastContainer = document.querySelector('.toast-container'); const toastId = `toast-${Date.now()}`;
    const toastHTML = `<div id="${toastId}" class="toast align-items-center text-bg-${type} border-0" role="alert" aria-live="assertive" aria-atomic="true"><div class="d-flex"><div class="toast-body">${message}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button></div></div>`;
    toastContainer.insertAdjacentHTML('beforeend', toastHTML); const toastEl = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastEl); toast.show(); toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
}

function handleFirebaseError(error) { console.error("Firebase Error:", error); showToast(`Chyba databáze: ${error.message}`, 'danger'); }

function toggleButtonState(btn, isLoading, loadingText = 'Načítání...') {
    if (!btn) return;
    const btnTextEl = btn.querySelector('.btn-text');
    if (!btnTextEl) return;
    const originalText = btnTextEl.dataset.originalText || btnTextEl.textContent;
    if (!btnTextEl.dataset.originalText) btnTextEl.dataset.originalText = originalText;

    if (isLoading) {
        btn.disabled = true;
        btnTextEl.textContent = loadingText;
        const spinner = document.createElement('span');
        spinner.className = 'spinner-border spinner-border-sm ms-2';
        btn.appendChild(spinner);
    } else {
        btn.disabled = false;
        btn.querySelector('.spinner-border')?.remove();
        btnTextEl.textContent = originalText;
    }
}

function getMonthProgress() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const totalDays = endOfMonth.getDate();
    const passedDays = now.getDate();
    const progressPercentage = Math.round((passedDays / totalDays) * 100);
    const monthName = now.toLocaleString('cs-CZ', { month: 'long', year: 'numeric' });
    return { monthName, progressPercentage };
}

function getHotTip(data) {
    const allTips = data.tips || {};
    const matchResults = data.matchResults || {};
    const unevaluatedMatchTips = {};

    for (const user in allTips) {
        for (const matchId in allTips[user]) {
            if (!matchResults.hasOwnProperty(matchId)) {
                if (!unevaluatedMatchTips[matchId]) {
                    unevaluatedMatchTips[matchId] = 0;
                }
                unevaluatedMatchTips[matchId]++;
            }
        }
    }

    if (Object.keys(unevaluatedMatchTips).length === 0) {
        return { name: "Čeká se na nové zápasy", count: 0 };
    }

    const hotTipMatchId = Object.keys(unevaluatedMatchTips).reduce((a, b) => unevaluatedMatchTips[a] > unevaluatedMatchTips[b] ? a : b);
    
    let hotTipMatchName = "Neznámý zápas";
    if(allMatches) {
        for (const round of allMatches) {
            const foundMatch = round.matches.find(m => m.id === hotTipMatchId);
            if (foundMatch) {
                hotTipMatchName = foundMatch.name;
                break;
            }
        }
    }

    return { name: hotTipMatchName, count: unevaluatedMatchTips[hotTipMatchId] };
}

function calculatePlayerForm(username, evaluations, allMatches) {
    const userEvals = evaluations?.[username] || {};
    if (Object.keys(userEvals).length < 3 || !allMatches) return 0;

    const allMatchIds = allMatches.flatMap(round => round.matches.map(match => match.id));
    
    const sortedUserEvals = allMatchIds
        .filter(matchId => userEvals[matchId] !== undefined)
        .map(matchId => ({ id: matchId, result: userEvals[matchId] }));

    if (sortedUserEvals.length < 3) return 0;

    let streak = 0;
    for (let i = sortedUserEvals.length - 1; i >= 0; i--) {
        if (sortedUserEvals[i].result === 'ok') {
            streak++;
        } else {
            break;
        }
    }
    
    return streak;
}


function openPerplexityAnalysis(matchName) {
    const prompt = `Poskytni mi stručnou analýzu pro fotbalový zápas. Potřebuji to jasně, hezky strukturováno s emojis. Informace o klubech, zajimavosti, aktualni trener, sestava, historie, rivalita. Buď stručný, ale text pěkne vytvoř a strukturuj a předej infromace, tak aby byly pochopitelné. ZÁPAS: ${matchName}`;
    const encodedPrompt = encodeURIComponent(prompt);
    const url = `https://www.perplexity.ai/?q=${encodedPrompt}`;
    window.open(url, '_blank');
}
window.openPerplexityAnalysis = openPerplexityAnalysis;
window.saveTip = saveTip;
window.saveBet = saveBet;
window.saveProfile = saveProfile;
window.adminEvaluateMatch = adminEvaluateMatch;
window.showResetModal = showResetModal;

// --- ON PAGE LOAD ---
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loginBtn').addEventListener('click', login);
    document.getElementById('registerBtn').addEventListener('click', register);
    document.getElementById('logoutBtn').addEventListener('click', logout);

    initApp();
    
    const confirmBtn = document.getElementById('confirmResetBtn');
    if (confirmBtn) confirmBtn.addEventListener('click', confirmReset);
    
    const resetModalEl = document.getElementById('resetConfirmModal');
    if(resetModalEl) resetModal = new bootstrap.Modal(resetModalEl);
});
