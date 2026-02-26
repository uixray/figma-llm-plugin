import { TextNodeInfo, DataPreset, NodeGroup, ValueGroup } from '../shared/types';
import type { PromptVariableContext } from '../shared/utils';

/**
 * Рекурсивный поиск всех текстовых узлов внутри узла
 */
function getTextNodesRecursive(node: SceneNode): TextNodeInfo[] {
  const textNodes: TextNodeInfo[] = [];

  // Если это TEXT - добавляем
  if (node.type === 'TEXT') {
    textNodes.push({
      id: node.id,
      name: node.name,
      characters: node.characters,
    });
  }

  // Если есть children - рекурсивно обходим
  if ('children' in node) {
    const found = (node as any).findAll(function (n: SceneNode) {
      return n.type === 'TEXT';
    });

    for (const textNode of found) {
      if (textNode.type === 'TEXT') {
        textNodes.push({
          id: textNode.id,
          name: textNode.name,
          characters: (textNode as TextNode).characters,
        });
      }
    }
  }

  return textNodes;
}

/**
 * Получение выбранных текстовых нод (с рекурсивным обходом вложенных)
 */
export async function getSelectedTextNodes(): Promise<TextNodeInfo[]> {
  const selection = figma.currentPage.selection;
  const textNodes: TextNodeInfo[] = [];
  const seen = new Set<string>();  // Избегаем дубликатов

  for (const node of selection) {
    const found = getTextNodesRecursive(node);
    for (const textNode of found) {
      if (!seen.has(textNode.id)) {
        seen.add(textNode.id);
        textNodes.push(textNode);
      }
    }
  }

  return textNodes;
}

// ============================================================================
// Operation History for Undo
// ============================================================================

export interface OperationEntry {
  nodeId: string;
  oldText: string;
  newText: string;
}

export interface OperationRecord {
  id: string;
  timestamp: number;
  type: 'generate' | 'rename';
  entries: OperationEntry[];
}

/** In-memory operation history for undo (max entries) */
const MAX_UNDO_HISTORY = 10;
const operationHistory: OperationRecord[] = [];

/**
 * Record an operation in undo history
 */
export function pushOperationToHistory(record: OperationRecord): void {
  operationHistory.push(record);
  if (operationHistory.length > MAX_UNDO_HISTORY) {
    operationHistory.shift();
  }
}

/**
 * Get the last operation for undo (peek without removing)
 */
export function getLastOperation(): OperationRecord | null {
  return operationHistory.length > 0 ? operationHistory[operationHistory.length - 1] : null;
}

/**
 * Pop the last operation and undo it (restore old text values)
 * Returns the number of nodes restored, or 0 if nothing to undo.
 */
export async function undoLastOperation(): Promise<{ restoredCount: number; operationType: string }> {
  const record = operationHistory.pop();
  if (!record) return { restoredCount: 0, operationType: '' };

  let restoredCount = 0;
  for (const entry of record.entries) {
    try {
      const node = await figma.getNodeByIdAsync(entry.nodeId);
      if (node && node.type === 'TEXT') {
        await loadFontForNode(node);
        node.characters = entry.oldText;
        restoredCount++;
      }
    } catch (error) {
      console.error(`Failed to undo node ${entry.nodeId}:`, error);
    }
  }

  return { restoredCount, operationType: record.type };
}

/**
 * Get undo history length (for UI display)
 */
export function getUndoHistoryLength(): number {
  return operationHistory.length;
}

/**
 * Применение текста к нодам (с записью в историю для undo)
 */
export async function applyTextToNodes(text: string, nodeIds: string[], operationId?: string): Promise<number> {
  let appliedCount = 0;
  const entries: OperationEntry[] = [];

  for (const nodeId of nodeIds) {
    try {
      const node = await figma.getNodeByIdAsync(nodeId);

      if (node && node.type === 'TEXT') {
        // Save old text for undo
        const oldText = node.characters;

        // Загружаем шрифт перед изменением текста
        await loadFontForNode(node);
        node.characters = text;
        appliedCount++;

        entries.push({ nodeId, oldText, newText: text });
      }
    } catch (error) {
      console.error(`Failed to apply text to node ${nodeId}:`, error);
    }
  }

  // Record operation for undo if there were changes
  if (entries.length > 0 && operationId) {
    pushOperationToHistory({
      id: operationId,
      timestamp: Date.now(),
      type: 'generate',
      entries,
    });
  }

  return appliedCount;
}

/**
 * Загрузка шрифта для текстовой ноды
 */
export async function loadFontForNode(node: TextNode): Promise<void> {
  try {
    // Если используется один шрифт
    if (typeof node.fontName !== 'symbol') {
      await figma.loadFontAsync(node.fontName);
    } else {
      // Если используются mixed fonts - загружаем все
      const ranges = node.getRangeAllFontNames(0, node.characters.length);
      for (const fontName of ranges) {
        await figma.loadFontAsync(fontName);
      }
    }
  } catch (error) {
    console.error('Failed to load font:', error);
    // Fallback на default font
    await figma.loadFontAsync({ family: 'Roboto', style: 'Regular' });
  }
}

// ============================================================================
// Data Substitution Functions
// ============================================================================

/**
 * Заменить все плейсхолдеры (#паттерны) в тексте на значения из пресета
 * DEPRECATED: Теперь паттерны проверяются в ИМЕНИ СЛОЯ, а не в тексте
 * Эта функция оставлена для обратной совместимости
 */
export function substituteText(text: string, preset: DataPreset): string {
  let result = text;

  // Проходим по всем парам паттерн:значение в пресете
  for (const pattern in preset.values) {
    const value = preset.values[pattern];
    // Заменяем все вхождения паттерна
    result = result.split(pattern).join(value);
  }

  return result;
}

/**
 * Применить подстановку данных к выделенным текстовым слоям
 * ВАЖНО: Проверяется ИМЯ СЛОЯ (node.name), заменяется СОДЕРЖИМОЕ (node.characters)
 */
export async function applyDataSubstitution(preset: DataPreset): Promise<{ nodesProcessed: number }> {
  // Получить выделенные текстовые слои
  const nodes = await getSelectedTextNodes();

  if (nodes.length === 0) {
    throw new Error('No text layers selected');
  }

  let nodesProcessed = 0;

  // Применить подстановку к каждому узлу
  for (const nodeInfo of nodes) {
    try {
      const node = await figma.getNodeByIdAsync(nodeInfo.id);

      if (node && node.type === 'TEXT') {
        // Загружаем шрифт
        await loadFontForNode(node);

        // Проверяем ИМЯ СЛОЯ и заменяем СОДЕРЖИМОЕ
        const layerName = node.name;
        const matchedValues: string[] = [];

        // Собираем все совпадающие значения из первой группы (для обратной совместимости)
        if (preset.groups && preset.groups.length > 0) {
          const firstGroup = preset.groups[0];
          for (const pattern in firstGroup.values) {
            if (layerName.indexOf(pattern) !== -1) {
              matchedValues.push(firstGroup.values[pattern]);
            }
          }
        }

        // Если есть совпадения - применяем
        if (matchedValues.length > 0) {
          const separator = preset.multiValueSeparator || ', ';
          const finalValue = matchedValues.join(separator);
          node.characters = finalValue;
          console.log('[Substitution] Matched layer "' + layerName + '" with ' + matchedValues.length + ' patterns → "' + finalValue + '"');
          nodesProcessed++;
        } else {
          console.log('[Substitution] No pattern match for layer "' + layerName + '"');
        }
      }
    } catch (error) {
      console.error(`Failed to apply substitution to node ${nodeInfo.id}:`, error);
      // Продолжаем обработку остальных узлов
    }
  }

  return { nodesProcessed };
}

// ============================================================================
// Sequential Group Application Functions
// ============================================================================

/**
 * Группировка выделенных узлов с их текстовыми слоями
 */
export async function getSelectedNodeGroups(): Promise<NodeGroup[]> {
  const selection = figma.currentPage.selection;
  const groups: NodeGroup[] = [];

  for (const node of selection) {
    const textNodes = getTextNodesRecursive(node);

    if (textNodes.length > 0) {
      groups.push({
        parentId: node.id,
        parentName: node.name,
        textNodes: textNodes,
      });
    }
  }

  return groups;
}

/**
 * Последовательное применение групп значений к компонентам
 * Группа 1 → Компонент 1, Группа 2 → Компонент 2, и т.д.
 * Если компонентов больше чем групп - группы применяются по кругу
 */
export async function applyDataSubstitutionSequential(
  preset: DataPreset
): Promise<{ componentsProcessed: number; groupsUsed: number }> {

  const nodeGroups = await getSelectedNodeGroups();

  if (nodeGroups.length === 0) {
    throw new Error('No components with text layers selected');
  }

  if (preset.groups.length === 0) {
    throw new Error('Preset has no groups');
  }

  let componentsProcessed = 0;
  const groupsUsedSet = new Set<number>();

  // Последовательно: группа 1 → компонент 1, группа 2 → компонент 2
  // Если компонентов больше - группы применяются по кругу
  for (let i = 0; i < nodeGroups.length; i++) {
    const nodeGroup = nodeGroups[i];
    const groupIndex = i % preset.groups.length; // Циклическое применение
    const valueGroup = preset.groups[groupIndex];

    groupsUsedSet.add(groupIndex);

    // Применяем значения из этой группы ко всем текстам в компоненте
    for (const textNodeInfo of nodeGroup.textNodes) {
      try {
        const node = await figma.getNodeByIdAsync(textNodeInfo.id);

        if (node && node.type === 'TEXT') {
          await loadFontForNode(node);

          // Проверяем ИМЯ СЛОЯ и заменяем ЗНАЧЕНИЕ
          const layerName = node.name;
          const matchedValues: string[] = [];

          // Собираем все совпадающие значения
          for (const pattern in valueGroup.values) {
            if (layerName.indexOf(pattern) !== -1) {
              matchedValues.push(valueGroup.values[pattern]);
            }
          }

          // Если есть совпадения - применяем
          if (matchedValues.length > 0) {
            const separator = preset.multiValueSeparator || ', ';
            const finalValue = matchedValues.join(separator);
            node.characters = finalValue;
            console.log('[Sequential] Matched layer "' + layerName + '" with ' + matchedValues.length + ' patterns → "' + finalValue + '"');
          }
        }
      } catch (error) {
        console.error('Failed to apply to node ' + textNodeInfo.id + ':', error);
      }
    }

    componentsProcessed++;
  }

  return { componentsProcessed, groupsUsed: groupsUsedSet.size };
}

/**
 * Обратное переименование: ищет по ЗНАЧЕНИЮ текста и меняет ИМЯ слоя
 * Используется для быстрой настройки слоев под пресет
 */
export async function reverseRenameByContent(preset: DataPreset): Promise<{ nodesRenamed: number }> {
  if (!preset.defaultValues || Object.keys(preset.defaultValues).length === 0) {
    throw new Error('Preset has no default values for reverse renaming');
  }

  const nodes = await getSelectedTextNodes();

  if (nodes.length === 0) {
    throw new Error('No text layers selected');
  }

  let nodesRenamed = 0;

  for (const nodeInfo of nodes) {
    try {
      const node = await figma.getNodeByIdAsync(nodeInfo.id);

      if (node && node.type === 'TEXT') {
        const textContent = node.characters.trim().toLowerCase();

        // Ищем совпадение по содержимому
        for (const fieldName in preset.defaultValues) {
          const defaultValue = preset.defaultValues[fieldName].trim().toLowerCase();

          if (textContent === defaultValue || textContent.indexOf(defaultValue) !== -1) {
            // Нашли совпадение - переименовываем слой
            node.name = fieldName;
            nodesRenamed++;
            console.log('[ReverseRename] Renamed layer with content "' + node.characters + '" to "' + fieldName + '"');
            break; // Применили первое совпадение
          }
        }
      }
    } catch (error) {
      console.error('Failed to rename node ' + nodeInfo.id + ':', error);
    }
  }

  return { nodesRenamed };
}

// ============================================================================
// Vision: Export node as base64 image
// ============================================================================

/**
 * Export a Figma node as a base64-encoded PNG image.
 * Automatically reduces scale if the result exceeds maxSizeBytes.
 * @param node The node to export
 * @param maxSizeBytes Maximum image size in bytes (default: 1MB)
 * @returns Base64-encoded PNG string (without data URI prefix)
 */
export async function exportNodeAsBase64(
  node: SceneNode,
  maxSizeBytes: number = 1_048_576,
): Promise<string> {
  let scale = 2; // Start with 2x for good quality
  let bytes: Uint8Array = new Uint8Array(0);

  // Try decreasing scales until we're under the size limit
  while (scale >= 0.25) {
    bytes = await node.exportAsync({
      format: 'PNG',
      constraint: { type: 'SCALE', value: scale },
    });

    if (bytes.length <= maxSizeBytes) {
      break;
    }

    scale /= 2;
    console.log(`[Vision] Image too large (${bytes.length} bytes), reducing scale to ${scale}x`);
  }

  // Convert Uint8Array to base64 using Figma's built-in encoder
  return figma.base64Encode(bytes);
}

/**
 * Export the first selected node as base64 image.
 * Returns null if no exportable node is selected.
 */
export async function exportSelectionAsBase64(maxSizeBytes?: number): Promise<string | null> {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) return null;

  const node = selection[0];

  // Only export nodes that have visual content
  if ('exportAsync' in node) {
    try {
      return await exportNodeAsBase64(node, maxSizeBytes);
    } catch (error) {
      console.error('[Vision] Export failed:', error);
      return null;
    }
  }

  return null;
}

// ============================================================================
// Prompt Variable Context
// ============================================================================

/**
 * Find the nearest containing FRAME ancestor of a node
 */
function findNearestFrame(node: BaseNode): FrameNode | null {
  let current = node.parent;
  while (current) {
    if (current.type === 'FRAME') return current as FrameNode;
    current = current.parent;
  }
  return null;
}

/**
 * Get sibling names (other children of the same parent)
 */
function getSiblingNames(node: BaseNode, maxCount: number = 10): string[] {
  const parent = node.parent;
  if (!parent || !('children' in parent)) return [];

  return (parent as any).children
    .filter((child: BaseNode) => child.id !== node.id)
    .slice(0, maxCount)
    .map((child: BaseNode) => child.name);
}

/**
 * Collect prompt variable context from the current Figma selection.
 * Returns context based on the first selected node.
 */
export function getPromptVariableContext(): PromptVariableContext {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    return {
      layer_name: '',
      layer_type: '',
      layer_text: '',
      parent_name: '',
      frame_name: '',
      page_name: figma.currentPage.name,
      siblings: '',
      selection_count: '0',
    };
  }

  const firstNode = selection[0];
  const parentNode = firstNode.parent;
  const nearestFrame = findNearestFrame(firstNode);
  const siblings = getSiblingNames(firstNode);

  return {
    layer_name: firstNode.name,
    layer_type: firstNode.type,
    layer_text: firstNode.type === 'TEXT' ? (firstNode as TextNode).characters : '',
    parent_name: parentNode ? parentNode.name : '',
    frame_name: nearestFrame ? nearestFrame.name : '',
    page_name: figma.currentPage.name,
    siblings: siblings.join(', '),
    selection_count: String(selection.length),
  };
}
