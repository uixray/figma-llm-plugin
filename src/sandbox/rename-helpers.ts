import { RenameRule, RenamePreview, RenamePreset } from '../shared/types';

/**
 * Проверить, нужно ли пропустить узел при переименовании
 * NOTE: mainComponent is not used here because it requires getMainComponentAsync()
 * in dynamic-page documentAccess mode. INSTANCE nodes are skipped by type check.
 */
export function shouldIgnoreNode(node: SceneNode): boolean {
  // Пропускаем компоненты, наборы компонентов и экземпляры
  if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET' || node.type === 'INSTANCE') {
    return true;
  }

  // Пропускаем векторные элементы (иконки, иллюстрации)
  // Определяем по типу и отсутствию текстовых/фреймовых детей
  if (isVectorOnlyNode(node)) {
    return true;
  }

  return false;
}

/**
 * Проверить, является ли узел чисто векторным (иконка, иллюстрация)
 */
function isVectorOnlyNode(node: SceneNode): boolean {
  // Прямые векторные типы
  const vectorTypes = [
    'VECTOR',
    'STAR',
    'LINE',
    'ELLIPSE',
    'POLYGON',
    'RECTANGLE',
    'BOOLEAN_OPERATION',
  ];

  if (vectorTypes.includes(node.type)) {
    return true;
  }

  // Для групп - проверяем содержимое
  if (node.type === 'GROUP') {
    const children = (node as GroupNode).children;

    // Если группа пустая - пропускаем
    if (children.length === 0) {
      return true;
    }

    // Если ВСЕ дети - векторные элементы, значит это иконка/иллюстрация
    const allChildrenAreVectors = children.every((child) => {
      return vectorTypes.includes(child.type) || isVectorOnlyNode(child);
    });

    return allChildrenAreVectors;
  }

  return false;
}

/**
 * Проверить, должен ли узел быть переименован
 */
export function shouldRenameNode(node: SceneNode): boolean {
  // Пропускаем игнорируемые узлы
  if (shouldIgnoreNode(node)) {
    return false;
  }

  // Переименовываем только FRAME, GROUP, TEXT
  const allowedTypes = ['FRAME', 'GROUP', 'TEXT'];
  return allowedTypes.includes(node.type);
}

/**
 * Применить правила переименования к строке
 */
export function applyRenameRules(
  name: string,
  rules: RenameRule[],
  presetType?: string
): string {
  // Для встроенных пресетов используем специальную логику
  if (presetType && ['bem', 'camelCase', 'snakeCase', 'kebabCase'].includes(presetType)) {
    return applyBuiltInTransformation(name, presetType);
  }

  // Для кастомных правил - применяем regex
  let result = name;

  for (const rule of rules) {
    try {
      const flags = rule.caseSensitive ? 'g' : 'gi';
      const regex = new RegExp(rule.pattern, flags);
      result = result.replace(regex, rule.replacement);
    } catch (error) {
      console.error(`[RenameHelpers] Invalid regex pattern: ${rule.pattern}`, error);
      // Пропускаем невалидное правило
    }
  }

  return result;
}

/**
 * Генерировать предпросмотр переименования для выбранных узлов
 */
export function generateRenamePreview(
  nodes: readonly SceneNode[],
  preset: RenamePreset
): RenamePreview[] {
  const previews: RenamePreview[] = [];

  function processNode(node: SceneNode, depth: number = 0) {
    // Проверяем, нужно ли переименовать узел
    if (shouldRenameNode(node)) {
      const oldName = node.name;
      const newName = applyRenameRules(oldName, preset.rules, preset.type);

      // Добавляем в превью только если имя изменилось
      if (oldName !== newName) {
        previews.push({
          nodeId: node.id,
          nodeName: oldName, // Для отображения пути в UI
          oldName,
          newName,
          nodeType: node.type,
          depth,
        });
      }
    }

    // Рекурсивно обрабатываем детей (если это не игнорируемый узел)
    if ('children' in node && !shouldIgnoreNode(node)) {
      const parent = node as FrameNode | GroupNode | ComponentNode;
      for (const child of parent.children) {
        processNode(child, depth + 1);
      }
    }
  }

  // Обрабатываем все выбранные узлы
  for (const node of nodes) {
    processNode(node);
  }

  return previews;
}

/**
 * Применить переименование к узлам на основе превью
 */
export async function applyRenaming(previews: RenamePreview[]): Promise<number> {
  let renamedCount = 0;

  for (const preview of previews) {
    try {
      // Use async version as required by Figma API in dynamic-page mode
      const node = await figma.getNodeByIdAsync(preview.nodeId) as SceneNode;

      if (node && 'name' in node) {
        // Check if node is locked
        if ('locked' in node && node.locked) {
          console.warn(`[RenameHelpers] Skipping locked node: ${preview.nodeId}`);
          continue;
        }

        console.log(`[RenameHelpers] Renaming "${node.name}" -> "${preview.newName}"`);
        node.name = preview.newName;
        renamedCount++;
      } else {
        console.warn(`[RenameHelpers] Node not found or has no name property: ${preview.nodeId}`);
      }
    } catch (error) {
      console.error(`[RenameHelpers] Failed to rename node ${preview.nodeId}:`, error);
    }
  }

  console.log(`[RenameHelpers] Successfully renamed ${renamedCount}/${previews.length} nodes`);
  return renamedCount;
}

/**
 * Применить встроенное преобразование по типу пресета
 * Используется специальная логика для каждого типа
 */
export function applyBuiltInTransformation(name: string, presetType: string): string {
  switch (presetType) {
    case 'bem':
      // BEM: Block__Element--Modifier
      return name.replace(/\s+/g, '__').replace(/_/g, '__');

    case 'camelCase':
      // camelCase
      return name
        .replace(/[\s\-_]+(.)/g, (_, char) => char.toUpperCase())
        .replace(/^(.)/, (_, char) => char.toLowerCase());

    case 'snakeCase':
      // snake_case
      return name
        .replace(/[\s\-]+/g, '_')
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .toLowerCase();

    case 'kebabCase':
      // kebab-case
      return name
        .replace(/[\s_]+/g, '-')
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .toLowerCase();

    default:
      return name;
  }
}

/**
 * Рекурсивно собрать все узлы из выделения, которые нужно переименовать
 */
export function collectNodesToRename(nodes: readonly SceneNode[]): SceneNode[] {
  const result: SceneNode[] = [];

  function traverse(node: SceneNode) {
    if (shouldRenameNode(node)) {
      result.push(node);
    }

    // Рекурсивно обходим детей
    if ('children' in node && !shouldIgnoreNode(node)) {
      const parent = node as FrameNode | GroupNode | ComponentNode;
      for (const child of parent.children) {
        traverse(child);
      }
    }
  }

  for (const node of nodes) {
    traverse(node);
  }

  return result;
}
