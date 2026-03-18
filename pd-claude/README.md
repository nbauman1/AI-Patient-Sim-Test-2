# PD Patient Simulation — Claude API Setup

## Folder structure
```
pd-claude/
  index.html                  ← the simulation
  netlify.toml                ← Netlify config
  netlify/
    functions/
      chat.js                 ← proxy function (holds your Anthropic API key)
```

## Setup steps

### 1. Create a Netlify account
Go to netlify.com and sign up for free.

### 2. Connect to GitHub and deploy
- Create a new GitHub repository
- Upload the contents of this folder to it
- In Netlify: Add new site → Import from Git → connect your repo
- Netlify will auto-deploy

### 3. Add your Anthropic API key
- In Netlify: Site settings → Environment variables
- Add variable: Key = ANTHROPIC_API_KEY, Value = your sk-ant-... key

### 4. Update index.html
- Open index.html in a text editor
- Find: const NETLIFY_URL = 'YOUR-NETLIFY-URL-HERE';
- Replace with your actual Netlify URL e.g. https://bright-llama-123.netlify.app
- Re-upload/push to GitHub — Netlify redeploys automatically

### 5. Add to Articulate
- Rise: Web Object block → paste Netlify URL
- Storyline: Insert → Web Object → paste URL → 1280x720 slide size

### 6. Publish to LMS
- Rise: Publish → SCORM
- Storyline: Publish → LMS → SCORM 1.2 or 2004

## Editing responses
All of John's responses are in index.html in the RESPONSES object.
The routing logic and system prompt live in netlify/functions/chat.js.
