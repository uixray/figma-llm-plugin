# API Proxy Architecture

**Дата**: 2026-02-16 22:30
**Версия**: 2.0.0

---

## 🔒 Ограничения Figma CSP (Content Security Policy)

Figma плагины работают с ограничениями CSP, которые блокируют прямые запросы к большинству внешних API.

### Разрешённые домены (manifest.json)

```json
{
  "networkAccess": {
    "allowedDomains": [
      "https://proxy.uixray.tech",
      "https://api.openai.com",
      "https://*.openai.azure.com"
    ],
    "devAllowedDomains": [
      "http://localhost:1234"
    ]
  }
}
```

### Что это значит:

✅ **Разрешены прямые запросы**:
- OpenAI API (`api.openai.com`)
- Azure OpenAI (`*.openai.azure.com`)
- LM Studio (`localhost:1234`)
- Ваш proxy (`proxy.uixray.tech`)

❌ **Блокируются прямые запросы**:
- Anthropic Claude (`api.anthropic.com`)
- Google Gemini (`generativelanguage.googleapis.com`)
- Groq (`api.groq.com`)
- Mistral AI (`api.mistral.ai`)
- Cohere (`api.cohere.ai`)

---

## 🌐 Архитектура API URLs

### OpenAI (прямое подключение)

```typescript
{
  id: 'openai-gpt4o',
  name: 'GPT-4o',
  provider: 'openai',
  model: 'gpt-4o',
  apiUrl: 'https://api.openai.com/v1',
}
```

**Финальный URL**: `https://api.openai.com/v1/chat/completions`
- OpenAIProvider добавляет `/chat/completions` к базовому URL
- Работает БЕЗ proxy

### Claude, Gemini, Groq, Mistral, Cohere (через proxy)

```typescript
{
  id: 'claude-35-sonnet',
  name: 'Claude Sonnet 4.5',
  provider: 'claude',
  model: 'claude-sonnet-4-5-20250929',
  apiUrl: 'https://proxy.uixray.tech/api/claude',
}
```

**Финальный URL**: `https://proxy.uixray.tech/api/claude/messages`
- ClaudeProvider добавляет `/messages` к базовому URL
- **ТРЕБУЕТ proxy** из-за CSP ограничений Figma

### Yandex Cloud (через proxy)

```typescript
{
  id: 'yandex-gpt5-lite',
  name: 'YandexGPT 5 Lite',
  provider: 'yandex',
  model: 'yandexgpt-lite/latest',
  apiUrl: 'https://proxy.uixray.tech/api/yandex',
}
```

**Финальный URL**: `https://proxy.uixray.tech/api/yandex/...`
- YandexProvider использует специальный формат с modelUri
- **ТРЕБУЕТ proxy**

### LM Studio (локальный сервер)

```typescript
{
  id: 'lmstudio',
  name: 'LM Studio',
  provider: 'lmstudio',
  model: 'local',
  apiUrl: '{{baseUrl}}/v1',
}
```

**Финальный URL**: `http://localhost:1234/v1/chat/completions`
- Пользователь указывает customUrl при настройке
- Работает БЕЗ proxy (localhost разрешён в devAllowedDomains)

---

## 🔧 Как работает ваш Proxy

### Задача proxy:

1. **Обход CSP ограничений** - Figma разрешает только домены из allowedDomains
2. **Унификация API** - Преобразует запросы в формат целевого API
3. **Безопасность** - Скрывает прямые запросы к провайдерам

### Пример flow для Claude:

```
Figma Plugin
  ↓ POST https://proxy.uixray.tech/api/claude/messages
  ↓ Headers: Authorization: Bearer sk-ant-...
  ↓
Ваш Proxy (proxy.uixray.tech)
  ↓ POST https://api.anthropic.com/v1/messages
  ↓ Headers: x-api-key: sk-ant-...
  ↓ Headers: anthropic-version: 2023-06-01
  ↓
Anthropic API
  ← Response
  ←
Ваш Proxy
  ← Response (в формате OpenAI для унификации)
  ←
Figma Plugin
```

---

## 📋 Итоговая конфигурация

| Провайдер | Базовый URL | Требует Proxy | Примечание |
|-----------|-------------|---------------|------------|
| **OpenAI** | `api.openai.com/v1` | ❌ Нет | Прямое подключение |
| **Claude** | `proxy.uixray.tech/api/claude` | ✅ Да | CSP блокирует |
| **Gemini** | `proxy.uixray.tech/api/gemini` | ✅ Да | CSP блокирует |
| **Groq** | `proxy.uixray.tech/api/groq` | ✅ Да | CSP блокирует |
| **Mistral** | `proxy.uixray.tech/api/mistral` | ✅ Да | CSP блокирует |
| **Cohere** | `proxy.uixray.tech/api/cohere` | ✅ Да | CSP блокирует |
| **Yandex** | `proxy.uixray.tech/api/yandex` | ✅ Да | CSP блокирует |
| **LM Studio** | `localhost:1234/v1` | ❌ Нет | Локальный сервер |

---

## 🚀 Рекомендации для улучшения proxy

### 1. Добавить поддержку большего количества провайдеров

Можно добавить в manifest.json:
```json
"allowedDomains": [
  "https://proxy.uixray.tech",
  "https://api.openai.com",
  "https://*.openai.azure.com",
  "https://api.anthropic.com",      // ← Claude
  "https://generativelanguage.googleapis.com", // ← Gemini
  "https://api.groq.com",           // ← Groq
  "https://api.mistral.ai",         // ← Mistral
  "https://api.cohere.ai"           // ← Cohere
]
```

**Но**: Figma может ограничить количество разрешённых доменов или отклонить плагин при публикации.

### 2. Унифицировать формат ответов

Ваш proxy может преобразовывать все ответы в единый формат OpenAI:

```typescript
// Единый формат для всех провайдеров
{
  "choices": [{
    "message": {
      "content": "..."
    }
  }],
  "usage": {
    "prompt_tokens": 100,
    "completion_tokens": 200
  }
}
```

Это упростит код плагина - не нужны отдельные провайдеры для каждого API.

### 3. Добавить retry логику на стороне proxy

Proxy может автоматически повторять запросы при временных ошибках (503, timeout).

### 4. Логирование и мониторинг

- Логировать все запросы для отладки
- Мониторить rate limits провайдеров
- Alerting при проблемах с конкретным провайдером

---

## ⚠️ Важно для пользователей

### Если proxy не работает:

1. **OpenAI** - можно использовать напрямую (работает без proxy)
2. **LM Studio** - можно использовать локально (работает без proxy)
3. **Все остальные** - НЕ будут работать без рабочего proxy

### Альтернатива proxy:

Если у пользователя нет доступа к `proxy.uixray.tech`, он может:
1. Развернуть свой proxy server
2. Указать customUrl при создании провайдера
3. Добавить свой домен в manifest.json (для personal fork)

---

**Создано**: 2026-02-16 22:30
**Автор**: Claude Sonnet 4.5
