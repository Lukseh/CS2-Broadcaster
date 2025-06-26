/* --------------------------------------------------------------------
   server.js – CS-2 overlay + time-delay proxy (NO Redis)
   ------------------------------------------------------------------ */
import fs                from 'node:fs/promises';
import path              from 'node:path';
import { fileURLToPath } from 'node:url';

import JSON5             from 'json5';
import express           from 'express';

/* ---------- constants / env ----------------------------------------- */
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT      = process.env.PORT        || 8740;
const BASE_PATH = (process.env.BASE_PATH  || '/broadcast').replace(/\/+$/, '');
const AUTH_KEY  = process.env.AUTH_KEY    || 'super-secret-key';

/* ---------- read instance definitions ------------------------------- */
const raw = await fs.readFile(path.join(__dirname, 'instances.json5'), 'utf8');
const { instances = [] } = JSON5.parse(raw);

/* ---------- express -------------------------------------------------- */
const app = express();
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));
app.use(express.json());

/* ---------- tiny auth ----------------------------------------------- */
function protect (req, res, next) {
  const key = req.get('x-auth-key') || req.query.key || req.body?.auth?.token;
  if (key === AUTH_KEY) return next();
  res.status(401).json({ error:'unauthorised' });
}

/* ---------- history buffer ------------------------------------------ */
/* history[id] → Array of { ts:Number, data:Object } ordered by ts ASC */
const history = Object.create(null);

/* helper – keep only recent items (3×delay) to avoid memory leak ----- */
function purgeOld (arr, delay) {
  const limit = Date.now() - delay * 3;
  while (arr.length && arr[0].ts < limit) arr.shift();
}

/* ---------- HTML template (full, no cuts) --------------------------- */
function renderOverlayHTML (inst, all) {
  const assets = '/assets';
  const BASE   = BASE_PATH;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${inst.page_title}</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="icon" href="${assets}/favicon.ico">
  <link rel="stylesheet" href="${assets}/style.css">
  <script>
    const INST      = ${JSON.stringify(inst)};
    const ALL       = ${JSON.stringify(all.map(i=>({name:i.id,base:i.url})))};
    const BASE_PATH = "${BASE}";
  </script>

  <script type="module">
    /* ========== 1. TOP NAV ========================================= */
    const nav = document.createElement('nav');
    document.body.prepend(nav);

    const logo = Object.assign(new Image(),{
      src: '/assets/android-chrome-512x512.png',
      alt: 'Logo',
      style: 'height:40px;margin-right:15px'
    });
    nav.appendChild(logo);
    nav.append(document.createTextNode(INST.page_name));

    const sel = document.createElement('select');
    sel.style.cssText = 'margin-left:2vw;padding:6px 10px;background:#444;color:#fff;border:none;border-radius:4px';
    sel.appendChild(new Option('Switch broadcast','',true,true));
    ALL.forEach(o=>{
      const value = BASE_PATH + o.base;
      sel.appendChild(new Option(o.name,value,false,o.base===INST.url));
    });
    sel.onchange = e => location.href = e.target.value;
    nav.appendChild(sel);

    /* ========== 2. TWITCH IFRAMES ================================== */
    const parent  = location.hostname;
    const channel = INST.twitch_channel;

    const player = document.getElementById('twitch-player');
    player.src = \`https://player.twitch.tv/?channel=\${channel}&parent=\${parent}&autoplay=true\`;

    const chat = document.getElementById('twitch-chat');
    chat.src = \`https://www.twitch.tv/embed/\${channel}/chat?parent=\${parent}&darkpopout\`;

    /* ========== 3. DOM ELEMENTS (once) ============================= */
    const playersDiv = document.getElementById('players');
    playersDiv.innerHTML = '<div class="team-col left"></div><div class="team-col right"></div>';
    const $left  = playersDiv.querySelector('.team-col.left');
    const $right = playersDiv.querySelector('.team-col.right');

    /* helpers -------------------------------------------------------- */
    function weaponIcon(w){
      if(!w) return '';
      const id=(w.name||'').replace(/^weapon_/,'');
      return \`<img class="weapon" src="/assets/weapons/weapon_\${id}.svg" alt="\${id}">\`;
    }

    /* rendering ------------------------------------------------------ */
    function renderPlayers(gsi){
      $left.innerHTML = ''; $right.innerHTML = '';
      if(!gsi?.allplayers) return;

      Object.values(gsi.allplayers).forEach(p=>{
        const col = (p.team === 'T') ? $left : $right;
        const active = Object.values(p.weapons||{}).find(w=>w.state==='active');
        const card = document.createElement('div');
        card.className='player-card' + (p.state?.health===0 ? ' dead':'');
        card.innerHTML = \`
          <div class="name">\${p.name}<span class="money">$ \${p.state.money}</span></div>
          <div class="stats">
            <span>HP \${p.state.health}</span>
            <span>AR \${p.state.armor}</span>
            \${weaponIcon(active)}
          </div>
          <div class="hp-bar"><div class="hp-fill" style="width:\${p.state.health}%"></div></div>\`;
        col.appendChild(card);
      });
    }

    function renderScore(gsi){
      if(!gsi?.map) return;
      const t = gsi.map.team_t;
      const c = gsi.map.team_ct;
      document.getElementById('team1').textContent = t?.name || 'T';
      document.getElementById('team2').textContent = c?.name || 'CT';
      document.getElementById('score').textContent = \`\${t?.score||0} : \${c?.score||0}\`;
    }

    /* ========== 4. POLLING ========================================= */
    async function poll(){
      try{
        const r = await fetch('/gsi'+INST.url);
        if(r.ok){
          const data = await r.json();
          renderPlayers(data);
          renderScore(data);
        }
      }catch(e){ console.error(e); }
      setTimeout(poll, INST.delay_ms || 1000);
    }
    poll();
  </script>
  <link href="https://fonts.googleapis.com/css2?family=Microsoft+YaHei:wght@400;500;700&display=swap" rel="stylesheet">
</head>

<body>
  <div class="container">
    <div class="main">
      <iframe id="twitch-player" allowfullscreen></iframe>
      <div class="overlay-block">
        <div class="scoreboard">
          <div id="team1"></div>
          <div id="score"></div>
          <div id="team2"></div>
        </div>
        <div class="players" id="players"></div>
      </div>
    </div>
    <iframe class="chat" id="twitch-chat"></iframe>
  </div>
</body>
</html>`;
}

/* ---------- per-instance routes ------------------------------------- */
for (const inst of instances) {
  inst.url      = `/${String(inst.url || inst.id)}`.replace(/\/+/g, '/');
  inst.delay_ms = Number(inst.delay_ms) || 8000;   // default 8 s

  const overlayRoute = BASE_PATH + inst.url;
  const gsiRoute     = '/gsi'     + inst.url;

  /* overlay page ------------------------------------------------------ */
  app.get(overlayRoute, (_, res) =>
    res.type('html').send(renderOverlayHTML(inst, instances)));

  /* ---------- GET – snapshot ≥ delay_ms old ------------------------- */
  app.get(gsiRoute, (req, res) => {
    const arr = history[inst.id] || [];
    const cutoff = Date.now() - inst.delay_ms;

    // search newest→oldest for first snapshot older than cutoff
    let snap = null;
    for (let i = arr.length - 1; i >= 0; i--) {
      if (arr[i].ts <= cutoff) { snap = arr[i].data; break; }
    }
    res.json(snap ?? {});            // {} if nothing available yet
  });

  /* ---------- POST – push payload into history ---------------------- */
  app.post(gsiRoute, protect, (req, res) => {
    const arr = history[inst.id] ||= [];
    arr.push({ ts: Date.now(), data: req.body });
    purgeOld(arr, inst.delay_ms);
    res.json({ ok:true, stored: arr.length });
  });

  /* console summary -------------------------------------------------- */
  console.log(`Overlay  GET  ${overlayRoute}`);
  console.log(`GSI      GET  ${gsiRoute}`);
  console.log(`GSI      POST ${gsiRoute} (auth; stream delayed ${inst.delay_ms} ms)`);
}

/* ---------- 404 fallback & start ------------------------------------ */
app.use((_, res) => res.status(404).send('Not found'));

app.listen(PORT, () => {
  console.log(`Server running  http://localhost:${PORT}`);
  console.log(`Auth key:       ${AUTH_KEY}`);
});