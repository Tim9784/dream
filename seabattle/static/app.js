const GAMES = {
  seabattle: {title:'Морской бой', blurb:'Расставь корабли и потопи флот'},
  tictactoe: {title:'Крестики-нолики', blurb:'Классика 3×3'},
  checkers: {title:'Шашки', blurb:'Русские шашки 8×8'},
  chess: {title:'Шахматы', blurb:'Партия на двоих'},
  backgammon: {title:'Нарды', blurb:'Кости, ход и вынос'},
};

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
const screens = ['home','lobby','playing','done'];
const show = id => screens.forEach(s => $(s).classList.toggle('hidden', s!==id));

let chosenGame = 'seabattle';
let chosenBoard = 'medium';
let token=null, code=null, state=null, pollTimer=null;

// seabattle placement
let SB = {FLEET:PRESETS.medium.fleet.slice(), GRID:10, placed:[], selected:null, horizontal:true};

// checkers/chess selection
let picked = null; // {r,c}
let bgSel = {from:null, die:null};

function currentTheme(){ return document.documentElement.getAttribute('data-theme')==='light'?'light':'dark'; }
function applyTheme(theme){
  const t = theme==='light'?'light':'dark';
  document.documentElement.setAttribute('data-theme', t);
  try{ localStorage.setItem('seabattle-theme', t);}catch(_){}
  $('btnTheme').textContent = t==='light'?'Тёмная':'Светлая';
}
applyTheme(currentTheme());
$('btnTheme').onclick = () => applyTheme(currentTheme()==='light'?'dark':'light');

function renderGameCards(){
  const box = $('gameGrid');
  box.innerHTML = '';
  Object.entries(GAMES).forEach(([id, meta])=>{
    const b = document.createElement('button');
    b.type='button';
    b.className = 'game-card'+(chosenGame===id?' active':'');
    b.innerHTML = `<strong>${meta.title}</strong><small>${meta.blurb}</small>`;
    b.onclick = ()=>{
      chosenGame = id;
      $('seabattleOpts').classList.toggle('hidden', id!=='seabattle');
      renderGameCards();
    };
    box.appendChild(b);
  });
}
renderGameCards();
$('seabattleOpts').classList.toggle('hidden', chosenGame!=='seabattle');

document.querySelectorAll('.size-btn').forEach(btn=>{
  btn.onclick = ()=>{
    chosenBoard = btn.dataset.size;
    document.querySelectorAll('.size-btn').forEach(x=>x.classList.toggle('active', x.dataset.size===chosenBoard));
  };
});

async function api(path, opts={}){
  const res = await fetch(path, {
    headers:{'Content-Type':'application/json', ...(opts.headers||{})},
    ...opts
  });
  const data = await res.json().catch(()=>({ok:false,error:'Ответ сервера'}));
  if(!res.ok || data.ok===false) throw new Error(data.error || 'Ошибка запроса');
  return data;
}

function startPoll(){
  stopPoll();
  pollTimer = setInterval(async ()=>{
    if(!code||!token) return;
    try{
      const data = await api(`/api/room/${code}?token=${encodeURIComponent(token)}`);
      applyState(data.state);
    }catch(e){
      if(String(e.message||'').includes('не найдена')) goHome('Комната закрыта');
    }
  }, 900);
}
function stopPoll(){ if(pollTimer){ clearInterval(pollTimer); pollTimer=null; } }

function playerName(el){ return (el.value.trim() || 'Капитан'); }

function applyState(s){
  state = s;
  $('footerInfo').textContent = `${s.game_title} · код ${s.code}`;
  if(s.phase==='lobby'){
    show('lobby');
    $('lobbyGame').textContent = s.game_title;
    $('codeView').textContent = s.code;
    $('lobbyHint').textContent = s.message || 'Ждём второго игрока…';
    $('lobbyYou').textContent = s.your_name ? `Ты: ${s.your_name}` : '';
  } else if(s.phase==='placing' || s.phase==='playing'){
    show('playing');
    $('playTitle').textContent = s.game_title;
    $('playStatus').textContent = s.message || '';
    renderGame(s);
  } else if(s.phase==='done'){
    show('done');
    const win = s.winner && s.winner === s.you;
    if(s.winner==null && (s.message||'').toLowerCase().includes('нич')){
      $('doneStatus').textContent = s.message;
    } else if(win){
      $('doneStatus').textContent = s.message || 'Победа!';
    } else {
      $('doneStatus').textContent = s.message || 'Поражение';
    }
    stopPoll();
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
}

/* ===== Sea battle ===== */
function syncSB(gs){
  const grid = gs.grid||10;
  const fleet = (gs.fleet||PRESETS.medium.fleet).slice();
  if(grid!==SB.GRID || fleet.join(',')!==SB.FLEET.join(',')){
    SB.GRID=grid; SB.FLEET=fleet; SB.placed=[]; SB.selected=null;
  }
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
  const phase = gs.phase || (s.phase==='placing'?'placing':'battle');
  if(phase==='placing'){
    const ready = gs.ready && s.you && gs.ready[s.you];
    mount.innerHTML = `
      <div class="toolbar">
        <button class="btn ghost" id="sbRotate">Повернуть</button>
        <button class="btn ghost" id="sbRandom">Случайно</button>
        <button class="btn ghost" id="sbClear">Сбросить</button>
        <button class="btn" id="sbReady" ${ready?'disabled':''}>${ready?'Ожидаем соперника…':'Готов к бою'}</button>
      </div>
      <div class="fleet" id="sbFleet"></div>
      <div class="grid" id="sbPlace" style="grid-template-columns:repeat(${SB.GRID},1fr);max-width:460px;margin-top:12px"></div>`;
    paintSBPlace();
    $('sbRotate').onclick=()=>{ SB.horizontal=!SB.horizontal; };
    $('sbClear').onclick=()=>{ if(ready) return; SB.placed=[]; SB.selected=null; paintSBPlace(); };
    $('sbRandom').onclick=()=>{ if(ready) return; randomSB(); };
    $('sbReady').onclick=()=>doAction({type:'place', ships:SB.placed});
    return;
  }
  // battle
  mount.innerHTML = `<div class="boards">
    <div><h3 style="color:var(--heading)">Враг</h3><div class="grid" id="sbEnemy" style="grid-template-columns:repeat(${SB.GRID},1fr)"></div></div>
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
    d.onclick=()=>{
      if(SB.selected==null) return;
      const ship={size:SB.selected,x,y,horizontal:SB.horizontal};
      if(!canPlace(ship)) return;
      SB.placed.push(ship); SB.selected=null; paintSBPlace();
    };
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
      chip.onclick=()=>{ SB.selected=size; paintSBPlace(); };
      for(let i=0;i<size;i++){ const seg=document.createElement('div'); seg.className='seg'; chip.appendChild(seg); }
      fleet.appendChild(chip);
    }
  });
  const readyBtn=$('sbReady');
  if(readyBtn && !readyBtn.disabled) readyBtn.disabled = SB.placed.length!==SB.FLEET.length;
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
  mount.innerHTML = `<div class="ttt" id="ttt"></div>`;
  const box=$('ttt');
  board.forEach((v,i)=>{
    const b=document.createElement('button');
    b.textContent = v===1?'X':(v===2?'O':'');
    b.disabled = !myTurn || !!v;
    b.onclick=()=>doAction({cell:i});
    box.appendChild(b);
  });
}

/* ===== Checkers / Chess ===== */
// Фигуры одного набора (cburnett-like SVG). Цвет только через fill.
const CHESS_SVG = {
  K: `<g fill="none" fill-rule="evenodd" stroke="STROKE" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22.5 11.63V6M20 8h5" stroke-linejoin="miter"/><path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5" fill="FILL" stroke-linecap="butt" stroke-linejoin="miter"/><path d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-3.5-7.5-13-10.5-16-4-3 6 5 10 5 10V37z" fill="FILL"/><path d="M11.5 30c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0"/></g>`,
  Q: `<g fill="FILL" fill-rule="evenodd" stroke="STROKE" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM24.5 7.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM41 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM16 8.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM33 9a2 2 0 1 1-4 0 2 2 0 1 1 4 0z"/><path d="M9 26c8.5-1.5 21-1.5 27 0l2.5-12.5L31 25l-.3-14.1-5.2 13.6-3-14.5-3 14.5-5.2-13.6L14 25 11.5 13.5 9 26zM9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z" stroke-linecap="butt"/><path d="M11.5 30c3.5-1 18.5-1 22 0M12 33.5c6-1 15-1 21 0" fill="none"/></g>`,
  R: `<g fill="FILL" fill-rule="evenodd" stroke="STROKE" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 39h27v-3H9v3zM12 36v-4h21v4H12zM11 14V9h4v2h5V9h5v2h5V9h4v5" stroke-linecap="butt"/><path d="M34 14l-3 3H14l-3-3"/><path d="M31 17v12.5H14V17" stroke-linecap="butt" stroke-linejoin="miter"/><path d="M31 29.5l1.5 2.5h-20l1.5-2.5"/><path d="M11 14h23" fill="none" stroke-linejoin="miter"/></g>`,
  B: `<g fill="none" fill-rule="evenodd" stroke="STROKE" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><g fill="FILL" stroke-linecap="butt"><path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.35.49-2.32.47-3-.5 1.35-1.46 3-2 3-2z"/><path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 5.5-8.5-2.5-11.5-.5-.5-1.5-1-1.5-1 0-.5.5-1 .5-1-1.5-2.5-7.5-2.5-9 0 0 0 .5.5.5 1 0 0-1 .5-1.5 1-8 3-8 10-2.5 11.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z"/><path d="M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z"/></g><path d="M17.5 26h10M15 30h15m-7.5-14.5v5M20 18h5" stroke-linejoin="miter"/></g>`,
  N: `<g fill="none" fill-rule="evenodd" stroke="STROKE" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21" fill="FILL"/><path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3" fill="FILL"/><path d="M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0zm5.433-9.75a.5 1.5 30 1 1-.866-.5.5 1.5 30 1 1 .866.5z" fill="STROKE" stroke="none"/></g>`,
  P: `<path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03C15.41 27.09 11 31.58 11 36.5h23c0-4.92-4.41-9.41-7.41-10.47C28.06 24.84 29 23.03 29 21c0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" fill="FILL" stroke="STROKE" stroke-width="1.5" stroke-linecap="round"/>`
};

function chessSvg(kind, isWhite){
  const fill = isWhite ? '#f8fafc' : '#111827';
  const stroke = isWhite ? '#111827' : '#d1d5db';
  const raw = (CHESS_SVG[kind] || CHESS_SVG.P)
    .replace(/FILL/g, fill)
    .replace(/STROKE/g, stroke);
  const wrap = document.createElement('div');
  wrap.innerHTML = `<svg viewBox="0 0 45 45" class="chess-svg ${isWhite?'white':'black'}" aria-hidden="true">${raw}</svg>`;
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
  mount.innerHTML = `<div class="hint" style="margin-bottom:6px">Ты ходишь снизу вверх</div><div class="sq-board" id="sqBoard"></div>`;
  const box=$('sqBoard');
  // draw display rows top->bottom
  for(let dr=0; dr<8; dr++) for(let dc=0; dc<8; dc++){
    const sr = flip ? 7-dr : dr;
    const sc = flip ? 7-dc : dc;
    const sq=document.createElement('div');
    const dark=(sr+sc)%2===1;
    sq.className='sq '+(dark?'dark':'light');
    if(picked && picked.r===sr && picked.c===sc) sq.classList.add('sel');
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
        picked={r:sr,c:sc};
        renderBoardGame(mount, s, kind);
        return;
      }
      if(picked.r===sr && picked.c===sc){ picked=null; renderBoardGame(mount, s, kind); return; }
      const from=picked; picked=null;
      doAction({from_r:from.r, from_c:from.c, to_r:sr, to_c:sc});
    };
    box.appendChild(sq);
  }
}

/* ===== Backgammon ===== */
function bgPointOrder(s){
  // Ходим снизу вверх: дом игрока внизу экрана.
  // p1 home = 18..23 bottom-right; show bottom row as advancing toward home.
  // p2 home = 0..5; flip so their direction visually goes up.
  const top = [12,13,14,15,16,17,11,10,9,8,7,6];
  const bot = [18,19,20,21,22,23,5,4,3,2,1,0];
  if(s.you === 'p2'){
    return {
      top: top.map(i => 23-i),
      bot: bot.map(i => 23-i),
    };
  }
  return {top, bot};
}

function renderBackgammon(mount, s){
  const gs = s.game_state||{};
  const board = gs.board||Array(24).fill(0);
  const bar = gs.bar||{p1:0,p2:0};
  const off = gs.off||{p1:0,p2:0};
  const dice = gs.dice||[];
  const myTurn = s.turn===s.you && s.phase==='playing';
  const opp = s.you==='p1'?'p2':'p1';
  const order = bgPointOrder(s);

  mount.innerHTML = `
    <div class="hint" style="margin-bottom:6px">Ты идёшь снизу вверх · дом внизу</div>
    <div class="meta-line">
      <span>Бар: ты ${bar[s.you]||0} / враг ${bar[opp]||0}</span>
      <span>Вынесено: ты ${off[s.you]||0}/15 · враг ${off[opp]||0}/15</span>
    </div>
    <div class="toolbar">
      <button class="btn" id="bgRoll">Бросить кости</button>
      <button class="btn ghost" id="bgBar">Взять с бара</button>
      <button class="btn ghost" id="bgOff">Вынести</button>
    </div>
    <div class="dice" id="bgDice"></div>
    <div class="bg-half" style="grid-template-columns:repeat(12,minmax(0,1fr));margin-top:8px" id="bgTop"></div>
    <div class="bg-half" style="grid-template-columns:repeat(12,minmax(0,1fr));margin-top:8px" id="bgBot"></div>
    <p class="hint" style="margin-top:10px">Кость → пункт откуда → пункт куда</p>`;

  const rollBtn=$('bgRoll');
  rollBtn.disabled = !myTurn || (gs.rolled && dice.length>0);
  rollBtn.onclick=()=>doAction({type:'roll'});
  $('bgBar').disabled = !myTurn || !(bar[s.you]>0);
  $('bgBar').onclick=()=>{ if(!myTurn) return; bgSel.from='bar'; renderBackgammon(mount,s); };
  $('bgOff').disabled = !myTurn || bgSel.from==null || bgSel.die==null;
  $('bgOff').onclick=()=>{
    if(!myTurn || bgSel.from==null || bgSel.die==null) return;
    const from=bgSel.from, die=bgSel.die;
    bgSel={from:null,die:null,dieIdx:null};
    doAction({type:'move', from, to:'off', die});
  };

  const diceBox=$('bgDice');
  dice.forEach((d,i)=>{
    const el=document.createElement('div');
    el.className='die'+(bgSel.die===d && bgSel.dieIdx===i?' active':'');
    el.textContent=d;
    el.onclick=()=>{ if(!myTurn) return; bgSel.die=d; bgSel.dieIdx=i; renderBackgammon(mount, s); };
    diceBox.appendChild(el);
  });
  if(bgSel.from==='bar'){
    const mark=document.createElement('div');
    mark.className='die active'; mark.textContent='BAR';
    diceBox.appendChild(mark);
  }

  function fill(el, points){
    el.innerHTML='';
    points.forEach(i=>{
      const p=document.createElement('div');
      p.className='bg-point'+(bgSel.from===i?' sel':'');
      const v=board[i]||0;
      const count=Math.abs(v);
      const who = v>0?'p1':(v<0?'p2':null);
      const label=document.createElement('small'); label.textContent=String(i+1); label.style.opacity='.55'; p.appendChild(label);
      for(let n=0;n<Math.min(count,5);n++){
        const c=document.createElement('div'); c.className='checker '+(who||''); p.appendChild(c);
      }
      if(count>5){ const m=document.createElement('small'); m.textContent='+'+(count-5); p.appendChild(m); }
      p.onclick=()=>{
        if(!myTurn) return;
        if(bgSel.from==='bar'){
          if(bgSel.die==null){ $('playErr').textContent='Выбери кость'; return; }
          const die=bgSel.die; bgSel={from:null,die:null,dieIdx:null};
          doAction({type:'move', from:'bar', to:i, die});
          return;
        }
        if(bgSel.from==null){ bgSel.from=i; renderBackgammon(mount,s); return; }
        if(bgSel.from===i){ bgSel.from=null; renderBackgammon(mount,s); return; }
        if(bgSel.die==null){ $('playErr').textContent='Выбери кость'; return; }
        const from=bgSel.from, die=bgSel.die; bgSel={from:null,die:null,dieIdx:null};
        doAction({type:'move', from, to:i, die});
      };
      el.appendChild(p);
    });
  }
  fill($('bgTop'), order.top);
  fill($('bgBot'), order.bot);
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
function goHome(msg){
  stopPoll(); LS.clear();
  token=null; code=null; state=null; picked=null; bgSel={from:null,die:null,dieIdx:null};
  SB.placed=[]; SB.selected=null;
  show('home');
  $('homeErr').textContent = msg||'';
}

async function startGame(vsAi){
  $('homeErr').textContent='';
  try{
    const name=playerName($('name'));
    const body={name, game:chosenGame, vs_ai:!!vsAi};
    if(chosenGame==='seabattle') body.size=chosenBoard;
    const data=await api('/api/room/create',{method:'POST', body:JSON.stringify(body)});
    token=data.token; code=data.code;
    LS.set({token,code,name,vs_ai:!!vsAi});
    SB.placed=[]; SB.selected=null; picked=null; bgSel={from:null,die:null,dieIdx:null};
    applyState(data.state); startPoll();
  }catch(e){ $('homeErr').textContent=e.message; }
}

$('btnVsAi').onclick = ()=>startGame(true);
$('btnCreate').onclick = ()=>startGame(false);

$('btnJoin').onclick = async ()=>{
  $('homeErr').textContent='';
  try{
    const joinName=playerName($('joinName'));
    const data=await api('/api/room/join',{method:'POST', body:JSON.stringify({
      name:joinName,
      code:($('joinCode').value||'').replace(/\D/g,'').slice(0,6)
    })});
    token=data.token; code=data.code;
    LS.set({token,code,name:joinName});
    SB.placed=[]; SB.selected=null; picked=null; bgSel={from:null,die:null,dieIdx:null};
    applyState(data.state); startPoll();
  }catch(e){ $('homeErr').textContent=e.message; }
};

$('joinCode').addEventListener('input', e=>{ e.target.value=e.target.value.replace(/\D/g,'').slice(0,6); });
$('btnAgain').onclick=()=>goHome();
$('btnExitLobby').onclick=()=>leaveGame();
$('btnExitPlay').onclick=()=>leaveGame();

(async function resume(){
  const saved=LS.get();
  if(!saved||!saved.token||!saved.code) return;
  token=saved.token; code=saved.code;
  if(saved.name){ $('name').value=saved.name; $('joinName').value=saved.name; }
  try{
    const data=await api(`/api/room/${code}?token=${encodeURIComponent(token)}`);
    applyState(data.state); startPoll();
  }catch{ LS.clear(); }
})();
