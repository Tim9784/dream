const GAME_ICONS = {
  seabattle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 16.5c1.8-1.2 3.4-1.8 5-.8 1.8 1.1 3.2 1.1 5 0 1.6-1 3.2-.4 5 .8"/><path d="M5 13.5h14l-1.2-3.2a2 2 0 0 0-1.9-1.3H8.1a2 2 0 0 0-1.9 1.3L5 13.5Z"/><path d="M10 9V7.2a1.2 1.2 0 0 1 1.2-1.2h1.6A1.2 1.2 0 0 1 14 7.2V9"/><circle cx="8.5" cy="11.2" r=".7" fill="currentColor" stroke="none"/><circle cx="12" cy="11.2" r=".7" fill="currentColor" stroke="none"/><circle cx="15.5" cy="11.2" r=".7" fill="currentColor" stroke="none"/></svg>`,
  tictactoe: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 4l7 7M11 4L4 11" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="17" cy="17" r="4.2" stroke="currentColor" stroke-width="2.4"/></svg>`,
  checkers: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M12 3.5v17M3.5 12h17"/><rect x="3.5" y="3.5" width="8.5" height="8.5" fill="currentColor" stroke="none" opacity=".22"/><rect x="12" y="12" width="8.5" height="8.5" fill="currentColor" stroke="none" opacity=".22"/><circle cx="7.7" cy="7.7" r="2.55" fill="currentColor" stroke="none"/><circle cx="16.3" cy="16.3" r="2.55" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>`,
  chess: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.5 20h7"/><path d="M9.2 20c0-2.2.7-3.6 1.6-4.8.4-.5.7-1.1.7-1.8V11h1v2.4c0 .7.3 1.3.7 1.8.9 1.2 1.6 2.6 1.6 4.8"/><path d="M10 11c0-1.4.9-2.5 2-2.5s2 1.1 2 2.5"/><circle cx="12" cy="6.2" r="1.5"/><path d="M12 4.7V3.4"/></svg>`,
  backgammon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M7 6.5 9.6 14 12 6.5 14.4 14 17 6.5"/><circle cx="9.6" cy="16.6" r="1.35" fill="currentColor" stroke="none"/><circle cx="14.4" cy="16.6" r="1.35" fill="currentColor" stroke="none"/></svg>`,
  durak: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="3.5" width="12" height="17" rx="2.2"/><path d="M12 8.2c-.9-1.3-2.5-1.2-2.5.2 0 1.4 2.5 3.4 2.5 3.4s2.5-2 2.5-3.4c0-1.4-1.6-1.5-2.5-.2Z" fill="currentColor" stroke="none"/><path d="M9.2 17.8h5.6" stroke-linecap="round"/></svg>`,
  blik: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="10" height="14" rx="2" transform="rotate(-8 9 12)"/><rect x="10" y="5" width="10" height="14" rx="2" transform="rotate(10 15 12)"/><circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none"/></svg>`,
  hangman: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 20h10"/><path d="M7 20V5h8"/><path d="M15 5v3"/><circle cx="15" cy="10.2" r="1.6"/><path d="M15 11.8v3.4M13.4 17.4l1.6-2.2 1.6 2.2M13.6 13.4l-1.6 1.1M16.4 13.4l1.6 1.1"/></svg>`,
};

const ANIMALS = [
  'Лиса','Волк','Медведь','Заяц','Ёж','Белка','Выдра','Рысь','Тигр','Лев',
  'Панда','Коала','Енот','Барсук','Олень','Лось','Кабан','Бобёр','Сова','Орёл',
  'Сокол','Ворон','Пингвин','Дельфин','Кит','Акула','Осьминог','Краб','Черепаха','Лягушка',
  'Кот','Пёс','Хомяк','Капибара','Лама','Альпака','Жираф','Зебра','Слон','Носорог',
  'Крокодил','Хамелеон','Попугай','Пеликан','Фламинго','Ехидна','Кенгуру','Сурикат','Мангуст','Нерпа',
];

function randomAnimal(exclude){
  const pool = exclude ? ANIMALS.filter(a => a !== exclude) : ANIMALS.slice();
  return pool[Math.floor(Math.random() * pool.length)] || 'Лиса';
}

const GAMES = {
  seabattle: {title:'Морской бой', blurb:'Расставь корабли и потопи флот'},
  tictactoe: {title:'Крестики-нолики', blurb:'Классика 3×3'},
  checkers: {title:'Шашки', blurb:'Русские шашки 8×8'},
  chess: {title:'Шахматы', blurb:'Партия на двоих'},
  backgammon: {title:'Нарды', blurb:'Длинные нарды — все с одной головы'},
  durak: {title:'Дурак', blurb:'Подкидной на 2–4 игрока, колода 36'},
  blik: {title:'OUNO', blurb:'Сбрось карты по цвету или знаку — 2–4 игрока'},
  hangman: {title:'Виселица', blurb:'Отгадай слово по буквам — соло'},
};

const METRIKA_ID = 110798358;
const GAME_UTM = {
  seabattle:  {campaign:'seabattle',  content:'morskoy-boy'},
  tictactoe:  {campaign:'tictactoe',  content:'krestiki-noliki'},
  checkers:   {campaign:'checkers',   content:'shashki'},
  chess:      {campaign:'chess',      content:'shahmaty'},
  backgammon: {campaign:'backgammon', content:'nardy'},
  durak:      {campaign:'durak',      content:'durak'},
  blik:       {campaign:'ouno',       content:'ouno'},
  hangman:    {campaign:'hangman',    content:'viselica'},
};

function trackGameUtm(gameId, action){
  const id = String(gameId || '').toLowerCase();
  const meta = GAME_UTM[id];
  if(!meta) return;
  const act = String(action || 'select');
  try{
    const u = new URL(location.href);
    u.searchParams.set('utm_source', 'omove');
    u.searchParams.set('utm_medium', 'game');
    u.searchParams.set('utm_campaign', meta.campaign);
    u.searchParams.set('utm_content', meta.content);
    u.searchParams.set('utm_term', act);
    const next = u.pathname + u.search + u.hash;
    if(next !== location.pathname + location.search + location.hash){
      history.replaceState(history.state || {}, '', next);
    }
  }catch(_){}

  try{
    if(typeof ym === 'function'){
      ym(METRIKA_ID, 'params', {
        game: id,
        game_title: (GAMES[id] && GAMES[id].title) || id,
        game_action: act,
        utm_campaign: meta.campaign,
      });
      ym(METRIKA_ID, 'reachGoal', 'game_' + meta.campaign, {action: act});
      ym(METRIKA_ID, 'reachGoal', 'game_' + meta.campaign + '_' + act);
      // виртуальный просмотр с UTM в URL — Метрика подхватит метки
      ym(METRIKA_ID, 'hit', location.pathname + location.search, {
        title: ((GAMES[id] && GAMES[id].title) || id) + ' — Omove.ru',
        referer: document.referrer || undefined,
      });
    }
  }catch(_){}
}

// чтобы poll не слал «конец игры» много раз
let lastFinishedSig = '';
function trackGameFinished(s){
  if(!s || s.phase !== 'done' || !s.game) return;
  const sig = [s.code || code || '', s.game, s.winner || '', s.loser || '', s.result || '', s.message || ''].join('|');
  if(sig === lastFinishedSig) return;
  lastFinishedSig = sig;
  trackGameUtm(s.game, 'finished');
  try{
    if(typeof ym === 'function'){
      const meta = GAME_UTM[String(s.game).toLowerCase()];
      const campaign = (meta && meta.campaign) || s.game;
      ym(METRIKA_ID, 'reachGoal', 'game_finished', {
        game: s.game,
        campaign,
        winner: s.winner || null,
        result: s.result || null,
        vs_ai: !!s.vs_ai,
        vs_local: !!s.vs_local,
      });
    }
  }catch(_){}
}

const PRESETS = {
  small:{grid:8,fleet:[3,2,2,1,1,1]},
  medium:{grid:10,fleet:[4,3,3,2,2,2,1,1,1,1]},
  large:{grid:12,fleet:[5,4,3,3,2,2,2,2,1,1,1,1]},
};

const LS = {
  get(){ try{return JSON.parse(localStorage.getItem('lobby')||'null')}catch{return null} },
  set(v){ localStorage.setItem('lobby', JSON.stringify(v)) },
  clear(){ localStorage.removeItem('lobby') }
};

const $ = id => document.getElementById(id);
const screens = ['home','setup','lobby','playing','done'];
const show = id => screens.forEach(s => $(s).classList.toggle('hidden', s!==id));

let chosenGame = 'seabattle';
let chosenBoard = 'medium';
let chosenPlayers = 2;
let lastSettings = {game:'seabattle', vsAi:false, vsLocal:false, name:randomAnimal(), name2:randomAnimal(), size:'medium', players:2};
let token=null, code=null, state=null, pollTimer=null;
let tokens = {p1:null, p2:null};
let vsLocal = false;
let hotseatSlot = null; // чей сейчас «экран» после подтверждения передачи
let handoverFor = null;

// seabattle placement
let SB = {
  FLEET: PRESETS.medium.fleet.slice(),
  GRID: 10,
  configKey: `10:${PRESETS.medium.fleet.join(',')}`,
  placed: [],
  selected: null,
  horizontal: true,
};

// checkers/chess selection
let picked = null; // {r,c}
let bgSel = {from:null, die:null};

// не пересобирать UI на каждом poll, если состояние не изменилось
let lastPlaySig = '';
let stateRev = 0;
let rematchBusy = false;

function playStateSig(s){
  if(!s) return '';
  const gs = s.game_state || {};
  return [s.game, s.phase, s.turn, s.you, s.message, s.winner, s.loser, JSON.stringify(gs)].join('|');
}

function boardFilledCount(s){
  const board = s && s.game_state && s.game_state.board;
  if(!Array.isArray(board)) return 0;
  return board.reduce((n,v)=>n+(v?1:0), 0);
}

function currentTheme(){ return document.documentElement.getAttribute('data-theme')==='light'?'light':'dark'; }
function applyTheme(theme){
  const t = theme==='light'?'light':'dark';
  document.documentElement.setAttribute('data-theme', t);
  try{ localStorage.setItem('seabattle-theme', t);}catch(_){}
  $('btnTheme').textContent = t==='light'?'Тёмная':'Светлая';
}
applyTheme(currentTheme());
$('btnTheme').onclick = () => applyTheme(currentTheme()==='light'?'dark':'light');

function setLocalNamesVisible(on){
  const wrap = $('name2Wrap');
  if(wrap) wrap.classList.toggle('hidden', !on);
  const lbl = $('nameLabel');
  if(lbl) lbl.textContent = on ? 'Имя первого' : 'Твоё имя';
}

function openSetup(gameId){
  chosenGame = gameId || chosenGame;
  $('setupTitle').textContent = GAMES[chosenGame].title;
  $('seabattleOpts').classList.toggle('hidden', chosenGame!=='seabattle');
  if($('durakOpts')) $('durakOpts').classList.toggle('hidden', chosenGame!=='durak' && chosenGame!=='blik');
  if($('playersOptsTitle')){
    $('playersOptsTitle').textContent = chosenGame==='blik'
      ? 'Игроков за столом (по сети)'
      : 'Игроков за столом (по сети)';
  }
  $('setupErr').textContent = '';
  setLocalNamesVisible(false);
  if(currentUser && currentUser.name) applyAccountNameToForm();
  else fillDefaultNames();
  show('setup');
  trackGameUtm(chosenGame, 'select');
}

function renderGameCards(){
  const box = $('gameGrid');
  box.innerHTML = '';
  Object.entries(GAMES).forEach(([id, meta])=>{
    if(meta.hidden) return;
    const b = document.createElement('button');
    b.type='button';
    b.className = 'game-card'+(chosenGame===id?' active':'');
    const icon = GAME_ICONS[id] || '';
    b.innerHTML = `<span class="game-card-mark" aria-hidden="true">${icon}</span><span class="game-card-body"><strong>${meta.title}</strong><small>${meta.blurb}</small></span>`;
    b.onclick = ()=>{ chosenGame = id; openSetup(id); };
    box.appendChild(b);
  });
}
renderGameCards();

document.querySelectorAll('.size-btn').forEach(btn=>{
  btn.onclick = ()=>{
    if(btn.dataset.size){
      chosenBoard = btn.dataset.size;
      document.querySelectorAll('#sizePick .size-btn').forEach(x=>x.classList.toggle('active', x.dataset.size===chosenBoard));
    }
    if(btn.dataset.players){
      chosenPlayers = parseInt(btn.dataset.players,10)||2;
      document.querySelectorAll('#playersPick .size-btn').forEach(x=>x.classList.toggle('active', x.dataset.players===String(chosenPlayers)));
    }
  };
});

async function api(path, opts={}){
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers:{'Content-Type':'application/json', ...(opts.headers||{})},
    ...opts
  });
  const data = await res.json().catch(()=>({ok:false,error:'Ответ сервера'}));
  if(!res.ok || data.ok===false) throw new Error(data.error || 'Ошибка запроса');
  return data;
}

let currentUser = null;

function applyAccountNameToForm(){
  if(!currentUser || !currentUser.name) return;
  if($('name')){
    $('name').value = currentUser.name;
    $('name').dataset.fromUser = '1';
  }
  if($('authName')) $('authName').value = currentUser.name;
  lastSettings.name = currentUser.name;
}

function renderAccount(){
  const box = $('accountBox');
  if(!box) return;
  if(currentUser){
    box.innerHTML = `
      <div class="account-chip" title="${currentUser.email || ''}">
        <strong>${escapeHtml(currentUser.name || 'Игрок')}</strong>
        <small>${Number(currentUser.wins||0)} побед</small>
      </div>
      <button type="button" class="theme-btn" id="btnLogout" style="margin-top:0">Выйти</button>
    `;
    const btn = $('btnLogout');
    if(btn) btn.onclick = logoutUser;
    applyAccountNameToForm();
  }else{
    box.innerHTML = `<button type="button" class="theme-btn" id="btnLogin" style="margin-top:0">Войти</button>`;
    const btn = $('btnLogin');
    if(btn) btn.onclick = openAuthModal;
    if($('name')) delete $('name').dataset.fromUser;
  }
}

function escapeHtml(s){
  return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function openAuthModal(){
  const m = $('authModal');
  if(!m) return;
  $('authErr').textContent = '';
  $('authHint').textContent = '';
  if($('authName')){
    if(currentUser && currentUser.name){
      $('authName').value = currentUser.name;
    }else{
      // только явно введённое в сетапе имя — не случайный nickname
      const n = $('name');
      const fromSetup = (n && n.value || '').trim();
      if(fromSetup && n.dataset.fromUser === '1' && !$('authName').value.trim()){
        $('authName').value = fromSetup;
      }
    }
  }
  m.classList.remove('hidden');
  m.setAttribute('aria-hidden', 'false');
  if($('authEmail')) $('authEmail').focus();
}
function closeAuthModal(){
  const m = $('authModal');
  if(!m) return;
  m.classList.add('hidden');
  m.setAttribute('aria-hidden', 'true');
}

async function refreshMe(){
  try{
    const data = await api('/api/me');
    currentUser = data.user || null;
  }catch(_){
    currentUser = null;
  }
  renderAccount();
}

async function logoutUser(){
  try{ await api('/api/auth/logout', {method:'POST', body:'{}'}); }catch(_){}
  currentUser = null;
  renderAccount();
  loadRating();
}

function extractAuthToken(raw){
  const s = String(raw || '').trim();
  if(!s) return '';
  const m = s.match(/\/a\/([0-9a-fA-F]{16,64})/);
  if(m) return m[1].toLowerCase();
  const m2 = s.match(/[?&]auth=([0-9a-fA-F]{16,64})/);
  if(m2) return m2[1].toLowerCase();
  if(/^[0-9a-fA-F]{16,64}$/.test(s)) return s.toLowerCase();
  return '';
}

async function sendAuthLink(){
  const email = ($('authEmail') && $('authEmail').value || '').trim();
  const name = ($('authName') && $('authName').value || '').trim();
  $('authErr').textContent = '';
  $('authHint').textContent = '';
  try{
    const data = await api('/api/auth/request-link', {
      method: 'POST',
      body: JSON.stringify({email, name}),
    });
    let msg = `Письмо отправлено на ${data.email || email}. Открой ссылку из письма или скопируй код сюда в поле ниже.`;
    if(data.hint) msg += ' ' + data.hint;
    $('authHint').textContent = msg;
  }catch(e){
    $('authErr').textContent = e.message || 'Не удалось отправить';
  }
}

async function loginWithAuthCode(){
  $('authErr').textContent = '';
  $('authHint').textContent = '';
  const token = extractAuthToken($('authCode') && $('authCode').value);
  if(!token){
    $('authErr').textContent = 'Вставь код или ссылку вида omove.ru/a/…';
    return;
  }
  try{
    // относительный путь — работает даже когда https с телефона ломается
    location.href = '/a/' + encodeURIComponent(token);
  }catch(e){
    $('authErr').textContent = e.message || 'Не удалось открыть вход';
  }
}

async function verifyAuthToken(token){
  try{
    const data = await api('/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify({token}),
    });
    currentUser = data.user || null;
    renderAccount();
    loadRating();
    if($('homeErr')) $('homeErr').textContent = currentUser
      ? `Вы вошли как ${currentUser.name}. Победы будут в рейтинге.`
      : '';
  }catch(e){
    if($('homeErr')) $('homeErr').textContent = e.message || 'Ссылка для входа не сработала';
  }
  try{
    const u = new URL(location.href);
    if(u.searchParams.has('auth')){
      u.searchParams.delete('auth');
      history.replaceState(history.state || {}, '', u.pathname + u.search + u.hash);
    }
  }catch(_){}
}

async function loadRating(){
  const list = $('ratingList');
  if(!list) return;
  try{
    const data = await api('/api/rating?limit=15');
    const rows = data.rating || [];
    if(data.user) currentUser = data.user;
    if(!rows.length){
      list.innerHTML = '';
      if($('ratingHint')) $('ratingHint').textContent = 'Пока нет побед в рейтинге. Войди и выиграй партию.';
      return;
    }
    list.innerHTML = rows.map((r, i) => {
      const me = currentUser && Number(currentUser.id) === Number(r.id);
      return `<li class="${me?'me':''}" style="animation-delay:${Math.min(i,8)*40}ms">
        <span class="rank">${r.rank}</span>
        <span class="who">${escapeHtml(r.name)}</span>
        <span class="wins">${r.wins}</span>
      </li>`;
    }).join('');
    if($('ratingHint')){
      $('ratingHint').textContent = currentUser
        ? `Ты: ${currentUser.name} · ${currentUser.wins||0} побед · ${currentUser.games||0} партий`
        : 'Войди по email — победы в играх попадут в рейтинг.';
    }
  }catch(_){
    if($('ratingHint')) $('ratingHint').textContent = 'Рейтинг временно недоступен.';
  }
}

if($('btnAuthClose')) $('btnAuthClose').onclick = closeAuthModal;
if($('btnAuthSend')) $('btnAuthSend').onclick = sendAuthLink;
if($('btnAuthCode')) $('btnAuthCode').onclick = loginWithAuthCode;
if($('btnLogin')) $('btnLogin').onclick = openAuthModal;
if($('authModal')){
  $('authModal').addEventListener('click', (e)=>{
    if(e.target === $('authModal')) closeAuthModal();
  });
}

let authReady = (async function bootAuth(){
  try{
    const u = new URL(location.href);
    const authTok = (u.searchParams.get('auth') || '').trim().toLowerCase();
    const authOk = u.searchParams.get('auth_ok') === '1';
    const authErr = u.searchParams.get('auth_err') === '1';
    if(authTok){
      await verifyAuthToken(authTok);
    }else{
      await refreshMe();
      if(authOk && currentUser && $('homeErr')){
        $('homeErr').textContent = `Вы вошли как ${currentUser.name}. Победы будут в рейтинге.`;
      }else if(authErr && $('homeErr')){
        $('homeErr').textContent = 'Ссылка для входа недействительна или устарела. Запроси новую.';
      }
      if(authOk || authErr){
        u.searchParams.delete('auth_ok');
        u.searchParams.delete('auth_err');
        history.replaceState(history.state || {}, '', u.pathname + u.search + u.hash);
      }
    }
  }catch(_){
    try{ await refreshMe(); }catch(__){}
  }
  fillDefaultNames();
  loadRating();
})();

let roomMisses = 0;

function startPoll(){
  stopPoll();
  roomMisses = 0;
  pollTimer = setInterval(async ()=>{
    if(!code||!token) return;
    try{
      const data = await api(`/api/room/${code}?token=${encodeURIComponent(token)}`);
      roomMisses = 0;
      // после рематча фаза уходит с done — нельзя отфильтровать как «откат доски»
      const fromDone = !!(state && state.phase==='done' && data.state && data.state.phase!=='done');
      applyState(data.state, fromDone ? {force:true} : {});
      if(fromDone) lastPlaySig = '';
    }catch(e){
      const msg = String(e.message||'');
      if(msg.includes('не найдена') || msg.includes('Не найдена')){
        roomMisses += 1;
        // не выкидываем сразу — бывает гонка чтения на хостинге
        if(roomMisses >= 4){
          // пробуем один раз переподключиться по токену, не очищая сессию заранее
          try{
            const saved = LS.get();
            const joinName = (currentUser && currentUser.name)
              || (saved && saved.name)
              || ($('name') && $('name').value)
              || randomAnimal();
            const data = await api('/api/room/join', {
              method:'POST',
              body: JSON.stringify({ name: joinName, code, token })
            });
            token = data.token; code = data.code;
            roomMisses = 0;
            LS.set({ ...(saved||{}), token, code, name: joinName, game: (data.state&&data.state.game)||chosenGame });
            applyState(data.state);
            return;
          }catch(_){}
          goHome('Комната закрыта');
        }
      }
    }
  }, 900);
}
function stopPoll(){ if(pollTimer){ clearInterval(pollTimer); pollTimer=null; } }

function playerName(el){
  // в аккаунте всегда играем под выбранным именем, даже если в поле ещё random из LS
  if(currentUser && currentUser.name) return String(currentUser.name).slice(0, 20);
  const v = (el && el.value || '').trim();
  if(v) return v;
  return randomAnimal();
}

function fillDefaultNames(){
  // если уже вошли — всегда имя из аккаунта, не случайное
  if(currentUser && currentUser.name){
    applyAccountNameToForm();
    const n2 = $('name2');
    if(n2 && (!n2.value.trim() || /^Игрок\s*\d*$/i.test(n2.value.trim()))){
      n2.value = randomAnimal(currentUser.name);
    }
    return;
  }
  const n1 = $('name');
  const n2 = $('name2');
  if(n1 && n1.dataset.fromUser === '1') return;
  if(n1 && (!n1.value.trim() || /^Игрок\s*\d*$/i.test(n1.value.trim()))){
    n1.value = randomAnimal();
  }
  if(n2 && (!n2.value.trim() || /^Игрок\s*\d*$/i.test(n2.value.trim()))){
    n2.value = randomAnimal(n1 && n1.value.trim());
  }
}

// ручной ввод в сетапе помечаем, чтобы можно было перенести в форму входа
if($('name')){
  $('name').addEventListener('input', ()=>{
    const v = ($('name').value || '').trim();
    if(v) $('name').dataset.fromUser = '1';
    else delete $('name').dataset.fromUser;
  });
}

function needsPrivacy(game){
  // экран «я за экраном» — морской бой и карты (скрытая рука)
  return game==='seabattle' || game==='durak' || game==='blik';
}

function desiredHotseatSlot(s){
  if(!s || !s.vs_local) return s && s.you;
  if(s.phase==='done') return s.you || 'p1';
  if(s.phase==='placing'){
    const ready = (s.game_state && s.game_state.ready) || {};
    if(!ready.p1) return 'p1';
    if(!ready.p2) return 'p2';
    return s.turn || 'p1';
  }
  if(s.phase==='playing') return s.turn || 'p1';
  return 'p1';
}

function slotName(s, slot){
  return (s.players && s.players[slot] && s.players[slot].name) || randomAnimal();
}

function renderLobbyPlayers(s){
  const el = $('lobbyPlayers');
  if(!el) return;
  const need = s.max_players || 2;
  const slots = Object.keys(s.players||{}).sort();
  const seated = slots.filter(k => s.players[k]);
  const empty = Math.max(0, need - seated.length);
  const rows = seated.map(slot => {
    const p = s.players[slot];
    const mine = slot === s.you;
    const you = mine ? ' <span class="lobby-you-tag">ты</span>' : '';
    return `<li class="lobby-player${mine?' me':''}"><span class="lobby-player-dot"></span><span class="lobby-player-name">${escapeHtml(p.name)}</span>${you}</li>`;
  });
  for(let i=0;i<empty;i++){
    rows.push(`<li class="lobby-player empty"><span class="lobby-player-dot"></span><span class="lobby-player-name">Ждём игрока…</span></li>`);
  }
  el.innerHTML = `
    <div class="lobby-players-title">Сейчас в лобби</div>
    <ul class="lobby-players-list">${rows.join('')}</ul>`;
}

function escapeHtml(str){
  return String(str??'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

async function switchToSlot(slot){
  if(!vsLocal || !tokens[slot]) return;
  token = tokens[slot];
  hotseatSlot = slot;
  picked=null; bgSel={from:null,die:null,dieIdx:null};
  if(state && state.phase==='placing'){ SB.placed=[]; SB.selected=null; }
  const data = await api(`/api/room/${code}?token=${encodeURIComponent(token)}`);
  applyState(data.state, {skipHandover:true});
}

function renderHandover(s, nextSlot){
  const mount = $('gameMount');
  const name = slotName(s, nextSlot);
  const hint = s.game==='durak'
    ? 'Пусть второй игрок отвернётся — сейчас откроются твои карты.'
    : 'Пусть второй игрок отвернётся — сейчас откроется твоё поле с кораблями.';
  mount.innerHTML = `
    <div class="handover">
      <div class="handover-title">Ход: ${name}</div>
      <p class="hint">${hint}</p>
      <button type="button" class="btn" id="btnHandoverReady">Я за экраном — показать</button>
    </div>`;
  $('btnHandoverReady').onclick = ()=>switchToSlot(nextSlot).catch(e=>{
    $('playErr').textContent = e.message;
  });
}

function isMyAction(s){
  if(!s) return false;
  if(s.phase==='placing'){
    if(!s.you) return false;
    const ready = (s.game_state && s.game_state.ready) || {};
    return ready[s.you] !== true;
  }
  if(s.phase!=='playing') return false;
  if(s.you!=null && s.turn!=null && String(s.turn)===String(s.you)) return true;
  if(s.your_name && s.turn && s.players && s.players[s.turn] && s.players[s.turn].name===s.your_name) return true;
  // запасной путь по тексту статуса (если you вдруг потерялся)
  if(s.your_name && s.message){
    const name = s.your_name;
    const msg = String(s.message);
    if(
      msg === 'Ход '+name ||
      msg.startsWith('Ход '+name) ||
      msg.indexOf('— '+name) !== -1 ||
      msg.indexOf('- '+name) !== -1 ||
      msg.indexOf(name+' продолжает') !== -1
    ) return true;
  }
  return false;
}

function setPlayStatus(s, text, opts){
  opts = opts || {};
  const el = $('playStatus');
  if(!el) return;
  el.textContent = text || '';
  let mine;
  if(opts.forceMyTurn === true) mine = true;
  else if(opts.forceMyTurn === false) mine = false;
  else mine = isMyAction(s);
  // жёстко выставляем класс, без toggle-гонок
  el.className = mine ? 'status my-turn' : 'status';
  if(mine){
    const light = document.documentElement.getAttribute('data-theme')==='light';
    el.style.setProperty('color', light ? '#166534' : '#86efac', 'important');
    el.style.setProperty('background', light ? 'rgba(22,163,74,.18)' : 'rgba(34,197,94,.28)', 'important');
    el.style.setProperty('border-color', light ? 'rgba(22,163,74,.65)' : 'rgba(74,222,128,.75)', 'important');
    el.style.fontWeight = '700';
  } else {
    el.style.removeProperty('color');
    el.style.removeProperty('background');
    el.style.removeProperty('border-color');
    el.style.fontWeight = '';
  }
}

function setWinChance(s){
  const box = $('winChance');
  const pctEl = $('winChancePct');
  if(!box || !pctEl) return;
  const show = !!(s && s.vs_ai && s.win_chance!=null && (s.phase==='playing' || s.phase==='placing' || s.phase==='done'));
  box.classList.toggle('hidden', !show);
  if(!show) return;
  const pct = Math.max(0, Math.min(100, Number(s.win_chance)||0));
  pctEl.textContent = pct + '%';
  box.classList.remove('low','mid','high');
  box.classList.add(pct < 35 ? 'low' : (pct < 60 ? 'mid' : 'high'));
}

function applyState(s, opts={}){
  if(!s) return;
  const rev = Number(s.rev) || 0;
  // устаревший poll не должен откатывать доску после хода
  if(!opts.force && rev && stateRev && rev < stateRev) return;
  // защита только внутри текущей партии — после done/рематча пустая доска законна
  if(
    !opts.force &&
    state &&
    state.phase !== 'done' &&
    s.phase !== 'done' &&
    s.game==='tictactoe' &&
    (s.phase==='playing'||s.phase==='placing') &&
    boardFilledCount(s) < boardFilledCount(state)
  ){
    return;
  }
  if(rev) stateRev = rev;
  state = s;
  lastSettings.game = s.game || lastSettings.game;
  lastSettings.vsAi = !!s.vs_ai;
  lastSettings.vsLocal = !!s.vs_local;
  vsLocal = !!s.vs_local;

  if(vsLocal && s.phase!=='lobby' && s.phase!=='done' && !opts.skipHandover){
    const need = desiredHotseatSlot(s);
    if(need && hotseatSlot !== need){
      if(needsPrivacy(s.game)){
        show('playing');
        $('playTitle').textContent = s.game_title + ' · вместе';
        setPlayStatus(s, s.message || '', {forceMyTurn:false});
        setWinChance(s);
        $('playErr').textContent = '';
        if(handoverFor !== need){
          handoverFor = need;
          renderHandover(s, need);
        }
        return;
      }
      // остальные игры — сразу переключаем активного игрока без оверлея
      if(handoverFor !== 'auto:'+need){
        handoverFor = 'auto:'+need;
        switchToSlot(need).catch(e=>{ $('playErr').textContent = e.message; });
      }
      return;
    }
  }
  handoverFor = null;

  if(s.phase==='lobby'){
    show('lobby');
    $('lobbyGame').textContent = s.game_title;
    $('codeView').textContent = s.code;
    clearShareHint(false);
    const need = s.max_players || 2;
    const have = s.players_count || Object.values(s.players||{}).filter(Boolean).length;
    const left = Math.max(0, need - have);
    const canStart = !!s.can_start;
    const isHost = s.is_host || s.you==='p1';
    if(left){
      $('lobbyHint').textContent = s.message || `Ждём игроков… ${have}/${need}`;
    } else if(isHost){
      $('lobbyHint').textContent = s.message || 'Все на месте — нажми «Начать игру»';
    } else {
      $('lobbyHint').textContent = s.message || 'Все на месте';
    }
    const startRow = $('startRow');
    if(startRow) startRow.classList.toggle('hidden', !(canStart && isHost));
    const waitHost = $('waitHostHint');
    if(waitHost){
      waitHost.classList.toggle('hidden', !!isHost);
      waitHost.textContent = left
        ? 'Ждём организатора…'
        : 'Ждём, пока организатор начнёт игру…';
    }
    const lobbyErr = $('lobbyErr');
    if(lobbyErr && !lobbyErr.dataset.keep) lobbyErr.textContent = '';
    renderLobbyPlayers(s);
    setWinChance(null);
    if(!pollTimer) startPoll();
  } else if(s.phase==='placing' || s.phase==='playing'){
    show('playing');
    const localTag = s.vs_local ? ' · вместе' : '';
    $('playTitle').textContent = s.game_title + localTag;
    const who = s.vs_local && s.your_name ? `${s.your_name}: ` : '';
    setPlayStatus(s, who + (s.message || ''));
    setWinChance(s);
    if(!pollTimer) startPoll();
    const sig = playStateSig(s);
    if(sig === lastPlaySig) return;
    lastPlaySig = sig;
    renderGame(s);
  } else if(s.phase==='done'){
    show('done');
    setWinChance(s);
    const finSig = [s.code||'', s.game||'', s.winner||'', s.loser||'', s.result||'', s.message||''].join('|');
    const enteredDone = finSig !== lastFinishedSig;
    trackGameFinished(s);
    // рейтинг/аккаунт — один раз при входе на экран конца, не на каждом poll
    if(enteredDone){
      refreshMe();
      loadRating();
    }
    if(!pollTimer) startPoll(); // чтобы увидеть рематч от друзей
    const voted = !!(s.you && s.rematch_votes && s.rematch_votes[s.you]);
    const rematchBtn = $('btnReplay');
    if(rematchBtn && !rematchBusy){
      if(s.vs_ai || s.vs_local){
        rematchBtn.textContent = 'Играть заново';
        rematchBtn.disabled = false;
      } else if(s.rematch_ready){
        rematchBtn.textContent = 'Играть заново';
        rematchBtn.disabled = false;
      } else if(voted){
        rematchBtn.textContent = 'Ждём остальных…';
        rematchBtn.disabled = true;
      } else {
        rematchBtn.textContent = 'Играть заново вместе';
        rematchBtn.disabled = false;
      }
    }
    if(s.result==='draw' || (s.winner==null && !s.loser && (s.message||'').toLowerCase().includes('нич'))){
      $('doneStatus').textContent = s.message || 'Ничья!';
    } else if(s.vs_local){
      if(s.loser && s.players[s.loser]){
        $('doneStatus').textContent = s.message || `${s.players[s.loser].name} — дурак`;
      } else if(s.winner && s.players[s.winner]){
        $('doneStatus').textContent = s.message || `Победа: ${s.players[s.winner].name}`;
      } else {
        $('doneStatus').textContent = s.message || 'Игра окончена';
      }
    } else {
      const win = s.winner && s.winner === s.you;
      const iWon = win || (s.winners && s.you && s.winners.includes(s.you));
      const iLost = s.loser && s.loser === s.you;
      if(s.result==='draw' || (s.winner==null && !s.loser && (s.message||'').toLowerCase().includes('нич'))){
        $('doneStatus').textContent = s.message || 'Ничья!';
      } else if(iWon){
        $('doneStatus').textContent = s.message || 'Победа!';
      } else if(iLost){
        $('doneStatus').textContent = s.message || 'Ты дурак';
      } else {
        $('doneStatus').textContent = s.message || 'Игра окончена';
      }
    }
  }
}

async function doAction(payload){
  $('playErr').textContent='';
  try{
    const data = await api(`/api/room/${code}/action`, {
      method:'POST',
      body:JSON.stringify({token, ...payload})
    });
    applyState(data.state);
  }catch(e){ $('playErr').textContent=e.message; }
}

function renderGame(s){
  const mount = $('gameMount');
  if(s.game==='seabattle') return renderSeabattle(mount, s);
  if(s.game==='tictactoe') return renderTTT(mount, s);
  if(s.game==='checkers') return renderBoardGame(mount, s, 'checkers');
  if(s.game==='chess') return renderBoardGame(mount, s, 'chess');
  if(s.game==='backgammon') return renderBackgammon(mount, s);
  if(s.game==='durak') return renderDurak(mount, s);
  if(s.game==='blik') return renderBlik(mount, s);
  if(s.game==='hangman') return renderHangman(mount, s);
}

/* ===== Sea battle ===== */
function sbFleetKey(fleet){
  return (fleet||[]).map(n=>Number(n)).join(',');
}

function syncSB(gs){
  const grid = Number(gs.grid) || 10;
  const fleet = (gs.fleet||PRESETS.medium.fleet).map(n=>Number(n));
  const nextKey = `${grid}:${sbFleetKey(fleet)}`;
  if(nextKey !== SB.configKey){
    SB.GRID = grid;
    SB.FLEET = fleet.slice();
    SB.configKey = nextKey;
    SB.placed = [];
    SB.selected = null;
  }
}

function normalizeSBShip(ship){
  return {
    size: Number(ship.size),
    x: Number(ship.x),
    y: Number(ship.y),
    horizontal: ship.horizontal !== false,
  };
}

function hydrateSBFromServer(gs, s){
  const ships = gs.ships;
  if(!Array.isArray(ships) || !ships.length) return;
  const me = s && s.you;
  const amReady = !!(me && gs.ready && gs.ready[me]);
  if(!SB.placed.length || (amReady && ships.length === SB.FLEET.length)){
    SB.placed = ships.map(normalizeSBShip);
    SB.selected = null;
  }
}

function isSBReadyLocked(){
  const gs = state && state.game_state;
  return !!(gs && state.you && gs.ready && gs.ready[state.you]);
}

function sbPlaceMountKey(ready){
  return `${SB.configKey}:${ready?'ready':'active'}`;
}

function bindSBPlaceControls(){
  $('sbRotate').onclick = ()=>{ if(isSBReadyLocked()) return; SB.horizontal = !SB.horizontal; };
  $('sbClear').onclick = ()=>{ if(isSBReadyLocked()) return; SB.placed=[]; SB.selected=null; paintSBPlace(); };
  $('sbRandom').onclick = ()=>{ if(isSBReadyLocked()) return; randomSB(); };
  $('sbReady').onclick = ()=>{
    if(isSBReadyLocked()) return;
    if(SB.placed.length !== SB.FLEET.length) return;
    doAction({type:'place', ships:SB.placed});
  };
}

function updateSBPlaceReady(ready){
  const readyBtn = $('sbReady');
  if(readyBtn){
    readyBtn.textContent = ready ? 'Ожидаем соперника…' : 'Готов к бою';
    readyBtn.disabled = ready || SB.placed.length !== SB.FLEET.length;
  }
  ['sbClear','sbRandom','sbRotate'].forEach(id=>{
    const el = $(id);
    if(el) el.disabled = !!ready;
  });
}

function cellsOf(ship){
  const cells=[];
  for(let i=0;i<ship.size;i++) cells.push(ship.horizontal?[ship.x+i,ship.y]:[ship.x,ship.y+i]);
  return cells;
}
function canPlace(ship){
  const cells=cellsOf(ship);
  for(const [x,y] of cells) if(x<0||y<0||x>=SB.GRID||y>=SB.GRID) return false;
  const occ=new Set();
  SB.placed.forEach(s=>cellsOf(s).forEach(([x,y])=>occ.add(x+','+y)));
  for(const [x,y] of cells){
    if(occ.has(x+','+y)) return false;
    for(let dx=-1;dx<=1;dx++) for(let dy=-1;dy<=1;dy++){
      const k=(x+dx)+','+(y+dy);
      if(occ.has(k) && !cells.some(([cx,cy])=>cx===x+dx&&cy===y+dy)) return false;
    }
  }
  return true;
}

function renderSeabattle(mount, s){
  const gs = s.game_state||{};
  syncSB(gs);
  hydrateSBFromServer(gs, s);
  const phase = gs.phase || (s.phase==='placing'?'placing':'battle');
  if(phase==='placing'){
    const ready = !!(gs.ready && s.you && gs.ready[s.you]);
    const placeKey = sbPlaceMountKey(ready);
    if(mount.dataset.sbPlaceKey === placeKey && $('sbPlace') && $('sbFleet')){
      updateSBPlaceReady(ready);
      paintSBPlace();
      return;
    }
    mount.dataset.sbPlaceKey = placeKey;
    mount.innerHTML = `
      <div class="toolbar">
        <button class="btn ghost" id="sbRotate">Повернуть</button>
        <button class="btn ghost" id="sbRandom">Случайно</button>
        <button class="btn ghost" id="sbClear">Сбросить</button>
        <button class="btn" id="sbReady" ${ready?'disabled':''}>${ready?'Ожидаем соперника…':'Готов к бою'}</button>
      </div>
      <div class="fleet" id="sbFleet"></div>
      <div class="grid" id="sbPlace" style="grid-template-columns:repeat(${SB.GRID},1fr);max-width:460px;margin-top:12px"></div>`;
    bindSBPlaceControls();
    updateSBPlaceReady(ready);
    paintSBPlace();
    return;
  }
  mount.dataset.sbPlaceKey = '';
  // battle
  const enemyLeft = gs.enemy_ships_left;
  const enemyLabel = enemyLeft==null
    ? 'Враг'
    : `Враг · осталось ${enemyLeft} ${shipWordRu(enemyLeft)}`;
  mount.innerHTML = `<div class="boards">
    <div><h3 style="color:var(--heading)">${enemyLabel}</h3><div class="grid" id="sbEnemy" style="grid-template-columns:repeat(${SB.GRID},1fr)"></div></div>
    <div><h3 style="color:var(--heading)">Твои корабли</h3><div class="grid" id="sbOwn" style="grid-template-columns:repeat(${SB.GRID},1fr)"></div></div>
  </div>`;
  const myTurn = s.turn===s.you;
  drawSBGrid($('sbEnemy'), gs.enemy||emptySB(), true, myTurn);
  const own = emptySB();
  const board = gs.board||emptySB();
  const incoming = gs.incoming||emptySB();
  for(let y=0;y<SB.GRID;y++) for(let x=0;x<SB.GRID;x++){
    if(board[y][x]) own[y][x]=3;
    if(incoming[y][x]===1) own[y][x]=1;
    else if(incoming[y][x]===2) own[y][x]=2;
  }
  drawSBGrid($('sbOwn'), own, false, false);
}

function emptySB(){ return Array.from({length:SB.GRID},()=>Array(SB.GRID).fill(0)); }

function shipWordRu(n){
  const abs = Math.abs(n|0);
  const n10 = abs % 10, n100 = abs % 100;
  if(n100>=11 && n100<=14) return 'кораблей';
  if(n10===1) return 'корабль';
  if(n10>=2 && n10<=4) return 'корабля';
  return 'кораблей';
}

function paintSBPlace(){
  const g=$('sbPlace'); if(!g) return;
  const board=emptySB();
  SB.placed.forEach(s=>cellsOf(s).forEach(([x,y])=>board[y][x]=1));
  g.innerHTML='';
  for(let y=0;y<SB.GRID;y++) for(let x=0;x<SB.GRID;x++){
    const d=document.createElement('div');
    d.className='cell'+(board[y][x]?' ship':'');
    d.onmouseenter=()=>{
      if(SB.selected==null) return;
      paintSBPlace();
      const ship={size:SB.selected,x,y,horizontal:SB.horizontal};
      const ok=canPlace(ship);
      cellsOf(ship).forEach(([cx,cy])=>{
        if(cx<0||cy<0||cx>=SB.GRID||cy>=SB.GRID) return;
        g.children[cy*SB.GRID+cx]?.classList.add(ok?'preview':'bad');
      });
    };
    d.onmouseleave=()=>paintSBPlace();
    const placeAt = ()=>{
      if(isSBReadyLocked() || SB.selected==null) return;
      const ship={size:SB.selected,x,y,horizontal:SB.horizontal};
      if(!canPlace(ship)) return;
      SB.placed.push(ship); SB.selected=null; paintSBPlace();
    };
    d.onclick=placeAt;
    d.addEventListener('touchend', e=>{ e.preventDefault(); placeAt(); }, {passive:false});
    g.appendChild(d);
  }
  const fleet=$('sbFleet');
  fleet.innerHTML='';
  const rem=[...SB.FLEET];
  SB.placed.forEach(p=>{ const i=rem.indexOf(p.size); if(i>=0) rem.splice(i,1); });
  const counts={}; rem.forEach(s=>counts[s]=(counts[s]||0)+1);
  [...new Set(SB.FLEET)].forEach(size=>{
    for(let n=0;n<(counts[size]||0);n++){
      const chip=document.createElement('div');
      chip.className='ship-chip'+(SB.selected===size?' active':'');
      const pickShip=()=>{ if(isSBReadyLocked()) return; SB.selected=size; paintSBPlace(); };
      chip.onclick=pickShip;
      chip.addEventListener('touchend', e=>{ e.preventDefault(); pickShip(); }, {passive:false});
      for(let i=0;i<size;i++){ const seg=document.createElement('div'); seg.className='seg'; chip.appendChild(seg); }
      fleet.appendChild(chip);
    }
  });
  updateSBPlaceReady(isSBReadyLocked());
}

function randomSB(){
  SB.placed=[];
  const order=[...SB.FLEET].sort((a,b)=>b-a);
  for(const size of order){
    let ok=false;
    for(let t=0;t<600;t++){
      const horizontal=Math.random()>0.5;
      const x=Math.floor(Math.random()*(horizontal?SB.GRID-size+1:SB.GRID));
      const y=Math.floor(Math.random()*(horizontal?SB.GRID:SB.GRID-size+1));
      const ship={size,x,y,horizontal};
      if(canPlace(ship)){ SB.placed.push(ship); ok=true; break; }
    }
    if(!ok){ return randomSB(); }
  }
  SB.selected=null; paintSBPlace();
}

function drawSBGrid(el, matrix, clickable, enabled){
  el.innerHTML='';
  for(let y=0;y<SB.GRID;y++) for(let x=0;x<SB.GRID;x++){
    const v=matrix[y][x];
    const d=document.createElement('div');
    let cls='cell';
    if(v===1) cls+=' hit'; else if(v===2) cls+=' miss'; else if(v===3) cls+=' ship';
    if(!clickable||!enabled||v!==0) cls+=' locked';
    d.className=cls;
    if(clickable&&enabled&&v===0) d.onclick=()=>doAction({type:'shot',x,y});
    el.appendChild(d);
  }
}

/* ===== TicTacToe ===== */
function renderTTT(mount, s){
  const board = (s.game_state&&s.game_state.board)||Array(9).fill(0);
  const myTurn = s.turn===s.you && s.phase==='playing';
  // не трогаем innerHTML целиком — иначе после хода доска на миг «пустеет»
  let box = mount.querySelector('#ttt');
  if(!box || mount.dataset.gameUi !== 'tictactoe'){
    mount.dataset.gameUi = 'tictactoe';
    mount.innerHTML = `<div class="ttt" id="ttt"></div>`;
    box = mount.querySelector('#ttt');
    for(let i=0;i<9;i++){
      const b=document.createElement('button');
      b.type = 'button';
      b.dataset.cell = String(i);
      b.onclick = ()=>doAction({cell:i});
      box.appendChild(b);
    }
  }
  const buttons = box.querySelectorAll('button');
  board.forEach((v,i)=>{
    const b = buttons[i];
    if(!b) return;
    const mark = v===1?'X':(v===2?'O':'');
    if(b.textContent !== mark) b.textContent = mark;
    b.disabled = !myTurn || !!v;
  });
}

/* ===== Hangman (Виселица) ===== */
function renderHangman(mount, s){
  const gs = s.game_state||{};
  const masked = gs.masked || '';
  const wrong = gs.wrong|0, max = gs.max_wrong|0;
  const guessed = new Set(gs.guessed||[]);
  // простая «виселица» — SVG по количеству ошибок
  const parts = [];
  // опора
  parts.push(`<line x1="10" y1="140" x2="120" y2="140"/>`);
  parts.push(`<line x1="30" y1="20" x2="30" y2="140"/>`);
  parts.push(`<line x1="30" y1="20" x2="90" y2="20"/>`);
  parts.push(`<line x1="90" y1="20" x2="90" y2="38"/>`);
  if(wrong>0) parts.push(`<circle cx="90" cy="50" r="12"/>`);              // голова
  if(wrong>1) parts.push(`<line x1="90" y1="62" x2="90" y2="96"/>`);        // туловище
  if(wrong>2) parts.push(`<line x1="90" y1="70" x2="76" y2="84"/>`);        // левая рука
  if(wrong>3) parts.push(`<line x1="90" y1="70" x2="104" y2="84"/>`);       // правая рука
  if(wrong>4) parts.push(`<line x1="90" y1="96" x2="80" y2="118"/>`);       // левая нога
  if(wrong>5) parts.push(`<line x1="90" y1="96" x2="100" y2="118"/>`);      // правая нога
  mount.innerHTML = `
    <div class="hangman">
      <div class="hangman-top">
        <svg viewBox="0 0 150 150" class="hangman-svg" aria-label="Виселица">${parts.join('')}</svg>
        <div class="hangman-info">
          <div class="hangman-word" aria-live="polite">${masked}</div>
          <div class="hangman-tries">Ошибки: ${wrong}/${max}</div>
        </div>
      </div>
      <div class="kb" id="hgKb"></div>
    </div>`;
  const letters = (gs.alphabet||[]).slice();
  const kb = $('hgKb');
  kb.innerHTML = '';
  letters.forEach((L,i)=>{
    const b=document.createElement('button');
    b.type='button';
    b.className='kb-btn'+(guessed.has(L)?' used':'');
    b.textContent=L;
    if(guessed.has(L) || s.phase==='done'){ b.disabled=true; }
    b.onclick=()=>doAction({type:'guess', letter:L});
    kb.appendChild(b);
  });
}

/* ===== Checkers / Chess ===== */
// Официальные силуэты Wikimedia Chess_*lt45.svg; цвет через FILL/STROKE
const CHESS_SVG = {
  K: `<g fill="none" fill-rule="evenodd" stroke="STROKE" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"> <path stroke-linejoin="miter" d="M22.5 11.63V6M20 8h5"/> <path fill="FILL" stroke-linecap="butt" stroke-linejoin="miter" d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5"/> <path fill="FILL" d="M12.5 37c5.5 3.5 14.5 3.5 20 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-2.5-7.5-12-10.5-16-4-3 6 6 10.5 6 10.5v7"/> <path d="M12.5 30c5.5-3 14.5-3 20 0m-20 3.5c5.5-3 14.5-3 20 0m-20 3.5c5.5-3 14.5-3 20 0"/> </g>`,
  Q: `<g style="fill:FILL;stroke:STROKE;stroke-width:1.5;stroke-linejoin:round"> <path d="M 9,26 C 17.5,24.5 30,24.5 36,26 L 38.5,13.5 L 31,25 L 30.7,10.9 L 25.5,24.5 L 22.5,10 L 19.5,24.5 L 14.3,10.9 L 14,25 L 6.5,13.5 L 9,26 z"/> <path d="M 9,26 C 9,28 10.5,28 11.5,30 C 12.5,31.5 12.5,31 12,33.5 C 10.5,34.5 11,36 11,36 C 9.5,37.5 11,38.5 11,38.5 C 17.5,39.5 27.5,39.5 34,38.5 C 34,38.5 35.5,37.5 34,36 C 34,36 34.5,34.5 33,33.5 C 32.5,31 32.5,31.5 33.5,30 C 34.5,28 36,28 36,26 C 27.5,24.5 17.5,24.5 9,26 z"/> <path d="M 11.5,30 C 15,29 30,29 33.5,30" style="fill:none"/> <path d="M 12,33.5 C 18,32.5 27,32.5 33,33.5" style="fill:none"/> <circle cx="6" cy="12" r="2" /> <circle cx="14" cy="9" r="2" /> <circle cx="22.5" cy="8" r="2" /> <circle cx="31" cy="9" r="2" /> <circle cx="39" cy="12" r="2" /> </g>`,
  R: `<g style="opacity:1; fill:FILL; fill-opacity:1; fill-rule:evenodd; stroke:STROKE; stroke-width:1.5; stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:4; stroke-dasharray:none; stroke-opacity:1;" transform="translate(0,0.3)"> <path d="M 9,39 L 36,39 L 36,36 L 9,36 L 9,39 z " style="stroke-linecap:butt;" /> <path d="M 12,36 L 12,32 L 33,32 L 33,36 L 12,36 z " style="stroke-linecap:butt;" /> <path d="M 11,14 L 11,9 L 15,9 L 15,11 L 20,11 L 20,9 L 25,9 L 25,11 L 30,11 L 30,9 L 34,9 L 34,14" style="stroke-linecap:butt;" /> <path d="M 34,14 L 31,17 L 14,17 L 11,14" /> <path d="M 31,17 L 31,29.5 L 14,29.5 L 14,17" style="stroke-linecap:butt; stroke-linejoin:miter;" /> <path d="M 31,29.5 L 32.5,32 L 12.5,32 L 14,29.5" /> <path d="M 11,14 L 34,14" style="fill:none; stroke:STROKE; stroke-linejoin:miter;" /> </g>`,
  B: `<g style="opacity:1; fill:none; fill-rule:evenodd; fill-opacity:1; stroke:STROKE; stroke-width:1.5; stroke-linecap:round; stroke-linejoin:round; stroke-miterlimit:4; stroke-dasharray:none; stroke-opacity:1;" transform="translate(0,0.6)"> <g style="fill:FILL; stroke:STROKE; stroke-linecap:butt;"> <path d="M 9,36 C 12.39,35.03 19.11,36.43 22.5,34 C 25.89,36.43 32.61,35.03 36,36 C 36,36 37.65,36.54 39,38 C 38.32,38.97 37.35,38.99 36,38.5 C 32.61,37.53 25.89,38.96 22.5,37.5 C 19.11,38.96 12.39,37.53 9,38.5 C 7.65,38.99 6.68,38.97 6,38 C 7.35,36.54 9,36 9,36 z"/> <path d="M 15,32 C 17.5,34.5 27.5,34.5 30,32 C 30.5,30.5 30,30 30,30 C 30,27.5 27.5,26 27.5,26 C 33,24.5 33.5,14.5 22.5,10.5 C 11.5,14.5 12,24.5 17.5,26 C 17.5,26 15,27.5 15,30 C 15,30 14.5,30.5 15,32 z"/> <path d="M 25 8 A 2.5 2.5 0 1 1 20,8 A 2.5 2.5 0 1 1 25 8 z"/> </g> <path d="M 17.5,26 L 27.5,26 M 15,30 L 30,30 M 22.5,15.5 L 22.5,20.5 M 20,18 L 25,18" style="fill:none; stroke:STROKE; stroke-linejoin:miter;"/> </g>`,
  N: `<g style="opacity:1; fill:none; fill-opacity:1; fill-rule:evenodd; stroke:STROKE; stroke-width:1.5; stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:4; stroke-dasharray:none; stroke-opacity:1;" transform="translate(0,0.3)"> <path d="M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18" style="fill:FILL; stroke:STROKE;" /> <path d="M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,9.506 13.5,8.5 13.5,7.5 C 14.5,6.5 16.5,10 16.5,10 L 18.5,10 C 18.5,10 19.28,8.008 21,7 C 22,7 22,10 22,10" style="fill:FILL; stroke:STROKE;" /> <path d="M 9.5 25.5 A 0.5 0.5 0 1 1 8.5,25.5 A 0.5 0.5 0 1 1 9.5 25.5 z" style="fill:STROKE; stroke:STROKE;" /> <path d="M 15 15.5 A 0.5 1.5 0 1 1 14,15.5 A 0.5 1.5 0 1 1 15 15.5 z" transform="matrix(0.866,0.5,-0.5,0.866,9.693,-5.173)" style="fill:STROKE; stroke:STROKE;" /> </g>`,
  P: `<path d="m 22.5,9 c -2.21,0 -4,1.79 -4,4 0,0.89 0.29,1.71 0.78,2.38 C 17.33,16.5 16,18.59 16,21 c 0,2.03 0.94,3.84 2.41,5.03 C 15.41,27.09 11,31.58 11,39.5 H 34 C 34,31.58 29.59,27.09 26.59,26.03 28.06,24.84 29,23.03 29,21 29,18.59 27.67,16.5 25.72,15.38 26.21,14.71 26.5,13.89 26.5,13 c 0,-2.21 -1.79,-4 -4,-4 z" style="opacity:1; fill:FILL; fill-opacity:1; fill-rule:nonzero; stroke:STROKE; stroke-width:1.5; stroke-linecap:round; stroke-linejoin:miter; stroke-miterlimit:4; stroke-dasharray:none; stroke-opacity:1;"/>`
};

function chessSvg(kind, isWhite){
  const fill = isWhite ? '#f8fafc' : '#111827';
  const stroke = isWhite ? '#111827' : '#e5e7eb';
  const raw = (CHESS_SVG[kind] || CHESS_SVG.P)
    .replace(/FILL/g, fill)
    .replace(/STROKE/g, stroke);
  const wrap = document.createElement('div');
  wrap.innerHTML = `<svg viewBox="0 0 45 45" width="100%" height="100%" class="chess-svg ${isWhite?'white':'black'}" aria-hidden="true">${raw}</svg>`;
  return wrap.firstChild;
}

function flipNeeded(s){
  // У p2 свои фигуры снизу: переворачиваем доску
  return s.you === 'p2';
}
function toDisplay(s, r, c){
  if(!flipNeeded(s)) return [r,c];
  return [7-r, 7-c];
}
function toServer(s, r, c){
  if(!flipNeeded(s)) return [r,c];
  return [7-r, 7-c];
}

function renderBoardGame(mount, s, kind){
  const board = (s.game_state&&s.game_state.board)||[];
  const myTurn = s.turn===s.you && s.phase==='playing';
  const flip = flipNeeded(s);
  const FILES = 'abcdefgh';
  const castleOpts = (kind==='chess' && Array.isArray(s.game_state&&s.game_state.castle_options))
    ? s.game_state.castle_options
    : [];
  const legalMoves = (kind==='chess' && Array.isArray(s.game_state&&s.game_state.legal_moves))
    ? s.game_state.legal_moves
    : [];
  const kingPick = !!(picked && kind==='chess' && board[picked.r] && board[picked.r][picked.c]
    && String(board[picked.r][picked.c]).toUpperCase()==='K');
  const showCastleBtns = kingPick && castleOpts.length > 0;

  const moveHints = {};
  if(picked && kind==='chess'){
    legalMoves.forEach(m=>{
      if(m.from_r===picked.r && m.from_c===picked.c){
        moveHints[m.to_r+','+m.to_c] = !!m.capture;
      }
    });
  }

  const hint = 'Ты ходишь снизу вверх';

  const castleBtns = showCastleBtns
    ? `<div class="castle-bar" role="group" aria-label="Рокировка">${castleOpts.map((o,i)=>{
        const label = o.short ? 'Короткая рокировка' : 'Длинная рокировка';
        return `<button type="button" class="castle-quiet" data-castle="${i}">${label}</button>`;
      }).join('')}</div>`
    : '';

  mount.innerHTML = `
    <div class="hint chess-hint" style="margin-bottom:8px">${hint}</div>
    <div class="board-frame"><div class="sq-board" id="sqBoard"></div></div>
    ${castleBtns}`;
  const box=$('sqBoard');
  // draw display rows top->bottom
  for(let dr=0; dr<8; dr++) for(let dc=0; dc<8; dc++){
    const sr = flip ? 7-dr : dr;
    const sc = flip ? 7-dc : dc;
    const sq=document.createElement('div');
    const dark=(sr+sc)%2===1;
    sq.className='sq '+(dark?'dark':'light');
    if(picked && picked.r===sr && picked.c===sc) sq.classList.add('sel');
    const hintKey = sr+','+sc;
    const isMove = Object.prototype.hasOwnProperty.call(moveHints, hintKey);
    const isCapture = !!moveHints[hintKey];
    if(isMove) sq.classList.add(isCapture ? 'move-capture' : 'move-target');
    // координаты: a–h / 1–8 с учётом переворота доски
    const file = FILES[sc];
    const rank = String(8 - sr);
    if(dc === 0){
      const rl = document.createElement('span');
      rl.className = 'coord rank'+(dark?' on-dark':' on-light');
      rl.textContent = rank;
      sq.appendChild(rl);
    }
    if(dr === 7){
      const fl = document.createElement('span');
      fl.className = 'coord file'+(dark?' on-dark':' on-light');
      fl.textContent = file;
      sq.appendChild(fl);
    }
    if(isMove && !isCapture){
      const dot = document.createElement('span');
      dot.className = 'move-dot';
      dot.setAttribute('aria-hidden','true');
      sq.appendChild(dot);
    }
    const cell = board[sr] ? board[sr][sc] : null;
    if(kind==='checkers'){
      if(cell){
        const el=document.createElement('div');
        const isWhite = cell>0;
        el.className='chk-piece '+(isWhite?'white':'black')+(Math.abs(cell)===2?' king':'');
        sq.appendChild(el);
      }
    } else if(cell){
      const isWhite = cell === cell.toUpperCase();
      sq.appendChild(chessSvg(cell.toUpperCase(), isWhite));
    }
    sq.onclick = ()=>{
      if(!myTurn) return;
      if(!picked){
        // выбираем только свою фигуру
        const mine = cell && (
          (kind==='chess' && ((s.you==='p1' && cell===cell.toUpperCase()) || (s.you==='p2' && cell===cell.toLowerCase()))) ||
          (kind==='checkers' && ((s.you==='p1' && cell>0) || (s.you==='p2' && cell<0)))
        );
        if(!mine) return;
        picked={r:sr,c:sc};
        renderBoardGame(mount, s, kind);
        return;
      }
      if(picked.r===sr && picked.c===sc){ picked=null; renderBoardGame(mount, s, kind); return; }
      // клик по чужой/пустой клетке без хода — перевыбор своей фигуры
      if(kind==='chess' && !isMove){
        const mine = cell && ((s.you==='p1' && cell===cell.toUpperCase()) || (s.you==='p2' && cell===cell.toLowerCase()));
        if(mine){
          picked={r:sr,c:sc};
          renderBoardGame(mount, s, kind);
          return;
        }
        picked=null;
        renderBoardGame(mount, s, kind);
        return;
      }
      const from=picked; picked=null;
      doAction({from_r:from.r, from_c:from.c, to_r:sr, to_c:sc});
    };
    box.appendChild(sq);
  }

  mount.querySelectorAll('[data-castle]').forEach(btn=>{
    btn.onclick = ()=>{
      if(!myTurn || !kingPick) return;
      const opt = castleOpts[Number(btn.getAttribute('data-castle'))];
      if(!opt) return;
      picked = null;
      doAction({
        from_r: opt.from_r, from_c: opt.from_c,
        to_r: opt.to_r, to_c: opt.to_c
      });
    };
  });
}

/* ===== Backgammon ===== */
function bgLayout(you){
  // Классическая доска: у текущего игрока голова справа сверху, дом справа снизу.
  // Для p2 — поворот на 180°, а не зеркало.
  const base = {
    topLeft:  [11,10,9,8,7,6],
    topRight: [5,4,3,2,1,0],
    botLeft:  [12,13,14,15,16,17],
    botRight: [18,19,20,21,22,23],
  };
  if(you !== 'p2') return base;
  const rev = arr => arr.slice().reverse();
  return {
    topLeft:  rev(base.botRight), // 23..18
    topRight: rev(base.botLeft),  // 17..12
    botLeft:  rev(base.topRight), // 0..5
    botRight: rev(base.topLeft),  // 6..11
  };
}

function renderBackgammon(mount, s){
  const gs = s.game_state||{};
  const board = gs.board||Array(24).fill(0);
  const bar = gs.bar||{p1:0,p2:0};
  const off = gs.off||{p1:0,p2:0};
  const dice = gs.dice||[];
  const legal = gs.legal||[];
  const myTurn = s.turn===s.you && s.phase==='playing';
  const me = s.you;
  const opp = me==='p1'?'p2':'p1';
  const layout = bgLayout(me);

  // auto-pick die if only one unique value remains
  if(myTurn && dice.length && bgSel.die==null){
    const uniq=[...new Set(dice)];
    if(uniq.length===1){ bgSel.die=uniq[0]; bgSel.dieIdx=dice.indexOf(uniq[0]); }
  }

  function movesFrom(frm){
    return legal.filter(m => m.from===frm && (bgSel.die==null || m.die===bgSel.die));
  }
  function canSelectFrom(frm){
    if(!myTurn || !dice.length) return false;
    if(frm==='bar') return (bar[me]||0)>0 && legal.some(m=>m.from==='bar');
    const v = board[frm]||0;
    const mine = me==='p1' ? v>0 : v<0;
    return mine && legal.some(m=>m.from===frm);
  }
  const destSet = new Set();
  if(bgSel.from!=null){
    movesFrom(bgSel.from).forEach(m=>destSet.add(String(m.to)));
  }

  mount.innerHTML = `
    <div class="hint">Длинные нарды · все 15 с головы · чужие пункты закрыты · вынос из дома</div>
    <div class="meta-line">
      <span>Правило головы: за ход снимается только одна шашка с головы</span>
      <span>Вынесено: ты ${off[me]||0}/15 · соперник ${off[opp]||0}/15</span>
    </div>
    <div class="bg-board">
      <div class="bg-inner">
        <div class="bg-quad top" id="bgTL"></div>
        <div class="bg-bar" title="Разделитель доски">
          <div class="bar-slot" id="bgBarOpp"></div>
          <div class="bar-slot" id="bgBarMe"></div>
        </div>
        <div class="bg-quad top" id="bgTR"></div>
        <div class="bg-off">
          <div class="off-slot" id="bgOffOpp"><span>Соперник</span><strong id="bgOffOppN">0</strong></div>
          <div class="off-slot" id="bgOffMe"><span>Твой вынос</span><strong id="bgOffMeN">0</strong></div>
        </div>
        <div class="bg-quad bot" id="bgBL"></div>
        <div class="bg-quad bot" id="bgBR"></div>
      </div>
    </div>
    <div class="bg-controls">
      <button class="btn" id="bgRoll">Бросить кости</button>
      <div class="dice" id="bgDice"></div>
    </div>
    <p class="hint" style="margin-top:8px">Кликни стопку → затем подсвеченный пункт. Кость подставится сама, если одна.</p>`;

  $('bgOffOppN').textContent = String(off[opp]||0);
  $('bgOffMeN').textContent = String(off[me]||0);
  if(destSet.has('off')) $('bgOffMe').classList.add('hint');

  const rollBtn=$('bgRoll');
  rollBtn.disabled = !myTurn || (gs.rolled && dice.length>0);
  rollBtn.onclick=()=>{ bgSel={from:null,die:null,dieIdx:null}; doAction({type:'roll'}); };

  const diceBox=$('bgDice');
  dice.forEach((d,i)=>{
    const el=document.createElement('div');
    el.className='die'+(bgSel.die===d && bgSel.dieIdx===i?' active':'');
    el.textContent=d;
    el.onclick=()=>{
      if(!myTurn) return;
      bgSel.die=d; bgSel.dieIdx=i;
      renderBackgammon(mount,s);
    };
    diceBox.appendChild(el);
  });
  if(!dice.length && gs.rolled===false && myTurn){
    const tip=document.createElement('span'); tip.className='hint'; tip.textContent='Сначала брось кости'; diceBox.appendChild(tip);
  }

  function paintBar(el, who, selectable){
    el.innerHTML='';
    const n = bar[who]||0;
    for(let i=0;i<Math.min(n,5);i++){
      const c=document.createElement('div'); c.className='checker '+who; el.appendChild(c);
    }
    if(n>5){ const m=document.createElement('div'); m.className='checker-count'; m.textContent='×'+n; el.appendChild(m); }
    if(selectable && canSelectFrom('bar')){
      if(bgSel.from==='bar') el.classList.add('sel');
      el.onclick=()=>{
        bgSel.from = bgSel.from==='bar' ? null : 'bar';
        if(bgSel.from==='bar'){
          const opts=movesFrom('bar');
          if(opts.length===1){ bgSel.die=opts[0].die; }
        }
        renderBackgammon(mount,s);
      };
    }
  }
  paintBar($('bgBarOpp'), opp, false);
  paintBar($('bgBarMe'), me, myTurn);

  $('bgOffMe').onclick=()=>{
    if(!myTurn || bgSel.from==null) return;
    const opts = movesFrom(bgSel.from).filter(m=>m.to==='off');
    if(!opts.length){ $('playErr').textContent='Сюда нельзя'; return; }
    const pick = opts.find(m=>m.die===bgSel.die) || opts[0];
    const from=bgSel.from; bgSel={from:null,die:null,dieIdx:null};
    doAction({type:'move', from, to:'off', die:pick.die});
  };

  function fillQuad(el, points, top){
    el.innerHTML='';
    points.forEach((pointIdx, i)=>{
      const p=document.createElement('div');
      p.className='bg-point'+(i%2?' alt':'')+(bgSel.from===pointIdx?' sel':'')+(destSet.has(String(pointIdx))?' hint':'');
      const v=board[pointIdx]||0;
      const count=Math.abs(v);
      const who = v>0?'p1':(v<0?'p2':null);
      const myHead = me==='p1'?0:12;
      if(pointIdx===myHead && count>0 && who===me) p.classList.add('head-glow');
      if(pointIdx===(me==='p1'?12:0) && count>0 && who===opp) p.classList.add('head-glow');
      const stack=document.createElement('div'); stack.className='stack';
      // Всегда одинаковый размер фишек: рисуем до 5, остальное — числом
      const show = Math.min(count, 5);
      for(let n=0;n<show;n++){
        const c=document.createElement('div'); c.className='checker '+(who||''); stack.appendChild(c);
      }
      if(count>1){ const m=document.createElement('div'); m.className='checker-count'; m.textContent='×'+count; stack.appendChild(m); }
      p.appendChild(stack);
      p.onclick=()=>{
        if(!myTurn) return;
        $('playErr').textContent='';
        // destination click
        if(bgSel.from!=null && destSet.has(String(pointIdx))){
          const opts = movesFrom(bgSel.from).filter(m=>m.to===pointIdx);
          const pick = opts.find(m=>m.die===bgSel.die) || opts[0];
          if(!pick) return;
          const from=bgSel.from; bgSel={from:null,die:null,dieIdx:null};
          doAction({type:'move', from, to:pointIdx, die:pick.die});
          return;
        }
        // select own point
        if(!canSelectFrom(pointIdx)){
          if(bgSel.from!=null){ bgSel.from=null; renderBackgammon(mount,s); }
          return;
        }
        if(bgSel.from===pointIdx){ bgSel.from=null; renderBackgammon(mount,s); return; }
        bgSel.from=pointIdx;
        const opts=movesFrom(pointIdx);
        if(opts.length){
          const dies=[...new Set(opts.map(o=>o.die))];
          if(dies.length===1) bgSel.die=dies[0];
        }
        renderBackgammon(mount,s);
      };
      el.appendChild(p);
    });
  }

  fillQuad($('bgTL'), layout.topLeft, true);
  fillQuad($('bgTR'), layout.topRight, true);
  fillQuad($('bgBL'), layout.botLeft, false);
  fillQuad($('bgBR'), layout.botRight, false);
}

/* ===== Durak ===== */
const DURAK_RANK = {6:'6',7:'7',8:'8',9:'9',T:'10',J:'В',Q:'Д',K:'К',A:'Т'};
const DURAK_SUIT = {s:'♠',h:'♥',d:'♦',c:'♣'};

function cardLabel(code){
  if(!code) return '';
  return (DURAK_RANK[code[0]]||code[0])+(DURAK_SUIT[code[1]]||code[1]);
}
function cardRed(code){ return code && (code[1]==='h'||code[1]==='d'); }

function renderDurak(mount, s){
  const gs = s.game_state||{};
  const me = s.you;
  const order = gs.order || Object.keys(gs.hand_counts||{}).filter(k=>s.players&&s.players[k]);
  const others = order.filter(slot=>slot!==me);
  const myTurn = s.phase==='playing' && s.turn===me;
  const legal = gs.legal||[];
  const canAttack = new Set(legal.filter(a=>a.type==='attack').map(a=>a.card));
  const canDefend = new Set(legal.filter(a=>a.type==='defend').map(a=>a.card));
  const canTake = legal.some(a=>a.type==='take');
  const canPass = legal.some(a=>a.type==='pass');
  const myHand = (gs.hands && me && gs.hands[me]) || [];
  const table = gs.table||[];
  const outSet = new Set(gs.out||[]);
  const expectHint = {
    attack:'Сходи картой',
    defend:'Отбей или возьми',
    throw:'Подкинь или пас / бито'
  }[gs.expect]||'';

  const othersHtml = others.map(slot=>{
    const n = (gs.hand_counts && gs.hand_counts[slot]) || 0;
    const nm = (s.players[slot]&&s.players[slot].name) || slot;
    const roles = [
      gs.attacker===slot?'атака':'',
      gs.defender===slot?'защита':'',
      outSet.has(slot)?'вышел':'',
      s.turn===slot?'ходит':''
    ].filter(Boolean).join(' · ');
    return `<div class="durak-opp-seat" data-slot="${slot}">
      <div class="durak-role">${nm} · ${n} карт${roles? ' · '+roles:''}</div>
      <div class="durak-hand opp" data-backs="${slot}"></div>
    </div>`;
  }).join('');

  mount.innerHTML = `
    <div class="durak">
      <div class="durak-meta">
        <div>Козырь <span class="durak-trump ${cardRed(gs.trump_card)?'red':''}">${cardLabel(gs.trump_card)}</span></div>
        <div>Колода: <strong>${gs.deck_count||0}</strong></div>
        <div>Игроков: <strong>${order.length}</strong></div>
      </div>
      <div class="durak-others">${othersHtml || '<div class="hint">Нет соперников</div>'}</div>
      <div class="durak-table" id="durakTable"></div>
      <div class="durak-actions" id="durakActions"></div>
      <div class="durak-me">
        <div class="durak-role">Ты${gs.attacker===me?' · атака':''}${gs.defender===me?' · защита':''}${myTurn?' · твой ход':''}
          ${myTurn && expectHint? ' — '+expectHint:''}</div>
        <div class="durak-hand me" id="durakHand"></div>
      </div>
    </div>`;

  mount.querySelectorAll('[data-backs]').forEach(box=>{
    const slot = box.getAttribute('data-backs');
    const n = (gs.hand_counts && gs.hand_counts[slot]) || 0;
    for(let i=0;i<Math.min(n,8);i++){
      const back = document.createElement('div');
      back.className = 'dcard back';
      box.appendChild(back);
    }
    if(n>8){
      const m=document.createElement('div'); m.className='checker-count'; m.textContent='×'+n; box.appendChild(m);
    }
  });

  const tableBox = $('durakTable');
  if(!table.length){
    const empty = document.createElement('div');
    empty.className = 'durak-empty';
    empty.textContent = 'Стол пуст';
    tableBox.appendChild(empty);
  } else {
    table.forEach(pair=>{
      const wrap = document.createElement('div');
      wrap.className = 'dpair';
      const a = document.createElement('div');
      a.className = 'dcard'+(cardRed(pair.a)?' red':'');
      a.textContent = cardLabel(pair.a);
      wrap.appendChild(a);
      if(pair.d){
        const d = document.createElement('div');
        d.className = 'dcard beat'+(cardRed(pair.d)?' red':'');
        d.textContent = cardLabel(pair.d);
        wrap.appendChild(d);
      } else {
        const wait = document.createElement('div');
        wait.className = 'dcard ghost';
        wait.textContent = '?';
        wrap.appendChild(wait);
      }
      tableBox.appendChild(wrap);
    });
  }

  const actBox = $('durakActions');
  if(canPass){
    const b = document.createElement('button');
    b.className = 'btn'; b.type='button';
    b.textContent = (gs.expect==='throw' ? 'Пас / бито' : 'Бито');
    b.onclick = ()=>doAction({type:'pass'});
    actBox.appendChild(b);
  }
  if(canTake){
    const b = document.createElement('button');
    b.className = 'btn ghost'; b.type='button'; b.textContent='Беру';
    b.onclick = ()=>doAction({type:'take'});
    actBox.appendChild(b);
  }

  const handBox = $('durakHand');
  myHand.forEach(code=>{
    if(!code) return;
    const c = document.createElement('button');
    c.type = 'button';
    c.className = 'dcard'+(cardRed(code)?' red':'');
    c.textContent = cardLabel(code);
    const playable = myTurn && (canAttack.has(code) || canDefend.has(code));
    if(!playable) c.disabled = true;
    else c.style.cursor = 'pointer';
    c.onclick = ()=>{
      if(!playable) return;
      if(canDefend.has(code)) doAction({type:'defend', card:code});
      else if(canAttack.has(code)) doAction({type:'attack', card:code});
    };
    handBox.appendChild(c);
  });
}

/* ===== Blik / OUNO ===== */
const BLIK_COLOR_CLASS = {c:'blik-c', t:'blik-t', a:'blik-a', v:'blik-v'};
const BLIK_FACE = {S:'стоп', Z:'↻', D:'+2'};
// локальный UI: выбор цвета не должен сбрасываться поллом
let blikUi = { colorPick: null };

function blikCardMeta(code){
  if(!code) return {cls:'blik-wild', label:'?', sub:'', wild:true};
  if(code==='WW') return {cls:'blik-wild', label:'★', sub:'Радуга', wild:true};
  if(code==='WX') return {cls:'blik-wild blik-wx', label:'+4', sub:'Радуга', wild:true};
  const col = code[0], face = code[1];
  return {
    cls: BLIK_COLOR_CLASS[col] || 'blik-c',
    label: BLIK_FACE[face] || face,
    sub: '',
    wild: false,
    color: col,
    face
  };
}

function blikCardHtml(meta){
  const sub = meta.sub ? `<small>${meta.sub}</small>` : '';
  return `<span class="bcard-face">${meta.label}${sub}</span>`;
}

function renderBlik(mount, s){
  const gs = s.game_state||{};
  const me = s.you;
  const order = gs.order || [];
  const others = order.filter(slot=>slot!==me);
  const myTurn = s.phase==='playing' && s.turn===me;
  const legal = gs.legal||[];
  const playable = new Set(legal.filter(a=>a.type==='play').map(a=>a.card));
  const canDraw = legal.some(a=>a.type==='draw');
  const canPass = legal.some(a=>a.type==='pass');
  const playDrawn = legal.filter(a=>a.type==='play_drawn');
  const colorActs = legal.filter(a=>a.type==='color');
  const myHand = (gs.hands && me && gs.hands[me]) || [];
  const top = blikCardMeta(gs.top);
  const cur = gs.current_color || 'c';
  const dir = (gs.direction||1) > 0 ? '→' : '←';
  const labels = gs.color_labels || {c:'Коралл',t:'Бирюза',a:'Янтарь',v:'Фиолет'};

  // сбросить устаревший выбор цвета
  if(blikUi.colorPick){
    const pick = blikUi.colorPick;
    if(pick.mode==='play_drawn' && !gs.drawn) blikUi.colorPick = null;
    else if(pick.mode==='play' && (!pick.card || !myHand.includes(pick.card) || gs.drawn)) blikUi.colorPick = null;
    else if(pick.mode==='color' && !colorActs.length) blikUi.colorPick = null;
  }

  const othersHtml = others.map(slot=>{
    const n = (gs.hand_counts && gs.hand_counts[slot]) || 0;
    const nm = (s.players[slot]&&s.players[slot].name) || slot;
    const turn = s.turn===slot ? ' · ходит' : '';
    return `<div class="blik-opp">
      <div class="blik-role">${nm} · ${n}${turn}</div>
      <div class="blik-hand opp" data-backs="${slot}"></div>
    </div>`;
  }).join('');

  const drawnMeta = gs.drawn ? blikCardMeta(gs.drawn) : null;
  const drawnBlock = drawnMeta
    ? `<div class="blik-drawn-wrap">
         <div class="blik-drawn-label">Взятая карта</div>
         <div class="bcard ${drawnMeta.cls}" id="blikDrawnCard">${blikCardHtml(drawnMeta)}</div>
       </div>`
    : '';

  mount.innerHTML = `
    <div class="blik">
      <div class="blik-meta">
        <div>Цвет <span class="blik-chip ${BLIK_COLOR_CLASS[cur]||''}">${labels[cur]||cur}</span></div>
        <div>Колода: <strong>${gs.deck_count||0}</strong></div>
        <div>Ход ${dir}</div>
      </div>
      <div class="blik-others">${othersHtml || '<div class="hint">Нет соперников</div>'}</div>
      <div class="blik-table">
        <button type="button" class="bcard back blik-deck" id="blikDeck" ${canDraw?'':'disabled'} title="Взять карту"></button>
        <div class="bcard ${top.cls}" id="blikTop">${blikCardHtml(top)}</div>
        ${drawnBlock}
      </div>
      <div class="blik-actions" id="blikActions"></div>
      <div class="blik-me">
        <div class="blik-role">Ты${myTurn?' · твой ход':''}${gs.drawn?' · можно сходить взятой или пас':''}</div>
        <div class="blik-hand me" id="blikHand"></div>
      </div>
    </div>`;

  mount.querySelectorAll('[data-backs]').forEach(box=>{
    const slot = box.getAttribute('data-backs');
    const n = (gs.hand_counts && gs.hand_counts[slot]) || 0;
    for(let i=0;i<Math.min(n,8);i++){
      const back = document.createElement('div');
      back.className = 'bcard back';
      box.appendChild(back);
    }
    if(n>8){
      const m=document.createElement('div'); m.className='checker-count'; m.textContent='×'+n; box.appendChild(m);
    }
  });

  const act = $('blikActions');
  const showColorPicker = ()=>{
    act.innerHTML = '';
    const tip = document.createElement('div');
    tip.className = 'hint'; tip.style.cssText='width:100%;margin-bottom:4px';
    tip.textContent = 'Выбери цвет';
    act.appendChild(tip);
    ['c','t','a','v'].forEach(col=>{
      const b = document.createElement('button');
      b.type='button'; b.className='btn blik-color-btn '+ (BLIK_COLOR_CLASS[col]||'');
      b.textContent = labels[col]||col;
      b.onclick = ()=>{
        const pick = blikUi.colorPick;
        blikUi.colorPick = null;
        if(!pick) return;
        if(pick.mode==='play_drawn') doAction({type:'play_drawn', color:col});
        else if(pick.mode==='play') doAction({type:'play', card:pick.card, color:col});
        else if(pick.mode==='color') doAction({type:'color', color:col});
      };
      act.appendChild(b);
    });
    const cancel = document.createElement('button');
    cancel.type='button'; cancel.className='btn ghost'; cancel.textContent='Назад';
    cancel.onclick = ()=>{ blikUi.colorPick = null; renderBlik(mount, s); };
    act.appendChild(cancel);
  };

  if(colorActs.length && !blikUi.colorPick){
    blikUi.colorPick = {mode:'color'};
  }

  if(blikUi.colorPick){
    showColorPicker();
  } else if(playDrawn.length){
    const b = document.createElement('button');
    b.type='button'; b.className='btn';
    b.textContent = drawnMeta && drawnMeta.wild
      ? ('Сходить: '+(drawnMeta.sub||'Радуга')+(drawnMeta.label==='+4'?' +4':''))
      : 'Сходить этой';
    b.onclick = ()=>{
      if(gs.drawn==='WW' || gs.drawn==='WX'){
        blikUi.colorPick = {mode:'play_drawn'};
        renderBlik(mount, s);
      } else {
        blikUi.colorPick = null;
        doAction({type:'play_drawn'});
      }
    };
    act.appendChild(b);
  }
  if(canPass && !blikUi.colorPick){
    const b = document.createElement('button');
    b.type='button'; b.className='btn ghost'; b.textContent='Пас';
    b.onclick = ()=>{ blikUi.colorPick = null; doAction({type:'pass'}); };
    act.appendChild(b);
  }
  if(canDraw && !blikUi.colorPick){
    const deckBtn = $('blikDeck');
    if(deckBtn) deckBtn.onclick = ()=>{ blikUi.colorPick = null; doAction({type:'draw'}); };
    const b = document.createElement('button');
    b.type='button'; b.className='btn ghost'; b.textContent='Взять карту';
    b.onclick = ()=>{ blikUi.colorPick = null; doAction({type:'draw'}); };
    act.appendChild(b);
  }

  const handBox = $('blikHand');
  myHand.forEach(code=>{
    if(!code) return;
    const meta = blikCardMeta(code);
    const c = document.createElement('button');
    c.type='button';
    c.className = 'bcard '+meta.cls;
    c.innerHTML = blikCardHtml(meta);
    const ok = myTurn && playable.has(code) && !gs.drawn && !colorActs.length && !blikUi.colorPick;
    if(!ok) c.disabled = true;
    else c.style.cursor = 'pointer';
    c.onclick = ()=>{
      if(!ok) return;
      if(meta.wild){
        blikUi.colorPick = {mode:'play', card:code};
        renderBlik(mount, s);
      } else {
        blikUi.colorPick = null;
        doAction({type:'play', card:code});
      }
    };
    handBox.appendChild(c);
  });
}

/* ===== room actions ===== */
async function leaveGame(){
  stopPoll();
  const wasCode=code, wasToken=token;
  if(wasCode && wasToken){
    try{ await api(`/api/room/${wasCode}/leave`, {method:'POST', body:JSON.stringify({token:wasToken})}); }catch(_){}
  }
  goHome();
}
function clearShareHint(force=true){
  const hint = $('shareHint');
  if(!hint) return;
  // force=true — всегда сбрасывать; иначе не трогаем свежий «Скопировано» в текущем лобби
  if(!force && hint.classList.contains('ok') && hint.dataset.code === String(code||'')) return;
  hint.classList.remove('ok');
  hint.textContent = '';
  delete hint.dataset.code;
}

function goHome(msg){
  stopPoll(); LS.clear();
  token=null; code=null; state=null; picked=null; bgSel={from:null,die:null,dieIdx:null};
  tokens={p1:null,p2:null}; vsLocal=false; hotseatSlot=null; handoverFor=null;
  lastPlaySig = '';
  stateRev = 0;
  lastFinishedSig = '';
  SB.placed=[]; SB.selected=null;
  blikUi = { colorPick: null };
  setLocalNamesVisible(false);
  clearShareHint(true);
  const startRow = $('startRow');
  if(startRow) startRow.classList.add('hidden');
  const waitHost = $('waitHostHint');
  if(waitHost) waitHost.classList.add('hidden');
  const lobbyErr = $('lobbyErr');
  if(lobbyErr){ lobbyErr.textContent = ''; delete lobbyErr.dataset.keep; }
  show('home');
  const err = $('homeErr');
  if(err) err.textContent = msg||'';
  const se = $('setupErr');
  if(se) se.textContent = '';
}

function visibleErrEl(){
  if($('done') && !$('done').classList.contains('hidden') && $('doneStatus')) return $('doneStatus');
  if($('playing') && !$('playing').classList.contains('hidden') && $('playErr')) return $('playErr');
  if($('lobby') && !$('lobby').classList.contains('hidden') && $('lobbyErr')) return $('lobbyErr');
  if($('setup') && !$('setup').classList.contains('hidden') && $('setupErr')) return $('setupErr');
  return $('homeErr') || $('setupErr') || $('doneStatus');
}

async function startGame({vsAi=false, vsLocalMode=false}={}){
  const errEl = visibleErrEl();
  if(errEl && errEl !== $('doneStatus')) errEl.textContent='';
  clearShareHint(true);
  try{
    const name=playerName($('name'));
    const name2 = (($('name2')&&$('name2').value.trim()) || randomAnimal(name)).slice(0,20);
    const body={name, game:chosenGame, vs_ai:!!vsAi, vs_local:!!vsLocalMode};
    if(vsLocalMode) body.name2 = name2;
    if(chosenGame==='seabattle') body.size=chosenBoard;
    if((chosenGame==='durak' || chosenGame==='blik') && !vsAi && !vsLocalMode) body.players = chosenPlayers;
    lastSettings = {game:chosenGame, vsAi:!!vsAi, vsLocal:!!vsLocalMode, name, name2, size:chosenBoard, players:chosenPlayers};
    const data=await api('/api/room/create',{method:'POST', body:JSON.stringify(body)});
    code=data.code;
    vsLocal = !!data.vs_local || !!vsLocalMode;
    if(vsLocal && data.tokens){
      tokens = {p1:data.tokens.p1, p2:data.tokens.p2};
      token = tokens.p1;
      hotseatSlot = null; // покажем экран передачи
    } else {
      tokens = {p1:data.token, p2:null};
      token = data.token;
      hotseatSlot = data.slot || 'p1';
    }
    LS.set({
      token, code, name, name2, vs_ai:!!vsAi, vs_local:vsLocal,
      tokens: vsLocal ? tokens : null,
      game:chosenGame, size:chosenBoard
    });
    SB.placed=[]; SB.selected=null; picked=null; bgSel={from:null,die:null,dieIdx:null};
    lastPlaySig = '';
    stateRev = 0;
    lastFinishedSig = '';
    clearShareHint(true);
    const mode = vsLocalMode ? 'local' : (vsAi ? 'ai' : 'pvp');
    trackGameUtm(chosenGame, mode);
    applyState(data.state, {force:true}); startPoll();
    return data;
  }catch(e){
    if(errEl) errEl.textContent=e.message || 'Не удалось создать игру';
    return null;
  }
}

async function joinRoomByCode(roomCode, joinName){
  const clean = String(roomCode||'').replace(/\D/g,'').slice(0,6);
  const saved = LS.get();
  const resumeToken = (saved && saved.code === clean && saved.token) ? saved.token : (code===clean && token ? token : null);
  const body = { name: joinName, code: clean };
  if(resumeToken) body.token = resumeToken;
  const data=await api('/api/room/join',{method:'POST', body:JSON.stringify(body)});
  token=data.token; code=data.code;
  tokens={p1:null,p2:null}; vsLocal=false; hotseatSlot=data.slot||'p2';
  chosenGame = (data.state && data.state.game) || chosenGame;
  lastSettings = {game:chosenGame, vsAi:false, vsLocal:false, name:joinName, name2:randomAnimal(joinName), size:chosenBoard};
  LS.set({token,code,name:joinName, game:chosenGame});
  trackGameUtm(chosenGame, data.reconnected ? 'reconnect' : 'join');
  if(!data.reconnected){
    SB.placed=[]; SB.selected=null; picked=null; bgSel={from:null,die:null,dieIdx:null};
  }
  clearShareHint(true);
  roomMisses = 0;
  applyState(data.state); startPoll();
  return data;
}

$('btnVsAi').onclick = ()=>{ setLocalNamesVisible(false); startGame({vsAi:true}); };
$('btnCreate').onclick = ()=>{ setLocalNamesVisible(false); startGame({vsAi:false, vsLocalMode:false}); };
$('btnLocal').onclick = ()=>{
  if($('name2Wrap') && $('name2Wrap').classList.contains('hidden')){
    setLocalNamesVisible(true);
    $('setupErr').textContent = 'Укажи имена игроков и нажми «Вдвоём здесь» ещё раз';
    return;
  }
  $('setupErr').textContent = '';
  startGame({vsLocalMode:true});
};
$('btnSetupBack').onclick = ()=>goHome();

$('btnJoin').onclick = async ()=>{
  const errEl = $('setupErr') || $('homeErr');
  if(errEl) errEl.textContent='';
  try{
    await joinRoomByCode(($('joinCode').value||''), playerName($('name')));
  }catch(e){ if(errEl) errEl.textContent=e.message; }
};

if($('btnStartGame')) $('btnStartGame').onclick = async ()=>{
  const errEl = $('lobbyErr');
  if(errEl){ errEl.textContent=''; delete errEl.dataset.keep; }
  if(!code || !token) return;
  try{
    const data = await api(`/api/room/${code}/start`, {
      method:'POST', body:JSON.stringify({token})
    });
    if(data.state) applyState(data.state);
  }catch(e){
    if(errEl){ errEl.textContent=e.message; errEl.dataset.keep='1'; }
  }
};

$('joinCode').addEventListener('input', e=>{ e.target.value=e.target.value.replace(/\D/g,'').slice(0,6); });
$('btnAgain').onclick=()=>goHome();

async function startFreshReplay({vsAi=false, vsLocal=false}={}){
  // новая комната с теми же настройками
  stopPoll();
  const oldCode = code, oldToken = token;
  const useAi = !!vsAi;
  const useLocal = !!vsLocal;
  if(oldCode && oldToken){
    try{
      await api(`/api/room/${oldCode}/leave`, {
        method:'POST', body:JSON.stringify({token:oldToken})
      });
    }catch(_){}
  }
  token=null; code=null; state=null;
  tokens={p1:null,p2:null}; vsLocal=false; hotseatSlot=null; handoverFor=null;
  stateRev = 0; lastPlaySig = ''; lastFinishedSig = '';
  LS.clear();
  chosenGame = lastSettings.game || chosenGame;
  chosenBoard = lastSettings.size || chosenBoard;
  chosenPlayers = lastSettings.players || chosenPlayers;
  if($('name') && lastSettings.name) $('name').value = lastSettings.name;
  if($('name2') && lastSettings.name2) $('name2').value = lastSettings.name2;
  if(currentUser && currentUser.name) applyAccountNameToForm();
  document.querySelectorAll('#sizePick .size-btn').forEach(x=>x.classList.toggle('active', x.dataset.size===chosenBoard));
  document.querySelectorAll('#playersPick .size-btn').forEach(x=>x.classList.toggle('active', x.dataset.players===String(chosenPlayers)));
  if($('doneStatus')) $('doneStatus').textContent = 'Запускаем новую партию…';
  let created = null;
  if(useLocal){
    setLocalNamesVisible(true);
    created = await startGame({vsLocalMode:true});
  } else {
    setLocalNamesVisible(false);
    created = await startGame({vsAi:useAi});
  }
  if(!created) throw new Error(($('doneStatus') && $('doneStatus').textContent) || 'Не удалось начать заново');
}

$('btnReplay').onclick = async ()=>{
  if(rematchBusy) return;
  rematchBusy = true;
  const rematchBtn = $('btnReplay');
  if(rematchBtn) rematchBtn.disabled = true;
  const wantAi = !!(state && state.vs_ai) || !!lastSettings.vsAi;
  const wantLocal = !!(state && state.vs_local) || !!lastSettings.vsLocal;
  if($('doneStatus')) $('doneStatus').textContent = 'Запускаем новую партию…';
  try{
    // 1) робот / вдвоём здесь — сначала рематч в той же комнате (1 запрос)
    if(code && token){
      try{
        const data = await api(`/api/room/${code}/rematch`, {
          method:'POST', body:JSON.stringify({token})
        });
        if(data.state && data.state.phase !== 'done'){
          lastPlaySig = '';
          stateRev = 0;
          applyState(data.state, {force:true});
          startPoll();
          return;
        }
        // сетевая игра: голос учтён, ждём остальных
        if(data.state && !wantAi && !wantLocal){
          lastPlaySig = '';
          applyState(data.state, {force:true});
          startPoll();
          return;
        }
      }catch(_){}
    }
    // 2) запасной путь — новая комната (только соло/локалка)
    if(wantAi || wantLocal || !state){
      await startFreshReplay({vsAi:wantAi, vsLocal:wantLocal});
      return;
    }
    if($('doneStatus')) $('doneStatus').textContent = 'Не удалось начать заново. Нажми «В меню».';
  }catch(e){
    if($('doneStatus')) $('doneStatus').textContent = (e && e.message) || 'Не удалось начать заново';
  }finally{
    rematchBusy = false;
    if(rematchBtn && state && state.phase==='done' && !state.vs_ai && !state.vs_local){
      const voted = !!(state.you && state.rematch_votes && state.rematch_votes[state.you]);
      rematchBtn.disabled = !!voted;
    } else if(rematchBtn && (!state || state.phase==='done')){
      rematchBtn.disabled = false;
    }
  }
};

$('btnExitLobby').onclick=()=>leaveGame();
$('btnExitPlay').onclick=()=>leaveGame();

function inviteUrl(roomCode){
  const c = String(roomCode||code||'').replace(/\D/g,'').slice(0,6);
  const base = `${location.origin}${location.pathname || '/'}`;
  const u = new URL(base, location.href);
  u.searchParams.set('join', c);
  return u.toString();
}

function readJoinCodeFromUrl(){
  try{
    const u = new URL(location.href);
    let c = (u.searchParams.get('join')||'').replace(/\D/g,'').slice(0,6);
    if(!c && /^\/?join\/(\d{4,6})\/?$/i.test(u.pathname||'')){
      c = RegExp.$1;
    }
    if(c.length===6){
      u.searchParams.delete('join');
      const path = (u.pathname||'/').replace(/\/join\/\d{4,6}\/?$/i,'/') || '/';
      history.replaceState({}, '', path + (u.search||'') + (u.hash||''));
      return c;
    }
  }catch(_){}
  return '';
}

async function copyText(text){
  if(navigator.clipboard && navigator.clipboard.writeText){
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly','');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

async function shareInvite(){
  const hint = $('shareHint');
  const roomCode = String(code || ($('codeView')&&$('codeView').textContent) || '').replace(/\D/g,'').slice(0,6);
  if(!roomCode || roomCode.length!==6){
    if(hint){ hint.classList.remove('ok'); hint.textContent = 'Код ещё не готов'; delete hint.dataset.code; }
    return;
  }
  const url = inviteUrl(roomCode);
  const title = (state && state.game_title) || (GAMES[chosenGame]&&GAMES[chosenGame].title) || 'Omove.ru';
  const text = `Давай сыграем в «${title}» на Omove.ru. Код: ${roomCode}`;
  if(hint){ hint.classList.remove('ok'); hint.textContent = ''; delete hint.dataset.code; }
  try{
    if(navigator.share){
      await navigator.share({ title: 'Omove.ru', text, url });
      if(hint){ hint.classList.add('ok'); hint.textContent = 'Отправлено'; hint.dataset.code = roomCode; }
      return;
    }
  }catch(e){
    if(e && e.name==='AbortError') return;
  }
  try{
    await copyText(url);
    if(hint){ hint.classList.add('ok'); hint.textContent = 'Ссылка скопирована'; hint.dataset.code = roomCode; }
  }catch(_){
    if(hint){ hint.classList.remove('ok'); hint.textContent = url; delete hint.dataset.code; }
  }
}

if($('btnShare')) $('btnShare').onclick = ()=>{ shareInvite(); };

(async function boot(){
  // ждём аккаунт: иначе старый random из LS перетирает выбранное имя
  try{ await authReady; }catch(_){}

  const accountName = () => (currentUser && currentUser.name) ? String(currentUser.name).slice(0,20) : '';

  const pendingJoin = readJoinCodeFromUrl();
  if(pendingJoin){
    const prev = LS.get();
    const joinName = (accountName() || (prev && prev.name) || ($('name') && $('name').value.trim()) || randomAnimal()).slice(0,20);
    LS.clear();
    token=null; code=null; state=null;
    tokens={p1:null,p2:null}; vsLocal=false;
    if($('name')) $('name').value = joinName;
    if($('joinCode')) $('joinCode').value = pendingJoin;
    try{
      await joinRoomByCode(pendingJoin, joinName);
    }catch(e){
      openSetup(chosenGame || 'seabattle');
      if($('setupErr')) $('setupErr').textContent = e.message || 'Не удалось войти по ссылке';
    }
    return;
  }

  const saved=LS.get();
  if(!saved||!saved.code){
    fillDefaultNames();
    return;
  }
  if(saved.vs_local && saved.tokens && saved.tokens.p1 && saved.tokens.p2){
    tokens = saved.tokens;
    vsLocal = true;
    token = saved.token || tokens.p1;
    code = saved.code;
    hotseatSlot = null;
    if($('name')) $('name').value = accountName() || saved.name || $('name').value;
    if(saved.name2 && $('name2')) $('name2').value=saved.name2;
    try{
      const data=await api(`/api/room/${code}?token=${encodeURIComponent(token)}`);
      if(data.state && data.state.game) trackGameUtm(data.state.game, 'resume');
      stateRev = 0;
      applyState(data.state, {force:true}); startPoll();
    }catch{
      LS.clear();
      fillDefaultNames();
    }
    return;
  }
  if(!saved.token){
    fillDefaultNames();
    return;
  }
  token=saved.token; code=saved.code;
  if($('name')) $('name').value = accountName() || saved.name || $('name').value;
  try{
    const data=await api(`/api/room/${code}?token=${encodeURIComponent(token)}`);
    if(data.state && data.state.game) trackGameUtm(data.state.game, 'resume');
    stateRev = 0;
    applyState(data.state, {force:true}); startPoll();
  }catch(e){
    // комната могла кратко не прочитаться — пробуем явный rejoin по токену
    try{
      await joinRoomByCode(saved.code, accountName() || saved.name || playerName($('name')));
    }catch(_){
      // устаревшая сессия — тихо сбрасываем, без ошибки на главной
      LS.clear();
      token = null;
      code = null;
      state = null;
      fillDefaultNames();
    }
  }
})();
