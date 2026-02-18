# Figma LLM Plugin — Project Analysis & Publication Readiness Report

## 1. Overview

**Current name:** LLM Text Generator
**Version:** 1.0.0 (de facto v2.0 by features)
**Codebase:** ~14,500 lines of TypeScript across 42 source files
**Architecture:** Figma Plugin API (Sandbox + UI iframe)
**Build system:** tsup (esbuild-based bundler)

---

## 2. Publication Readiness Assessment

### Overall Score: 7/10 — Almost Ready

| Criterion               | Score | Status  |
|--------------------------|-------|---------|
| Core functionality       | 9/10  | Working |
| UI/UX                    | 7/10  | Good, needs polish |
| Code quality             | 8/10  | Clean architecture |
| Internationalization     | 8/10  | 5 languages |
| Error handling           | 7/10  | Decent |
| Documentation            | 3/10  | Missing |
| Testing                  | 1/10  | No tests |
| Security                 | 6/10  | API keys in plaintext clientStorage |
| Figma Community metadata | 0/10  | Not prepared |
| GitHub repo readiness    | 2/10  | No README, LICENSE, CONTRIBUTING |

---

## 3. Strong Sides

### Architecture
- **Strategy pattern** for 8 provider implementations (BaseProvider -> OpenAI, Claude, Gemini, Yandex, Mistral, Groq, Cohere, LM Studio)
- **Modular UI** with 5 dedicated panels (Generate, Data, Rename, Settings, Help) + coordinator
- **Clean separation**: shared types/constants, sandbox logic, UI rendering
- **Settings migration** system (v1->v2) with backwards compatibility
- **Message-based** communication between UI iframe and sandbox

### Features (unique for Figma plugins)
- **30+ AI models** from 8 providers — no other Figma plugin offers this breadth
- **Data substitution** system with presets, field schemas, cyclic group application
- **Mass layer renaming** with 4 style presets (BEM, camelCase, snakeCase, kebabCase) + AI-powered rename
- **Saved prompts library** with categories, tags, search, per-prompt provider preference
- **Batch processing** with progress tracking and cancellation
- **Built-in data presets** (User, Product, Place, Color themes) available from quick actions menu
- **i18n** (English, Russian, Japanese, Chinese, French) with first-run language selector

### Technical highlights
- **Streaming support** for text generation (real-time token display)
- **Cost estimation** per generation (input/output pricing per model)
- **Retry logic** with exponential backoff for API failures
- **Custom abort/cancellation** system (Figma sandbox doesn't support AbortController)
- **Context-aware generation** — selected layers' text auto-attached as context

---

## 4. Weak Sides

### Critical for publication
1. **No automated tests** — 0 test files, 0 test commands
2. **No README.md** — no installation, usage, or contribution guide
3. **No LICENSE** — unclear IP rights
4. **API keys stored in plaintext** in `figma.clientStorage` (industry standard for Figma plugins, but should be documented)
5. **`confirm()` and `alert()` blocked** in Figma iframe — some deletion flows may silently fail
6. **First-run screen forced** to always show (temporary debug flag left in main.ts line ~258)
7. **No error boundary** — unhandled errors in panel constructors could crash entire UI

### UX issues
1. **No onboarding flow** beyond language selection — new users don't know where to start
2. **No connection test button** for providers — users can't verify API keys work before generating
3. **Provider cards don't show API key status** (configured vs. not configured)
4. **No undo** for text generation — applied text changes can't be reverted
5. **Modal-based workflows** for prompts library — could be inline panels instead
6. **No keyboard shortcuts** for common actions
7. **Color presets** (Red, Blue, Green, Yellow) are structurally different from data presets — confusing

### Technical debt
1. **`main-old.ts`** (1,357 lines) kept in source — dead code
2. **Duplicate Groq model** — Mixtral 8x7B is deprecated on Groq platform (replaced with Llama 3.1 8B)
3. **Claude models require CORS proxy** but proxy setup is not documented
4. **`networkAccess.allowedDomains`** in manifest only lists 3 domains — users adding Mistral, Groq, Cohere, Gemini will hit network errors
5. **No input sanitization** for provider API URLs
6. **`window.prompt()` calls** would fail in Figma iframe (already mitigated in Prompts panel but check other panels)

---

## 5. Ideas for Improvement

### High Priority (before publication)
1. Write README.md with screenshots, installation guide, feature overview
2. Add LICENSE (MIT recommended for community plugins)
3. Fix `networkAccess.allowedDomains` — add all provider domains
4. Remove first-run force-show debug flag
5. Delete `main-old.ts`
6. Add connection test button in Settings panel
7. Add CHANGELOG.md

### Medium Priority
1. Add unit tests for shared utilities (validation, migration, i18n)
2. Add "Test Connection" button per provider card
3. Add undo support (store previous text values before applying)
4. Add keyboard shortcuts (Cmd+Enter to generate, Esc to cancel)
5. Add "Copy to clipboard" button for generated text
6. Add prompt templates/starters for common Figma tasks
7. Add dark mode specific styles (currently relies on Figma's CSS variables)
8. Add generation history (last 10 generations with timestamps)

### Nice to Have
1. Add Figma Variables support (read/apply design tokens)
2. Add image generation via DALL-E/Midjourney/Flux APIs
3. Add translation mode (auto-detect source language, translate to target)
4. Add team sharing for prompts and presets via Figma team storage
5. Add analytics/usage dashboard per provider (cost tracking, token usage)
6. Add OpenRouter as meta-provider (access 100+ models through one API key)
7. Add support for Figma's new Widget API (embedded UI in canvas)

---

## 6. Plugin Name Suggestions

### Primary recommendations (searchable, descriptive):
1. **AI Text Lab** — short, memorable, implies experimentation
2. **Copygen AI** — implies copy/content generation, modern feel
3. **TextForge AI** — implies powerful text crafting
4. **AI Content Fill** — directly describes the core function

### Alternative options:
5. **SmartText AI** — clear, functional
6. **Multi-LLM Text** — highlights the multi-provider advantage
7. **PolyglotAI** — highlights multilingual capability
8. **FillText AI** — describes data fill + generation
9. **ContentBridge** — bridges AI providers to Figma
10. **AI Copy Studio** — studio implies comprehensive toolkit

### Name analysis:

| Name | Searchability | Uniqueness | Clarity | Memorability |
|------|:---:|:---:|:---:|:---:|
| AI Text Lab | High | Medium | High | High |
| Copygen AI | High | High | Medium | High |
| TextForge AI | Medium | High | Medium | High |
| AI Content Fill | High | Medium | Very High | Medium |
| Multi-LLM Text | Very High | High | Very High | Low |

**Recommendation:** "AI Text Lab" — it's short, searchable ("AI text figma"), hints at experimentation (supporting 30+ models), and sounds professional.

---

## 7. Figma Community Description

### Short description (for search):
> AI-powered text generation and data fill for Figma. 30+ models from OpenAI, Claude, Gemini, Groq, Mistral, Cohere, YandexGPT, and LM Studio. Generate, translate, rename layers, and fill designs with real data.

### Full description:

> **The most versatile AI text plugin for Figma.**
>
> Connect 30+ language models from 8 providers and generate, transform, and fill text content directly in your designs.
>
> **Key Features:**
>
> - **Multi-Provider AI Generation** — GPT-4o, Claude, Gemini, Groq, Mistral, Cohere, YandexGPT, or run models locally with LM Studio. Switch providers per request.
>
> - **Smart Data Fill** — Replace placeholder text with real data using customizable presets. Built-in templates for Users, Products, Places, and more. Create your own presets and share them as JSON.
>
> - **Mass Layer Renaming** — Apply BEM, camelCase, snakeCase, or kebabCase naming conventions to hundreds of layers at once. Or let AI suggest semantic names based on content.
>
> - **Saved Prompts Library** — Save, categorize, and reuse your best prompts. Assign preferred providers per prompt. Search by name, content, or tags.
>
> - **Batch Processing** — Generate content for multiple text layers simultaneously with progress tracking and cost estimation.
>
> - **5 Languages** — Full interface localization: English, Russian, Japanese, Chinese, French.
>
> - **Privacy First** — Use LM Studio for completely offline, private AI generation. No data leaves your machine.
>
> **Quick Start:**
> 1. Install the plugin
> 2. Go to Settings, add a provider (LM Studio for free local, or any cloud API)
> 3. Select text layers in your design
> 4. Write a prompt and click Generate
>
> **For Teams:**
> Export/import presets and prompts as JSON to share with your team. Built-in presets available from the quick actions menu.
>
> **Pricing:** The plugin itself is free. AI API usage is billed by your chosen provider. LM Studio is completely free.

### Tags for Figma Community:
`ai`, `text`, `content`, `generation`, `gpt`, `claude`, `gemini`, `llm`, `data`, `fill`, `rename`, `layers`, `localization`, `translation`, `batch`

---

## 8. GitHub Repository Checklist

### Files needed before publishing:
- [ ] `README.md` — with screenshots, features, installation, usage
- [ ] `LICENSE` — MIT
- [ ] `CHANGELOG.md` — version history
- [ ] `CONTRIBUTING.md` — how to contribute
- [ ] `.gitignore` — ensure dist/, node_modules/ are excluded
- [ ] `package.json` — update version to 2.0.0, add description, keywords, repository URL
- [ ] Screenshots/GIFs for README and Figma Community page

### Code cleanup:
- [ ] Delete `src/ui/main-old.ts`
- [ ] Remove first-run debug flag in `main.ts`
- [ ] Update manifest `networkAccess.allowedDomains` to include all provider domains
- [ ] Review and remove any `console.log` debug statements
- [ ] Verify all TODO comments are resolved

---

## 9. Competitive Landscape

### Similar Figma plugins (as of 2025):
1. **Content Reel** — data fill only, no AI
2. **CopyDoc** — exports copy, no AI generation
3. **AI Copilot** — single provider (OpenAI only)
4. **ChatGPT for Figma** — OpenAI only, no data fill
5. **Relume Lorem Ipsum** — basic placeholder text

### Our competitive advantages:
- **8 providers vs 1** in most competitors
- **Data substitution system** — unique combination with AI generation
- **Mass rename** — not found in any AI text plugin
- **Local model support** (LM Studio) — privacy-first approach
- **i18n** — most plugins are English-only
- **Saved prompts with provider preference** — unique workflow optimization
- **Open-source** (if published on GitHub) — community can contribute providers
