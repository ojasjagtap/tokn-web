# Troubleshooting IDE Not Working

If the IDE loads but is non-functional after building, follow these steps to diagnose and fix the issue.

## Step 1: Rebuild from Scratch

```bash
# Clean previous build
rm -rf dist/

# Rebuild
npm run build

# Check that all folders are present
ls -la dist/
```

You should see these folders in `dist/`:
- ✅ `assets/` - Bundled CSS and JS
- ✅ `landing/` - Landing page assets
- ✅ `renderer/` - IDE logic
- ✅ `flows/` - Workflow examples
- ✅ `src/` - Services and workers

If any are missing, the build plugin isn't working correctly.

## Step 2: Test Locally

```bash
npm run preview
```

Visit http://localhost:4173/app.html

## Step 3: Check Browser Console

Open browser DevTools (F12) and check the Console tab for errors:

### Common Errors and Fixes

#### Error: "Failed to fetch dynamically imported module"
**Problem**: Module paths are incorrect or files don't exist

**Check**:
```bash
# Verify renderer/script.js exists
ls -la dist/renderer/script.js

# Verify src folder exists
ls -la dist/src/services/
```

**Fix**: Re-run build. The vite.config.js plugin should copy these folders.

#### Error: "Cannot find module '../src/services/fileOperations.js'"
**Problem**: The src folder wasn't copied to dist

**Fix**:
1. Make sure [vite.config.js](vite.config.js) includes src in the copyStaticFolders plugin
2. Rebuild with `npm run build`

#### Error: "Failed to load module script"
**Problem**: CORS or MIME type issues

**Fix**: Use `npm run preview` (not a simple file server like `python -m http.server`)

#### No errors, but IDE still doesn't work
**Problem**: JavaScript might be silently failing

**Debug Steps**:
1. Open DevTools Console
2. Type: `console.log('test')`
3. Check Network tab - are all files loading?
4. Check if `/renderer/script.js` returns 200 status
5. Check if `/src/services/fileOperations.js` returns 200 status

## Step 4: Verify File Contents

Check that the renderer script can be loaded:

```bash
# Check if renderer/script.js exists and has content
head -20 dist/renderer/script.js

# Check if services exist
ls -la dist/src/services/
```

## Step 5: Test Import Paths

Create a test file to verify imports work:

```html
<!-- test-imports.html -->
<!DOCTYPE html>
<html>
<body>
  <div id="status"></div>
  <script type="module">
    const status = document.getElementById('status');

    try {
      // Test importing renderer script
      await import('/renderer/script.js');
      status.innerHTML = '✓ All imports successful';
      status.style.color = 'green';
    } catch (error) {
      status.innerHTML = `✗ Import failed: ${error.message}`;
      status.style.color = 'red';
      console.error(error);
    }
  </script>
</body>
</html>
```

Place this in the `dist/` folder and visit it via preview server.

## Step 6: Check for Path Issues

The renderer/script.js uses these imports:
- `../src/services/fileOperations.js`
- `../src/services/providerRegistry.js`
- `./tool-script.js`
- `./dspy-optimize-script.js`
- `./dspy-worker.js`
- etc.

All these paths must exist in the dist folder structure:
```
dist/
├── renderer/
│   ├── script.js (imports ../src/services/)
│   ├── tool-script.js
│   ├── dspy-optimize-script.js
│   └── ...
└── src/
    └── services/
        ├── fileOperations.js
        ├── providerRegistry.js
        └── webStorage.js
```

## Step 7: Verify Vite Config

Check your [vite.config.js](vite.config.js):

```javascript
const copyStaticFolders = () => ({
  name: 'copy-static-folders',
  closeBundle() {
    cpSync(resolve(__dirname, 'landing'), resolve(__dirname, 'dist/landing'), { recursive: true })
    cpSync(resolve(__dirname, 'renderer'), resolve(__dirname, 'dist/renderer'), { recursive: true })
    cpSync(resolve(__dirname, 'flows'), resolve(__dirname, 'dist/flows'), { recursive: true })
    cpSync(resolve(__dirname, 'src'), resolve(__dirname, 'dist/src'), { recursive: true })
  }
})
```

All four cpSync calls must be present.

## Step 8: Clear Browser Cache

Sometimes the browser caches old broken versions:

1. Open DevTools (F12)
2. Right-click the reload button
3. Select "Empty Cache and Hard Reload"

Or use incognito/private mode.

## Step 9: Check React App Loading

The React app in app.html should load renderer/script.js. Check [src/App.jsx](src/App.jsx):

```javascript
useEffect(() => {
  const script = document.createElement('script')
  script.src = '/renderer/script.js'
  script.type = 'module'
  document.body.appendChild(script)
}, [])
```

This dynamically loads the renderer script after React mounts.

## Step 10: Network Tab Analysis

1. Open DevTools → Network tab
2. Reload page
3. Filter by "JS"
4. Check that these load successfully (200 status):
   - `/assets/app-*.js` (React bundle)
   - `/renderer/script.js`
   - `/src/services/fileOperations.js`
   - `/src/services/providerRegistry.js`

If any return 404, the file wasn't copied correctly.

## Common Issues Summary

| Symptom | Cause | Fix |
|---------|-------|-----|
| Blank canvas, no grid | renderer/script.js not loading | Copy renderer folder to dist |
| Can't drag nodes | JavaScript not initializing | Check console for errors |
| 404 on /src/services/ | src folder not copied | Add src to copyStaticFolders |
| Module import errors | Wrong paths or missing files | Verify folder structure in dist |
| Works in dev, not in build | Static files not copied | Update vite.config.js |

## Still Not Working?

1. **Compare with working dev mode**:
   ```bash
   # Start dev server
   npm run dev
   ```
   If it works in dev but not in build, it's definitely a build configuration issue.

2. **Check file permissions**:
   ```bash
   ls -la dist/renderer/
   ls -la dist/src/
   ```
   All files should be readable.

3. **Verify Node/npm versions**:
   ```bash
   node --version  # Should be 18+
   npm --version
   ```

4. **Check for syntax errors**:
   ```bash
   # Lint the renderer script
   grep -n "import.*from" renderer/script.js
   ```
   All import paths should be correct.

5. **Test with a minimal setup**:
   Create a simple HTML file that just tries to load the renderer:
   ```html
   <!DOCTYPE html>
   <html>
   <body>
     <h1>Test</h1>
     <script type="module">
       import * as renderer from '/renderer/script.js';
       console.log('Loaded!', renderer);
     </script>
   </body>
   </html>
   ```

## Getting More Info

To get detailed error information:

```javascript
// Add to browser console
window.addEventListener('error', (e) => {
  console.error('Global error:', e.error);
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled promise rejection:', e.reason);
});
```

## Report the Issue

If still not working, provide:
1. Full error message from console
2. Network tab screenshot showing failed requests
3. Output of `ls -la dist/`
4. Node/npm versions
5. Browser and version

---

**Next Steps**:
- Make sure build includes all folders (landing, renderer, flows, src)
- Test with `npm run preview`
- Check browser console for specific errors
- Verify all imports resolve correctly
