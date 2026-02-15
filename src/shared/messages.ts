import type {
  ProviderType,
  PluginSettings,
  GenerationSettings,
  TextNodeInfo,
  DataPresetSettings,
  RenameSettings,
  RenamePreview,
  SavedPromptsLibrary,
  SavedPrompt,
} from './types';
import type { BatchProgress } from '../sandbox/batch-processor';

// ============================================================================
// Message Types: UI → Sandbox
// ============================================================================

/**
 * Загрузка настроек из clientStorage
 */
export interface LoadSettingsRequest {
  type: 'load-settings';
  id: string;
}

/**
 * Сохранение настроек в clientStorage
 */
export interface SaveSettingsRequest {
  type: 'save-settings';
  id: string;
  settings: PluginSettings;
}

/**
 * Генерация текста через LLM
 */
export interface GenerateTextRequest {
  type: 'generate-text';
  id: string;
  providerId: string; // V2: ID провайдера из providerConfigs
  prompt: string;
  systemPrompt?: string;
  settings: GenerationSettings;
}

/**
 * Применение сгенерированного текста к нодам
 */
export interface ApplyGeneratedTextRequest {
  type: 'apply-text';
  id: string;
  text: string;
  targetNodeIds: string[]; // IDs выбранных текстовых нод
}

/**
 * Отмена генерации
 */
export interface CancelGenerationRequest {
  type: 'cancel-generation';
  id: string;
  generationId: string; // ID генерации для отмены
}

/**
 * Получение выбранных текстовых слоёв
 */
export interface GetSelectedTextRequest {
  type: 'get-selected-text';
  id: string;
}

/**
 * Тест подключения к провайдеру
 */
export interface TestConnectionRequest {
  type: 'test-connection';
  id: string;
  provider: ProviderType;
}

/**
 * Тестовый перевод выделенного текста
 */
export interface TestTranslationRequest {
  type: 'test-translation';
  id: string;
}

/**
 * Быстрое применение пресета (из меню команд)
 */
export interface QuickApplyPresetRequest {
  type: 'quick-apply-preset';
  id: string;
  presetId: string;
}

/**
 * Генерация превью переименования
 */
export interface RenamePreviewRequest {
  type: 'rename-preview';
  presetId: string;
}

/**
 * Применение переименования
 */
export interface RenameApplyRequest {
  type: 'rename-apply';
  preview: RenamePreview[];
  presetId: string;
}

/**
 * Загрузка настроек переименования
 */
export interface LoadRenameSettingsRequest {
  type: 'load-rename-settings';
}

/**
 * Загрузка библиотеки промптов
 */
export interface LoadPromptsLibraryRequest {
  type: 'load-prompts-library';
}

/**
 * Сохранение промпта
 */
export interface SavePromptRequest {
  type: 'save-prompt';
  prompt: SavedPrompt;
}

/**
 * Обновление счётчика использования промпта
 */
export interface UpdatePromptUsageRequest {
  type: 'update-prompt-usage';
  promptId: string;
}

/**
 * Удаление промпта
 */
export interface DeletePromptRequest {
  type: 'delete-prompt';
  promptId: string;
}

/**
 * Получение списка выбранных текстовых слоёв (для multi-field генерации)
 */
export interface GetSelectedLayersRequest {
  type: 'get-selected-layers';
  id: string;
}

/**
 * Multi-field генерация (отдельный результат для каждого слоя)
 */
export interface GenerateMultiRequest {
  type: 'generate-multi';
  id: string;
  providerId: string;
  prompt: string;
  systemPrompt?: string;
  settings: GenerationSettings;
  layers: Array<{
    id: string;
    name: string;
    originalText: string;
  }>;
}

/**
 * Отмена multi-field генерации
 */
export interface CancelMultiGenerationRequest {
  type: 'cancel-multi-generation';
  id: string;
}

/**
 * Применение multi-field результатов к слоям
 */
export interface ApplyMultiResultsRequest {
  type: 'apply-multi-results';
  id: string;
  results: Array<{
    layerId: string;
    text: string;
  }>;
}

/**
 * AI Rename — генерация имён через AI провайдер
 */
export interface AIRenamePreviewRequest {
  type: 'ai-rename-preview';
  id: string;
  prompt: string;
  includeHierarchy: boolean;
}

/**
 * Union type для всех сообщений UI → Sandbox
 */
export type UIToSandboxMessage =
  | LoadSettingsRequest
  | SaveSettingsRequest
  | GenerateTextRequest
  | ApplyGeneratedTextRequest
  | CancelGenerationRequest
  | GetSelectedTextRequest
  | GetSelectedLayersRequest
  | TestConnectionRequest
  | TestTranslationRequest
  | LoadDataPresetsRequest
  | SaveDataPresetsRequest
  | ApplyDataSubstitutionRequest
  | QuickApplyPresetRequest
  | RenamePreviewRequest
  | RenameApplyRequest
  | LoadRenameSettingsRequest
  | LoadPromptsLibraryRequest
  | SavePromptRequest
  | UpdatePromptUsageRequest
  | DeletePromptRequest
  | GenerateMultiRequest
  | CancelMultiGenerationRequest
  | ApplyMultiResultsRequest
  | AIRenamePreviewRequest;

// ============================================================================
// Message Types: Sandbox → UI
// ============================================================================

/**
 * Ответ с загруженными настройками
 */
export interface LoadSettingsResponse {
  type: 'settings-loaded';
  id: string;
  settings: PluginSettings;
}

/**
 * Ответ о сохранении настроек
 */
export interface SaveSettingsResponse {
  type: 'settings-saved';
  id: string;
  success: boolean;
  error?: string;
}

/**
 * Генерация началась
 */
export interface GenerateTextResponse {
  type: 'generation-started';
  id: string;
  generationId: string;
  selectionContextCount?: number; // Сколько текстовых слоёв было автоматически подставлено
}

/**
 * Чанк streaming генерации
 */
export interface GenerateTextStreamChunk {
  type: 'generation-chunk';
  id: string;
  generationId: string;
  chunk: string;
  tokensGenerated: number;
}

/**
 * Генерация завершена
 */
export interface GenerateTextComplete {
  type: 'generation-complete';
  id: string;
  generationId: string;
  fullText: string;
  tokensUsed: number;
  cost?: number; // Стоимость в рублях/долларах
  duration: number; // ms
  appliedCount?: number; // Сколько слоёв обновлено автоматически
}

/**
 * Ошибка генерации
 */
export interface GenerateTextError {
  type: 'generation-error';
  id: string;
  generationId: string;
  error: string;
  retryable: boolean;
}

/**
 * Ответ о применении текста
 */
export interface ApplyTextResponse {
  type: 'text-applied';
  id: string;
  success: boolean;
  appliedCount: number;
  error?: string;
}

/**
 * Ответ с выбранными текстовыми слоями
 */
export interface GetSelectedTextResponse {
  type: 'selected-text';
  id: string;
  textNodes: TextNodeInfo[];
}

/**
 * Selected text loaded (simplified response with just text)
 */
export interface SelectedTextLoadedResponse {
  type: 'selected-text-loaded';
  id: string;
  text: string;
}

/**
 * Уведомление
 */
export interface NotificationMessage {
  type: 'notification';
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
}

/**
 * Обновление статистики использования токенов
 */
export interface TokenUsageUpdate {
  type: 'token-usage';
  provider: ProviderType;
  tokensUsed: number;
  estimatedCost: number;
}

/**
 * Результат теста подключения
 */
export interface TestConnectionResponse {
  type: 'test-connection-result';
  id: string;
  success: boolean;
  error?: string;
}

/**
 * Результат тестового перевода
 */
export interface TestTranslationResponse {
  type: 'test-translation-result';
  id: string;
  success: boolean;
  original?: string;
  translated?: string;
  error?: string;
}

/**
 * Загрузка пресетов данных
 */
export interface LoadDataPresetsRequest {
  type: 'load-data-presets';
  id: string;
}

/**
 * Сохранение пресетов данных
 */
export interface SaveDataPresetsRequest {
  type: 'save-data-presets';
  id: string;
  settings: DataPresetSettings;
}

/**
 * Применение подстановки данных
 */
export interface ApplyDataSubstitutionRequest {
  type: 'apply-data-substitution';
  id: string;
  presetId: string;
}

/**
 * Ответ с загруженными пресетами
 */
export interface DataPresetsLoadedResponse {
  type: 'data-presets-loaded';
  id: string;
  settings: DataPresetSettings;
}

/**
 * Результат применения подстановки
 */
export interface SubstitutionAppliedResponse {
  type: 'substitution-applied';
  id: string;
  success: boolean;
  nodesProcessed: number;
  componentsProcessed?: number;  // Для последовательного применения
  groupsUsed?: number;           // Сколько групп было использовано
  error?: string;
}

/**
 * Ответ с загруженными настройками переименования
 */
export interface RenameSettingsLoadedResponse {
  type: 'rename-settings-loaded';
  settings: RenameSettings;
}

/**
 * Результат генерации превью переименования
 */
export interface RenamePreviewResponse {
  type: 'rename-preview-result';
  preview: RenamePreview[];
}

/**
 * Результат применения переименования
 */
export interface RenameApplyResponse {
  type: 'rename-apply-result';
  renamedCount: number;
}

/**
 * Прогресс batch обработки
 */
export interface BatchProgressMessage {
  type: 'batch-progress';
  progress: BatchProgress;
}

/**
 * Ответ с загруженной библиотекой промптов
 */
export interface PromptsLibraryLoadedResponse {
  type: 'prompts-library-loaded';
  library: SavedPromptsLibrary;
}

/**
 * Ответ со списком выбранных текстовых слоёв (для multi-field)
 */
export interface SelectedLayersResponse {
  type: 'selected-layers-loaded';
  id: string;
  layers: Array<{
    id: string;
    name: string;
    characters: string;
  }>;
}

/**
 * Chunk multi-field генерации (прогресс для одного слоя)
 */
export interface GenerationMultiChunkResponse {
  type: 'generation-multi-chunk';
  id: string;
  layerIndex: number;
  text: string;         // Полный текст (не дельта) для данного слоя на данный момент
  tokens: number;
}

/**
 * Завершение multi-field генерации
 */
export interface GenerationMultiCompleteResponse {
  type: 'generation-multi-complete';
  id: string;
  results: Array<{
    layerId: string;
    layerName: string;
    originalText: string;
    generatedText: string;
    tokens: number;
    cost: number;
  }>;
  totalTokens: number;
  totalCost: number;
  duration: number;
}

/**
 * Ошибка multi-field генерации
 */
export interface GenerationMultiErrorResponse {
  type: 'generation-multi-error';
  id: string;
  error: string;
}

/**
 * Результат применения multi-field результатов
 */
export interface ApplyMultiResultsResponse {
  type: 'multi-results-applied';
  id: string;
  success: boolean;
  appliedCount: number;
  error?: string;
}

/**
 * Настройки обновлены (для обновления UI в реальном времени)
 */
export interface SettingsUpdatedMessage {
  type: 'settings-updated';
  settings: PluginSettings;
}

/**
 * Union type для всех сообщений Sandbox → UI
 */
export type SandboxToUIMessage =
  | LoadSettingsResponse
  | SaveSettingsResponse
  | SettingsUpdatedMessage
  | GenerateTextResponse
  | GenerateTextStreamChunk
  | GenerateTextComplete
  | GenerateTextError
  | ApplyTextResponse
  | GetSelectedTextResponse
  | SelectedTextLoadedResponse
  | SelectedLayersResponse
  | NotificationMessage
  | TokenUsageUpdate
  | TestConnectionResponse
  | TestTranslationResponse
  | DataPresetsLoadedResponse
  | SubstitutionAppliedResponse
  | RenameSettingsLoadedResponse
  | RenamePreviewResponse
  | RenameApplyResponse
  | BatchProgressMessage
  | PromptsLibraryLoadedResponse
  | GenerationMultiChunkResponse
  | GenerationMultiCompleteResponse
  | GenerationMultiErrorResponse
  | ApplyMultiResultsResponse;

// ============================================================================
// Message Wrapper для postMessage
// ============================================================================

/**
 * Обёртка для postMessage
 */
export interface PluginMessage<T> {
  pluginMessage: T;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Отправить сообщение из UI в Sandbox
 */
export function sendToSandbox<T extends UIToSandboxMessage>(message: T): void {
  parent.postMessage({ pluginMessage: message } as PluginMessage<T>, '*');
}

/**
 * Отправить сообщение из Sandbox в UI
 */
export function sendToUI<T extends SandboxToUIMessage>(message: T): void {
  figma.ui.postMessage(message);
}
