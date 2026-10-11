# ISSUE-017: Option-Value Mismatch in Persistent Dropdowns

## Description
Persisting a dropdown selection to local storage or application state and restoring it on mount without verifying if the value exists in the current dropdown's options list. If the stored value is not in the options list (which dynamically depends on context or user-specific data), the dropdown component falls back to displaying a default placeholder, but the underlying filter variable remains set to the invalid/missing value. This leads to a silent mismatch: the UI indicates that a default or unfiltered state is active, but the list is actually filtered by the missing stored value, producing an empty list with no explanation.

## Symptoms
- A dropdown filter displays "Current Year" or a default placeholder, but the data table is completely empty.
- Switching between entities (e.g., different users or products) causes tables to load empty because the previous entity's selection is still active but not visible in the dropdown UI.
- The UI fails to provide visual feedback about the active filter value.

## Anti-Pattern Code Blocks
```javascript
// Dropdown template
<Dropdown
  id="dropdown-filter"
  v-model="modelValue"
  :options="options"
  placeholder="Default Option"
/>

// Inside setup/script
const modelValue = ref("");
const storedValue = localStorage.getItem("selected-filter-key");
if (storedValue) {
  modelValue.value = storedValue; // Sets value to e.g., "2024-2025"
}

// options are loaded dynamically and may only contain ["", "2025-2026"]
// Since "2024-2025" is not in options, Dropdown shows "Default Option",
// but modelValue remains "2024-2025", filtering items to empty.
```

## Remediation Code Blocks
```javascript
// Option: Dynamically append the selected value to options if missing
const safeOptions = computed(() => {
  const opts = [...options.value];
  if (modelValue.value && !opts.some(opt => opt.value === modelValue.value)) {
    opts.push({
      label: modelValue.value,
      value: modelValue.value
    });
  }
  return opts;
});

<Dropdown
  id="dropdown-filter"
  v-model="modelValue"
  :options="safeOptions"
  placeholder="Default Option"
/>
```

## Tags
`local-storage`, `frontend`, `state-management`, `dropdown`, `user-experience`
