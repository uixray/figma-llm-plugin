# UText - AI Text Generator: Analysis & Growth Plan

Last updated: 2026-02-20

## Overview

**Plugin:** UText - AI Text Generator v2.1.0
**Stack:** TypeScript (strict), Figma Plugin API, tsup bundler
**Architecture:** Sandbox (Figma API) + UI (WebView) + Shared (types, i18n, providers)
**Providers:** 9 implementations, 30+ models (OpenAI, Claude, Gemini, Groq, Mistral, Cohere, Yandex, LM Studio, Custom)
**Localization:** 5 languages (EN, RU, JA, ZH, FR), ~2000 translation strings
**Proxy:** figma-yandex-proxy server with Cloudflare Worker tunneling for regional bypass

---

## Strong Sides

### Architecture & Code Quality
- **Strategy + Factory patterns** for providers — adding a new provider requires only a new class extending `BaseProvider`
- **Full TypeScript strict mode** — comprehensive interfaces for all data structures (`PluginSettings`, `ProviderGroup`, `ModelConfig`, `DataPreset`, etc.)
- **Clean separation** — sandbox (Figma API access), UI (panels/modals), shared (types, i18n, utils)
- **Type-safe IPC** — message types defined in `messages.ts`, async request/response with unique IDs
- **Settings versioning & migration** — automatic v1 → v2 → v2.1 migration without data loss (`settings-migration.ts`)

### Feature Richness
- **4 core features** that cover the main designer workflow: text generation, data substitution, mass renaming, prompt library
- **30+ pre-configured models** with pricing info — user sees estimated cost before generating
- **Provider Groups (v2.1)** — group multiple models under one API key with custom URLs, proxy, pricing overrides
- **Data Presets** — field schemas with groups, reverse fill by layer name matching, import/export
- **Mass Rename** — style mode (BEM, camelCase, etc.) + AI mode with preview-before-apply
- **Saved Prompts Library** — categories, tags, usage counting, provider preference per prompt

### Infrastructure
- **Self-hosted CORS proxy** (`figma-yandex-proxy`) solves Figma's null-origin restriction
- **Cloudflare Worker tunneling** — free regional bypass without extra servers
- **Per-provider proxy config** — only route blocked providers (e.g., Gemini) through proxy
- **Retry with exponential backoff** and `AbortController` — resilient to network issues

### UX
- **Inline editing** — no page navigation, forms appear in-place
- **Preview-before-apply** for renaming and data substitution
- **Collapsible advanced sections** — clean default UI, power features accessible
- **Context badges** — shows how many layers are attached to the prompt
- **First-run language picker** — smooth onboarding

---

## Weak Sides

### Testing
- Jest configured but **<10% coverage**
- No unit tests for provider implementations (token counting, cost calculation, response parsing)
- No integration tests for settings migration (critical path — data loss risk)
- No E2E tests for main workflows (generate → apply, batch rename)
- Test setup exists (`__tests__/setup.ts`) but largely unused

### Performance
- **Sequential batch processing** — mass rename/generate processes nodes one-by-one; 50+ nodes = noticeable wait
- **Crude token estimation** (1 token ~ 4 chars) — inaccurate cost display, especially for non-Latin text
- **No response caching** — identical prompts always hit API
- **Large preset imports** can cause UI lag — no chunked processing

### Missing Capabilities
- **No vision/multimodal support** — GPT-4V, Gemini Vision, Claude Vision unused despite being ideal for a design plugin
- **No streaming display** — response appears all at once after generation completes
- **No undo support** — applied text/renames cannot be reverted (only Figma's built-in undo)
- **No parallel generation** — can't generate for multiple layers simultaneously
- **No Figma Variables integration** — data presets don't connect to Figma's native variable system

### Accessibility
- **Minimal ARIA attributes** — screen readers poorly supported
- **No focus management** in modals — Tab key doesn't cycle within modal
- **Color contrast** not verified for all themes
- **Keyboard shortcuts** absent for common actions (generate, apply, cancel)

### Code & Documentation
- **Some large files** — `types.ts` (~1500 loc), `i18n.ts` (~2000 loc) could benefit from splitting
- **Sparse JSDoc** — complex functions lack parameter/return documentation
- **No architectural docs** — new contributors need to read all source to understand the system
- **Some hardcoded strings** — technical error messages not fully localized

---

## Growth Opportunities

### High Priority (next releases)

1. **Vision AI Integration**
   - Send screenshots of selected frames to multimodal models (GPT-4V, Gemini, Claude Vision)
   - Use case: "Generate button text that fits this card layout" — AI sees the design context
   - Implementation: `figma.createImage()` → base64 → provider's vision endpoint
   - Requires adding `supportsVision` flag to `BaseProvider` and image input UI

2. **Streaming Token Display**
   - Show response character-by-character as it arrives from API
   - Dramatically improves perceived performance for long generations
   - Most providers already support streaming (SSE)
   - Implementation: chunk-based IPC messages from sandbox to UI

3. **Parallel Batch Processing**
   - Process 3-5 nodes concurrently instead of sequentially
   - Add per-node progress indicators
   - Implement cancel-safe intermediate states (save partial results)
   - Expected 3-5x speedup for mass operations

4. **Test Coverage → 60%+**
   - Priority targets: provider response parsing, settings migration, cost calculation
   - Add snapshot tests for UI panel rendering
   - CI pipeline with automated testing

5. **Prompt Variables / Templates**
   - Support `{layer_name}`, `{layer_type}`, `{parent_name}`, `{siblings}` in prompts
   - Auto-substitute from Figma context before sending to API
   - Enable reusable prompt templates for specific design patterns

### Medium Priority (growth features)

6. **A/B Copywriting Mode**
   - Generate N variants of text for a single layer
   - Display side-by-side comparison in a modal
   - One-click apply to Figma
   - Track which variants perform best (manual rating)

7. **Team Collaboration**
   - Share prompt libraries and data presets via URL/file
   - Figma Team Library integration for shared prompts
   - Version control for preset collections

8. **Usage Analytics Dashboard**
   - Track spending per provider/model/project
   - Token usage over time chart
   - Most-used prompts ranking
   - Budget alerts

9. **Advanced Rename Engine**
   - Custom JavaScript expressions for rename rules
   - AI-powered semantic naming (layer content → meaningful name)
   - Pattern learning from existing well-named layers
   - Undo support for renames

10. **Figma Variables Integration**
    - Connect data presets to Figma Variables
    - Auto-fill from variable collections
    - Sync preset changes to variables and vice versa

### Long-term Vision

11. **AI Design Critique**
    - Send full frame screenshot to vision model
    - Get UX/UI recommendations (spacing, contrast, hierarchy)
    - Suggest text improvements in context of the design

12. **Plugin Marketplace / Extensions**
    - Allow third-party prompt packs
    - Custom provider plugins
    - Community-shared rename presets

13. **Enterprise Features**
    - Team API key management (OAuth2)
    - Usage quotas and rate limiting per user
    - Audit logs for compliance
    - SSO integration

14. **Accessibility Compliance**
    - Full WCAG 2.1 AA for plugin UI
    - Screen reader optimization
    - Keyboard-only navigation
    - High contrast theme

---

## Key Files Reference

| File | Purpose | Lines |
|------|---------|-------|
| `src/shared/types.ts` | All TypeScript interfaces and default presets | ~1500 |
| `src/shared/i18n.ts` | Translation dictionary (5 languages) | ~2000 |
| `src/shared/providers.ts` | Provider/model catalog with pricing | ~500 |
| `src/shared/messages.ts` | IPC message type definitions | ~200 |
| `src/shared/settings-migration.ts` | v1→v2→v2.1 migration logic | ~300 |
| `src/sandbox/code.ts` | Main sandbox entry, command handlers | ~600 |
| `src/sandbox/api-client.ts` | LLM API interaction, provider instantiation | ~300 |
| `src/sandbox/providers/BaseProvider.ts` | Abstract provider class | ~200 |
| `src/sandbox/batch-processor.ts` | Multi-node processing | ~200 |
| `src/sandbox/rename-handler.ts` | Mass layer renaming logic | ~300 |
| `src/ui/main.ts` | UI coordinator, message routing | ~450 |
| `src/ui/index.html` | Single-page HTML (5 tabs, modals) | ~500 |
| `src/ui/panels/GeneratePanel.ts` | Text generation interface | ~400 |
| `src/ui/panels/SettingsPanel.ts` | Provider group management | ~500 |
| `src/ui/panels/DataPanel.ts` | Data substitution presets | ~400 |
| `src/ui/panels/RenamePanel.ts` | Mass layer renaming UI | ~350 |
| `src/ui/panels/HelpPanel.ts` | Help & documentation | ~450 |
| `src/ui/panels/PromptsPanel.ts` | Saved prompts library modal | ~400 |

## Design Patterns in Use

| Pattern | Where | Purpose |
|---------|-------|---------|
| Strategy | `BaseProvider` + 9 providers | Polymorphic LLM API handling |
| Factory | `ProviderFactory.createProvider()` | Dynamic provider instantiation |
| Observer | Message event listeners (IPC) | Async sandbox ↔ UI communication |
| Singleton | `StorageManager`, `i18n`, `ApiClient` | Shared state management |
| Builder | Provider config merging | Complex settings composition |
| Adapter | Proxy URL handling | CORS bypass for browser-based API calls |

## Infrastructure

```
Figma Plugin (null origin)
    │
    │ POST /api/{provider}/...
    ▼
Proxy Server (proxy.uixray.tech, Yandex Cloud VM)
    │
    ├─ Direct → Yandex, Groq, Mistral, Cohere, Claude
    │
    └─ Via Cloudflare Worker → Gemini (regional bypass)
        │
        ▼
    ai-api-proxy.uixray.workers.dev
        │
        ▼
    generativelanguage.googleapis.com
```
