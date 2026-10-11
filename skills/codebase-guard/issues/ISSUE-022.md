# ISSUE-022: Cross-Site Scripting (XSS) via Raw HTML Injection in Highlight Templates

## Title
Cross-Site Scripting (XSS) via Raw HTML Injection in Highlight Templates

## Description
Using raw HTML rendering directives (such as `v-html` or innerHTML) to display highlighted search matches can introduce Cross-Site Scripting (XSS) vulnerabilities. When search text comes from database fields or user inputs, naive replacement or styling wrappers preserve raw HTML characters instead of escaping them. All content characters must be HTML-escaped while only safe markup formatting tags (such as `<b>` or `<span>`) are dynamically injected around matching indices.

## Symptoms
* Security audits identifying unescaped database fields or user inputs rendered dynamically inside raw HTML templates.
* Execution of malicious HTML/JS payloads (such as `<script>` or `<img src=x onerror=...>` tags) stored in database text columns when displayed in lists or tables.

## Anti-Pattern
Preserving the original text string intact or using simple substring replacement that does not escape HTML characters before rendering:

```javascript
// Naive highlight wrapping that preserves original raw HTML entities
function getHighlightedText(target, keyword) {
  if (!keyword) return target;
  const matchIndex = target.indexOf(keyword);
  if (matchIndex === -1) return target;
  return target.replace(keyword, `<b>${keyword}</b>`);
}
```

```html
<!-- Rendering the unsanitized string using v-html -->
<span v-html="getHighlightedText(data.name, keyword)" />
```

## Working Fix / Mitigation
Implement character-by-character or tokenized HTML escaping, applying the formatting tag (`<b>`) specifically to matching indices:

```javascript
function escapeHtml(unsafe) {
  if (unsafe == null) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getHighlightedHtml(target, matchIndices) {
  if (!target) return "";
  if (!matchIndices || matchIndices.length === 0) {
    return escapeHtml(target);
  }

  const indexes = new Set(matchIndices);
  let result = "";
  let inBold = false;

  for (let i = 0; i < target.length; i++) {
    const char = target[i];
    const isMatched = indexes.has(i);

    if (isMatched && !inBold) {
      result += "<b>";
      inBold = true;
    } else if (!isMatched && inBold) {
      result += "</b>";
      inBold = false;
    }

    // Escape character safely
    if (char === "&") result += "&amp;";
    else if (char === "<") result += "&lt;";
    else if (char === ">") result += "&gt;";
    else if (char === '"') result += "&quot;";
    else if (char === "'") result += "&#039;";
    else result += char;
  }

  if (inBold) {
    result += "</b>";
  }

  return result;
}
```
