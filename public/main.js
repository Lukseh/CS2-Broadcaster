const gsiBuffer = [];
const config = window.appConfig;
let renderDelay = 8000; //Stream delay fallback default

let lastConfig = null;

async function fetchState() {
  try {
    const res = await fetch(`${config.base_path}/state`);
    const data = await res.json();

    //Update render delay from config
    if (data.config?.delay_ms !== undefined) {
      renderDelay = parseInt(data.config.delay_ms) || 8000;
    }

    //Add timestamped GSI data
    gsiBuffer.push({ timestamp: Date.now(), data });

    //Trim buffer to 30 seconds max
    while (gsiBuffer.length > 0 && Date.now() - gsiBuffer[0].timestamp > 30000) {
      gsiBuffer.shift();
    }

  } catch (err) {
    console.error('Error fetching state:', err);
  }
}

function renderState() {
  const now = Date.now();
  const targetTime = now - renderDelay;

  //Find the oldest state ≥ targetTime
  const state = gsiBuffer.find(item => item.timestamp >= targetTime);
  if (!state) return;

  const { config, gsi } = state.data;
  const players = gsi.allplayers || {};

  //Update Twitch embeds only once
  if (!lastConfig || lastConfig.twitch_channel !== config.twitch_channel) {
    const parentHost = location.hostname;
    document.getElementById('twitch-player').src =
      `https://player.twitch.tv/?channel=${config.twitch_channel}&parent=${parentHost}`;
    document.getElementById('twitch-chat').src =
      `https://www.twitch.tv/embed/${config.twitch_channel}/chat?parent=${parentHost}&darkpopout`;
    lastConfig = config;
  }

//Automatic parse of team names from gsi or use custom from config
const teamLeftName = gsi.map?.team_ct?.name || config.team_left || 'TEAM 1';
const teamRightName = gsi.map?.team_t?.name || config.team_right || 'TEAM 2';

document.getElementById('team1').innerText = teamLeftName;
document.getElementById('team2').innerText = teamRightName;

  const scoreL = gsi.map?.team_ct?.score ?? 0;
  const scoreR = gsi.map?.team_t?.score ?? 0;
  document.getElementById('score').innerText = `${scoreL} : ${scoreR}`;

  const left = [], right = [];

  for (const steamid in players) {
    const p = players[steamid];
    const hp = p.state?.health ?? 0;
    const armor = p.state?.armor ?? 0;
    const helmet = p.state?.helmet;
    const money = p.state?.money ?? 0;
    const weapon = Object.values(p.weapons || {}).find(w => w.state === 'active');

    const card = `
      <div class="player-card">
        <strong>${p.name || 'unknown'}</strong>
        <div class="health-bar"><div class="health-fill" style="width:${hp}%;"></div></div>
        <div class="label">HP: ${hp} | $${money}</div>
        <div class="label">Armor: ${armor}${helmet ? " + Helmet" : ""}</div>
        <div class="label">Weapon: ${weapon?.name?.replace('weapon_', '') || '—'}</div>
      </div>
    `;

    if (p.team === 'CT') left.push(card);
    else if (p.team === 'T') right.push(card);
  }

  const playersContainer = document.getElementById('players');
  playersContainer.innerHTML = '';

  for (let i = 0; i < 5; i++) {
    const leftCol = document.createElement('div');
    const rightCol = document.createElement('div');
    leftCol.innerHTML = left[i] || '';
    rightCol.innerHTML = right[i] || '';
    playersContainer.appendChild(leftCol);
    playersContainer.appendChild(rightCol);
  }
}

//Polling
setInterval(fetchState, 1000);
setInterval(renderState, 500);