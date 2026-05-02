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
      (_, i) => `<div class="ln">${i + 1}</div>`
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

  // Line numbers scroll naturally with code (both are children of code-area)

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
  //  4.  SELECTION → AUTO-TRIGGER ANALYSIS
  // ============================================================

  let _autoTriggerTimer = null;
  const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

  function tryAutoTrigger() {
    // Don't re-trigger if the panel is already open
    if (panel.classList.contains('open')) return;

    const sel = window.getSelection();
    const text = sel.toString().trim();

    if (!text || text.length < 2) return;

    // Only respond to selections inside the editor
    let node = sel.anchorNode;
    let insideEditor = false;
    while (node) {
      if (node === editor) { insideEditor = true; break; }
      node = node.parentNode;
    }
    if (!insideEditor) return;

    selectedText = text;

    // Brief delay so the selection feels settled before the panel appears
    clearTimeout(_autoTriggerTimer);
    _autoTriggerTimer = setTimeout(openPanel, 400);
  }

  // ---- Mobile: touchend-based trigger ----
  // On real mobile devices, selectionchange fires too frequently during
  // keyboard open/viewport resize, causing debounce timers to never fire.
  // Instead, we use touchend (fires once when finger lifts) with a generous
  // delay to let the selection fully settle.

  if (isTouchDevice) {
    let _lastTapTime = 0;

    function checkMobileSelection() {
      if (panel.classList.contains('open')) return;

      const sel = window.getSelection();
      const text = sel.toString().trim();
      if (!text || text.length < 2) return;

      // Verify selection is inside editor
      let node = sel.anchorNode;
      let insideEditor = false;
      while (node) {
        if (node === editor) { insideEditor = true; break; }
        node = node.parentNode;
      }
      if (!insideEditor) return;

      selectedText = text;

      // Open panel first so it can read the native selection ranges
      openPanel();

      // Blur to dismiss the keyboard synchronously
      if (document.activeElement && document.activeElement !== document.body) {
        document.activeElement.blur();
      }
      editor.blur();
    }

    // Touchend catches taps and double taps
    document.addEventListener('touchend', (e) => {
      // Skip touches on the panel, overlay, or close button
      if (panel.contains(e.target) || overlay === e.target) return;

      const now = Date.now();
      if (now - _lastTapTime < 400) {
        // --- Double-Tap Detected ---
        if (panel.classList.contains('open')) {
          e.preventDefault(); // Stop zoom
          closePanel();
        } else {
          // If panel is closed, check if they double-tapped to trigger analysis.
          // We wait 50ms so the OS can finalize its own native text selection.
          setTimeout(checkMobileSelection, 50);
        }
        _lastTapTime = 0;
      } else {
        _lastTapTime = now;
      }
    });
  }

  // Trigger analysis when the user finishes selecting (desktop — mouse)
  document.addEventListener('mouseup', () => {
    // On pure touch interactions, mouseup may fire synthetically — but
    // tryAutoTrigger's guards (panel open check, selection length) prevent issues.
    setTimeout(tryAutoTrigger, 80);
  });

  // Also support keyboard selection (Shift+Arrow, Ctrl+Shift+End, etc.)
  editor.addEventListener('keyup', (e) => {
    if (e.shiftKey) {
      setTimeout(tryAutoTrigger, 80);
    }
  });

  // ============================================================
  //  5.  EXPLANATION PANEL
  // ============================================================

  // -- Dynamic Insight Generator --
  function analyzeSnippet(code) {
    const lines = code.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//'));
    if (!lines.length) {
      return { role: 'Empty sequence.', concepts: ['None'], steps: ['No executable code found.'], mistakes: ['None'] };
    }

    let role = 'Executes a sequence of C statements.';
    if (code.includes('for') || code.includes('while')) {
      role = 'Iterates through elements or repeats operations until a condition is met.';
    } else if (code.includes('if')) {
      role = 'Evaluates conditions to branch the flow of execution.';
    } else if (code.includes('*') || code.includes('&')) {
      role = 'Manipulates variables and memory addresses directly via pointers.';
    } else if (code.includes('+') || code.includes('-') || code.includes('/') || code.includes('*')) {
      role = 'Performs mathematical or logical operations calculations.';
    }

    const concepts = new Set();
    if (/(int|float|char|double|long)\s+/.test(code)) concepts.add('Variable declaration');
    if (code.includes('[')) concepts.add('Array indexing');
    if (code.includes('for') || code.includes('while')) concepts.add('Loop traversal');
    if (code.includes('if') || code.includes('else') || code.includes('==') || code.includes('>') || code.includes('<')) concepts.add('Conditional logic');
    if (code.includes('return')) concepts.add('Function return');
    if (code.includes('*') || code.includes('&')) concepts.add('Pointers and memory');
    if (code.includes('printf') || code.includes('scanf')) concepts.add('I/O operations');
    if (concepts.size === 0) concepts.add('Basic sequential execution');

    const steps = [];
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (l.startsWith('if') || l.startsWith('else if')) steps.push('Evaluate condition to determine execution path.');
      else if (l.startsWith('else')) steps.push('Execute fallback logic if conditions are false.');
      else if (l.startsWith('for') || l.startsWith('while')) steps.push('Begin repeating structure based on a condition.');
      else if (l.startsWith('return')) steps.push('Return a calculated value and exit scope.');
      else if (l.includes('=') && !l.includes('==')) steps.push('Assign or update variable state.');
      else if (l.includes('printf')) steps.push('Print formatted output to console.');
      else if (/(int|float|char|double|long)\s+/.test(l)) steps.push('Allocate memory for variable declaration.');
      else steps.push('Execute standard functional statement.');
    }

    const mistakes = new Set();
    if (code.includes('while')) mistakes.add('Creating an infinite loop if the exit condition is never met.');
    if (code.includes('[')) mistakes.add('Out-of-bounds array access (indexing beyond allocated size).');
    if (code.includes('*') || code.includes('&')) mistakes.add('Dereferencing a null pointer, uninitialized pointer, or out-of-scope address.');
    if (code.includes('/')) mistakes.add('Division by zero resulting in process crash or undefined behavior.');
    if (/(int|float|char|double)\s+[a-zA-Z_]\w*\s*;/.test(code)) mistakes.add('Using a variable before properly initializing its value.');
    if (code.includes('=') && !code.includes('==') && code.includes('if')) mistakes.add('Using assignment (=) instead of comparison (==) inside conditional checks.');
    if (code.includes('for')) mistakes.add('Off-by-one errors in loop boundaries (e.g. using <= instead of <).');
    if (mistakes.size === 0) mistakes.add('Syntax errors like missing semicolons or mismatched braces.');

    return {
      role,
      concepts: Array.from(concepts).slice(0, 6),
      steps,
      mistakes: Array.from(mistakes).slice(0, 5)
    };
  }

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

  // ============================================================
  //  MEMORY VIEW — pointer detection & diagram
  // ============================================================

  /**
   * Scan the snippet for pointer-related patterns and build
   * a data model suitable for rendering a memory diagram.
   *
   * Returns { variables: [...], pointers: [...], links: [...] }
   *   variable = { name, type, value, addr }
   *   pointer  = { name, type, target, addr }
   *   link     = { from (pointer name), to (variable name) }
   *
   * Returns null if no pointer concepts are detected.
   */
  function detectPointers(snippet) {
    const lines = snippet.split('\n');
    const variables = [];   // regular variables that pointers point to
    const pointers  = [];   // pointer variables
    const links     = [];   // from → to
    const seenVars  = {};   // name → index into variables[]
    const seenPtrs  = {};   // name → index into pointers[]

    let addrCounter = 0x100;
    const nextAddr = () => '0x' + (addrCounter++).toString(16).toUpperCase();

    // First pass — collect regular variable declarations
    for (const line of lines) {
      const t = line.trim();
      if (!t || t.startsWith('//') || t.startsWith('#')) continue;

      // int x = 5;   char c = 'A'; etc. (non-pointer)
      const varDecl = t.match(
        /^(?:const\s+)?(?:unsigned\s+|signed\s+)?(?:int|char|float|double|long|short)\s+([a-zA-Z_]\w*)\s*=\s*([^;]+);/);
      if (varDecl && !t.includes('*')) {
        const name = varDecl[1];
        const value = varDecl[2].trim();
        if (!(name in seenVars)) {
          seenVars[name] = variables.length;
          variables.push({ name, type: 'variable', value, addr: nextAddr() });
        }
      }

      // int arr[] = {...};  — array declaration
      const arrDecl = t.match(
        /^(?:int|char|float|double)\s+([a-zA-Z_]\w*)\s*\[/);
      if (arrDecl && !t.includes('*')) {
        const name = arrDecl[1];
        if (!(name in seenVars)) {
          const valMatch = t.match(/=\s*\{([^}]*)\}/);
          const value = valMatch ? '{' + valMatch[1].trim() + '}' : 'array';
          seenVars[name] = variables.length;
          variables.push({ name, type: 'array', value, addr: nextAddr() });
        }
      }
    }

    // Second pass — collect pointer declarations & relationships
    for (const line of lines) {
      const t = line.trim();
      if (!t || t.startsWith('//') || t.startsWith('#')) continue;

      // int *p = &x;
      const ptrDecl = t.match(
        /^(?:const\s+)?(?:unsigned\s+|signed\s+)?(?:int|char|float|double|long|short|void)\s+\*\s*([a-zA-Z_]\w*)\s*=\s*&\s*([a-zA-Z_]\w*)/);
      if (ptrDecl) {
        const pName = ptrDecl[1];
        const target = ptrDecl[2];
        // Ensure target variable exists
        if (!(target in seenVars)) {
          seenVars[target] = variables.length;
          variables.push({ name: target, type: 'variable', value: '?', addr: nextAddr() });
        }
        if (!(pName in seenPtrs)) {
          seenPtrs[pName] = pointers.length;
          pointers.push({ name: pName, target, addr: nextAddr(), targetAddr: variables[seenVars[target]].addr });
          links.push({ from: pName, to: target });
        }
        continue;
      }

      // int *p = arr;  or   int *p = numbers;
      const ptrArr = t.match(
        /^(?:const\s+)?(?:int|char|float|double|void)\s+\*\s*([a-zA-Z_]\w*)\s*=\s*([a-zA-Z_]\w+)\s*;/);
      if (ptrArr) {
        const pName = ptrArr[1];
        const target = ptrArr[2];
        if (target in seenVars && !(pName in seenPtrs)) {
          seenPtrs[pName] = pointers.length;
          pointers.push({ name: pName, target, addr: nextAddr(), targetAddr: variables[seenVars[target]].addr });
          links.push({ from: pName, to: target });
        }
        continue;
      }

      // Function parameter: int *arr   (inside function signature)
      const paramPtr = t.match(
        /(?:int|char|float|double|void)\s+\*\s*([a-zA-Z_]\w*)\s*[,)]/);
      if (paramPtr) {
        const pName = paramPtr[1];
        if (!(pName in seenPtrs)) {
          seenPtrs[pName] = pointers.length;
          pointers.push({ name: pName, target: null, addr: nextAddr(), targetAddr: null });
        }
      }

      // p = &x;  (reassignment)
      const ptrReassign = t.match(
        /^([a-zA-Z_]\w*)\s*=\s*&\s*([a-zA-Z_]\w*)\s*;/);
      if (ptrReassign && ptrReassign[1] in seenPtrs) {
        const pName = ptrReassign[1];
        const target = ptrReassign[2];
        if (!(target in seenVars)) {
          seenVars[target] = variables.length;
          variables.push({ name: target, type: 'variable', value: '?', addr: nextAddr() });
        }
        // Update pointer target
        pointers[seenPtrs[pName]].target = target;
        pointers[seenPtrs[pName]].targetAddr = variables[seenVars[target]].addr;
        links.push({ from: pName, to: target });
      }
    }

    // Only return if we actually found pointer concepts
    if (pointers.length === 0) return null;

    return { variables, pointers, links };
  }

  /**
   * Build the HTML for the Memory View diagram card.
   */
  function buildMemoryViewHTML(memData) {
    if (!memData) return '';

    function unknownVal() {
      return '<em class="mem-unknown">&mdash;</em>';
    }

    function renderCard(name, badge, rows) {
      const badgeHTML = badge ? ` <span class="mem-cell__ptr-badge">${escapeHTML(badge)}</span>` : '';
      const rowsHTML = rows.map(r =>
        `<div class="mem-cell__row"><span class="mem-cell__key">${r.label}</span><span class="${r.cls || 'mem-cell__val'}">${r.value}</span></div>`
      ).join('');
      return `
        <div class="mem-cell" data-mem-name="${escapeHTML(name)}">
          <div class="mem-cell__name">${escapeHTML(name)}${badgeHTML}</div>
          ${rowsHTML}
        </div>`;
    }

    const varCards = memData.variables.map(v => {
      const typeStr = v.type || 'int';
      const valStr = (v.value !== undefined && v.value !== null && v.value !== '?') ? escapeHTML(String(v.value)) : unknownVal();
      return renderCard(v.name, null, [
        { label: 'type', value: typeStr },
        { label: 'value', value: valStr },
        { label: 'addr', value: v.addr || unknownVal(), cls: 'mem-cell__addr' },
      ]);
    }).join('');

    const ptrCards = memData.pointers.map(p => {
      const storedVal = p.targetAddr || unknownVal();
      const targetInfo = p.target ? ` → ${escapeHTML(p.target)}` : '';
      return renderCard(p.name, 'ptr', [
        { label: 'type', value: 'pointer' },
        { label: 'stores', value: storedVal + targetInfo, cls: 'mem-cell__addr' },
        { label: 'addr', value: p.addr || unknownVal(), cls: 'mem-cell__addr' },
      ]);
    }).join('');

    const arrowsHTML = memData.links.map(link => `
      <div class="mem-arrow" data-from="${escapeHTML(link.from)}" data-to="${escapeHTML(link.to)}">
        <span class="mem-arrow__from">${escapeHTML(link.from)}</span>
        <span class="mem-arrow__line">──▶</span>
        <span class="mem-arrow__to">${escapeHTML(link.to)}</span>
      </div>
    `).join('');

    return `
      <div class="insight-card insight-card--memory">
        <div class="insight-card__label">Memory View</div>
        <div class="mem-diagram">
          <div class="mem-cells">
            ${varCards}
            ${ptrCards}
          </div>
          ${arrowsHTML ? `<div class="mem-arrows">${arrowsHTML}</div>` : ''}
        </div>
      </div>`;
  }

  function openPanel() {
    panelSnippet.textContent = selectedText;
    window._codeinsighSelectedText = selectedText;

    const insight = analyzeSnippet(selectedText);

    const roleHTML = `
      <div class="insight-card insight-card--role">
        <div class="insight-card__label">Quick Role</div>
        <div class="insight-card__role-text">${insight.role}</div>
      </div>`;

    const conceptsHTML = `
      <div class="insight-card insight-card--concepts">
        <div class="insight-card__label">Concepts Detected</div>
        <div class="concept-chips">
          ${insight.concepts.map(c => `<span class="concept-chip">${c}</span>`).join('')}
        </div>
      </div>`;

    const visibleSteps = insight.steps.slice(0, 6);
    const hiddenSteps = insight.steps.slice(6);
    const stepsHTML = `
      <div class="insight-card insight-card--steps">
        <div class="insight-card__label">Execution Steps</div>
        <ol class="step-list" id="step-list-ol">
          ${visibleSteps.map(s => `<li class="step-list__item">${s}</li>`).join('')}
          ${hiddenSteps.length ? `<li class="step-list__item step-list__item--more" id="step-expand-trigger">Show ${hiddenSteps.length} more steps</li>` : ''}
          ${hiddenSteps.map(s => `<li class="step-list__item step-list__item--hidden" style="display:none">${s}</li>`).join('')}
        </ol>
      </div>`;

    const mistakesHTML = `
      <div class="insight-card insight-card--mistakes">
        <div class="insight-card__label">Possible Mistakes</div>
        <ul class="mistake-list">
          ${insight.mistakes.map(m => `<li class="mistake-list__item">${m}</li>`).join('')}
        </ul>
      </div>`;

    // --- Variable Flow ---
    const detectedVars = detectVariables(selectedText);
    const variableFlowHTML = buildVariableFlowHTML(detectedVars);

    // --- Memory View (pointers) ---
    const memData = detectPointers(selectedText);
    const memoryViewHTML = buildMemoryViewHTML(memData);

    const diveDeeperHTML = `
      <div class="insight-card insight-card--dive-deeper" style="border-color: var(--accent-edge); cursor: pointer; transition: all 0.2s ease; margin-top: 1.5rem;" onclick="if(window._openDeepDive) window._openDeepDive()" onmouseover="this.style.background='var(--accent-dim)'; this.style.borderColor='var(--accent)';" onmouseout="this.style.background='transparent'; this.style.borderColor='var(--accent-edge)';">
        <div class="insight-card__label" style="color: var(--accent); display: flex; align-items: center; gap: 0.5rem; justify-content: center; font-size: 0.95rem; margin-bottom: 0;">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
          Dive Deeper
        </div>
      </div>`;

    panelBody.innerHTML = roleHTML + conceptsHTML + stepsHTML + mistakesHTML + variableFlowHTML + memoryViewHTML + diveDeeperHTML;

    // "Show X more steps" — expand on click
    const expandTrigger = document.getElementById('step-expand-trigger');
    if (expandTrigger) {
      expandTrigger.addEventListener('click', function() {
        const hiddenItems = panelBody.querySelectorAll('.step-list__item--hidden');
        hiddenItems.forEach(el => { el.style.display = ''; el.classList.remove('step-list__item--hidden'); });
        this.remove();
      });
    }

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
  }

  function closePanel() {
    panel.classList.remove('open');
    overlay.classList.remove('open');
    clearVariableHighlights();
  }

  // (Analyze button removed — analysis auto-triggers on selection)

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
    if (!clearAnnotationsBtn) return;
    if (annotationLayer.children.length > 0) {
      clearAnnotationsBtn.classList.add('visible');
    } else {
      clearAnnotationsBtn.classList.remove('visible');
    }
  }

  if (clearAnnotationsBtn) clearAnnotationsBtn.addEventListener('click', clearAnnotations);

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

  // ============================================================
  //  8.  SCROLL-LINKED CINEMATIC TRANSITION (real-time progress)
  // ============================================================
  
  const aboutSection = document.querySelector('.about-section');
  const aboutContainer = document.querySelector('.about-container');
  const aboutTitle = document.querySelector('.about-title');

  // --- Typewriter (still runs once, but now triggered after enough scroll) ---
  const TITLE_TEXT = "Understand Code, Not Just Run It";
  let titleTyped = false;
  if (aboutTitle) aboutTitle.textContent = '';

  function runTypewriter() {
    if (titleTyped) return;
    titleTyped = true;
    let i = 0;
    aboutTitle.classList.add('is-typing');
    function tick() {
      if (i < TITLE_TEXT.length) {
        aboutTitle.textContent += TITLE_TEXT.charAt(i++);
        setTimeout(tick, 28 + Math.random() * 24);
      } else {
        setTimeout(() => aboutTitle.classList.remove('is-typing'), 700);
      }
    }
    tick();
  }

  // --- Hex color interpolation helpers ---
  function hexToRgb(hex) {
    // Handle both #rrggbb and rgba(r,g,b,a) strings gracefully
    if (hex.startsWith('rgba') || hex.startsWith('rgb')) return null;
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return [r, g, b];
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  function lerpColor(hexA, hexB, t) {
    const cA = hexToRgb(hexA);
    const cB = hexToRgb(hexB);
    if (!cA || !cB) return t < 0.5 ? hexA : hexB;
    const r = Math.round(lerp(cA[0], cB[0], t));
    const g = Math.round(lerp(cA[1], cB[1], t));
    const b = Math.round(lerp(cA[2], cB[2], t));
    return `rgb(${r},${g},${b})`;
  }

  // --- Theme color definitions ---
  // These match directly with :root and [data-theme="dark"] in style.css
  const LIGHT_THEME = {
    bg:        '#fff5f8',
    text:      '#4a148c',
    textMuted: '#7b1fa2',
  };
  const DARK_THEME = {
    bg:        '#04141c',
    text:      '#cfd8dc',
    textMuted: '#78909c',
  };

  function easeInOut(t) {
    // Smooth cubic easing
    return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3) / 2;
  }

  if (aboutSection && aboutContainer) {
    // Set initial hidden state
    aboutContainer.style.opacity = '0';
    aboutContainer.style.transform = 'translateY(110px) scale(0.90)';
    aboutContainer.style.transition = 'none'; // JS-driven, no CSS transition

    let ticking = false;

    function updateTransition() {
      const sectionTop = aboutSection.getBoundingClientRect().top;
      const winH = window.innerHeight;

      // Progress: 0 when section top is at bottom of viewport, 1 when at top of viewport
      const rawProgress = 1 - (sectionTop / winH);
      // Clamp to [0, 1]
      const progress = Math.min(1, Math.max(0, rawProgress));
      const eased = easeInOut(progress);

      // Is current theme dark?
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

      // Start color = current theme bg, End color = inverted theme bg
      const startBg   = isDark ? DARK_THEME.bg        : LIGHT_THEME.bg;
      const endBg     = isDark ? LIGHT_THEME.bg       : DARK_THEME.bg;
      const startText = isDark ? DARK_THEME.text       : LIGHT_THEME.text;
      const endText   = isDark ? LIGHT_THEME.text      : DARK_THEME.text;
      const startMuted = isDark ? DARK_THEME.textMuted : LIGHT_THEME.textMuted;
      const endMuted   = isDark ? LIGHT_THEME.textMuted : DARK_THEME.textMuted;

      // Interpolate colors
      const bgColor   = lerpColor(startBg,    endBg,    eased);
      const textColor = lerpColor(startText,  endText,  eased);
      const mutedColor = lerpColor(startMuted, endMuted, eased);

      aboutSection.style.backgroundColor = bgColor;
      aboutSection.style.color = textColor;

      // Apply text color to all text children (title, intro, items)
      aboutSection.querySelectorAll('.about-title, .about-subtitle, .about-benefits li, .about-steps li').forEach(el => {
        el.style.color = textColor;
      });
      aboutSection.querySelectorAll('.about-intro, .about-benefits li::before').forEach(el => {
        el.style.color = mutedColor;
      });

      // Animate container: fade and rise from 0.4 progress onwards
      const contentProgress = Math.min(1, Math.max(0, (progress - 0.2) / 0.6));
      const contentEased = easeInOut(contentProgress);
      const translateY = 110 * (1 - contentEased);
      const scale     = 0.90 + 0.10 * contentEased;
      const opacity   = contentEased;

      aboutContainer.style.opacity = String(opacity);
      aboutContainer.style.transform = `translateY(${translateY}px) scale(${scale})`;

      // Trigger typewriter when content is mostly visible
      if (contentProgress > 0.5 && !titleTyped) {
        runTypewriter();
      }

      ticking = false;
    }

    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(updateTransition);
        ticking = true;
      }
    }, { passive: true });

    // Run once on load in case section is partially visible
    updateTransition();
  }

})();
