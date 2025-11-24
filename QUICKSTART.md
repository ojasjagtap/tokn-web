# tokn Quick Start Guide

Welcome to **tokn** - your visual flow-based IDE for prompt engineering! This guide will get you up and running in minutes.

## 🚀 Quick Start (3 Steps)

### 1. Install & Run Frontend

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app will open at `http://localhost:3000` in your browser.

### 2. Configure API Keys

1. Click the **⚙️ Settings** icon in the top-right corner
2. Add your API keys for the providers you want to use:
   - **OpenAI**: Get from https://platform.openai.com/api-keys
   - **Claude (Anthropic)**: Get from https://console.anthropic.com/
   - **Gemini (Google)**: Get from https://aistudio.google.com/apikey

Your API keys are encrypted using AES-GCM and stored securely in your browser's IndexedDB.

### 3. Create Your First Workflow

1. **Add a Prompt Node**: Double-click the canvas or click "Add Node" → "Prompt"
2. **Configure the node**:
   - Select your provider (OpenAI, Claude, or Gemini)
   - Choose a model (e.g., `gpt-4o-mini`, `claude-3-5-sonnet-20241022`, `gemini-2.0-flash-exp`)
   - Write your prompt (e.g., "Write a haiku about AI")
3. **Run it**: Click the ▶️ Run button
4. **See results**: Output appears in the right panel

That's it! You're now running AI workflows in tokn! 🎉

---

## 📚 Core Features

### Node Types

- **🎯 Prompt Node**: Send prompts to LLMs and get responses
- **🔧 Custom Tool Node**: Run JavaScript code as tools in a sandboxed Web Worker
- **🔀 Branch Node**: Create conditional logic based on outputs
- **⚡ DSPy Optimizer**: Optimize prompts using Stanford's DSPy framework (requires backend)
- **🧬 GEPA Optimizer**: Genetic evolution-based prompt optimization (requires backend)

### Workflow Management

- **Save**: Click 💾 Save (uses File System Access API - Chrome/Edge only)
- **Open**: Click 📂 Open to load existing workflows
- **Auto-save**: Enabled by default, saves to IndexedDB every 30s
- **Export**: Download workflows as `.promptflow` JSON files

### Custom Tools

Create JavaScript tools that nodes can call:

```javascript
// Example: Fetch data from an API
async function fetchWeather(args) {
    const response = await fetch(`https://api.weather.com/${args.city}`);
    return await response.json();
}
return fetchWeather(args);
```

Tools run in a Web Worker sandbox with:
- ✅ Fetch API, async/await, JSON, Math, Date
- ❌ No file system, no Node.js modules, no `require()`

---

## 🔌 Backend Setup (Optional)

The backend enables DSPy and GEPA optimization nodes. Skip this if you only need basic prompt nodes.

### Quick Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run backend
python app.py
```

Backend runs at `http://localhost:5000`

### Configure Backend in Settings

1. Open Settings (⚙️)
2. Scroll to "Backend Configuration"
3. Set Backend URL: `http://localhost:5000/api`
4. Click "Test Connection"

### Using Optimization Nodes

**DSPy Optimizer Node**:
- Optimizes prompts using MIPRO algorithm
- Requires training examples (input/output pairs)
- Automatically tests multiple prompt variations

**GEPA Optimizer Node**:
- Uses genetic evolution to improve prompts
- Tracks experiments in MLflow (optional)
- Supports multi-model optimization

---

## 🌐 Browser Compatibility

| Feature | Chrome/Edge | Firefox | Safari |
|---------|------------|---------|--------|
| Core functionality | ✅ | ✅ | ✅ |
| Encrypted API keys | ✅ | ✅ | ✅ |
| Auto-save | ✅ | ✅ | ✅ |
| File save/open | ✅ | ❌ | ❌ |
| Web Workers | ✅ | ✅ | ✅ |

**Recommended**: Chrome, Edge, or Opera (full feature support including File System Access API)

**Firefox/Safari**: Use download/upload workflow files instead of native save/open

---

## 💡 Common Workflows

### Simple Question Answering
```
[Input Node] → [Prompt: "Answer: {{question}}"] → [Output]
```

### Multi-Step Reasoning
```
[Prompt: "Outline"] → [Prompt: "Expand outline"] → [Output]
```

### Tool-Augmented Generation
```
[Prompt: "Research topic"] → [Tool: web_search] → [Prompt: "Summarize"] → [Output]
```

### Prompt Optimization
```
[Examples] → [GEPA Optimizer] → [Optimized Prompt] → [Test]
```

---

## 🔒 Security & Privacy

- **API Keys**: Encrypted with AES-GCM before storage, never sent to our servers
- **Workflows**: Stored locally in your browser (IndexedDB)
- **Backend**: Receives API keys temporarily for optimization, never logs or persists them
- **Custom Tools**: Run in isolated Web Worker sandbox, no file system access

---

## 📖 Example: Build a Research Assistant

1. **Create a prompt node**:
   - Prompt: "Research {{topic}} and provide 3 key points"
   - Model: `gpt-4o-mini`
   - Input variable: `topic`

2. **Add a custom tool** (web search simulator):
```javascript
async function searchWeb(args) {
    // In production, use a real search API
    return {
        results: [
            `${args.query} - Overview`,
            `${args.query} - Applications`,
            `${args.query} - Future trends`
        ]
    };
}
return searchWeb(args);
```

3. **Chain them together**:
   - Connect tool output to prompt input
   - Run the workflow
   - Export as `.promptflow` file

---

## 🚢 Production Deployment

Ready to deploy? See our deployment guides:

- **Frontend**: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) - Vercel, Netlify, AWS, etc.
- **Backend**: [backend/README.md](backend/README.md) - Docker, Heroku, Railway, etc.

Quick deploy to Vercel:
```bash
npm install -g vercel
npm run build
vercel --prod
```

---

## 🐛 Troubleshooting

### "API key not found" error
- Open Settings and add your API key
- Make sure you clicked "Save" after entering the key
- Check browser console for encryption errors

### Save/Open not working
- Use Chrome, Edge, or Opera for File System Access API
- Or use "Download Workflow" / "Upload Workflow" buttons

### Backend connection failed
- Verify backend is running: `curl http://localhost:5000/api/health`
- Check CORS settings in `backend/app.py`
- Ensure Backend URL in Settings matches your backend

### Custom tool errors
- Remove any `require()` or Node.js imports
- Use only browser APIs (fetch, etc.)
- Check browser console for detailed error messages

### Build errors
```bash
# Clear cache and rebuild
rm -rf node_modules dist
npm install
npm run build
```

---

## 📚 Learn More

- **Full Documentation**: [README.md](README.md)
- **Backend API**: [docs/BACKEND_API.md](docs/BACKEND_API.md)
- **Deployment Guide**: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- **Backend Setup**: [backend/README.md](backend/README.md)

---

## 🆘 Need Help?

1. Check this guide
2. Review [README.md](README.md)
3. Open an issue: https://github.com/ojasjagtap/tokn/issues

---

## 🎓 Tips & Best Practices

### Optimize Your Prompts
- Start simple, add complexity gradually
- Use variables (e.g., `{{topic}}`) for reusability
- Test with multiple inputs before optimizing
- Use DSPy/GEPA for data-driven optimization

### Organize Workflows
- Use descriptive node names
- Group related nodes visually
- Save different versions as you iterate
- Export workflows before major changes

### API Cost Management
- Use cheaper models for testing (`gpt-4o-mini`, `claude-3-5-haiku-20241022`)
- Set max_tokens to control response length
- Cache results when possible
- Monitor usage in provider dashboards

### Custom Tool Development
- Test tools separately before integrating
- Handle errors gracefully
- Add input validation
- Keep tools focused (single responsibility)
- Document expected args format

---

**You're all set!** Start building amazing AI workflows with tokn. Happy prompting! 🚀

*Last updated: 2025-11-24*
