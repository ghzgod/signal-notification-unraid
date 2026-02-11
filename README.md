# Signal Notification Agent for Unraid

Send Unraid system notifications to Signal groups via [signal-cli](https://github.com/AsamK/signal-cli).

## Features

- Notification agent for Unraid's built-in notification system (Settings > Notifications)
- Settings page with dynamic group selection via signal-cli JSON-RPC API
- Create new Signal groups directly from the Unraid UI
- Test connection and send test messages from Settings
- Works with any signal-cli instance (local Docker container or remote)

## Requirements

- Unraid 6.12.0 or later
- A running [signal-cli](https://github.com/AsamK/signal-cli) instance with the JSON-RPC API enabled (e.g. the `ghcr.io/asamk/signal-cli` Docker container with `daemon --http` mode)

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
3. Click **Test Connection**
4. Select a group from the dropdown (or create a new one)
5. Click **Send Test** to verify
6. Click **Apply** to save
7. On the **Notification Agents** tab, enable the Signal agent and configure which notification fields to include

## How It Works

The plugin installs a notification agent that Unraid invokes whenever system events occur (array status changes, disk warnings, plugin updates, etc.). The agent sends messages to your configured Signal group via signal-cli's JSON-RPC API.

## License

MIT
