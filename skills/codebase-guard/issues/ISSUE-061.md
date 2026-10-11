# ISSUE-061: Interactive Icons Lacking Keyboard Accessibility and Semantics

## Title
Interactive Icons Lacking Keyboard Accessibility and Semantics

## Description
Custom interactive controls (such as inline clear/delete buttons, icons acting as triggers, or list items) must be fully accessible. If rendered using generic non-interactive HTML tags (like `<i>` or `<span>`), they lack keyboard focus (`tabindex="0"`), ARIA role semantics (`role="button"`), accessible labels (`aria-label`), and keydown handlers (listening to `Enter` and `Space` keys). This prevents screen reader users and keyboard-only users from interacting with them.

## Symptoms
* Interactive icons or buttons bypassed entirely during Tab key navigation.
* Screen readers failing to identify the presence, label, or role of clickable custom elements.
* Click events on icons not firing when keys (like Enter or Space) are pressed.

## Anti-Pattern
Clickable clear icon lacking focusability, semantics, and keyboard activation triggers:

```html
<span class="input-container">
  <i v-if="value" class="clear-icon" @click="value = ''" />
  <input v-model="value" />
</span>
```

## Working Fix / Mitigation
Wrap custom interactive elements with standard button components/tags, or add appropriate accessibility attributes and keydown activation handlers to generic tags:

```html
<span class="input-container">
  <i
    v-if="value"
    class="clear-icon"
    role="button"
    tabindex="0"
    aria-label="Clear input value"
    @click="value = ''"
    @keydown.enter.prevent="value = ''"
    @keydown.space.prevent="value = ''"
  />
  <input v-model="value" />
</span>
```

## Tags
`frontend`, `html`, `accessibility`, `clean-code`
