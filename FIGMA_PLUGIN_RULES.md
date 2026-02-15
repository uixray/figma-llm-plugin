# Figma Plugin Development Rules & Best Practices

## ⚠️ КРИТИЧЕСКИЕ ПРАВИЛА - ВСЕГДА СЛЕДОВАТЬ!

### 1. Network API - ИСПОЛЬЗУЙ ТОЛЬКО `fetch()` БЕЗ STREAMING

**НЕПРАВИЛЬНО:**
```typescript
const response = await figma.network.fetch(url, options);
```

**ПРАВИЛЬНО:**
```typescript
const response = await fetch(url, options);
```

**Причина:** В Figma Plugin API используется стандартный глобальный `fetch()` API, а не `figma.network.fetch()`. Последнего просто не существует!

**⚠️ КРИТИЧНО - НЕТ ПОДДЕРЖКИ STREAMING:**

Figma's `fetch()` **НЕ поддерживает** `response.body` (ReadableStream)!

```typescript
const response = await fetch(url, options);
console.log(response.body); // undefined в Figma!
```

**Решение:**
- Всегда используй `stream: false` в запросах к API
- Используй `response.json()` или `response.text()` для чтения ответа
- НЕ пытайся использовать `response.body.getReader()`
- **ПРИМЕНЯЕТСЯ КО ВСЕМ ПРОВАЙДЕРАМ:** LM Studio, Yandex Cloud, OpenAI Compatible

```typescript
// ✅ ПРАВИЛЬНО - LM Studio
const body = {
  model: 'ibm/granite-3.2-8b',
  messages: [...],
  stream: false  // ВСЕГДА false!
};
const response = await fetch(url, { method: 'POST', body: JSON.stringify(body) });
const data = await response.json(); // Работает

// ✅ ПРАВИЛЬНО - Yandex Cloud
const body = {
  modelUri: `gpt://${folderId}/${model}`,
  completionOptions: {
    stream: false,  // ВСЕГДА false!
    temperature: 0.7,
    maxTokens: '500'
  },
  messages: [...]
};

// ✅ ПРАВИЛЬНО - OpenAI Compatible
const body = {
  model: 'gpt-4',
  messages: [...],
  stream: false  // ВСЕГДА false!
};

// ❌ НЕПРАВИЛЬНО
const body = { stream: true, ...otherParams };
const response = await fetch(url, { method: 'POST', body: JSON.stringify(body) });
const reader = response.body.getReader(); // response.body = undefined!
```

**Проверка доступности:**
```typescript
if (typeof fetch !== 'function') {
  console.error('fetch is not available');
  return;
}
```

**Источники:**
- [Making Network Requests | Plugin API](https://www.figma.com/plugin-docs/making-network-requests/)
- [fetch | Plugin API](https://www.figma.com/plugin-docs/api/properties/global-fetch/)

---

### 2. Network Access в manifest.json

**КРИТИЧНО:** IP адреса НЕ поддерживаются в `devAllowedDomains`!

**НЕПРАВИЛЬНО:**
```json
"devAllowedDomains": [
  "http://127.0.0.1:1234",
  "http://10.8.1.17:1234",
  "http://localhost:*"
]
```

**ПРАВИЛЬНО:**
```json
"devAllowedDomains": [
  "http://localhost:1234"
]
```

**Правила:**
- ✅ Используй `localhost` с конкретным портом
- ❌ НЕ используй IP адреса (127.0.0.1, 192.168.x.x, 10.x.x.x)
- ❌ НЕ используй wildcards в портах (`localhost:*`)
- ✅ Указывай протокол (`http://` или `https://`)
- ✅ Указывай конкретный порт (`:1234`, `:3000`, и т.д.)

**Валидация URL:**
Figma строго проверяет формат URL. Ошибка `Invalid value for devAllowedDomains. 'X' must be a valid URL` означает неверный формат.

**Источники:**
- [Plugin Manifest | Developer Docs](https://developers.figma.com/docs/plugins/manifest/)
- [Making Network Requests | Developer Docs](https://developers.figma.com/docs/plugins/making-network-requests/)

---

### 3. Доступ к Network API требует UI

**ПРОБЛЕМА:** `fetch()` доступен только когда плагин имеет UI.

**РЕШЕНИЕ для команд меню без UI:**

```typescript
// Создать невидимый UI
const html = `
  <html>
    <head><style>body { margin: 0; padding: 0; }</style></head>
    <body>
      <script>
        parent.postMessage({ pluginMessage: { type: 'ui-ready' } }, '*');
      </script>
    </body>
  </html>
`;

figma.showUI(html, { visible: false, width: 1, height: 1 });

// Затем в handleUIMessage
if (message.type === 'ui-ready') {
  // Теперь можно использовать fetch()
  const response = await fetch(url, options);
}
```

**Причина:** `fetch()` доступен только в контексте с браузерными API, которые требуют UI iframe.

---

### 4. CORS Requirements

Figma плагины имеют `null` origin, поэтому могут обращаться только к API с:
```
Access-Control-Allow-Origin: *
```

**Для локальных серверов (LM Studio, etc):**
- Убедись что сервер слушает на `localhost`, не на IP адресе
- Сервер должен возвращать CORS заголовки для `*` origin

**✅ РЕШЕНИЕ - Yandex Cloud через прокси:**
Yandex Cloud API **НЕ поддерживает** CORS запросы с `null` origin (Figma плагины).
- **Решение:** Используем прокси-сервер `https://proxy.uixray.tech/api/yandex`
- Прокси имеет реальный домен и обходит CORS ограничения
- Прокси не хранит API ключи - они передаются в каждом запросе от пользователя
- **Обязательно:** используй `stream: false` в `completionOptions` (см. раздел про streaming)
- Тест подключения и генерация текста **работают** через прокси
- Исходный код прокси: https://github.com/your-username/figma-yandex-proxy

---

### 5. Manifest.json - Структура NetworkAccess

```json
{
  "networkAccess": {
    "allowedDomains": [
      "https://api.production.com",
      "https://*.cdn.com"
    ],
    "devAllowedDomains": [
      "http://localhost:3000",
      "http://localhost:1234"
    ],
    "reasoning": "Required for communication with external APIs"
  }
}
```

**Правила:**
- `allowedDomains` - для production
- `devAllowedDomains` - для development/testing
- Можно использовать wildcards в subdomains: `https://*.example.com`
- НЕ забывай добавлять `reasoning` для прохождения review

---

### 6. Типичные Ошибки и Решения

#### Ошибка: `Cannot read properties of undefined (reading 'fetch')`
**Причина:** Использовался `figma.network.fetch` вместо `fetch`
**Решение:** Заменить на `fetch()`

#### Ошибка: `Invalid value for devAllowedDomains. 'X' must be a valid URL`
**Причина:** Неверный формат URL (IP адрес, wildcard в порту)
**Решение:** Использовать `http://localhost:PORT`

#### Ошибка: `fetch is not defined`
**Причина:** Команда выполняется без UI
**Решение:** Создать невидимый UI (см. пункт 3)

#### Ошибка: `Content Security Policy directive`
**Причина:** Домен не добавлен в `allowedDomains`/`devAllowedDomains`
**Решение:** Добавить домен в manifest.json

---

### 7. Best Practices

#### Логирование для отладки
```typescript
console.log('[MODULE] Action:', action);
console.log('[MODULE] fetch available:', typeof fetch);
console.log('[MODULE] Using URL:', url);
```

#### Обработка ошибок сети
```typescript
try {
  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[ERROR] Response:', response.status, errorText);
    figma.notify(`❌ Error ${response.status}`);
    return;
  }

  const data = await response.json();
  // process data...

} catch (error) {
  console.error('[ERROR] Network request failed:', error);
  figma.notify(`❌ ${error.message}`);
}
```

#### Проверка доступности API перед использованием
```typescript
if (typeof fetch !== 'function') {
  console.error('[ERROR] fetch API not available');
  figma.notify('❌ Network API not available');
  figma.closePlugin();
  return;
}
```

---

### 8. LM Studio / Local Server Integration

**Правильная конфигурация:**

1. **В LM Studio:**
   - Bind to: `localhost` или `127.0.0.1`
   - Port: `1234` (по умолчанию)
   - Убедись что Server URL показывает `http://localhost:1234`

2. **В manifest.json:**
   ```json
   "devAllowedDomains": [
     "http://localhost:1234"
   ]
   ```

3. **В настройках плагина:**
   - Base URL: `http://localhost:1234/v1`
   - Model: `ibm/granite-3.2-8b` (или другая модель)

4. **В коде:**
   ```typescript
   const url = `${baseUrl}/chat/completions`;
   const response = await fetch(url, {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       model: 'ibm/granite-3.2-8b',
       messages: [{ role: 'user', content: prompt }],
       temperature: 0.7,
       max_tokens: 500
     })
   });
   ```

---

### 9. Тестирование Network Requests

**Чек-лист перед тестированием:**
- [ ] `devAllowedDomains` содержит правильный URL
- [ ] Используется `fetch()`, а не `figma.network.fetch()`
- [ ] Локальный сервер запущен на `localhost`, не на IP
- [ ] Плагин перезагружен после изменения manifest.json
- [ ] UI создан (даже невидимый) перед вызовом `fetch()`
- [ ] CORS настроен на сервере (`Access-Control-Allow-Origin: *`)

---

### 10. Команды из меню (Menu Commands)

**Структура в manifest.json:**
```json
"menu": [
  {
    "name": "My Command",
    "command": "my-command"
  }
]
```

**Обработка в code.ts:**
```typescript
private async initializePlugin(): Promise<void> {
  const command = figma.command;

  if (command === 'my-command') {
    // Если нужен fetch, создай UI
    figma.showUI(invisibleHTML, { visible: false, width: 1, height: 1 });
    // Жди ui-ready перед использованием fetch
  } else {
    // Показать обычный UI
    figma.showUI(__html__, { width: 400, height: 600 });
  }
}
```

---

## 📚 Полезные Ссылки

### Официальная документация:
- [Plugin API Overview](https://www.figma.com/plugin-docs/)
- [Making Network Requests](https://www.figma.com/plugin-docs/making-network-requests/)
- [Plugin Manifest](https://developers.figma.com/docs/plugins/manifest/)
- [How Plugins Run](https://www.figma.com/plugin-docs/how-plugins-run/)

### Форум и примеры:
- [Figma Plugin Forum](https://forum.figma.com/)
- [CORS Error Discussion](https://forum.figma.com/report-a-problem-6/cors-error-in-figma-plugin-despite-configuring-alloweddomains-and-devalloweddomains-36708)

---

## 🔄 История изменений

### 2024 (текущая версия плагина)
- ✅ Используется `fetch()` вместо `figma.network.fetch()`
- ✅ `devAllowedDomains` использует только `localhost` с конкретным портом
- ✅ Команды меню создают невидимый UI для network access
- ✅ Проверка `typeof fetch !== 'function'` перед использованием

---

## ⚡ Quick Reference

```typescript
// ===== БАЗОВОЕ ИСПОЛЬЗОВАНИЕ =====

// ✅ ПРАВИЛЬНО - используй fetch()
const response = await fetch('http://localhost:1234/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
});

// ❌ НЕПРАВИЛЬНО - figma.network.fetch не существует!
const response = await figma.network.fetch(url, options);


// ===== LM STUDIO (OpenAI-compatible) =====

// ✅ ПРАВИЛЬНО
const body = {
  model: 'ibm/granite-3.2-8b',
  messages: [{ role: 'user', content: 'Hello' }],
  temperature: 0.7,
  max_tokens: 500,
  stream: false  // КРИТИЧНО: всегда false!
};

const response = await fetch('http://localhost:1234/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

const data = await response.json();
const text = data.choices[0].message.content;


// ===== YANDEX CLOUD =====

// ✅ ПРАВИЛЬНО
const body = {
  modelUri: 'gpt://b1g.../yandexgpt-lite',
  completionOptions: {
    stream: false,  // КРИТИЧНО: всегда false!
    temperature: 0.7,
    maxTokens: '500'
  },
  messages: [{ role: 'user', text: 'Hello' }]
};

const response = await fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/completion', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Api-Key YOUR_API_KEY'
  },
  body: JSON.stringify(body)
});

const data = await response.json();
const text = data.result.alternatives[0].message.text;


// ===== OPENAI COMPATIBLE =====

// ✅ ПРАВИЛЬНО
const body = {
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello' }],
  temperature: 0.7,
  max_tokens: 500,
  stream: false  // КРИТИЧНО: всегда false!
};

const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY'
  },
  body: JSON.stringify(body)
});


// ===== MANIFEST.JSON =====

// ✅ ПРАВИЛЬНО
"devAllowedDomains": ["http://localhost:1234"]
"allowedDomains": [
  "https://llm.api.cloud.yandex.net",
  "https://api.openai.com"
]

// ❌ НЕПРАВИЛЬНО
"devAllowedDomains": ["http://127.0.0.1:1234"]  // IP адреса не поддерживаются!
"devAllowedDomains": ["http://localhost:*"]     // wildcards в портах не работают!
"devAllowedDomains": ["http://10.8.1.17:1234"]  // локальные IP не работают!
```

---

**ВСЕГДА ПРОВЕРЯЙ ЭТОТ ДОКУМЕНТ ПЕРЕД РАБОТОЙ С NETWORK API В FIGMA ПЛАГИНАХ!**
