# ISSUE-019: Synthetic Composite ID Delimiter Collisions and Property Loss in UI Normalization

## Description
Failing to use unambiguous delimiters when constructing synthetic composite identifiers (e.g., concatenating an item ID with an index number) can cause parsing failures. If the delimiter (like a hyphen `-`) is also a valid character in the source identifier (such as a UUID), parsing logic that splits or slices from the boundary will truncate the original ID and result in invalid data transmission.

Additionally, UI list selectors or dropdown wrapper components often rebuild and normalize option arrays to a fixed schema (e.g., matching only `id` and `label`). If they strip out custom properties, parent views will lose context (such as index numbers) upon selection. To handle this cleanly, the wrapper mappings must explicitly preserve the custom properties so they can be read directly from the selected objects without brittle parsing.

Finally, defaulting missing optional properties to empty strings (`""`) instead of `null` causes template-level conditional statements (like `v-if="val != null"`) to execute the truthy branch, rendering empty UI elements or blank tables.

## Symptoms
- Truncated or malformed database IDs (especially UUIDs) sent in mutation payloads due to simple hyphen splitting of composite IDs.
- Custom selector state fields (like index numbers) resolving to `undefined` because wrapper normalization logic dropped them from the option object schema.
- UI elements, table rows, or buttons rendering blank or showing loading states indefinitely because computed fields defaulted to `""` instead of `null`.

## Anti-Pattern Code Blocks
```javascript
// 1. Brittle composite ID building and parsing
const compositeId = `${item.id}-${subIndex}`;
const rawId = compositeId.split('-')[0]; // Breaks if item.id is a UUID like "a1-b2-c3"

// 2. Dropping custom properties during mapping/normalization
const normalizedList = props.items.map(x => ({
  id: x.id,
  label: x.label
  // subIndex property is dropped here!
}));

// 3. Returning empty strings for optional properties, breaking conditional UI rendering
const displayLabel = computed(() => {
  if (!data.value) return "";
  return data.value.label ?? "";
});
```

## Remediation Code Blocks
```javascript
// 1. Unambiguous composite ID delimiter
const compositeId = `${item.id}__marker__${subIndex}`;
const rawId = (() => {
  const idx = compositeId.lastIndexOf("__marker__");
  return idx !== -1 ? compositeId.slice(0, idx) : compositeId;
})();

// 2. Explicitly preserving custom properties in normalizers
const normalizedList = props.items.map(x => ({
  id: x.id,
  label: x.label,
  subIndex: x.subIndex // Preserved!
}));

// 3. Returning null for missing optional properties
const displayLabel = computed(() => {
  if (!data.value) return null;
  return data.value.label ?? null;
});
```

## Tags
`frontend`, `state-management`, `serialization`, `null-safety`, `clean-code`
