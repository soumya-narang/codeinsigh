/* ===== Codeinsigh — script.js ===== */
(() => {
  'use strict';

  // ------ DOM refs ------
  const editor = document.getElementById('code-editor');
  const lineNumbers = document.getElementById('line-numbers');
  const explainBtn = document.getElementById('explain-btn');
  const panel = document.getElementById('explanation-panel');
  const overlay = document.getElementById('panel-overlay');
  const panelClose = document.getElementById('panel-close');
  const panelBody = document.getElementById('panel-body');
  const panelSnippet = document.getElementById('panel-snippet');
  const codeArea = document.getElementById('code-area');
  const annotationLayer = document.getElementById('annotation-layer');
  const clearAnnotationsBtn = document.getElementById('clear-annotations');

  // ------ State ------
  let selectedText = '';

  // ============================================================
  //  1.  SYNTAX HIGHLIGHTING  (C language — token-based)
  // ============================================================

  const C_KEYWORDS = new Set([
    'auto', 'break', 'case', 'const', 'continue', 'default', 'do',
    'else', 'enum', 'extern', 'for', 'goto', 'if', 'inline',
    'register', 'restrict', 'return', 'sizeof',
    'static', 'struct', 'switch', 'typedef', 'union',
    'volatile', 'while', '_Bool', '_Complex', '_Imaginary'
  ]);

  const C_TYPES = new Set([
    'int', 'char', 'float', 'double', 'void', 'long', 'short', 'unsigned',
    'signed', 'size_t', 'FILE', 'NULL', 'bool', 'true', 'false'
  ]);

  // Tokeniser: yields { type, value } for each token
  function* tokenize(code) {
    let i = 0;
    const len = code.length;

    while (i < len) {
      // --- Multi-line comment ---
      if (code[i] === '/' && code[i + 1] === '*') {
        const end = code.indexOf('*/', i + 2);
        const stop = end === -1 ? len : end + 2;
        yield { type: 'comment', value: code.slice(i, stop) };
        i = stop;
        continue;
      }

      // --- Single-line comment ---
      if (code[i] === '/' && code[i + 1] === '/') {
        const end = code.indexOf('\n', i);
        const stop = end === -1 ? len : end;
        yield { type: 'comment', value: code.slice(i, stop) };
        i = stop;
        continue;
      }

      // --- Preprocessor directive (at start of line or after whitespace) ---
      if (code[i] === '#' && (i === 0 || code[i - 1] === '\n')) {
        const end = code.indexOf('\n', i);
        const stop = end === -1 ? len : end;
        yield { type: 'preproc', value: code.slice(i, stop) };
        i = stop;
        continue;
      }

      // --- String literal ---
      if (code[i] === '"') {
        let j = i + 1;
        while (j < len && code[j] !== '"') {
          if (code[j] === '\\') j++;
          j++;
        }
        j = Math.min(j + 1, len);
        yield { type: 'string', value: code.slice(i, j) };
        i = j;
        continue;
      }

      // --- Char literal ---
      if (code[i] === "'") {
        let j = i + 1;
        while (j < len && code[j] !== "'") {
          if (code[j] === '\\') j++;
          j++;
        }
        j = Math.min(j + 1, len);
        yield { type: 'string', value: code.slice(i, j) };
        i = j;
        continue;
      }

      // --- Numbers ---
      if (/[0-9]/.test(code[i]) || (code[i] === '.' && i + 1 < len && /[0-9]/.test(code[i + 1]))) {
        let j = i;
        if (code[j] === '0' && (code[j + 1] === 'x' || code[j + 1] === 'X')) {
          j += 2;
          while (j < len && /[0-9a-fA-F]/.test(code[j])) j++;
        } else {
          while (j < len && /[0-9]/.test(code[j])) j++;
          if (j < len && code[j] === '.') {
            j++;
            while (j < len && /[0-9]/.test(code[j])) j++;
          }
          if (j < len && (code[j] === 'e' || code[j] === 'E')) {
            j++;
            if (j < len && (code[j] === '+' || code[j] === '-')) j++;
            while (j < len && /[0-9]/.test(code[j])) j++;
          }
        }
        while (j < len && /[fFlLuU]/.test(code[j])) j++;
        yield { type: 'number', value: code.slice(i, j) };
        i = j;
        continue;
      }

      // --- Identifiers / keywords / types ---
      if (/[a-zA-Z_]/.test(code[i])) {
        let j = i;
        while (j < len && /[a-zA-Z0-9_]/.test(code[j])) j++;
        const word = code.slice(i, j);

        // Check if followed by '(' → function call
        let k = j;
        while (k < len && code[k] === ' ') k++;
        if (code[k] === '(' && !C_KEYWORDS.has(word)) {
          yield { type: 'function', value: word };
        } else if (C_KEYWORDS.has(word)) {
          yield { type: 'keyword', value: word };
        } else if (C_TYPES.has(word)) {
          yield { type: 'type', value: word };
        } else {
          yield { type: 'plain', value: word };
        }
        i = j;
        continue;
      }

      // --- Whitespace (including newlines) ---
      if (/\s/.test(code[i])) {
        let j = i;
        while (j < len && /\s/.test(code[j])) j++;
        yield { type: 'plain', value: code.slice(i, j) };
        i = j;
        continue;
      }

      // --- Punctuation / operators ---
      yield { type: 'plain', value: code[i] };
      i++;
    }
  }

  function escapeHTML(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  const TOKEN_CLASS = {
    comment: 'syn-comment',
    preproc: 'syn-preproc',
    string: 'syn-string',
    number: 'syn-number',
    keyword: 'syn-keyword',
    type: 'syn-type',
    function: 'syn-function',
  };

  function highlightC(code) {
    let html = '';
    for (const token of tokenize(code)) {
      const escaped = escapeHTML(token.value);
      const cls = TOKEN_CLASS[token.type];
      if (cls) {
        html += `<span class="${cls}">${escaped}</span>`;
      } else {
        html += escaped;
      }
    }
    return html;
  }

  // ------ Line numbers ------
  function updateLineNumbers() {
    const text = editor.innerText || '';
    const count = text.split('\n').length || 1;
    lineNumbers.innerHTML = Array.from(
      { length: count },
      (_, i) => `<span>${i + 1}</span>`
    ).join('');
  }

  // ------ Apply highlighting (preserving caret) ------
  function applyHighlighting() {
    const text = editor.innerText || '';
    const pos = saveCaretPosition(editor);
    editor.innerHTML = highlightC(text);
    restoreCaretPosition(editor, pos);
    updateLineNumbers();
  }

  // ============================================================
  //  2.  CARET HELPERS  (for contenteditable)
  // ============================================================

  function saveCaretPosition(el) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return 0;
    const range = sel.getRangeAt(0);
    const pre = range.cloneRange();
    pre.selectNodeContents(el);
    pre.setEnd(range.endContainer, range.endOffset);
    return pre.toString().length;
  }

  function restoreCaretPosition(el, pos) {
    const sel = window.getSelection();
    sel.removeAllRanges();
    const range = document.createRange();

    let charIndex = 0;
    const nodeStack = [el];
    let node, found = false;

    while ((node = nodeStack.pop())) {
      if (node.nodeType === Node.TEXT_NODE) {
        const nextIndex = charIndex + node.length;
        if (pos <= nextIndex) {
          range.setStart(node, pos - charIndex);
          range.collapse(true);
          found = true;
          break;
        }
        charIndex = nextIndex;
      } else {
        for (let i = node.childNodes.length - 1; i >= 0; i--) {
          nodeStack.push(node.childNodes[i]);
        }
      }
    }

    if (!found) {
      range.selectNodeContents(el);
      range.collapse(false);
    }
    sel.addRange(range);
  }

  // ============================================================
  //  3.  EDITOR INPUT HANDLING
  // ============================================================

  // Sync scroll between line numbers and code
  codeArea.addEventListener('scroll', () => {
    lineNumbers.style.transform = `translateY(${-codeArea.scrollTop}px)`;
  });

  // Handle paste — strip formatting
  editor.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, text);
  });

  // Re-highlight on input (debounced)
  let highlightTimer;
  editor.addEventListener('input', () => {
    clearTimeout(highlightTimer);
    highlightTimer = setTimeout(applyHighlighting, 200);
    updateLineNumbers();
  });

  // Tab key support
  editor.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      document.execCommand('insertText', false, '    ');
    }
  });

  // Initial line number
  updateLineNumbers();

  // ============================================================
  //  4.  SELECTION → FLOATING "EXPLAIN" BUTTON
  // ============================================================

  function showExplainButton() {
    const sel = window.getSelection();
    const text = sel.toString().trim();

    if (!text || text.length < 2) {
      explainBtn.classList.remove('visible');
      return;
    }

    // Only respond to selections inside the editor
    let node = sel.anchorNode;
    let insideEditor = false;
    while (node) {
      if (node === editor) { insideEditor = true; break; }
      node = node.parentNode;
    }
    if (!insideEditor) {
      explainBtn.classList.remove('visible');
      return;
    }

    selectedText = text;

    // Position the button near the end of the selection
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    explainBtn.style.top = `${window.scrollY + rect.bottom + 8}px`;
    explainBtn.style.left = `${window.scrollX + rect.left + rect.width / 2}px`;
    explainBtn.style.transform = 'translate(-50%, 0)';
    explainBtn.classList.add('visible');
  }

  // Listen for selection changes globally
  document.addEventListener('selectionchange', () => {
    // Small delay to let the selection settle
    setTimeout(showExplainButton, 50);
  });

  document.addEventListener('mouseup', () => {
    setTimeout(showExplainButton, 50);
  });

  // Hide button when clicking away (but not on the button itself)
  document.addEventListener('mousedown', (e) => {
    if (!explainBtn.contains(e.target)) {
      explainBtn.classList.remove('visible');
    }
  });

  // ============================================================
  //  5.  EXPLANATION PANEL
  // ============================================================

  // -- Placeholder insight data --
  const PLACEHOLDER_INSIGHT = {
    role: 'Iterates through an array to find and return the largest element.',
    concepts: [
      'Variable initialization',
      'Array indexing',
      'Loop traversal',
      'Conditional comparison',
      'Return value',
      'Pointer dereferencing'
    ],
    steps: [
      'Access the first element of the array',
      'Store it in the variable max as a baseline',
      'Loop through each remaining element',
      'Compare current element against max',
      'Update max if a larger value is found',
      'Return the final maximum value'
    ],
    mistakes: [
      'Starting the loop at index 0 instead of 1, comparing the element to itself',
      'Using >= instead of > which doesn\'t cause errors but adds unnecessary updates',
      'Not checking if the array is empty or size is 0 before accessing arr[0]',
      'Off-by-one error: using i <= size instead of i < size',
      'Passing a negative size value, causing undefined behaviour'
    ]
  };

  // ============================================================
  //  VARIABLE FLOW — detection, card, highlighting, scroll
  // ============================================================

  /**
   * Detect variables in the selected snippet by scanning for
   * type-identifier patterns and classifying each line where
   * the variable appears.
   */
  function detectVariables(snippet) {
    const lines = snippet.split('\n');
    // Phase 1 — find declared variable names
    const declaredVars = new Set();
    const typeTokens = new Set([...C_TYPES]);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) continue;
      // Match patterns like "int max", "int *arr", "int i = 1"
      const declMatch = trimmed.match(
        /^(?:const\s+)?(?:unsigned\s+|signed\s+|long\s+|short\s+)*(?:int|char|float|double|void|long|short|size_t|bool|FILE)\s+\*?\s*([a-zA-Z_]\w*)/);
      if (declMatch) {
        const varName = declMatch[1];
        // Skip function declarations (identifier followed by '(')
        const afterVar = trimmed.slice(trimmed.indexOf(varName) + varName.length).trim();
        if (afterVar.startsWith('(')) continue;
        declaredVars.add(varName);
      }

      // Also catch for-loop declarations: "for (int i = ...)"
      const forDeclMatch = trimmed.match(
        /for\s*\(\s*(?:int|char|float|double|long|short|unsigned|signed)\s+\*?\s*([a-zA-Z_]\w*)/);
      if (forDeclMatch) {
        declaredVars.add(forDeclMatch[1]);
      }
    }

    if (declaredVars.size === 0) {
      // Fallback: collect plain identifiers that appear more than once
      const freq = {};
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) continue;
        for (const tok of tokenize(trimmed)) {
          if (tok.type === 'plain' && /^[a-zA-Z_]\w*$/.test(tok.value)
              && !C_KEYWORDS.has(tok.value) && !C_TYPES.has(tok.value)) {
            freq[tok.value] = (freq[tok.value] || 0) + 1;
          }
        }
      }
      for (const [name, count] of Object.entries(freq)) {
        if (count >= 2) declaredVars.add(name);
      }
    }

    if (declaredVars.size === 0) return [];

    // Phase 2 — classify each occurrence
    const varMap = {};  // name → { init:[], mod:[], use:[] }
    for (const v of declaredVars) varMap[v] = { init: [], mod: [], use: [] };

    for (let idx = 0; idx < lines.length; idx++) {
      const raw = lines[idx];
      const trimmed = raw.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) continue;

      for (const varName of declaredVars) {
        // Does this line mention this variable?
        const varRegex = new RegExp('\\b' + varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
        if (!varRegex.test(trimmed)) continue;

        // Classify
        const isDeclLine = new RegExp(
          '^(?:const\\s+)?(?:unsigned\\s+|signed\\s+|long\\s+|short\\s+)*(?:int|char|float|double|void|long|short|size_t|bool|FILE)\\s+\\*?\\s*' +
          varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b'
        ).test(trimmed);

        // Check for "for (int i" pattern
        const isForInit = new RegExp(
          'for\\s*\\(\\s*(?:int|char|float|double)\\s+\\*?\\s*' +
          varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b'
        ).test(trimmed);

        const isModification = new RegExp(
          '(?:^|[;{\\s])' + varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
          '\\s*(?:=|\\+=|\\-=|\\*=|\\/=|%=|\\+\\+|\\-\\-)'
        ).test(trimmed) && !isDeclLine && !isForInit;

        if (isDeclLine || isForInit) {
          varMap[varName].init.push({ line: idx + 1, code: trimmed });
        } else if (isModification) {
          varMap[varName].mod.push({ line: idx + 1, code: trimmed });
        } else {
          varMap[varName].use.push({ line: idx + 1, code: trimmed });
        }
      }
    }

    // Convert to array, keep only variables with at least 2 total occurrences
    const result = [];
    for (const [name, cats] of Object.entries(varMap)) {
      const total = cats.init.length + cats.mod.length + cats.use.length;
      if (total >= 2) {
        result.push({ name, ...cats });
      }
    }
    return result;
  }

  /**
   * Build the HTML for the Variable Flow insight card.
   */
  function buildVariableFlowHTML(variables) {
    if (!variables.length) return '';

    const entryHTML = (label, entries) => {
      if (!entries.length) return '';
      return entries.map(e =>
        `<div class="var-flow-entry" data-var-line="${e.line}">
           <span class="var-flow-label var-flow-label--${label.toLowerCase()}">${label}</span>
           <code class="var-flow-code">${escapeHTML(e.code)}</code>
         </div>`
      ).join('');
    };

    const groups = variables.map(v => `
      <div class="var-flow-group">
        <span class="var-flow-var-name">${escapeHTML(v.name)}</span>
        ${entryHTML('Initialization', v.init)}
        ${entryHTML('Modification', v.mod)}
        ${entryHTML('Usage', v.use)}
      </div>
    `).join('');

    return `
      <div class="insight-card insight-card--variable-flow">
        <div class="insight-card__label">Variable Flow</div>
        ${groups}
      </div>`;
  }

  /**
   * Highlight every occurrence of the given variable names inside
   * the editor with a soft pastel <mark>.
   */
  function highlightVariableOccurrences(varNames) {
    clearVariableHighlights();
    if (!varNames.length) return;

    const text = editor.innerText || '';
    const pos = saveCaretPosition(editor);

    // Build a regex matching any of the variable names as whole words
    const escaped = varNames.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const combinedRegex = new RegExp('\\b(' + escaped.join('|') + ')\\b', 'g');

    // Re-highlight the code first
    let html = highlightC(text);

    // Now wrap variable occurrences — we must be careful not to
    // replace inside HTML tags or existing span attributes.
    // Strategy: split by HTML tags, process only text nodes.
    const parts = html.split(/(<[^>]+>)/);
    for (let i = 0; i < parts.length; i++) {
      // Skip HTML tags
      if (parts[i].startsWith('<')) continue;
      parts[i] = parts[i].replace(combinedRegex,
        '<mark class="var-highlight">$1</mark>');
    }
    editor.innerHTML = parts.join('');
    restoreCaretPosition(editor, pos);
  }

  function clearVariableHighlights() {
    const marks = editor.querySelectorAll('mark.var-highlight');
    if (!marks.length) return;
    marks.forEach(mark => {
      const parent = mark.parentNode;
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
      parent.removeChild(mark);
    });
  }

  /**
   * Given a line number (1-indexed, relative to the snippet's position
   * within the editor), scroll the editor so the line is visible and
   * flash-highlight it.
   */
  function scrollToEditorLine(lineNum) {
    const style = window.getComputedStyle(editor);
    const lineHeight = parseFloat(style.lineHeight) || (parseFloat(style.fontSize) * 1.7);
    const paddingTop = parseFloat(style.paddingTop) || 16;

    // Account for snippet's position within the full editor content
    const snippetStartLine = getCurrentSnippetStartLine();
    const absoluteLine = snippetStartLine + lineNum - 1;

    const targetY = paddingTop + (absoluteLine - 1) * lineHeight;

    codeArea.scrollTo({
      top: Math.max(0, targetY - codeArea.clientHeight / 3),
      behavior: 'smooth'
    });

    // Flash the line
    const flashEl = document.createElement('div');
    flashEl.className = 'var-line-flash';
    flashEl.style.top = `${targetY}px`;
    flashEl.style.height = `${lineHeight}px`;
    annotationLayer.appendChild(flashEl);
    flashEl.addEventListener('animationend', () => flashEl.remove());
  }

  /** Track the snippet start line for scroll-to-line mapping. */
  let _snippetStartLine = 1;
  function getCurrentSnippetStartLine() { return _snippetStartLine; }

  function detectSnippetStartLine() {
    const fullText = editor.innerText || '';
    const idx = fullText.indexOf(selectedText);
    if (idx <= 0) return 1;
    return fullText.substring(0, idx).split('\n').length;
  }

  function openPanel() {
    panelSnippet.textContent = selectedText;

    const roleHTML = `
      <div class="insight-card insight-card--role">
        <div class="insight-card__label">Quick Role</div>
        <div class="insight-card__role-text">${PLACEHOLDER_INSIGHT.role}</div>
      </div>`;

    const conceptsHTML = `
      <div class="insight-card insight-card--concepts">
        <div class="insight-card__label">Concepts Detected</div>
        <div class="concept-chips">
          ${PLACEHOLDER_INSIGHT.concepts.map(c => `<span class="concept-chip">${c}</span>`).join('')}
        </div>
      </div>`;

    const stepsHTML = `
      <div class="insight-card insight-card--steps">
        <div class="insight-card__label">Execution Steps</div>
        <ol class="step-list">
          ${PLACEHOLDER_INSIGHT.steps.map(s => `<li class="step-list__item">${s}</li>`).join('')}
        </ol>
      </div>`;

    const mistakesHTML = `
      <div class="insight-card insight-card--mistakes">
        <div class="insight-card__label">Possible Mistakes</div>
        <ul class="mistake-list">
          ${PLACEHOLDER_INSIGHT.mistakes.map(m => `<li class="mistake-list__item">${m}</li>`).join('')}
        </ul>
      </div>`;

    // --- Variable Flow ---
    const detectedVars = detectVariables(selectedText);
    const variableFlowHTML = buildVariableFlowHTML(detectedVars);

    panelBody.innerHTML = roleHTML + conceptsHTML + stepsHTML + mistakesHTML + variableFlowHTML;

    // Highlight variable occurrences in the editor
    if (detectedVars.length) {
      _snippetStartLine = detectSnippetStartLine();
      highlightVariableOccurrences(detectedVars.map(v => v.name));
    }

    // Render inline annotations for the selected lines
    const lineRange = getSelectedLineRange();
    if (lineRange) {
      renderAnnotations(lineRange.startLine, lineRange.endLine);
    }

    panel.classList.add('open');
    overlay.classList.add('open');
    explainBtn.classList.remove('visible');
  }

  function closePanel() {
    panel.classList.remove('open');
    overlay.classList.remove('open');
    clearVariableHighlights();
  }

  explainBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Show loading state briefly
    const originalText = explainBtn.textContent;
    explainBtn.textContent = 'Analyzing snippet\u2026';
    explainBtn.classList.add('loading');

    setTimeout(() => {
      explainBtn.textContent = originalText;
      explainBtn.classList.remove('loading');
      openPanel();
    }, 600);
  });

  panelClose.addEventListener('click', closePanel);
  overlay.addEventListener('click', closePanel);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePanel();
  });

  // ============================================================
  //  6.  INLINE ANNOTATIONS
  // ============================================================

  // Placeholder annotations keyed by trimmed line content patterns
  const LINE_ANNOTATIONS = {
    '#include <stdio.h>': 'standard I/O library',
    '#include <stdlib.h>': 'standard utility library',
    'int find_max(int *arr, int size) {': 'function definition',
    'int max = arr[0];': 'starting value for comparison',
    'for (int i = 1; i < size; i++) {': 'iterate remaining elements',
    'if (arr[i] > max) {': 'check for larger value',
    'max = arr[i];': 'update maximum',
    'return max;': 'return result',
    'int main() {': 'program entry point',
    'int numbers[] = {12, 45, 7, 23, 56, 89, 34};': 'sample dataset',
    'int length = sizeof(numbers) / sizeof(numbers[0]);': 'calculate array length',
    'int result = find_max(numbers, length);': 'call find_max',
    'printf("Maximum value: %d\\n", result);': 'print result to console',
    'return 0;': 'successful exit',
  };

  /**
   * Detect which 1-indexed line numbers fall within the current selection.
   */
  function getSelectedLineRange() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return null;

    const range = sel.getRangeAt(0);
    const fullText = editor.innerText || '';
    const lines = fullText.split('\n');

    // Calculate character offsets of the selection within the editor
    const preRange = document.createRange();
    preRange.selectNodeContents(editor);
    preRange.setEnd(range.startContainer, range.startOffset);
    const startOffset = preRange.toString().length;

    const preRange2 = document.createRange();
    preRange2.selectNodeContents(editor);
    preRange2.setEnd(range.endContainer, range.endOffset);
    const endOffset = preRange2.toString().length;

    // Map character offsets to line numbers
    let charCount = 0;
    let startLine = 1, endLine = 1;
    for (let i = 0; i < lines.length; i++) {
      const lineEnd = charCount + lines[i].length;
      if (charCount <= startOffset && startOffset <= lineEnd) startLine = i + 1;
      if (charCount <= endOffset && endOffset <= lineEnd) endLine = i + 1;
      charCount = lineEnd + 1; // +1 for newline
    }
    return { startLine, endLine };
  }

  /**
   * Render annotation bubbles for lines within the given range.
   */
  function renderAnnotations(startLine, endLine) {
    const fullText = editor.innerText || '';
    const lines = fullText.split('\n');

    // Compute line height from the editor's computed style
    const style = window.getComputedStyle(editor);
    const lineHeight = parseFloat(style.lineHeight) || (parseFloat(style.fontSize) * 1.7);
    const paddingTop = parseFloat(style.paddingTop) || 16;

    for (let i = startLine - 1; i < endLine && i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (!trimmed) continue; // skip blank lines

      // Look up annotation text
      const note = LINE_ANNOTATIONS[trimmed];
      if (!note) continue;

      // Check if this line already has an annotation
      const lineNum = i + 1;
      if (annotationLayer.querySelector(`[data-line="${lineNum}"]`)) continue;

      const bubble = document.createElement('div');
      bubble.className = 'annotation-bubble';
      bubble.setAttribute('data-line', lineNum);
      bubble.style.top = `${paddingTop + i * lineHeight + (lineHeight - 20) / 2}px`;
      // stagger animation
      bubble.style.animationDelay = `${(i - startLine + 1) * 0.06}s`;

      const textSpan = document.createElement('span');
      textSpan.textContent = note;
      bubble.appendChild(textSpan);

      const dismiss = document.createElement('button');
      dismiss.className = 'annotation-bubble__dismiss';
      dismiss.innerHTML = '\u00d7';
      dismiss.title = 'Dismiss';
      dismiss.addEventListener('click', () => {
        bubble.remove();
        updateClearBtnVisibility();
      });
      bubble.appendChild(dismiss);

      annotationLayer.appendChild(bubble);
    }

    updateClearBtnVisibility();
  }

  function clearAnnotations() {
    annotationLayer.innerHTML = '';
    updateClearBtnVisibility();
  }

  function updateClearBtnVisibility() {
    if (annotationLayer.children.length > 0) {
      clearAnnotationsBtn.classList.add('visible');
    } else {
      clearAnnotationsBtn.classList.remove('visible');
    }
  }

  clearAnnotationsBtn.addEventListener('click', clearAnnotations);

  // ============================================================
  //  VARIABLE FLOW — hover-to-scroll delegation
  // ============================================================
  panelBody.addEventListener('mouseenter', (e) => {
    const entry = e.target.closest('.var-flow-entry[data-var-line]');
    if (!entry) return;
    const lineNum = parseInt(entry.getAttribute('data-var-line'), 10);
    if (lineNum) scrollToEditorLine(lineNum);
  }, true);

  // ============================================================
  //  7.  SAMPLE CODE (preloaded for demo)
  // ============================================================

  const SAMPLE_CODE = `#include <stdio.h>
#include <stdlib.h>

// Finds the maximum value in an array
int find_max(int *arr, int size) {
    int max = arr[0];
    for (int i = 1; i < size; i++) {
        if (arr[i] > max) {
            max = arr[i];
        }
    }
    return max;
}

int main() {
    int numbers[] = {12, 45, 7, 23, 56, 89, 34};
    int length = sizeof(numbers) / sizeof(numbers[0]);

    int result = find_max(numbers, length);
    printf("Maximum value: %d\\n", result);

    return 0;
}`;

  editor.innerText = SAMPLE_CODE;
  applyHighlighting();
})();
