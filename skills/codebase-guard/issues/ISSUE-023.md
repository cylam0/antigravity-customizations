# ISSUE-023: Globally Scoped Deep CSS Styling Bleed on General Tag Selectors

## Title
Globally Scoped Deep CSS Styling Bleed on General Tag Selectors

## Description
When overriding styles of child components using Vue scoped styles, styling rules using raw tag selectors (like `b`, `span`, or `div`) inside deep selectors (like `:deep(b)` or `::v-deep b`) will bleed and match *all* instances of that tag selector inside the component hierarchy. This overrides standard elements layout-wide or dialog-wide. To prevent styling bleed, deep selectors must always target specific custom CSS classes wrapper tags.

## Symptoms
* Standard bold text (`<b>`), spans, or paragraphs elsewhere in a modal, dialog, or page-level component rendering with unintended colors, font weights, or margins.
* Layout styling breaking when adding unrelated UI elements containing standard formatting tags.

## Anti-Pattern
Applying a deep CSS selector directly on a general HTML tag:

```css
<style scoped>
/* BLEEDS: Affects every <b> tag rendered within this dialog or any child component */
:deep(b) {
  color: #ff9800;
  font-weight: bold;
}
</style>
```

## Working Fix / Mitigation
Wrap the target formatted text template inside a classed parent element, and restrict the deep selector scope to that class:

```html
<!-- Wrap in a class-specific container -->
<template #body="{ data }">
  <span class="search-highlight" v-html="getHighlightedText(data)" />
</template>
```

```css
<style scoped>
/* SAFE: Restricts style overrides strictly to bold tags within search-highlight */
:deep(.search-highlight b) {
  color: #ff9800;
  font-weight: bold;
}
</style>
```
