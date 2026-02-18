# UText - AI Text Generator for Figma

> AI-powered text generation, mass layer renaming, and design automation with 30+ LLM models.

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Figma Plugin](https://img.shields.io/badge/Figma-Plugin-black?logo=figma)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?logo=typescript)
![Version](https://img.shields.io/badge/Version-2.1.0-green)

## Features

- **30+ AI Models** - OpenAI, Claude, Gemini, Mistral, Groq, Cohere, Yandex Cloud, LM Studio, or any OpenAI-compatible API
- **Generate & Apply** - Select text layers, write a prompt, and AI fills them in with generated content
- **Mass Layer Renaming** - Rename hundreds of layers using style presets (BEM, camelCase, snake_case, kebab-case) or AI
- **Prompt Library** - Save, organize, and reuse your prompts with categories and tags
- **Data Presets** - Built-in templates for Users, Products, Places, Colors with quick-apply from the right-click menu
- **5 Languages** - English, Russian, Japanese, Chinese, French
- **Dark/Light/Auto Theme** - Follows your Figma preferences
- **Export/Import** - Backup and share your entire plugin configuration

## Installation

### From Figma Community
1. Open Figma
2. Go to **Plugins** > **Browse plugins in Community**
3. Search for **UText**
4. Click **Install**

### For Development
```bash
git clone https://github.com/uixray/figma-llm-plugin.git
cd figma-llm-plugin
npm install
npm run build
```

Then in Figma:
1. Go to **Plugins** > **Development** > **Import plugin from manifest...**
2. Select the `manifest.json` file from the cloned directory

## Quick Start

### 1. Set Up a Provider

Open the plugin and go to the **Settings** tab:

1. Click **+ Add Group**
2. Choose a provider (e.g., OpenAI, Groq, LM Studio)
3. Enter your API key (not needed for LM Studio)
4. Select which models to enable
5. Click **Save**

### 2. Generate Text

Go to the **Generate** tab:

1. Select one or more text layers in Figma
2. Choose a model from the dropdown
3. Write a prompt (e.g., "Generate a product description for a premium headphone")
4. Click **Generate & Apply**
5. The AI response is automatically applied to the selected text layers

### 3. Use Data Presets

Go to the **Data** tab:

1. Select a frame containing text layers named `name`, `email`, `phone`, etc.
2. Choose a preset (User, Product, Place, Other, or a color)
3. Click **Apply Preset**
4. Text layers get filled with matching mock data

You can also apply presets directly from **Plugins > UText > Built-in Presets** in the right-click menu.

### 4. Rename Layers

Go to the **Rename** tab:

**Style Mode:**
1. Select frames/groups in Figma
2. Choose a naming preset (BEM, camelCase, snake_case, kebab-case)
3. Click **Preview Changes** to review
4. Click **Apply**

**AI Mode:**
1. Select frames/groups in Figma
2. Choose an AI provider from the dropdown
3. Write a prompt (e.g., "Use semantic names based on content, follow BEM convention")
4. Click **AI Preview** to see suggestions
5. Click **Apply**

### 5. Prompt Library

Go to the **Prompts** tab:

- Browse and use saved prompts
- Create new prompts with categories and tags
- Edit or delete existing prompts

## Supported Providers

| Provider | Models | API Key | Notes |
|----------|--------|---------|-------|
| **OpenAI** | GPT-4o, GPT-4 Turbo, GPT-4o Mini, O1 | Required | Via proxy or direct |
| **Claude (Anthropic)** | Claude 3.5 Sonnet/Haiku, Claude 3 Opus | Required | Via proxy or direct |
| **Google Gemini** | Gemini 2.5 Flash, 1.5 Pro/Flash | Required | Via proxy or direct |
| **Mistral** | Large, Small, Nemo, Pixtral, Codestral | Required | Via proxy or direct |
| **Groq** | Llama 3.3/3.1/3, Mixtral, Gemma 2 | Required | Via proxy or direct |
| **Cohere** | Command R+, Command R | Required | Via proxy or direct |
| **Yandex Cloud** | YandexGPT Pro/Lite + 6 more | Required | Needs Folder ID |
| **LM Studio** | Any local model | Not needed | Requires local server URL |
| **Custom ("Other")** | Any model | Depends | Any OpenAI-compatible API |

## LM Studio Setup

LM Studio lets you run AI models locally on your machine:

1. Download and install [LM Studio](https://lmstudio.ai)
2. Load a model and start the local server
3. In UText Settings, create a new LM Studio group
4. Enter your server URL (default: `http://127.0.0.1:1234`)
5. Save and select the model in the Generate tab

**Note for development mode:** The plugin allows any URL in dev mode. For published plugins, only `localhost` and `127.0.0.1` on port 1234 are allowed. If you need a different IP/port, use a proxy or run the plugin in development mode.

## Proxy Configuration

By default, API requests go through the built-in proxy at `proxy.uixray.tech` to handle CORS restrictions.

In **Settings > General > Proxy Server** you can:
- **Default proxy** - Uses `proxy.uixray.tech` (recommended)
- **Custom proxy** - Use your own proxy URL
- **Direct connection** - No proxy, connect directly to APIs (may have CORS issues in some cases)

## Project Structure

```
src/
  sandbox/           # Figma sandbox (runs in plugin backend)
    providers/       # AI provider implementations (OpenAI, Claude, Gemini, etc.)
    api-client.ts    # Central API routing
    code.ts          # Main sandbox entry point
    rename-handler.ts
    storage-manager.ts
  shared/            # Shared code (UI + Sandbox)
    types.ts         # TypeScript interfaces
    providers.ts     # Provider configurations (30+ models)
    i18n.ts          # Translations (5 languages)
    provider-converter.ts
    provider-groups-utils.ts
  ui/                # UI layer (runs in iframe)
    panels/          # Modular UI panels
      GeneratePanel.ts
      DataPanel.ts
      PromptsPanel.ts
      RenamePanel.ts
      SettingsPanel.ts
      HelpPanel.ts
    main.ts          # UI entry point
    index.html
    styles.css
    styles-groups.css
    theme.css
```

## Development

```bash
# Install dependencies
npm install

# Build (one-time)
npm run build

# Watch mode (auto-rebuild on changes)
npm run dev

# Run tests
npm test
```

After building, reload the plugin in Figma to see your changes.

## License

[MIT](LICENSE)

## Links

- [GitHub Repository](https://github.com/uixray/figma-llm-plugin)
- [Changelog](CHANGELOG.md)
- [Report an Issue](https://github.com/uixray/figma-llm-plugin/issues)
