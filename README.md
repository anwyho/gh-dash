# gh-dash

Personal GitHub PR dashboard for `Gusto/hawaiian-ice`. Shows your draft, active, and recently closed PRs, plus open PRs from your teammates. Runs locally via Next.js.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure your teammates:
   ```bash
   cp config.example.json config.json
   # Edit config.json with your GitHub login and teammate handles
   ```

3. Make sure `gh` is authenticated:
   ```bash
   gh auth status
   ```

4. Start the dashboard:
   ```bash
   npm run dev
   ```

5. Open http://localhost:3000

## Config

`config.json` (gitignored):

```json
{
  "myGitHubLogin": "your-github-username",
  "teammates": ["handle1", "handle2"],
  "repo": "Gusto/hawaiian-ice",
  "refreshIntervalMs": 120000
}
```

## Requirements

- Node.js 22+
- `gh` CLI authenticated (`gh auth status`)
