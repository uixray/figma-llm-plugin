import { sendToSandbox } from '../../shared/messages';
import type { DataPresetSettings, DataPreset, ValueGroup } from '../../shared/types';
import { generateUniqueId } from '../../shared/utils';

/**
 * Data Panel - handles data presets UI and logic
 */
export class DataPanel {
  private dataPresets: DataPresetSettings | null = null;
  private currentEditingPresetId: string | null = null;

  constructor() {
    this.setupEventListeners();
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    document.getElementById('preset-select')?.addEventListener('change', () => this.handlePresetSelect());
    document.getElementById('new-preset-btn')?.addEventListener('click', () => this.handleNewPreset());
    document.getElementById('edit-preset-btn')?.addEventListener('click', () => this.handleEditPreset());
    document.getElementById('add-field-name-btn')?.addEventListener('click', () => this.addFieldNameUI(''));
    document.getElementById('data-add-group-btn')?.addEventListener('click', () => this.addGroupUI());
    document.getElementById('save-preset-btn')?.addEventListener('click', () => this.handleSavePreset());
    document.getElementById('delete-preset-btn')?.addEventListener('click', () => this.handleDeletePreset());
    document.getElementById('cancel-edit-btn')?.addEventListener('click', () => this.handleCancelEdit());
    document.getElementById('apply-substitution-btn')?.addEventListener('click', () => this.handleApplySubstitution());
    document.getElementById('export-preset-btn')?.addEventListener('click', () => this.handleExportPreset());
    document.getElementById('import-preset-btn')?.addEventListener('click', () => this.handleImportPreset());
    document.getElementById('import-file-input')?.addEventListener('change', (e) => this.handleFileSelected(e));
  }

  /**
   * Load presets
   */
  loadPresets(settings: DataPresetSettings): void {
    this.dataPresets = settings;
    this.renderPresetSelect();
  }

  /**
   * Render preset select
   */
  private renderPresetSelect(): void {
    if (!this.dataPresets) return;

    const select = document.getElementById('preset-select') as HTMLSelectElement;
    if (!select) return;

    select.innerHTML = '<option value="">-- Select Preset --</option>';

    // Separate built-in and user presets
    const builtInPresets = this.dataPresets.presets.filter(p => p.id.startsWith('built-in-'));
    const userPresets = this.dataPresets.presets.filter(p => !p.id.startsWith('built-in-'));

    if (builtInPresets.length > 0) {
      const builtInGroup = document.createElement('optgroup');
      builtInGroup.label = '📦 Built-in Presets';
      for (const preset of builtInPresets) {
        const option = document.createElement('option');
        option.value = preset.id;
        option.textContent = preset.name;
        if (preset.id === this.dataPresets.selectedPresetId) option.selected = true;
        builtInGroup.appendChild(option);
      }
      select.appendChild(builtInGroup);
    }

    if (userPresets.length > 0) {
      const userGroup = document.createElement('optgroup');
      userGroup.label = '👤 My Presets';
      for (const preset of userPresets) {
        const option = document.createElement('option');
        option.value = preset.id;
        option.textContent = preset.name;
        if (preset.id === this.dataPresets.selectedPresetId) option.selected = true;
        userGroup.appendChild(option);
      }
      select.appendChild(userGroup);
    }

    const applyBtn = document.getElementById('apply-substitution-btn') as HTMLButtonElement;
    if (applyBtn) {
      applyBtn.disabled = !this.dataPresets.selectedPresetId;
    }
  }

  /**
   * Handle preset select
   */
  private handlePresetSelect(): void {
    const select = document.getElementById('preset-select') as HTMLSelectElement;
    const selectedId = select.value;

    if (!this.dataPresets) return;

    this.dataPresets.selectedPresetId = selectedId || null;

    if (selectedId) {
      this.showPresetViewer(selectedId);
      this.hidePresetEditor();
    } else {
      this.hidePresetViewer();
      this.hidePresetEditor();
    }

    const editBtn = document.getElementById('edit-preset-btn') as HTMLButtonElement;
    if (editBtn) {
      editBtn.style.display = selectedId ? 'inline-block' : 'none';
    }

    const applyBtn = document.getElementById('apply-substitution-btn') as HTMLButtonElement;
    if (applyBtn) {
      applyBtn.disabled = !selectedId;
    }

    const exportBtn = document.getElementById('export-preset-btn') as HTMLButtonElement;
    if (exportBtn) {
      exportBtn.disabled = !selectedId;
    }
  }

  /**
   * Create new preset
   */
  private handleNewPreset(): void {
    const select = document.getElementById('preset-select') as HTMLSelectElement;
    select.value = '';
    this.dataPresets!.selectedPresetId = null;
    this.hidePresetViewer();
    this.showPresetEditor();
  }

  /**
   * Edit current preset
   */
  private handleEditPreset(): void {
    if (!this.dataPresets || !this.dataPresets.selectedPresetId) return;
    this.hidePresetViewer();
    this.showPresetEditor(this.dataPresets.selectedPresetId);
  }

  /**
   * Show preset viewer with group cards
   */
  private showPresetViewer(presetId: string): void {
    const viewer = document.getElementById('preset-viewer');
    if (!viewer) return;

    const preset = this.dataPresets!.presets.find(p => p.id === presetId);
    if (!preset) return;

    viewer.style.display = 'block';
    this.renderGroupCards(preset);
  }

  /**
   * Hide preset viewer
   */
  private hidePresetViewer(): void {
    const viewer = document.getElementById('preset-viewer');
    if (viewer) {
      viewer.style.display = 'none';
    }
  }

  /**
   * Render group cards
   */
  private renderGroupCards(preset: DataPreset): void {
    const container = document.getElementById('groups-cards-container');
    if (!container) return;

    container.innerHTML = '';

    if (preset.groups.length === 0) {
      container.innerHTML = '<p style="color: #999;">No groups yet. Click Edit to add groups.</p>';
      return;
    }

    for (const group of preset.groups) {
      const card = document.createElement('div');
      card.className = 'group-card';

      const cardTitle = document.createElement('div');
      cardTitle.className = 'group-card-title';
      cardTitle.textContent = group.name;

      const cardContent = document.createElement('div');
      cardContent.className = 'group-card-content';

      for (const key in group.values) {
        const row = document.createElement('div');
        row.className = 'group-card-row';

        const label = document.createElement('span');
        label.className = 'group-card-label';
        label.textContent = key + ':';

        const value = document.createElement('span');
        value.className = 'group-card-value';
        value.textContent = group.values[key];

        row.appendChild(label);
        row.appendChild(value);
        cardContent.appendChild(row);
      }

      card.appendChild(cardTitle);
      card.appendChild(cardContent);
      container.appendChild(card);
    }
  }

  /**
   * Show preset editor
   */
  private showPresetEditor(presetId?: string): void {
    const editor = document.getElementById('preset-editor');
    if (!editor) return;

    editor.style.display = 'block';

    if (presetId) {
      const preset = this.dataPresets!.presets.find(p => p.id === presetId);
      if (preset) {
        this.currentEditingPresetId = presetId;
        const nameInput = document.getElementById('preset-name') as HTMLInputElement;
        if (nameInput) nameInput.value = preset.name;

        const separatorInput = document.getElementById('multi-value-separator') as HTMLInputElement;
        if (separatorInput) separatorInput.value = preset.multiValueSeparator || ', ';

        this.renderFieldNames(preset.fieldNames || [], preset.defaultValues);
        this.renderGroupsWithSchema(preset.groups, preset.fieldNames || []);
      }
    } else {
      this.currentEditingPresetId = null;
      const nameInput = document.getElementById('preset-name') as HTMLInputElement;
      if (nameInput) nameInput.value = '';

      const separatorInput = document.getElementById('multi-value-separator') as HTMLInputElement;
      if (separatorInput) separatorInput.value = ', ';

      this.renderFieldNames(['name']);
      this.renderGroupsWithSchema([], ['name']);
    }

    const deleteBtn = document.getElementById('delete-preset-btn');
    if (deleteBtn) {
      if (!presetId || (presetId && presetId.startsWith('built-in-'))) {
        deleteBtn.style.display = 'none';
      } else {
        deleteBtn.style.display = 'inline-block';
      }
    }
  }

  /**
   * Hide preset editor
   */
  private hidePresetEditor(): void {
    const editor = document.getElementById('preset-editor');
    if (editor) {
      editor.style.display = 'none';
    }
    this.currentEditingPresetId = null;
  }

  /**
   * Render field names schema
   */
  private renderFieldNames(fieldNames: string[], defaultValues?: Record<string, string>): void {
    const container = document.getElementById('field-names-container');
    if (!container) return;

    container.innerHTML = '';

    if (fieldNames.length === 0) {
      fieldNames = ['name'];
    }

    for (const fieldName of fieldNames) {
      const defaultValue = defaultValues?.[fieldName] || '';
      this.addFieldNameUI(fieldName, defaultValue);
    }
  }

  /**
   * Add field name UI row
   */
  private addFieldNameUI(fieldName: string, defaultValue: string = ''): void {
    const container = document.getElementById('field-names-container');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'field-name-row';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'field-name-input';
    nameInput.placeholder = 'Field name (e.g., name)';
    nameInput.value = fieldName;
    nameInput.addEventListener('change', () => this.updateGroupsSchema());

    const defaultInput = document.createElement('input');
    defaultInput.type = 'text';
    defaultInput.className = 'field-default-input';
    defaultInput.placeholder = 'Default value (e.g., John)';
    defaultInput.value = defaultValue;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = '✕';
    removeBtn.type = 'button';
    removeBtn.addEventListener('click', () => {
      row.remove();
      this.updateGroupsSchema();
    });

    row.appendChild(nameInput);
    row.appendChild(defaultInput);
    row.appendChild(removeBtn);
    container.appendChild(row);
  }

  /**
   * Update groups schema when fields change
   */
  private updateGroupsSchema(): void {
    const fieldNames = this.getFieldNamesFromUI();
    const groups = this.getGroupsFromUI();
    this.renderGroupsWithSchema(groups, fieldNames);
  }

  /**
   * Get field names from UI
   */
  private getFieldNamesFromUI(): string[] {
    const inputs = document.querySelectorAll('.field-name-input') as NodeListOf<HTMLInputElement>;
    const names: string[] = [];
    inputs.forEach(input => {
      const val = input.value.trim();
      if (val) names.push(val);
    });
    return names;
  }

  /**
   * Get groups from UI
   */
  private getGroupsFromUI(): Array<{ id?: string; name: string; values: Record<string, string> }> {
    const groups: Array<{ id?: string; name: string; values: Record<string, string> }> = [];
    const groupDivs = document.querySelectorAll('.value-group');

    groupDivs.forEach(groupDiv => {
      const nameInput = groupDiv.querySelector('.group-name') as HTMLInputElement;
      const groupName = nameInput ? nameInput.value.trim() : '';
      const groupId = groupDiv.getAttribute('data-group-id') || undefined;

      const values: Record<string, string> = {};
      const valueInputs = groupDiv.querySelectorAll('.group-field-input') as NodeListOf<HTMLInputElement>;

      valueInputs.forEach(input => {
        const fieldName = input.getAttribute('data-field-name');
        if (fieldName) {
          values[fieldName] = input.value.trim();
        }
      });

      if (groupName) {
        groups.push({ id: groupId, name: groupName, values });
      }
    });

    return groups;
  }

  /**
   * Render groups with schema
   */
  private renderGroupsWithSchema(groups: Array<{ id?: string; name: string; values: Record<string, string> }>, fieldNames: string[]): void {
    const container = document.getElementById('preset-values-container');
    if (!container) return;

    container.innerHTML = '';

    if (groups.length === 0) {
      this.addGroupUI();
    } else {
      for (const group of groups) {
        this.addGroupUIWithSchema(group, fieldNames);
      }
    }
  }

  /**
   * Add group UI
   */
  private addGroupUI(): void {
    const fieldNames = this.getFieldNamesFromUI();
    this.addGroupUIWithSchema({ name: '', values: {} }, fieldNames);
  }

  /**
   * Add group UI with schema
   */
  private addGroupUIWithSchema(group: { id?: string; name: string; values: Record<string, string> }, fieldNames: string[]): void {
    const container = document.getElementById('preset-values-container');
    if (!container) return;

    const groupDiv = document.createElement('div');
    groupDiv.className = 'value-group';
    if (group.id) {
      groupDiv.setAttribute('data-group-id', group.id);
    }

    const header = document.createElement('div');
    header.className = 'group-header';

    const groupNameInput = document.createElement('input');
    groupNameInput.type = 'text';
    groupNameInput.className = 'group-name';
    groupNameInput.placeholder = 'Group Name (e.g., John Smith)';
    groupNameInput.value = group.name;

    const deleteGroupBtn = document.createElement('button');
    deleteGroupBtn.className = 'btn-secondary';
    deleteGroupBtn.textContent = '✕ Delete';
    deleteGroupBtn.type = 'button';
    deleteGroupBtn.addEventListener('click', () => groupDiv.remove());

    header.appendChild(groupNameInput);
    header.appendChild(deleteGroupBtn);

    const valuesContainer = document.createElement('div');
    valuesContainer.className = 'group-values-container';

    for (const fieldName of fieldNames) {
      const row = document.createElement('div');
      row.className = 'value-row';

      const label = document.createElement('label');
      label.className = 'field-label';
      label.textContent = fieldName + ':';

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'group-field-input';
      input.setAttribute('data-field-name', fieldName);
      input.placeholder = 'Value for ' + fieldName;
      input.value = group.values[fieldName] || '';

      row.appendChild(label);
      row.appendChild(input);
      valuesContainer.appendChild(row);
    }

    groupDiv.appendChild(header);
    groupDiv.appendChild(valuesContainer);
    container.appendChild(groupDiv);
  }

  /**
   * Save preset
   */
  private async handleSavePreset(): Promise<void> {
    const nameInput = document.getElementById('preset-name') as HTMLInputElement;
    const name = nameInput.value.trim();

    if (!name) {
      this.showNotification('Preset name is required', 'error');
      return;
    }

    const fieldNames = this.getFieldNamesFromUI();
    if (fieldNames.length === 0) {
      this.showNotification('Add at least one field name', 'error');
      return;
    }

    const separatorInput = document.getElementById('multi-value-separator') as HTMLInputElement;
    const separator = separatorInput ? separatorInput.value : ', ';

    const defaultValues: Record<string, string> = {};
    const fieldRows = document.querySelectorAll('.field-name-row');
    fieldRows.forEach(row => {
      const nameInput = row.querySelector('.field-name-input') as HTMLInputElement;
      const defaultInput = row.querySelector('.field-default-input') as HTMLInputElement;
      if (nameInput && defaultInput) {
        const fieldName = nameInput.value.trim();
        const defaultValue = defaultInput.value.trim();
        if (fieldName && defaultValue) {
          defaultValues[fieldName] = defaultValue;
        }
      }
    });

    const groups: ValueGroup[] = [];
    const groupDivs = document.querySelectorAll('.value-group');

    for (let i = 0; i < groupDivs.length; i++) {
      const groupDiv = groupDivs[i];
      const groupNameInput = groupDiv.querySelector('.group-name') as HTMLInputElement;
      const groupName = groupNameInput.value.trim();

      if (!groupName) {
        this.showNotification('All groups must have a name', 'error');
        return;
      }

      const values: Record<string, string> = {};
      const fieldInputs = groupDiv.querySelectorAll('.group-field-input') as NodeListOf<HTMLInputElement>;

      fieldInputs.forEach(input => {
        const fieldName = input.getAttribute('data-field-name');
        if (fieldName) {
          values[fieldName] = input.value.trim();
        }
      });

      groups.push({
        id: groupDiv.getAttribute('data-group-id') || generateUniqueId(),
        name: groupName,
        values: values,
      });
    }

    if (groups.length === 0) {
      this.showNotification('Add at least one group', 'error');
      return;
    }

    if (!this.dataPresets) return;

    if (this.currentEditingPresetId) {
      const preset = this.dataPresets.presets.find(p => p.id === this.currentEditingPresetId);
      if (preset) {
        preset.name = name;
        preset.version = 1;
        preset.fieldNames = fieldNames;
        preset.defaultValues = defaultValues;
        preset.multiValueSeparator = separator;
        preset.groups = groups;
        preset.updatedAt = Date.now();
      }
    } else {
      const newPreset: DataPreset = {
        id: generateUniqueId(),
        name: name,
        version: 1,
        fieldNames: fieldNames,
        defaultValues: defaultValues,
        multiValueSeparator: separator,
        groups: groups,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.dataPresets.presets.push(newPreset);
      this.dataPresets.selectedPresetId = newPreset.id;
    }

    this.dataPresets.lastUpdated = Date.now();
    sendToSandbox({
      type: 'save-data-presets',
      id: generateUniqueId(),
      settings: this.dataPresets,
    });

    this.renderPresetSelect();
    this.hidePresetEditor();

    if (this.dataPresets.selectedPresetId) {
      this.showPresetViewer(this.dataPresets.selectedPresetId);
    }

    this.showNotification('Preset saved', 'success');
  }

  /**
   * Delete preset
   */
  private async handleDeletePreset(): Promise<void> {
    if (!this.currentEditingPresetId || !this.dataPresets) return;

    if (this.currentEditingPresetId.startsWith('built-in-')) {
      this.showNotification('Cannot delete built-in preset', 'error');
      return;
    }

    if (!confirm('Delete this preset?')) return;

    this.dataPresets.presets = this.dataPresets.presets.filter(p => p.id !== this.currentEditingPresetId);

    if (this.dataPresets.selectedPresetId === this.currentEditingPresetId) {
      this.dataPresets.selectedPresetId = null;
    }

    this.dataPresets.lastUpdated = Date.now();

    sendToSandbox({
      type: 'save-data-presets',
      id: generateUniqueId(),
      settings: this.dataPresets,
    });

    this.renderPresetSelect();
    this.hidePresetEditor();
    this.showNotification('Preset deleted', 'success');
  }

  /**
   * Cancel editing
   */
  private handleCancelEdit(): void {
    this.hidePresetEditor();

    if (this.dataPresets && this.dataPresets.selectedPresetId) {
      this.showPresetViewer(this.dataPresets.selectedPresetId);
    }
  }

  /**
   * Apply substitution
   */
  private async handleApplySubstitution(): Promise<void> {
    if (!this.dataPresets || !this.dataPresets.selectedPresetId) {
      this.showNotification('Select a preset first', 'error');
      return;
    }

    sendToSandbox({
      type: 'apply-data-substitution',
      id: generateUniqueId(),
      presetId: this.dataPresets.selectedPresetId,
    });
  }

  /**
   * Export preset to JSON
   */
  private handleExportPreset(): void {
    if (!this.dataPresets || !this.dataPresets.selectedPresetId) return;

    const preset = this.dataPresets.presets.find(p => p.id === this.dataPresets!.selectedPresetId);
    if (!preset) return;

    const json = JSON.stringify(preset, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = preset.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '_preset.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.showNotification('Preset exported', 'success');
  }

  /**
   * Import preset from JSON
   */
  private handleImportPreset(): void {
    const input = document.getElementById('import-file-input') as HTMLInputElement;
    if (input) {
      input.click();
    }
  }

  /**
   * Handle file selected
   */
  private handleFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = e.target?.result as string;
        const importedPreset = JSON.parse(json) as DataPreset;

        if (!importedPreset.name || !importedPreset.groups || !importedPreset.fieldNames) {
          throw new Error('Invalid preset format');
        }

        importedPreset.id = generateUniqueId();
        importedPreset.createdAt = Date.now();
        importedPreset.updatedAt = Date.now();

        importedPreset.groups = importedPreset.groups.map(g => ({
          id: generateUniqueId(),
          name: g.name,
          values: g.values,
        }));

        if (this.dataPresets) {
          this.dataPresets.presets.push(importedPreset);
          this.dataPresets.selectedPresetId = importedPreset.id;
          this.dataPresets.lastUpdated = Date.now();

          sendToSandbox({
            type: 'save-data-presets',
            id: generateUniqueId(),
            settings: this.dataPresets,
          });

          this.renderPresetSelect();
          this.showPresetViewer(importedPreset.id);
          this.showNotification('Preset imported: ' + importedPreset.name, 'success');
        }
      } catch (error: any) {
        this.showNotification('Failed to import preset: ' + error.message, 'error');
      }

      input.value = '';
    };

    reader.readAsText(file);
  }

  /**
   * Handle substitution applied result
   */
  handleSubstitutionApplied(success: boolean, componentsProcessed?: number, groupsUsed?: number, nodesProcessed?: number, error?: string): void {
    if (success) {
      if (componentsProcessed !== undefined) {
        const text = 'Applied ' + groupsUsed + ' groups to ' + componentsProcessed + ' components';
        this.showNotification(text, 'success');
      } else {
        this.showNotification('Updated ' + nodesProcessed + ' text layers', 'success');
      }
    } else {
      this.showNotification(error || 'Failed to apply substitution', 'error');
    }
  }

  /**
   * Show notification (delegate to main UI)
   */
  private showNotification(message: string, level: 'info' | 'success' | 'error' | 'warning'): void {
    const event = new CustomEvent('show-notification', {
      detail: { message, level },
    });
    window.dispatchEvent(event);
  }
}
