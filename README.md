# WEB-BROADCAST-CS2
Simple web project for your cs2 matches.


**⚠️ IMPORTANT: If you plan to use GOTV and web server remotely, use a VPN!**

I don't take responsibility for opening ports in any other case.

Advised usage of cloudflared tunnel / proxy (nginx, apache, caddy)

## 🔧 Installation
To install ( Run commands with administrator privileges (use sudo on Linux or run as Administrator on Windows):<br>
- open command line and use
  ```ruby
  git clone https://github.com/Lukseh/WEB-BROADCAST-CS2.git
  ```
  
- then
  ```ruby
  cd WEB-BROADCAST-CS2
  ```
  
- edit `config.json5` to your liking<br>
- run
  ```ruby
  yarn
  ```
  to install dependencies
  
- to check before production build run
  ```ruby
  yarn start
  ```
  
- if everything is correct run
  ```ruby
  yarn startprod
  ```
  
🔒 Also remember to put the same auth key in both `config.json5` and `gamestate_integration_web-broadcast-cs2.cfg` and DO NOT SHARE IT!!!

## 🎮 Usage
Put your GSI endpoint into `gamestate_integration_web-broadcast-cs2.cfg`

  for example if you're gonna serve instance for tv.example.com/primary
  
  ```
  "uri" "http://127.0.0.1:8740/primary/gsi"
```
and change port accordingly to what you put in `config.json5
    
```
"uri" "http://127.0.0.1:8741/secondary/gsi"
```
if you set `base_path` to secondary and `port` to 8741 in `config.json5

## ⚙️ Config file `config.json5`

Specify what /PATH will you be serving the app at

💡 If running multiple instances: give each a unique base_path and port. You can serve them all through one Cloudflare tunnel
```ruby
  "base_path": "/primary",
```

Link name of your broadcasts ttv channel (**NOT LINK**)
```ruby
  "twitch_channel": "",
```

Specify delay of your stream to delay the info on website (**USE IN MS CALCULATE BY MULTIPLYING SECONDS * 1000**)
```ruby
  "delay_ms": 8000, // 8 seconds delay by default
```

Use custom name for left team, if you use gsi it should automatically fill
```ruby
  "team_left": "",
```

Use custom name for right team, if you use gsi it should automatically fill
```ruby
  "team_right": "",
```

AUTH TOKEN **DO NOT SHARE** AND SET THE SAME ONE IN GSI FILE AND `config.json5`
```ruby
  "auth_token": "priv",
```

If you want to host app on domain put it here
```ruby
  "parent_domain": "localhost",
```

⚠️ Specify port for app **REMEMBER TO OPEN IT FOR LAN IF YOUR WEBSERVER IS ON THE SAME LAN AS GOTV CLIENT** or use VPN like hamachi, zerotier etc.
```ruby
  "port": 8740
```
