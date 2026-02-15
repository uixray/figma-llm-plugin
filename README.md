# UText - AI-Powered Text Generation for Figma

> **Version 2.0** - The ultimate Figma plugin for AI text generation, layer renaming, and design automation with 30+ LLM providers.

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Figma Plugin](https://img.shields.io/badge/Figma-Plugin-black?logo=figma)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?logo=typescript)

## ✨ Features

### 🤖 30+ AI Providers
- **Yandex Cloud** (8 models): YandexGPT Pro/Lite, GPT-4o-mini, Claude 3.5, Llama 3.1, Mistral Nemo/Large
- **OpenAI** (5 models): GPT-4o, GPT-4 Turbo, O1-preview, O1-mini, GPT-4o Mini
- **Claude by Anthropic** (4 models): Claude 3.5 Sonnet/Haiku, Claude 3 Opus/Sonnet
- **Google Gemini** (3 models): Gemini 2.5 Flash, 1.5 Pro/Flash
- **Mistral** (5 models): Large, Small, Nemo, Pixtral, Codestral
- **Groq** (5 models): Llama 3.3, 3.1, 3, Mixtral, Gemma 2
- **Cohere** (2 models): Command R+, Command R
- **LM Studio** (local inference): Run models locally on your machine

### 🎯 Core Capabilities

#### Text Generation
- **Smart Prompts**: Built-in presets for users, products, places, colors
- **System Prompts**: Guide AI behavior with custom instructions
- **Temperature Control**: Fine-tune creativity (0.0 - 2.0)
- **Token Limits**: Set max output length
- **Streaming Output**: Real-time text generation
- **Cost Estimation**: Track API usage costs

#### Mass Layer Renaming
- **BEM Convention**: `Block__Element--Modifier`
- **camelCase**: `firstSecondThird`
- **snake_case**: `first_second_third`
- **kebab-case**: `first-second-third`
- **Batch Processing**: Rename hundreds of layers instantly
- **Preview Mode**: See changes before applying

#### Saved Prompts Library
- **Categories**: User, Product, Place, Colors, Custom
- **Tags**: Organize and filter prompts
- **Quick Apply**: Right-click menu integration
- **Import/Export**: Share prompt libraries with teams

#### Provider Groups (V2.1)
- **One API Key, Multiple Models**: Share credentials across models
- **Custom Configuration**: Model-specific settings
- **Enable/Disable**: Toggle models without deleting configurations
- **Group Management**: Create, edit, delete groups via modal UI

### 🎨 UI & UX

- **Theme System**: Light/Dark/Auto modes (follows system preferences)
- **i18n**: 5 languages (English, Russian, Japanese, Chinese, French)
- **Modular Panels**: Generate, Data, Prompts, Rename, Settings
- **Export/Import**: Backup and restore entire configuration
- **Responsive Design**: Adapts to Figma panel sizes

---

## 📦 Installation

### Prerequisites
- **Figma Desktop** (plugin requires desktop app for full functionality)
- **Bun** (recommended) or **Node.js** 18+

### Build from Source

```bash
# Clone repository
git clone https://github.com/yourusername/figma-llm-plugin.git
cd figma-llm-plugin

# Install dependencies
bun install
# or: npm install

# Build plugin
bun run build
# or: npm run build
```

After building, files will be in `dist/`:
- `dist/code.js` - Sandbox code
- `dist/ui.html` - UI bundle

### Import to Figma

1. Open **Figma Desktop**
2. Go to **Plugins → Development → Import plugin from manifest...**
3. Select `manifest.json` from project root
4. Plugin appears in **Plugins → Development → LLM Text Generator**

---

## 🚀 Quick Start

### 1. Configure Provider Group

1. **Open Plugin**: Plugins → Development → LLM Text Generator
2. **Go to Settings**: Click "Settings" tab
3. **Add Provider Group**:
   - Click **"+ Add Group"**
   - **Name**: "My OpenAI Models"
   - **Provider**: OpenAI
   - **API Key**: `sk-proj-...` (your API key)
   - **Select Models**: Check GPT-4o, GPT-4 Turbo
   - Click **"Save Group"**

4. **Test Connection** (optional):
   - Generate panel → Select model → Enter test prompt → Generate

### 2. Generate Text

1. **Select Model**: Choose from dropdown (e.g., "GPT-4o")
2. **Enter Prompt**: "Generate a product description for a coffee maker"
3. **Advanced Settings** (optional):
   - System Prompt: "You are a marketing expert"
   - Temperature: 0.7
   - Max Tokens: 150
4. **Generate**: Click "Generate" button
5. **Apply to Layers**:
   - Select text layers in Figma
   - Click **"Apply to Selection"**

### 3. Use Saved Prompts

**Quick Apply**:
- Right-click in Figma → UText → Built-in Presets → "User"
- Generates random user name and applies to selected layers

**Create Custom Prompt**:
1. Prompts panel → "+ Add Prompt"
2. Name: "Email Address"
3. Category: User
4. Prompt: "Generate a realistic email address"
5. Save → Use from dropdown

### 4. Mass Rename Layers

1. **Select Layers**: 10+ text layers with content
2. **Rename Panel**: Click "Rename" tab
3. **Choose Convention**: BEM / camelCase / snake_case / kebab-case
4. **Rename**: Click "Rename by Content"
5. **Result**: Layers renamed based on their text content

---

## 🔧 Configuration Guide

### Provider-Specific Setup

#### OpenAI
```
API Key: sk-proj-... (from platform.openai.com)
Models: GPT-4o, GPT-4 Turbo, O1-preview, O1-mini, GPT-4o Mini
Custom URL: (leave empty for default)
```

#### Claude (Anthropic)
```
API Key: sk-ant-... (from console.anthropic.com)
Models: Claude 3.5 Sonnet/Haiku, Claude 3 Opus/Sonnet
Proxy: Uses proxy.uixray.tech (built-in)
```

#### Google Gemini
```
API Key: AIzaSy... (from aistudio.google.com)
Models: Gemini 2.5 Flash, 1.5 Pro/Flash
Proxy: Uses proxy.uixray.tech (built-in)
```

#### Yandex Cloud
```
Folder ID: b1g... (from Yandex Cloud Console)
API Key: AQVN... (IAM token)
Models: YandexGPT Pro/Lite, GPT-4o-mini, Claude 3.5 Haiku/Sonnet, Llama 3.1, Mistral Nemo/Large
Proxy: Uses proxy.uixray.tech (built-in)
```

#### Mistral
```
API Key: ... (from console.mistral.ai)
Models: Large, Small, Nemo, Pixtral, Codestral
Custom URL: (leave empty for default)
```

#### Groq
```
API Key: gsk_... (from console.groq.com)
Models: Llama 3.3, 3.1, 3, Mixtral, Gemma 2
Custom URL: (leave empty for default)
```

#### Cohere
```
API Key: ... (from dashboard.cohere.com)
Models: Command R+, Command R
Custom URL: (leave empty for default)
```

#### LM Studio (Local)
```
Local Server URL: http://127.0.0.1:1234
Model Name: llama-3.2-3b-instruct (loaded model name)
API Key: (not required)
```

**LM Studio Setup**:
1. Download [LM Studio](https://lmstudio.ai/)
2. Load a model (Llama, Mistral, etc.)
3. Start local server (default port 1234)
4. Configure plugin with server URL and model name

### Advanced Settings

#### Temperature
- **0.0-0.3**: Focused, deterministic (facts, data)
- **0.4-0.7**: Balanced (default, good for most tasks)
- **0.8-1.2**: Creative (marketing, storytelling)
- **1.3-2.0**: Very creative (experimental)

#### Max Tokens
- **50-150**: Short text (names, titles)
- **150-500**: Medium text (descriptions, paragraphs)
- **500-2000**: Long text (articles, detailed content)
- **Model-specific limits** shown in UI

#### System Prompts
```
Marketing Expert: "You are a professional marketing copywriter specializing in product descriptions."
Technical Writer: "You are a technical documentation specialist. Write clear, concise, accurate content."
Creative Writer: "You are a creative storyteller with a vivid imagination."
```

---

## 📁 Project Structure

```
figma-llm-plugin/
├── src/
│   ├── ui/                          # UI Layer (iframe)
│   │   ├── panels/                  # Modular UI Panels
│   │   │   ├── GeneratePanel.ts    # Text generation UI
│   │   │   ├── DataPanel.ts        # Data management UI
│   │   │   ├── PromptsPanel.ts     # Saved prompts UI
│   │   │   ├── RenamePanel.ts      # Layer renaming UI
│   │   │   ├── SettingsPanel.ts    # Settings & provider groups
│   │   │   └── index.ts            # Panel exports
│   │   ├── main.ts                  # UI coordinator (220 lines)
│   │   ├── i18n-ui.ts               # UI translation system
│   │   ├── index.html               # HTML template
│   │   ├── styles.css               # Main styles
│   │   ├── styles-groups.css        # Provider groups styles
│   │   └── theme.css                # Theme system styles
│   │
│   ├── sandbox/                     # Sandbox Layer (code.ts)
│   │   ├── providers/               # Provider Implementations
│   │   │   ├── BaseProvider.ts     # Abstract base class
│   │   │   ├── YandexProvider.ts   # Yandex Cloud
│   │   │   ├── OpenAIProvider.ts   # OpenAI
│   │   │   ├── ClaudeProvider.ts   # Anthropic Claude
│   │   │   ├── GeminiProvider.ts   # Google Gemini
│   │   │   ├── MistralProvider.ts  # Mistral AI
│   │   │   ├── GroqProvider.ts     # Groq
│   │   │   ├── CohereProvider.ts   # Cohere
│   │   │   ├── LMStudioProvider.ts # LM Studio
│   │   │   ├── ProviderFactory.ts  # Provider instantiation
│   │   │   └── index.ts            # Provider exports
│   │   ├── rename-strategy.ts       # Renaming strategies
│   │   ├── rename-handler.ts        # Rename coordination
│   │   ├── batch-processor.ts       # Batch operations
│   │   ├── prompts-handler.ts       # Saved prompts logic
│   │   ├── storage-manager.ts       # Settings persistence
│   │   ├── figma-helpers.ts         # Figma API utilities
│   │   └── code.ts                  # Main sandbox entry
│   │
│   └── shared/                      # Shared Code
│       ├── types.ts                 # TypeScript interfaces
│       ├── messages.ts              # UI ↔ Sandbox messages
│       ├── constants.ts             # Plugin constants
│       ├── providers.ts             # Provider configurations
│       ├── i18n.ts                  # Translation keys
│       ├── theme.ts                 # Theme management
│       ├── error-handler.ts         # Error handling
│       └── utils.ts                 # Utilities
│
├── dist/                            # Build output
│   ├── code.js                      # Sandbox bundle (152 KB)
│   └── ui.html                      # UI bundle (281 KB CSS+JS)
│
├── manifest.json                    # Figma plugin manifest
├── tsconfig.json                    # TypeScript config
├── tsup.config.ts                   # Build configuration
├── package.json                     # Dependencies
├── CHANGELOG.md                     # Version history
└── README.md                        # This file
```

---

## 🏗️ Architecture

### V2.0 Modular Architecture

#### UI Layer (iframe)
```
main.ts (220 lines)
  └─ PanelCoordinator
       ├─ GeneratePanel
       ├─ DataPanel
       ├─ PromptsPanel
       ├─ RenamePanel
       └─ SettingsPanel (Group Editor Modal)
```

#### Sandbox Layer (code.ts)
```
code.ts
  ├─ ProviderFactory
  │    └─ BaseProvider (Strategy Pattern)
  │         ├─ YandexProvider
  │         ├─ OpenAIProvider
  │         ├─ ClaudeProvider
  │         ├─ GeminiProvider
  │         ├─ MistralProvider
  │         ├─ GroqProvider
  │         ├─ CohereProvider
  │         └─ LMStudioProvider
  │
  ├─ RenameHandler
  │    └─ RenameStrategy (BEM, camelCase, snake_case, kebab-case)
  │
  ├─ BatchProcessor
  ├─ PromptsHandler
  └─ StorageManager (Settings Migration V1→V2→V2.1)
```

#### Provider Strategy Pattern
```typescript
abstract class BaseProvider {
  async generateText(prompt, settings): Promise<string>
  protected abstract buildRequestBody(prompt, settings): any
  protected abstract parseResponse(data): string
}

// Example: OpenAI implementation
class OpenAIProvider extends BaseProvider {
  protected buildRequestBody(prompt, settings) {
    return {
      model: this.baseConfig.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: settings.temperature,
      max_tokens: settings.maxTokens
    };
  }

  protected parseResponse(data) {
    return data.choices[0].message.content;
  }
}
```

### Settings Migration System
```typescript
// V1.x → V2.0 → V2.1 automatic migration
function migrateSettings(old: any): PluginSettings {
  if (!old.version) {
    // Migrate V1 → V2
    return {
      version: 2,
      providerGroups: [],
      legacyProviders: old.providers,
      ui: old.ui || {}
    };
  }
  return old; // Already V2+
}
```

---

## 🛠️ Development

### Scripts

```bash
# Development mode (auto-rebuild on changes)
bun run dev

# Production build
bun run build

# Run tests
bun run test
```

### Tech Stack

- **TypeScript 5.3** - Strict type safety
- **Figma Plugin API** - Document manipulation
- **tsup** - Fast bundler
- **Bun** - JavaScript runtime (dev)
- **CSS Custom Properties** - Theme system

### Adding a New Provider

1. Create provider class in `src/sandbox/providers/`:
```typescript
// NewProvider.ts
import { BaseProvider } from './BaseProvider';

export class NewProvider extends BaseProvider {
  protected buildRequestBody(prompt: string, settings: GenerationSettings) {
    return {
      model: this.baseConfig.model,
      messages: [{ role: 'user', content: prompt }],
      // Provider-specific fields
    };
  }

  protected parseResponse(data: any): string {
    return data.output.text; // Provider-specific path
  }
}
```

2. Add configuration to `src/shared/providers.ts`:
```typescript
{
  id: 'new-provider-model',
  name: 'New Provider',
  provider: 'new-provider',
  description: 'Provider description',
  model: 'model-name',
  apiUrl: 'https://api.provider.com/v1/chat',
  requiresProxy: true,
  pricing: { input: 0.001, output: 0.002 },
  contextLimit: 8000,
  streaming: true
}
```

3. Register in `src/sandbox/providers/ProviderFactory.ts`:
```typescript
import { NewProvider } from './NewProvider';

case 'new-provider':
  return new NewProvider(config, userConfig);
```

---

## 🐛 Troubleshooting

### CORS Errors (Cloud Providers)

**Symptom**: "Network error" or "Failed to fetch"

**Solution**:
- Plugin uses built-in proxy (`proxy.uixray.tech`)
- Ensure internet connection is active
- Check provider API status page

### LM Studio Connection Failed

**Symptom**: "Cannot connect to local server"

**Solutions**:
1. Verify LM Studio is running
2. Check server URL: `http://127.0.0.1:1234`
3. Ensure model is loaded in LM Studio
4. Check firewall settings (allow port 1234)

### API Key Invalid

**Symptom**: "401 Unauthorized" or "Invalid API key"

**Solutions**:
1. Verify API key is correct (no extra spaces)
2. Check API key permissions (e.g., OpenAI organization)
3. Ensure account has active credits/quota
4. Try regenerating API key from provider dashboard

### Rate Limit Exceeded

**Symptom**: "429 Too Many Requests"

**Solutions**:
1. Wait before retrying (rate limits reset after time)
2. Reduce Max Tokens to lower request size
3. Upgrade API plan (if available)
4. Use different model with higher limits

### Text Not Applying to Layers

**Symptom**: "Apply to Selection" does nothing

**Solutions**:
1. Select **text layers** in Figma (not frames)
2. Ensure layers are not locked
3. Check text layer permissions
4. Try selecting fewer layers at once

### Settings Not Saving

**Symptom**: Configuration resets after closing plugin

**Solutions**:
1. Close plugin properly (don't force-quit Figma)
2. Export settings as backup (Settings → General → Export)
3. Check Figma's `clientStorage` quota (rare issue)

---

## 📊 Pricing Reference

| Provider | Model | Input ($/1M tokens) | Output ($/1M tokens) |
|----------|-------|---------------------|----------------------|
| **OpenAI** | GPT-4o | $2.50 | $10.00 |
| | GPT-4 Turbo | $10.00 | $30.00 |
| | GPT-4o Mini | $0.15 | $0.60 |
| | O1-preview | $15.00 | $60.00 |
| | O1-mini | $3.00 | $12.00 |
| **Claude** | Claude 3.5 Sonnet | $3.00 | $15.00 |
| | Claude 3.5 Haiku | $1.00 | $5.00 |
| | Claude 3 Opus | $15.00 | $75.00 |
| | Claude 3 Sonnet | $3.00 | $15.00 |
| **Gemini** | Gemini 2.5 Flash | $0.075 | $0.30 |
| | Gemini 1.5 Pro | $1.25 | $5.00 |
| | Gemini 1.5 Flash | $0.075 | $0.30 |
| **Mistral** | Large 2 | $2.00 | $6.00 |
| | Small 2 | $0.20 | $0.60 |
| | Nemo | $0.15 | $0.15 |
| | Pixtral 12B | $0.15 | $0.15 |
| | Codestral | $0.20 | $0.60 |
| **Groq** | Llama 3.3 70B | $0.59 | $0.79 |
| | Llama 3.1 70B | $0.59 | $0.79 |
| | Llama 3 70B | $0.59 | $0.79 |
| | Mixtral 8x7B | $0.24 | $0.24 |
| | Gemma 2 9B | $0.20 | $0.20 |
| **Yandex** | YandexGPT Pro | ~$0.50 | ~$1.50 |
| | YandexGPT Lite | ~$0.10 | ~$0.30 |
| **LM Studio** | All models | **FREE** | **FREE** |

*Prices as of February 2026. Check provider websites for current pricing.*

---

## 🗺️ Roadmap

### V2.1 (Current)
- ✅ Provider Groups
- ✅ Mass Layer Renaming
- ✅ Saved Prompts Library
- ✅ Batch Processing
- ✅ Theme System
- ✅ Export/Import Settings

### V2.2 (Planned)
- [ ] Data Import (CSV/Excel)
- [ ] Local Data Sets (names, addresses, products)
- [ ] Prompt Enhancement via AI
- [ ] Generation History
- [ ] Usage Statistics Dashboard
- [ ] Team Sharing (shared prompts/settings)

### V3.0 (Future)
- [ ] Image Generation (DALL-E, Midjourney)
- [ ] Vector Graphics Generation (SVG from descriptions)
- [ ] Design System Integration
- [ ] Plugin API for extensions
- [ ] Cloud Sync (cross-device settings)

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

### Development Guidelines

- **TypeScript**: Use strict mode, full type annotations
- **Code Style**: Prettier (default config)
- **Commits**: Conventional Commits format
- **Tests**: Add tests for new features (Jest)
- **Docs**: Update README/CHANGELOG for user-facing changes

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Figma** - Plugin API and design tools
- **Anthropic** - Claude AI assistance
- **Open Source Community** - Libraries and inspiration

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/figma-llm-plugin/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/figma-llm-plugin/discussions)
- **Email**: your.email@example.com

---

**Made with ❤️ using Claude Code**

**UText V2.0** - Transform your Figma workflow with AI-powered text generation.
