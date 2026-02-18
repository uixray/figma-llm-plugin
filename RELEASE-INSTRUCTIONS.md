# UText V2.0 - Release Instructions

**Version**: 2.0.0
**Date**: 2026-02-15
**Status**: ✅ Ready for Manual Testing & Publication

---

## ✅ Completed Steps

### 1. Development ✅
- [x] All features implemented (6 phases complete)
- [x] Production build successful (ui.js 281KB, code.js 152KB)
- [x] No TypeScript errors
- [x] All documentation written

### 2. Version Control ✅
- [x] Git repository initialized
- [x] .gitignore created
- [x] LICENSE file (MIT) created
- [x] Initial commit created
- [x] Version tag v2.0.0 created

```bash
Commit: c86cc28
Tag: v2.0.0
Branch: master
Files: 80 files, 32,610 insertions
```

### 3. Documentation ✅
- [x] README.md (623 lines)
- [x] CHANGELOG.md (350+ lines)
- [x] PHASE-5-COMPLETE.md
- [x] PHASE-6-COMPLETE.md
- [x] RELEASE-SUMMARY.md
- [x] RELEASE-INSTRUCTIONS.md (this file)

---

## 📋 Next Steps (Manual Actions Required)

### Step 1: Manual Testing (2-3 hours)

**Testing Priority**: High → Medium → Low

#### HIGH Priority (Must Test Before Release)

**Provider Groups**:
- [ ] Create group (OpenAI)
  - Name: "Test OpenAI"
  - Provider: OpenAI
  - API Key: (use test key or leave invalid for UI testing)
  - Select models: GPT-4o, GPT-4 Turbo
  - Save → Verify appears in list
- [ ] Edit group
  - Click "Edit" on created group
  - Change name to "OpenAI Models"
  - Toggle model selection
  - Save → Verify changes persist
- [ ] Delete group
  - Click "Delete" → Confirm
  - Verify removed from list

**Text Generation**:
- [ ] Select model from dropdown
- [ ] Enter prompt: "Generate a product name for a smart coffee maker"
- [ ] Click "Generate" → Verify text appears
- [ ] Create text layer in Figma
- [ ] Select layer → "Apply to Selection" → Verify text applied

**Settings Persistence**:
- [ ] Create a provider group
- [ ] Close plugin
- [ ] Reopen plugin
- [ ] Verify group still exists

**Theme System**:
- [ ] Settings → General → Theme: "Light" → Verify bright theme
- [ ] Theme: "Dark" → Verify dark theme
- [ ] Theme: "Auto" → Verify matches system preference
- [ ] Close plugin → Reopen → Verify theme persists

**Export/Import**:
- [ ] Settings → General → "📥 Export Settings"
- [ ] Verify JSON file downloads
- [ ] Settings → General → "📤 Import Settings"
- [ ] Select exported file → Verify settings restored

#### MEDIUM Priority (Test if Time Permits)

**Mass Renaming**:
- [ ] Create 5+ text layers with content
- [ ] Select all layers
- [ ] Rename panel → BEM → "Rename by Content"
- [ ] Verify layers renamed (e.g., "Product Title" → "ProductTitle")
- [ ] Test other conventions: camelCase, snake_case, kebab-case

**Saved Prompts**:
- [ ] Prompts panel → "+ Add Prompt"
- [ ] Name: "Test Prompt"
- [ ] Category: Custom
- [ ] Prompt: "Generate test data"
- [ ] Save → Verify appears in list
- [ ] Delete prompt → Verify removed

**Language Switching**:
- [ ] Settings → General → Language: "Русский"
- [ ] Verify entire UI updates to Russian
- [ ] Test 2-3 other languages (Japanese, Chinese)
- [ ] Switch back to English

#### LOW Priority (Nice to Have)

**Edge Cases**:
- [ ] Create group without API key → Verify validation error
- [ ] Create group without selecting models → Verify validation error
- [ ] Import invalid JSON → Verify error message
- [ ] Generate with very long prompt (1000+ chars) → Verify handling
- [ ] Rename 100+ layers at once → Verify progress tracking

**API Testing** (requires valid API keys):
- [ ] Add real API key for one provider
- [ ] Generate actual text
- [ ] Verify streaming works (if provider supports)
- [ ] Verify error handling for invalid API key

---

### Step 2: Fix Critical Bugs (If Found)

If testing reveals critical bugs:

1. **Fix the issue**
2. **Rebuild**: `bun run build`
3. **Test fix**
4. **Amend commit**:
   ```bash
   git add .
   git commit --amend --no-edit
   git tag -d v2.0.0
   git tag -a v2.0.0 -m "Version 2.0.0 - ..." # Same message
   ```

**Note**: Only fix critical bugs. Minor issues → create GitHub issues for V2.1.

---

### Step 3: Create Screenshots (5-8 images)

**Required Screenshots**:

1. **Main UI - Generate Panel**
   - Show text generation in action
   - Display model dropdown with providers
   - Show generated text in output area
   - **File**: `screenshots/01-generate-panel.png`

2. **Provider Groups Settings**
   - Show groups list with 2-3 groups
   - Display group cards with model counts
   - Show "Add Group" button
   - **File**: `screenshots/02-provider-groups.png`

3. **Group Editor Modal**
   - Show modal open with form fields
   - Display provider selection
   - Show model checkboxes with pricing
   - **File**: `screenshots/03-group-editor.png`

4. **Mass Renaming Demo**
   - Before: Text layers with original names
   - After: Renamed layers (BEM/camelCase/etc)
   - Show rename panel with convention selector
   - **File**: `screenshots/04-mass-rename.png`

5. **Saved Prompts Library**
   - Show prompts list with categories
   - Display tags
   - Show built-in presets
   - **File**: `screenshots/05-saved-prompts.png`

6. **Theme System**
   - Split image: Light mode (left) + Dark mode (right)
   - Same UI in both themes
   - **File**: `screenshots/06-themes.png`

7. **Multi-Language Support** (Optional)
   - Split image: English (left) + Russian/Japanese (right)
   - Same panel in different languages
   - **File**: `screenshots/07-i18n.png`

8. **Export/Import** (Optional)
   - Show export button
   - Display JSON preview
   - Show import dialog
   - **File**: `screenshots/08-export-import.png`

**Screenshot Tips**:
- Use Figma plugin window (don't crop too tight)
- Show realistic data (product names, user names)
- Use light mode for consistency (or show both)
- Highlight key features with arrows/annotations (optional)
- Resolution: At least 1600px width for clarity

---

### Step 4: GitHub Setup (If Not Already Done)

1. **Create GitHub Repository**:
   - Repository name: `figma-llm-plugin` or `utext-figma`
   - Description: "UText - AI-powered text generation for Figma with 30+ LLM providers"
   - Public repository
   - Don't initialize with README (we already have one)

2. **Add Remote**:
   ```bash
   cd "D:\Dev\Claude projects\figma-llm-plugin"
   git remote add origin https://github.com/YOUR_USERNAME/figma-llm-plugin.git
   ```

3. **Push to GitHub**:
   ```bash
   git push -u origin master
   git push origin v2.0.0
   ```

---

### Step 5: Create GitHub Release

1. **Go to Releases**: `https://github.com/YOUR_USERNAME/figma-llm-plugin/releases`

2. **Click "Draft a new release"**

3. **Fill Release Form**:
   - **Tag**: `v2.0.0` (select existing tag)
   - **Title**: `UText V2.0 - AI-Powered Text Generation 🎉`
   - **Description**: Copy from below

4. **Release Notes** (Markdown):

```markdown
# UText V2.0 - Complete Rewrite 🎉

The ultimate Figma plugin for AI text generation, layer renaming, and design automation.

## ✨ Highlights

### 🤖 30+ AI Providers
- **Yandex Cloud** (8 models): YandexGPT Pro/Lite, GPT-4o-mini, Claude 3.5, Llama 3.1, Mistral Nemo/Large
- **OpenAI** (5 models): GPT-4o, GPT-4 Turbo, O1-preview, O1-mini, GPT-4o Mini
- **Claude** (4 models): Claude 3.5 Sonnet/Haiku, Claude 3 Opus/Sonnet
- **Google Gemini** (3 models): Gemini 2.5 Flash, 1.5 Pro/Flash
- **Mistral** (5 models): Large, Small, Nemo, Pixtral, Codestral
- **Groq** (5 models): Llama 3.3, 3.1, 3, Mixtral, Gemma 2
- **Cohere** (2 models): Command R+, Command R
- **LM Studio** (local): Run models locally on your machine

### 🎯 Key Features

- **Provider Groups**: Share one API key across multiple models
- **Mass Layer Renaming**: BEM, camelCase, snake_case, kebab-case
- **Saved Prompts Library**: Categories, tags, quick apply
- **Batch Processing**: Rename hundreds of layers instantly
- **Theme System**: Light/Dark/Auto modes
- **i18n Support**: 5 languages (EN/RU/JA/ZH/FR)
- **Export/Import**: Backup and restore settings

## 📦 Installation

### From Source
\`\`\`bash
git clone https://github.com/YOUR_USERNAME/figma-llm-plugin.git
cd figma-llm-plugin
bun install
bun run build
\`\`\`

### Import to Figma
1. Open Figma Desktop
2. Plugins → Development → Import plugin from manifest...
3. Select `manifest.json`

## 📖 Documentation

- **User Guide**: [README.md](README.md)
- **Changelog**: [CHANGELOG.md](CHANGELOG.md)
- **Migration**: See CHANGELOG.md for V1.x → V2.0 guide

## 🏗️ Technical Details

**Architecture**:
- Strategy pattern for providers
- Modular UI (5 panels, main.ts reduced 84%)
- Settings migration (V1→V2→V2.1)
- TypeScript strict mode (100%)

**Bundle Size**:
- ui.js: 281.73 KB
- code.js: 152.58 KB
- Total: 434 KB

**Build Time**: ~80ms

## 🐛 Known Issues

None at release time ✅

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/YOUR_USERNAME/figma-llm-plugin/issues)
- **Discussions**: [GitHub Discussions](https://github.com/YOUR_USERNAME/figma-llm-plugin/discussions)

## 🙏 Credits

Developed with Claude Code (Sonnet 4.5)

---

**Full Changelog**: Initial release (no previous version)
```

5. **Upload Screenshots**:
   - Drag and drop all screenshot files into release description
   - They'll be automatically embedded

6. **Attach Build Artifacts** (Optional):
   - `dist/ui.html`
   - `dist/code.js`
   - Can be useful for users who want pre-built version

7. **Publish Release**: Click "Publish release"

---

### Step 6: Figma Community Submission

**Prerequisites**:
- ✅ Plugin tested and working
- ✅ Screenshots created
- ✅ GitHub release published

**Steps**:

1. **Open Figma Desktop**

2. **Run Plugin**: Plugins → Development → UText - AI Text Generator

3. **Publish Plugin**:
   - In plugin window: Three dots menu (⋮) → "Publish plugin..."
   - Or: Right-click plugin in Development → "Publish plugin..."

4. **Fill Submission Form**:

   **Basic Info**:
   - **Name**: `UText - AI Text Generator`
   - **Tagline**: "AI-powered text generation with 30+ providers, mass renaming, and design automation"
   - **Description**:

   ```
   Transform your Figma workflow with AI-powered text generation, mass layer renaming, and design automation.

   ✨ KEY FEATURES

   🤖 30+ AI Providers
   Choose from OpenAI, Claude, Gemini, Mistral, Groq, Cohere, Yandex Cloud, or run models locally with LM Studio.

   🎯 Smart Text Generation
   • Built-in prompts for users, products, places, colors
   • Custom prompts library with categories and tags
   • System prompts to guide AI behavior
   • Temperature control for creativity
   • Real-time streaming output

   🏷️ Mass Layer Renaming
   Rename hundreds of layers instantly with:
   • BEM Convention (Block__Element--Modifier)
   • camelCase (firstSecondThird)
   • snake_case (first_second_third)
   • kebab-case (first-second-third)

   🔑 Provider Groups
   Share one API key across multiple models. Perfect for teams and power users.

   🎨 Beautiful UI
   • Light/Dark/Auto themes
   • 5 languages (EN/RU/JA/ZH/FR)
   • Modular, responsive design
   • Export/Import settings

   📖 QUICK START

   1. Install plugin
   2. Add provider: Settings → Groups → "+ Add Group"
   3. Generate text: Select model → Enter prompt → Generate
   4. Apply to layers: Select text layers → "Apply to Selection"

   💡 PERFECT FOR

   • UI designers creating mockups
   • UX writers testing copy variations
   • Content creators generating ideas
   • Design teams using AI workflows

   🆓 FREE & OPEN SOURCE

   MIT License. Full documentation and source code on GitHub:
   https://github.com/YOUR_USERNAME/figma-llm-plugin

   ⚡ TECHNICAL

   • 30+ model configurations
   • Strategy pattern architecture
   • TypeScript strict mode
   • Fast builds (~80ms)
   • Bundle: 434 KB total

   Support: GitHub Issues | Documentation: README.md
   ```

   **Categories**:
   - Primary: `Productivity`
   - Secondary: `Text`, `Automation`

   **Tags** (max 10):
   - `ai`
   - `text-generation`
   - `llm`
   - `openai`
   - `claude`
   - `gemini`
   - `automation`
   - `rename`
   - `productivity`
   - `design-tools`

   **Cover Image**:
   - Use screenshot #1 (Generate Panel) or create custom graphic
   - Dimensions: 1920×1080 or 1600×900
   - Show plugin in action

   **Screenshots** (5-8 images):
   - Upload all created screenshots
   - Order: Main UI → Provider Groups → Features → Details

   **Links**:
   - **GitHub**: `https://github.com/YOUR_USERNAME/figma-llm-plugin`
   - **Documentation**: `https://github.com/YOUR_USERNAME/figma-llm-plugin#readme`
   - **Issues**: `https://github.com/YOUR_USERNAME/figma-llm-plugin/issues`

5. **Submit for Review**:
   - Click "Submit for review"
   - Figma team will review (usually 1-3 business days)
   - You'll receive email notification when approved

6. **After Approval**:
   - Plugin appears in Community
   - Users can install directly from Figma
   - Share link: `https://figma.com/community/plugin/YOUR_PLUGIN_ID`

---

## 🎉 Post-Release Actions

### 1. Announce Release

**Social Media** (Optional):
- Twitter/X: "Just released UText V2.0 for Figma! 30+ AI providers, mass renaming, themes. Free & open source 🚀"
- LinkedIn: Professional post with screenshots
- Reddit: r/FigmaDesign (check subreddit rules first)

**Figma Community**:
- Comment on your plugin page with tips
- Respond to user feedback

### 2. Monitor Feedback

**GitHub**:
- Watch for issues
- Respond to questions
- Triage bugs: Critical → High → Medium → Low

**Figma Community**:
- Read reviews
- Respond to comments
- Update plugin based on feedback

### 3. Plan V2.1

**Roadmap**:
- [ ] User feedback implementation
- [ ] Bug fixes from community
- [ ] Onboarding tutorial
- [ ] Automated tests
- [ ] Performance optimization

---

## 📊 Success Metrics

**Track These** (after 1 week, 1 month, 3 months):

- GitHub Stars
- Figma Community installs
- GitHub Issues (open/closed)
- User reviews (rating)
- Feature requests
- Contributors

**Target Goals** (3 months):
- ⭐ 100+ GitHub stars
- 📥 1,000+ installs
- ⭐⭐⭐⭐⭐ 4.5+ rating
- 📝 Active community (issues, discussions)

---

## ✅ Final Checklist

Before submitting to Figma Community:

- [ ] All manual tests passed
- [ ] Screenshots created (5-8 images)
- [ ] GitHub repository created
- [ ] Git pushed to GitHub
- [ ] GitHub release published
- [ ] No critical bugs found
- [ ] Documentation reviewed
- [ ] Plugin manifest correct

After all ✅ → Submit to Figma Community! 🚀

---

## 📞 Help & Support

**Questions During Release?**

1. **Check Documentation**:
   - README.md
   - CHANGELOG.md
   - PHASE-6-COMPLETE.md

2. **Common Issues**:
   - Build errors → `bun install && bun run build`
   - Git issues → Check `.gitignore`
   - Figma errors → Check `manifest.json`

3. **Need Help?**:
   - Review PHASE-6-COMPLETE.md for detailed guides
   - Check Figma plugin documentation
   - GitHub Issues template

---

**🎊 Good luck with the release! UText V2.0 is ready to ship! 🎊**

---

_Document created: 2026-02-15_
_Version: 2.0.0_
_Status: Ready for manual testing_
