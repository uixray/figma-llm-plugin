import {
  generateUniqueId,
  estimateTokens,
  formatCost,
  formatDuration,
  isValidUrl,
  isNonEmptyString,
  resolvePromptVariables,
  promptHasVariables,
  PromptVariableContext,
  PROMPT_VARIABLES,
} from './utils';

describe('generateUniqueId', () => {
  it('should return a non-empty string', () => {
    const id = generateUniqueId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('should generate unique IDs on successive calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateUniqueId()));
    expect(ids.size).toBe(100);
  });

  it('should contain a timestamp portion', () => {
    const before = Date.now();
    const id = generateUniqueId();
    const after = Date.now();
    const timestamp = parseInt(id.split('-')[0], 10);
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });
});

describe('estimateTokens', () => {
  it('should estimate ~1 token per 4 characters', () => {
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcdefgh')).toBe(2);
  });

  it('should round up for partial tokens', () => {
    expect(estimateTokens('abc')).toBe(1);    // 3/4 = 0.75 → ceil = 1
    expect(estimateTokens('abcde')).toBe(2);  // 5/4 = 1.25 → ceil = 2
  });

  it('should return 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('should handle long text', () => {
    const longText = 'a'.repeat(1000);
    expect(estimateTokens(longText)).toBe(250);
  });

  it('should handle Unicode text', () => {
    const text = 'Привет мир!'; // 11 chars
    expect(estimateTokens(text)).toBe(3); // 11/4 = 2.75 → 3
  });
});

describe('formatCost', () => {
  it('should format cost with 4 decimal places', () => {
    expect(formatCost(0.0123)).toBe('₽0.0123');
  });

  it('should use custom currency symbol', () => {
    expect(formatCost(1.5, '$')).toBe('$1.5000');
  });

  it('should format zero cost', () => {
    expect(formatCost(0)).toBe('₽0.0000');
  });

  it('should pad small values', () => {
    expect(formatCost(0.001)).toBe('₽0.0010');
  });
});

describe('formatDuration', () => {
  it('should convert ms to seconds with 1 decimal', () => {
    expect(formatDuration(1500)).toBe('1.5s');
  });

  it('should handle exact seconds', () => {
    expect(formatDuration(3000)).toBe('3.0s');
  });

  it('should handle sub-second values', () => {
    expect(formatDuration(250)).toBe('0.3s');
  });

  it('should handle zero', () => {
    expect(formatDuration(0)).toBe('0.0s');
  });
});

describe('isValidUrl', () => {
  it('should return true for valid HTTP URLs', () => {
    expect(isValidUrl('http://example.com')).toBe(true);
    expect(isValidUrl('https://example.com')).toBe(true);
  });

  it('should return true for URLs with paths', () => {
    expect(isValidUrl('https://api.openai.com/v1/chat/completions')).toBe(true);
  });

  it('should return true for localhost URLs', () => {
    expect(isValidUrl('http://localhost:1234')).toBe(true);
    expect(isValidUrl('http://127.0.0.1:1234/v1')).toBe(true);
  });

  it('should return false for empty strings', () => {
    expect(isValidUrl('')).toBe(false);
  });

  it('should return false for malformed URLs', () => {
    expect(isValidUrl('not-a-url')).toBe(false);
    expect(isValidUrl('://missing-scheme')).toBe(false);
  });
});

describe('isNonEmptyString', () => {
  it('should return true for non-empty strings', () => {
    expect(isNonEmptyString('hello')).toBe(true);
    expect(isNonEmptyString('  hello  ')).toBe(true);
  });

  it('should return false for empty or whitespace-only strings', () => {
    expect(isNonEmptyString('')).toBe(false);
    expect(isNonEmptyString('   ')).toBe(false);
    expect(isNonEmptyString('\t\n')).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isNonEmptyString(undefined)).toBe(false);
  });
});

describe('PROMPT_VARIABLES', () => {
  it('should define all expected variables', () => {
    const keys = PROMPT_VARIABLES.map(v => v.key);
    expect(keys).toContain('layer_name');
    expect(keys).toContain('layer_type');
    expect(keys).toContain('layer_text');
    expect(keys).toContain('parent_name');
    expect(keys).toContain('frame_name');
    expect(keys).toContain('page_name');
    expect(keys).toContain('siblings');
    expect(keys).toContain('selection_count');
  });

  it('should have descriptions for all variables', () => {
    for (const v of PROMPT_VARIABLES) {
      expect(v.description).toBeTruthy();
      expect(v.description.length).toBeGreaterThan(5);
    }
  });
});

describe('resolvePromptVariables', () => {
  const context: PromptVariableContext = {
    layer_name: 'Submit Button',
    layer_type: 'TEXT',
    layer_text: 'Click me',
    parent_name: 'Form Container',
    frame_name: 'Login Page',
    page_name: 'Page 1',
    siblings: 'Email Input, Password Input',
    selection_count: '3',
  };

  it('should replace single variable', () => {
    expect(resolvePromptVariables('Hello {layer_name}', context)).toBe('Hello Submit Button');
  });

  it('should replace multiple variables', () => {
    const result = resolvePromptVariables(
      'Generate text for {layer_name} in {frame_name}',
      context,
    );
    expect(result).toBe('Generate text for Submit Button in Login Page');
  });

  it('should replace all occurrences of the same variable', () => {
    expect(resolvePromptVariables('{layer_name} is {layer_name}', context)).toBe(
      'Submit Button is Submit Button',
    );
  });

  it('should leave unrecognized variables as-is', () => {
    expect(resolvePromptVariables('Hello {unknown_var}', context)).toBe('Hello {unknown_var}');
  });

  it('should handle templates with no variables', () => {
    expect(resolvePromptVariables('No variables here', context)).toBe('No variables here');
  });

  it('should handle empty template', () => {
    expect(resolvePromptVariables('', context)).toBe('');
  });

  it('should replace all defined context variables', () => {
    const template = '{layer_name},{layer_type},{layer_text},{parent_name},{frame_name},{page_name},{siblings},{selection_count}';
    const expected = 'Submit Button,TEXT,Click me,Form Container,Login Page,Page 1,Email Input, Password Input,3';
    expect(resolvePromptVariables(template, context)).toBe(expected);
  });
});

describe('promptHasVariables', () => {
  it('should detect variables in prompt', () => {
    expect(promptHasVariables('Hello {layer_name}')).toBe(true);
    expect(promptHasVariables('{frame_name}: {layer_text}')).toBe(true);
  });

  it('should return false for prompts without variables', () => {
    expect(promptHasVariables('Hello world')).toBe(false);
    expect(promptHasVariables('No braces here')).toBe(false);
  });

  it('should return false for empty prompt', () => {
    expect(promptHasVariables('')).toBe(false);
  });

  it('should detect unrecognized variables too', () => {
    expect(promptHasVariables('Hello {custom_var}')).toBe(true);
  });

  it('should not detect empty braces', () => {
    expect(promptHasVariables('Hello {}')).toBe(false);
  });

  it('should not detect braces with spaces', () => {
    expect(promptHasVariables('Hello { name }')).toBe(false);
  });
});
