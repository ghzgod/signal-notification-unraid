# Signal Notification Agent for Unraid

Send Unraid system notifications to Signal groups via [signal-cli](https://github.com/AsamK/signal-cli).

## Features

- Notification agent for Unraid's built-in notification system (Settings > Notifications)
- Settings page with dynamic group selection
- Create new Signal groups directly from the Unraid UI
- Test connection and send test messages from Settings
- Auto-detects API type (asamk or bbernhard) — no manual configuration needed
- Works with any signal-cli instance (local Docker container or remote)

## Requirements

- Unraid 6.12.0 or later
- A running signal-cli instance using **one** of the following Docker images:
  - [`ghcr.io/asamk/signal-cli`](https://github.com/AsamK/signal-cli) — JSON-RPC API with `daemon --http` mode
  - [`bbernhard/signal-cli-rest-api`](https://github.com/bbernhard/signal-cli-rest-api) — REST API (normal or json-rpc mode)

## Installation

### From Community Applications (recommended)
Search for "Signal Notification" in the Community Applications plugin.

### Manual Install
Navigate to Plugins > Install Plugin and paste:
```
https://raw.githubusercontent.com/ghzgod/signal-notification-unraid/main/signal-notification.plg
```

## Setup

1. Go to **Settings > Notifications > Signal**
2. Enter your signal-cli API URL (e.g. `http://192.168.1.100:8085`)
3. The plugin auto-detects which API is running and shows the result
4. Select a group from the dropdown (or create a new one)
5. Click **Send Test** to verify
6. Click **Apply** to save
7. On the **Notification Agents** tab, enable the Signal agent and configure which notification fields to include

### Notes for bbernhard/signal-cli-rest-api users

- The plugin auto-detects your image and reads the registered account number automatically
- Make sure at least one phone number is registered/linked in signal-cli-rest-api before configuring the plugin
- The default port for bbernhard is `8080` — map it to a free host port (e.g. `8085:8080`)
- Group IDs from bbernhard use a `group.` prefix (e.g. `group.ckRzaEd4Vm...`) — this is handled automatically

## How It Works

The plugin installs a notification agent that Unraid invokes whenever system events occur (array status changes, disk warnings, plugin updates, etc.). The agent sends messages to your configured Signal group. The plugin auto-detects whether you're running asamk/signal-cli (JSON-RPC) or bbernhard/signal-cli-rest-api (REST) and routes API calls accordingly.

## License

MIT
