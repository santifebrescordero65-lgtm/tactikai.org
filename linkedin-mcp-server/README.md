# LinkedIn MCP Server

**13 tools. Your browser. Your session. No scraping.**

Connect Claude (or any MCP client) directly to your live LinkedIn account. All actions use your existing logged-in browser session — nothing touches LinkedIn until you approve.

## Tools

### People & Profile
| Tool | Description |
|------|-------------|
| `linkedin_get_my_profile` | Get your own profile (name, headline, location) |
| `linkedin_get_profile` | Get any member's profile by URL |
| `linkedin_search_people` | Search people with filters (company, title, location) |

### Companies & Leads
| Tool | Description |
|------|-------------|
| `linkedin_get_company` | Get company info (size, industry, website) |
| `linkedin_find_decision_makers` | Find VPs, Directors, C-suite at any company |
| `linkedin_search_jobs` | Search jobs — as buying signals for prospects |

### Messaging
| Tool | Description |
|------|-------------|
| `linkedin_get_inbox` | List your conversations with previews |
| `linkedin_get_conversation` | Read a full message thread |
| `linkedin_send_message` | Reply in an existing conversation |
| `linkedin_send_connection_request` | Send a connection request with a note |

### Content
| Tool | Description |
|------|-------------|
| `linkedin_get_posts` | Get someone's recent posts |
| `linkedin_create_post` | Publish a post to your feed |
| `linkedin_get_notifications` | Check connection requests and mentions |

## Setup (~10 min)

### 1. Install dependencies

```bash
cd linkedin-mcp-server
npm install
npm run install-browsers   # downloads Chromium once
npm run build
```

### 2. Start Chrome with remote debugging

**macOS**
```bash
open -a "Google Chrome" --args --remote-debugging-port=9222
```

**Linux**
```bash
google-chrome --remote-debugging-port=9222
```

**Windows**
```cmd
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
```

Then navigate to [linkedin.com](https://linkedin.com) and log in.

### 3. Add to Claude Desktop config

Open `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows) and add:

```json
{
  "mcpServers": {
    "linkedin": {
      "command": "node",
      "args": ["/absolute/path/to/linkedin-mcp-server/dist/index.js"],
      "env": {
        "CHROME_DEBUG_PORT": "9222"
      }
    }
  }
}
```

Restart Claude Desktop. You'll see the LinkedIn tools available.

### 4. Add to Claude Code (CLI)

```bash
claude mcp add linkedin -- node /absolute/path/to/linkedin-mcp-server/dist/index.js
```

## How it works

1. The server connects to your already-running Chrome instance via Chrome DevTools Protocol (CDP)
2. It finds your LinkedIn tab (or opens one) and extracts your session cookies
3. All API calls go to LinkedIn's internal Voyager API using your authenticated session
4. Nothing is sent until you approve — `send_message` and `create_post` require explicit tool invocation

## Example prompts

- *"Get me the last 3 posts from [profile URL] and their current role"*
- *"Who is the Head of Sales at Acme Corp? Return profile URLs and titles."*
- *"Which unread conversations look like positive replies? Draft a follow-up for each."*
- *"Find companies hiring a VP of Engineering right now — that's my ICP."*
- *"Write a post about [topic] and publish it when I confirm."*
