const express = require("express");
const fs = require("fs");
const path = require("path");
const JSON5 = require("json5");

const app = express();
const CONFIG_PATH = process.env.CONFIG || "./config.json5";
const config = JSON5.parse(fs.readFileSync(CONFIG_PATH, "utf8"));

config.instances.forEach(instance => {
    const { base_path, name, twitch_channel } = instance;

    // Serve static files from /public (HTML, JS, etc.)
    app.use(base_path, express.static(path.join(__dirname, "public")));

    // GSI endpoint for each instance
    app.get(`${base_path}/state`, (req, res) => {
        // Replace this with real GSI logic per instance
        res.json({
            gsi: { allplayers: {/* simulated player state */ } },
            config: {
                delay_ms: config.delay_ms,
                twitch_channel,
                team_left: "Team A",
                team_right: "Team B"
            }
        });
    });

    console.log(`Overlay running at http://localhost:8740${base_path}`);
});

app.listen(8740, () => {
    console.log("Server listening on port 8740");
});
