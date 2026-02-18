# Changelog

All notable changes to UText will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2026-02-18

### Added
- **Custom Provider ("Other")**: Connect any OpenAI-compatible API with custom base URL and model name
- **Custom Proxy URL**: Choose between default proxy, your own proxy, or direct connection
- **AI Rename Provider Selector**: Choose which AI model to use for layer renaming
- **Extended Network Access**: Direct API support for Anthropic, Google, Mistral, Groq, Cohere, Yandex

### Fixed
- **LM Studio connection**: Fixed customUrl not being passed to API client (was lost during config conversion)
- **LM Studio CSP**: Added localhost/127.0.0.1 to allowed domains, wildcard dev mode for custom IPs
- **Notification popups**: Now appear above modal windows (z-index: 9999)
- **Saved prompts modal**: Fixed clicks passing through to elements behind the modal
- **Button icon alignment**: Emoji icons now properly centered on all buttons
- **API error messages**: Improved diagnostics with provider-specific hints and fix suggestions

## [2.0.0] - 2026-02-15

### Major Release - V2.0 Architecture

Complete rewrite with new provider system, modular UI, and massive feature expansion.

### Added

#### Provider System (V2.1)
- **30+ AI Models** with full API integration:
  - **Yandex Cloud** (8 models): YandexGPT Pro/Lite, GPT-4o-mini, Claude 3.5 Haiku/Sonnet, Llama 3.1, Mistral Nemo/Large
  - **OpenAI** (5 models): GPT-4o, GPT-4 Turbo, GPT-4o Mini, O1-preview, O1-mini
  - **Claude / Anthropic** (4 models): Claude 3.5 Sonnet/Haiku, Claude 3 Opus/Sonnet
  - **Google Gemini** (3 models): Gemini 2.5 Flash, 1.5 Pro/Flash
  - **Mistral** (5 models): Large, Small, Nemo, Pixtral, Codestral
  - **Groq** (5 models): Llama 3.3, 3.1, 3, Mixtral, Gemma 2
  - **Cohere** (2 models): Command R+, Command R
  - **LM Studio** (local inference on any machine)
  - **Custom ("Other")**: Any OpenAI-compatible API
- **Provider Groups**: Share one API key across multiple models
- **Proxy Support**: Built-in CORS proxy with custom proxy option
- **Strategy Pattern**: Extensible provider architecture

#### Mass Layer Renaming
- **Style Mode**: BEM, camelCase, snake_case, kebab-case presets
- **AI Mode**: Rename layers using any AI provider with custom prompts
- **Batch Processing**: Rename hundreds of layers at once
- **Real-time Preview**: See changes before applying

#### Saved Prompts Library
- **Categories**: User, Product, Place, Colors, Custom
- **Tags System**: Filter and organize prompts
- **Built-in Presets**: 8 ready-to-use prompts
- **Quick Apply**: Right-click menu for fast prompt application

#### UI & UX
- **5 Specialized Panels**: Generate, Data, Prompts, Rename, Settings
- **Theme System**: Light/Dark/Auto modes
- **5 Languages**: English, Russian, Japanese, Chinese, French
- **Export/Import Settings**: Backup and restore configuration

## [1.0.0] - 2024-XX-XX

### Initial Release
- Basic text generation with LM Studio, Yandex Cloud, OpenAI-compatible APIs
- Simple UI with Generate/Settings tabs
- Token counting and cost estimation

---

- **Issues**: [GitHub Issues](https://github.com/uixray/figma-llm-plugin/issues)
- **Documentation**: See README.md

[2.1.0]: https://github.com/uixray/figma-llm-plugin/releases/tag/v2.1.0
[2.0.0]: https://github.com/uixray/figma-llm-plugin/releases/tag/v2.0.0
[1.0.0]: https://github.com/uixray/figma-llm-plugin/releases/tag/v1.0.0
