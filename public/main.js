const gsiBuffer = [];
const config = window.appConfig;
let renderDelay = 8000; //Stream delay fallback default

let lastConfig = null;

async function fetchState() {
    const basePath = window.location.pathname.split('/')[1]; // "primary" or "secondary"
    window.appConfig = {
        base_path: `/${basePath}`
    };
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

const lastPlayerHP = {}; // keep globally to track HP changes across renders

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

    // Team names
    const teamLeftName = gsi.map?.team_ct?.name || config.team_left || 'TEAM 1';
    const teamRightName = gsi.map?.team_t?.name || config.team_right || 'TEAM 2';

    document.getElementById('team1').innerText = teamLeftName;
    document.getElementById('team2').innerText = teamRightName;

    // Scores
    const scoreL = gsi.map?.team_ct?.score ?? 0;
    const scoreR = gsi.map?.team_t?.score ?? 0;
    document.getElementById('score').innerText = `${scoreL} : ${scoreR}`;

    const left = [];
    const right = [];

    for (const steamid in players) {
        const p = players[steamid];
        const hp = p.state?.health ?? 0;
        const armor = p.state?.armor ?? 0;
        const helmet = p.state?.helmet;
        const money = p.state?.money ?? 0;
        const weapon = Object.values(p.weapons || {}).find(w => w.state === 'active');

        const weaponName = weapon ? weapon.name.replace('weapon_', '') : null;
        const weaponIcon = weaponName
            ? `<img src="/assets/weapons/weapon_${weaponName}.svg" alt="${weaponName}" class="weapon-icon" />`
            : '—';

        const cardDiv = document.createElement('div');
        cardDiv.className = 'player-card';

        // Flashed effect
        if (p.state?.flashed === 1) cardDiv.classList.add('flashed');

        // Hurt effect if HP dropped since last render
        const hpChanged = lastPlayerHP[steamid] !== undefined && hp < lastPlayerHP[steamid];
        lastPlayerHP[steamid] = hp;

        if (hpChanged) {
            cardDiv.classList.add('hurt');
            setTimeout(() => cardDiv.classList.remove('hurt'), 300);
        }

        cardDiv.innerHTML = `
      <div class="player-name">${p.name || 'unknown'}</div>
      <div class="player-stats">
        <span class="stat hp">HP: ${hp}</span>
        <span class="stat armor">Armor: ${armor}${helmet ? ' + Helmet' : ''}</span>
        <span class="stat weapon">${weaponIcon}</span>
        <span class="stat money">$${money}</span>
      </div>
      <div class="health-bar"><div class="health-fill" style="width:${hp}%;"></div></div>
    `;

        if (p.team === 'CT') left.push(cardDiv);
        else if (p.team === 'T') right.push(cardDiv);
    }

    const playersContainer = document.getElementById('players');
    playersContainer.innerHTML = '';

    // Show max 5 players per team
    for (let i = 0; i < 5; i++) {
        const leftCol = document.createElement('div');
        const rightCol = document.createElement('div');
        leftCol.className = 'player-col left';
        rightCol.className = 'player-col right';
        if (left[i]) leftCol.appendChild(left[i]);
        if (right[i]) rightCol.appendChild(right[i]);
        playersContainer.appendChild(leftCol);
        playersContainer.appendChild(rightCol);
    }
}


//Polling
setInterval(fetchState, 1000);
setInterval(renderState, 500);