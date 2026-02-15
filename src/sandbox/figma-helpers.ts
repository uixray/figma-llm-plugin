import { TextNodeInfo, DataPreset, NodeGroup, ValueGroup } from '../shared/types';

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

/**
 * Применение текста к нодам
 */
export async function applyTextToNodes(text: string, nodeIds: string[]): Promise<number> {
  let appliedCount = 0;

  for (const nodeId of nodeIds) {
    try {
      const node = await figma.getNodeByIdAsync(nodeId);

      if (node && node.type === 'TEXT') {
        // Загружаем шрифт перед изменением текста
        await loadFontForNode(node);
        node.characters = text;
        appliedCount++;
      }
    } catch (error) {
      console.error(`Failed to apply text to node ${nodeId}:`, error);
    }
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
