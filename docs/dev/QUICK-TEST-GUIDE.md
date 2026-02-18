# Quick Test Guide - Figma LLM Plugin V2

## 🧪 5-Minute Smoke Test

### 1. Load Plugin (30 seconds)
1. Open Figma
2. Plugins → Development → Figma LLM Text Generator
3. ✅ Plugin window opens without errors
4. ✅ All 6 tabs visible

### 2. Test Settings Panel (1 minute)
1. Click **Settings** tab
2. ✅ Provider cards display
3. Click **+ Add Provider**
4. ✅ Modal opens with provider list
5. Click **Cancel**

### 3. Test Language Switcher (30 seconds)
1. In Settings, find **Language** dropdown
2. Select **Русский**
3. ✅ UI changes to Russian
4. Select **English**
5. ✅ UI changes back

### 4. Test Generate Panel (1 minute)
1. Click **Generate** tab
2. Type "Write a short welcome message" in prompt
3. ⚠️ If no provider configured:
   - Go to Settings
   - Add a provider (e.g., OpenAI with your API key)
   - Come back to Generate
4. Click **Generate**
5. ✅ Text appears in output area

### 5. Test Rename Panel (1 minute)
1. Create a few frames in Figma with random names
2. Select them
3. Click **Rename** tab
4. Select **camelCase** preset
5. Click **Preview Changes**
6. ✅ Preview table shows old → new names
7. Click **Apply Renaming**
8. ✅ Frames renamed in Figma

### 6. Test Prompts Panel (1 minute)
1. Click **Prompts** tab
2. Click **+ New Prompt**
3. Enter:
   - Name: "Welcome Message"
   - Category: "Marketing"
   - Content: "Write a warm welcome message"
4. Click **Save**
5. ✅ Prompt appears in list
6. Click **Load** on the saved prompt
7. ✅ Prompt loaded into Generate panel

---

## ✅ If All Tests Pass

**Congratulations!** The plugin is working correctly.

Next steps:
1. Update README.md with v2 features
2. Create CHANGELOG.md
3. Bump version to 2.0.0 in manifest.json
4. Ship it! 🚀

---

## ❌ If Tests Fail

### Error: "Cannot find module"
**Fix:** Run `npm install` then `npm run build`

### Error: Panel is blank
**Fix:** Check browser console (Cmd/Ctrl+Opt/Alt+I in Figma)
- Look for JavaScript errors
- Check if files are in `dist/` folder

### Error: Provider not working
**Fix:** Check:
1. API key is correct
2. Provider is enabled
3. Provider is set as active
4. Network connection is working

### Error: Rename not working
**Fix:**
1. Make sure layers are selected in Figma
2. Check console for errors
3. Try a different preset

---

## 🐛 Common Issues

### "No active provider configured"
→ Go to Settings → Add a provider → Set it as active

### "Please select at least one layer"
→ Select frames, groups, or text layers in Figma canvas

### "Preset not found"
→ The rename handler needs initialization - reload the plugin

### UI is in wrong language
→ Go to Settings → Language → Select your preferred language

---

## 📊 Expected Results

### Plugin Load
- Window: 380x550px
- 6 tabs: Generate, Settings, Data, Rename, Prompts, Help
- No console errors

### Settings Panel
- Empty provider list (if first run)
- "+ Add Provider" button working
- Language dropdown with 3 options
- Save Settings button visible

### Generate Panel
- Prompt textarea
- Advanced settings (collapsible)
- Generate/Cancel buttons
- Output area with Apply/Copy/Clear buttons

### Rename Panel
- Preset dropdown
- Preview button
- Preview table (when activated)
- Apply button

### Prompts Panel
- "No prompts saved yet" message (if first run)
- "+ New Prompt" button
- Search bar
- Category filter

### Data Panel
- Preset selector
- "New Preset" button
- Instructions visible

---

## 🎯 Full Test Checklist

See `INTEGRATION-COMPLETE.md` for the comprehensive testing checklist.

---

**Happy Testing!** 🧪
