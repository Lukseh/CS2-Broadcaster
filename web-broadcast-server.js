//Requirements
const express = require("express");
const fs = require("fs");
const cors = require("cors");
const path = require("path");
const JSON5 = require('json5');

//Configuration
let gsiData = {};
let config = {
  twitch_channel: "default",
  team_left: "Team Left",
  team_right: "Team Right",
  delay_ms: 8000,
};

//Initialization of process
const app = express();
const CONFIG_PATH = process.env.CONFIG || "./config.json5";
//Load JSON or JSON5 config file
  if (fs.existsSync(CONFIG_PATH)) {
    const userConfig = JSON5.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    config = { ...config, ...userConfig };
  }
//
const PORT = config.port || 8740; // use from config or fall back to 8740
const BASE_PATH = config.base_path || '/primary';  // Use from config or fall back to primary

app.use(cors());
app.use(express.json());

//Serve dynamic HTML
app.get(BASE_PATH + "/", (req, res) => {
  const html = fs.readFileSync(path.join(__dirname, "public", "index.html"), "utf8");
  const injected = html
    .replace(/__TWITCH_CHANNEL__/g, config.twitch_channel)
    .replace(/__TEAM_LEFT__/g, config.team_left)
    .replace(/__TEAM_RIGHT__/g, config.team_right)
    .replace(/__PARENT_DOMAIN__/g, config.parent_domain);
  res.send(injected);
});

//Static files (JS, CSS, etc.) from public directory
app.use(BASE_PATH, express.static(path.join(__dirname, "public")));

//Dynamic config endpoint
app.get('/config', (req, res) => {
  if (fs.existsSync(CONFIG_PATH)) {
    const userConfig = JSON5.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    config = { ...config, ...userConfig };
  }
  res.json(config); 
});


//Create endpoint for GSI to send data to
app.post(BASE_PATH + "/gsi", (req, res) => {
  gsiData = req.body;
  res.sendStatus(200);
});

//Create endpoint to get gsi data + config for page to load
app.get(BASE_PATH + "/state", (req, res) => {
  res.json({ gsi: gsiData, config });
});

//Give url to proxy with cloudlfared tunnel (tested) or nginx/apache/caddy (untested)
app.listen(PORT, () => {
  console.log(`Overlay running on http://localhost:${PORT}${BASE_PATH}`);
});
