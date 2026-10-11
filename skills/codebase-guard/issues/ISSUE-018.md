# ISSUE-018: Hardcoded DOM IDs in Reusable Components

## Description
Hardcoding `id` attributes inside reusable components or components rendered multiple times on the same page. This violates HTML specifications requiring DOM IDs to be unique within a document. Duplicate IDs break HTML label-input association (clicking a label focuses the wrong input), screen readers, and automated testing tools.

## Symptoms
- Multiple elements with the same `id` are present in the DOM simultaneously.
- Clicking a form label focuses an input in a different section of the page (e.g., behind a modal or dialog) instead of the input directly next to the label.
- End-to-end testing scripts target the wrong element when query selecting by ID.

## Anti-Pattern Code Blocks
```html
<!-- Inside reusable component MyInput.vue -->
<template>
  <div>
    <label for="custom-input">Input Label</label>
    <input id="custom-input" v-model="value" />
  </div>
</template>
```

## Remediation Code Blocks
```html
<!-- Accept a dynamic id prop falling back to a unique key -->
<script setup>
const props = defineProps({
  id: String,
  storageKey: {
    type: String,
    required: true
  }
});
</script>

<template>
  <div>
    <label :for="id ?? storageKey">Input Label</label>
    <input :id="id ?? storageKey" v-model="value" />
  </div>
</template>
```

## Tags
`html`, `accessibility`, `frontend`, `clean-code`, `duplicate-id`
