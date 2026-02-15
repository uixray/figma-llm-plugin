# Changelog

All notable changes to UText (Figma LLM Plugin) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-02-15

### 🚀 Major Release - V2.0 Architecture

This is a complete rewrite of the plugin with a new provider system, modular UI, and massive feature expansion.

### Added

#### Provider System (V2.1)
- **30+ AI Providers** with full API integration:
  - **Yandex Cloud** (8 models): YandexGPT Pro/Lite, GPT-4o-mini, Claude 3.5 Haiku/Sonnet, Llama 3.1, Mistral Nemo/Large
  - **OpenAI** (5 models): GPT-4o, GPT-4 Turbo, GPT-4o Mini, O1-preview, O1-mini
  - **Claude (Anthropic)** (4 models): Claude 3.5 Sonnet/Haiku, Claude 3 Opus/Sonnet
  - **Google Gemini** (3 models): Gemini 2.5 Flash, 1.5 Pro/Flash
  - **Mistral** (5 models): Large, Small, Nemo, Pixtral, Codestral
  - **Groq** (5 models): Llama 3.3, 3.1, 3, Mixtral, Gemma 2
  - **Cohere** (2 models): Command R+, Command R
  - **LM Studio** (local inference)
- **Provider Groups**: Share one API key across multiple models
- **Proxy Support**: Built-in CORS proxy for cloud providers
- **Model Metadata**: Pricing, context limits, streaming support for each model
- **Strategy Pattern**: Extensible provider architecture (BaseProvider + 8 implementations)

#### Mass Layer Renaming
- **BEM Convention**: Block__Element--Modifier
- **camelCase**: firstSecondThird
- **snake_case**: first_second_third
- **kebab-case**: first-second-third
- **Batch Processing**: Rename hundreds of layers at once with progress tracking
- **Real-time Preview**: See changes before applying

#### Saved Prompts Library
- **Categories**: User, Product, Place, Colors, Custom
- **Tags System**: Filter and organize prompts
- **Built-in Presets**: 8 ready-to-use prompts (User, Product, Place, Other, Red, Blue, Green, Yellow)
- **Quick Apply**: Right-click menu for fast prompt application
- **Import/Export**: Share prompt libraries

#### Batch Processing
- **Progress Tracking**: Real-time status updates with percentage
- **Error Recovery**: Continue processing on failures
- **Cancellation**: Stop batch operations mid-process
- **Statistics**: Success/failure counts, duration

#### UI & UX
- **Modular Architecture**: 5 specialized panels (Generate, Data, Prompts, Rename, Settings)
- **Theme System**: Light/Dark/Auto modes with system preference detection
- **i18n Support**: 5 languages (English, Russian, Japanese, Chinese, French)
- **Group Editor Modal**: Full-featured dialog for creating/editing provider groups
- **Tabs**: Settings organized into Groups/Legacy/General sections
- **Export/Import Settings**: Backup and restore entire plugin configuration
- **Responsive Design**: Optimized for different Figma panel sizes

#### Technical Improvements
- **TypeScript Strict Mode**: 100% type safety
- **Settings Migration**: Automatic V1→V2→V2.1 migration with backwards compatibility
- **ClientStorage**: Persistent settings synced across devices
- **Error Handling**: Detailed error messages with provider-specific guidance
- **Validation**: Comprehensive input validation for all forms
- **Bundle Optimization**: CSS inlining, code splitting (ui.js 281KB, code.js 152KB)

### Changed

#### Architecture
- **BREAKING**: Complete rewrite from monolithic to modular architecture
- **BREAKING**: Settings format changed (automatic migration included)
- **Provider Abstraction**: Unified interface for all LLM providers
- **Message-based Communication**: Type-safe UI ↔ Sandbox messaging
- **Storage Manager**: Centralized settings management with migration support

#### UI Refactor
- Reduced main.ts from 1358 lines → 220 lines (84% reduction)
- Extracted 5 specialized panels from monolithic UI
- Improved accessibility with ARIA labels and keyboard navigation
- Enhanced visual feedback with loading states and progress indicators

### Removed

- **BREAKING**: Old provider configuration format (V1.x)
- Hardcoded provider list (now dynamic from `PROVIDER_CONFIGS`)
- Inline CSS (moved to separate files for better organization)

### Fixed

- CORS errors with cloud providers (proxy routing)
- Event listener duplication in modals (clone-and-replace pattern)
- Theme persistence across sessions
- API key visibility toggle state
- Model selection validation

### Security

- API keys stored securely in Figma's clientStorage
- Password input masking for sensitive fields
- Validation of all user inputs
- Safe JSON parsing with error handling

## [1.0.0] - 2024-XX-XX

### Initial MVP Release

- Basic text generation with LM Studio, Yandex Cloud, OpenAI-compatible APIs
- Simple UI with Generate/Settings tabs
- Token counting and cost estimation
- System prompts and temperature control
- Retry logic with exponential backoff
- Local settings storage

---

## Migration Guide: V1.x → V2.0

### Automatic Migration

Settings are migrated automatically when you upgrade to V2.0:

1. **Provider Configs**: V1 configs moved to `legacyProviders` array
2. **UI Settings**: Preserved (showTokenCount, showCostEstimate)
3. **Version Field**: Added `version: 2` to settings

### Manual Steps

After upgrading:

1. **Review Legacy Providers**: Settings → Legacy tab
2. **Create Provider Groups**: Settings → Groups tab → "+ Add Group"
3. **Configure New Providers**: Select from 30+ available models
4. **Export Settings**: Settings → General → "📥 Export Settings" (backup)

### Breaking Changes

**Settings Structure**:
```typescript
// V1.x (deprecated)
{
  providers: {
    lmstudio: { enabled: true, baseUrl: '...', model: '...' },
    yandex: { enabled: true, folderId: '...', apiKey: '...' },
    openai: { enabled: true, baseUrl: '...', apiKey: '...' }
  }
}

// V2.0 (new)
{
  version: 2,
  providerGroups: [
    {
      id: 'uuid',
      name: 'My OpenAI Group',
      baseProviderId: 'openai-gpt4o',
      userConfig: { apiKey: '...', customUrl: '...' },
      models: [{ id: 'openai-gpt4o', enabled: true }]
    }
  ],
  legacyProviders: { /* V1 configs preserved */ }
}
```

**API Changes**:
- `generateText()` now accepts `providerGroupId` instead of provider type
- Settings messages use new `ProviderGroup` interface
- Model selection moved from Settings to Generate panel

### Rollback

To rollback to V1.x:

1. Export settings before upgrading (if not done)
2. Reinstall V1.x plugin
3. Settings will be empty (V1 doesn't understand V2 format)
4. Manually reconfigure providers using V1.x UI

**Note**: V2.0 preserves V1 settings in `legacyProviders`, but V1.x cannot read V2 format.

---

## Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/figma-llm-plugin/issues)
- **Documentation**: See README.md
- **Community**: Figma Community page (coming soon)

---

[2.0.0]: https://github.com/yourusername/figma-llm-plugin/releases/tag/v2.0.0
[1.0.0]: https://github.com/yourusername/figma-llm-plugin/releases/tag/v1.0.0
