/* ===== Codeinsigh — deep-dive.js (Dive Deeper — Cinematic Causality) ===== */
(() => {
  'use strict';

  // ── State ──────────────────────────────────────────────
  let simSteps = [];
  let rawSnippetLines = [];
  let finalState = {};
  let finalArrays = {};
  let nodeIdCounter = 0;
  let currentRootNode = null;

  const SKIP = new Set([
    'int','char','float','double','long','short','void','unsigned','signed',
    'sizeof','true','false','NULL','if','else','for','while','return',
    'break','continue','do','switch','case','const','static','struct',
    'typedef','enum','union','extern','printf','scanf','strlen','malloc','free'
  ]);

  // ── SVG Icons (inline, no emoji) ───────────────────────
  const ICON = {
    target: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>`,
    unlock: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`,
    check: `<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    zap: `<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    arrow: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`,
  };

  // ── DOM Setup ──────────────────────────────────────────
  const overlay = document.getElementById('deep-dive-overlay');
  if (!overlay) return;

  overlay.innerHTML = `
    <div class="dd-header">
      <div class="dd-title">
        ${ICON.target}
        Dive Deeper
      </div>
      <button class="dd-close" id="dd-close">exit</button>
    </div>
    <div class="dd-layout">
      <div class="dd-pane--canvas" id="dd-canvas">
        <div class="dd-canvas-content" id="dd-tree-area"></div>
      </div>
      <div class="dd-controls-bar">
        <div class="dd-step-info">
          <span class="dd-step-counter" id="dd-step-counter">select a result to trace</span>
        </div>
        <div class="dd-slider-wrapper">
          <button class="dd-btn" id="dd-btn-reset">back to results</button>
        </div>
      </div>
      <div class="dd-pane--code">
        <div class="dd-code-block" id="dd-code-block"></div>
      </div>
    </div>
  `;

  const btnClose  = document.getElementById('dd-close');
  const treeArea  = document.getElementById('dd-tree-area');
  const codeBlock = document.getElementById('dd-code-block');
  const stepInfo  = document.getElementById('dd-step-counter');
  const btnReset  = document.getElementById('dd-btn-reset');

  const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  // ── Opener ─────────────────────────────────────────────
  window._openDeepDive = () => {
    const snippet  = window._codeinsighSelectedText || '';
    const fullCode = document.getElementById('code-editor').innerText || '';
    if (!snippet || snippet.length < 3) return;
    if (!window._simulateCode) return;

    const res = window._simulateCode(snippet, fullCode);
    if (!res || !res.steps || !res.steps.length) return;

    simSteps        = res.steps;
    rawSnippetLines = snippet.split('\n');
    finalState      = res.finalState || {};
    finalArrays     = res.arrays || {};
    nodeIdCounter   = 0;
    currentRootNode = null;

    renderCode();
    showResultPicker();
    overlay.classList.add('active');
    // Hide custom cursor while overlay is active
    const cc = document.getElementById('custom-cursor');
    if (cc) cc.style.display = 'none';
  };

  btnClose.addEventListener('click', () => {
    overlay.classList.remove('active');
    const cc = document.getElementById('custom-cursor');
    if (cc) cc.style.display = '';
  });
  btnReset.addEventListener('click', showResultPicker);

  // ============================================================
  //  1. CODE PANE
  // ============================================================
  function renderCode() {
    codeBlock.innerHTML = rawSnippetLines.map((line, i) =>
      `<div class="dd-line" id="dd-line-${i}">
         <span class="dd-line-num">${i + 1}</span>
         <span class="dd-line-code">${esc(line)}</span>
       </div>`
    ).join('');
  }

  function highlightCodeLine(li) {
    codeBlock.querySelectorAll('.dd-line').forEach(el => el.classList.remove('active'));
    if (li < 0) return;
    const el = document.getElementById(`dd-line-${li}`);
    if (el) { el.classList.add('active'); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  }

  // ============================================================
  //  2. RESULT PICKER — minimal rows, not cards
  // ============================================================
  function showResultPicker() {
    stepInfo.textContent = 'select a result to trace';
    highlightCodeLine(-1);
    currentRootNode = null;

    let html = '<div class="dd-picker">';
    html += '<div class="dd-picker-title">final results</div>';
    html += '<div class="dd-picker-sub">click any value to trace its origin</div>';

    const vars = Object.keys(finalState).filter(k => !k.startsWith('*'));
    if (vars.length) {
      html += '<div class="dd-picker-section"><div class="dd-picker-section-title">variables</div>';
      vars.forEach(name => {
        html += resultRow(name, finalState[name], 'var', name);
      });
      html += '</div>';
    }

    Object.keys(finalArrays).forEach(aName => {
      const arr = finalArrays[aName];
      const len = arr._len || 0;
      if (!len) return;
      html += `<div class="dd-picker-section"><div class="dd-picker-section-title">${esc(aName)}[]</div>`;
      for (let i = 0; i < len; i++) {
        html += resultRow(`${aName}[${i}]`, arr[i] !== undefined ? arr[i] : '?', 'arr', `${aName}|${i}`);
      }
      html += '</div>';
    });

    html += '</div>';
    treeArea.innerHTML = html;

    // Attach handlers
    treeArea.querySelectorAll('.dd-result-row').forEach(row => {
      row.addEventListener('click', (e) => {
        // Ripple
        const ripple = document.createElement('div');
        ripple.className = 'dd-ripple';
        const rect = row.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
        ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
        row.appendChild(ripple);
        ripple.addEventListener('animationend', () => ripple.remove());

        const key = row.dataset.key;
        const type = row.dataset.type;
        setTimeout(() => {
          if (type === 'var') {
            startTrace(key, finalState[key]);
          } else {
            const [aName, idx] = key.split('|');
            const i = parseInt(idx, 10);
            startTrace(`${aName}[${i}]`, finalArrays[aName][i]);
          }
        }, 150);
      });
    });
  }

  function resultRow(name, value, type, key) {
    const dots = '·'.repeat(30);
    return `<div class="dd-result-row" data-type="${type}" data-key="${esc(key)}">
              <span class="dd-result-name">${esc(name)}</span>
              <span class="dd-result-dots">${dots}</span>
              <span class="dd-result-val">${esc(String(value))}</span>
              <span class="dd-result-arrow">${ICON.arrow}</span>
            </div>`;
  }

  // ============================================================
  //  3. CAUSALITY ENGINE (unchanged logic)
  // ============================================================
  function findLastChange(varName, beforeIdx) {
    for (let i = beforeIdx; i >= 0; i--) {
      if (simSteps[i].changed.includes(varName)) return i;
      const m = varName.match(/^(\w+)\[\d+\]$/);
      if (m && simSteps[i].changed.includes(m[1])) return i;
    }
    return -1;
  }

  function stateBefore(si) { return si > 0 ? simSteps[si - 1].state : {}; }
  function arrsBefore(si)  { return si > 0 ? simSteps[si - 1].arrs : {}; }

  function extractReads(stepIdx) {
    const step = simSteps[stepIdx];
    const line = (step.line || '').trim();
    const prev = stateBefore(stepIdx);
    const pArrs = arrsBefore(stepIdx);
    const cur = step.state;
    const cArrs = step.arrs;
    const reads = [];
    const seen = new Set();
    const writtenVar = (step.changed && step.changed[0]) || '';

    function add(name, display, value, reason) {
      if (seen.has(display)) return;
      seen.add(display);
      reads.push({ name, display, value, reason });
    }

    let expr = '';
    let isCompound = false;

    const declM = line.match(/^(?:const\s+)?(?:unsigned\s+|signed\s+)?(?:int|char|float|double|long|short|bool)\s+\*?\s*(\w+)\s*=\s*(.+?)\s*;$/);
    if (declM) expr = declM[2];

    if (/\{.*\}/.test(line) && /\[\s*\d*\s*\]/.test(line)) return [];

    const arrAM = line.match(/^(\w+)\[(.+?)\]\s*=\s*(.+?)\s*;$/);
    if (!expr && arrAM) {
      expr = arrAM[3];
      const ix = arrAM[2].trim();
      if (/^[a-zA-Z_]\w*$/.test(ix) && !SKIP.has(ix)) {
        add(ix, ix, prev[ix] !== undefined ? prev[ix] : cur[ix], 'index');
      }
    }

    const compM = line.match(/^(\*?\w+)\s*([+\-*/%])=\s*(.+?)\s*;$/);
    if (!expr && compM) {
      expr = compM[3]; isCompound = true;
      add(compM[1], `${compM[1]} (prev)`, prev[compM[1]], `before ${compM[2]}=`);
    }

    const assM = line.match(/^(\*?\w+)\s*=\s*(.+?)\s*;$/);
    if (!expr && assM && !/^(?:int|char|float|double|long|short|unsigned|signed|const)\b/.test(line)) {
      expr = assM[2];
    }

    const incM = line.match(/^(\*?\w+)\s*(\+\+|--)\s*;?$/);
    if (incM) {
      add(incM[1], `${incM[1]} (prev)`, prev[incM[1]], `before ${incM[2]}`);
      return reads;
    }

    if (!expr) { const m = line.match(/if\s*\((.+?)\)\s*\{?\s*$/); if (m) expr = m[1]; }
    if (!expr) { const m = line.match(/^for\s*\(\s*(.+?)\s*;\s*(.+?)\s*;\s*(.+?)\s*\)/); if (m) expr = m[2]; }
    if (!expr) { const m = line.match(/^return\s+(.+?)\s*;$/); if (m) expr = m[1]; }

    if (expr) {
      const arrAcc = [...expr.matchAll(/(\w+)\[([^\]]+)\]/g)];
      for (const match of arrAcc) {
        const aName = match[1];
        const idxE = match[2].trim();
        if (SKIP.has(aName)) continue;
        let idxV = parseInt(idxE, 10);
        if (isNaN(idxV) && (prev[idxE] !== undefined || cur[idxE] !== undefined)) {
          idxV = prev[idxE] !== undefined ? prev[idxE] : cur[idxE];
          add(idxE, idxE, idxV, 'array index');
        }
        if (!isNaN(idxV)) {
          const ad = pArrs[aName] || cArrs[aName];
          add(`${aName}[${idxV}]`, `${aName}[${idxV}]`, ad ? ad[idxV] : '?', 'element read');
        }
      }

      const clean = expr.replace(/\w+\[[^\]]+\]/g, ' ');
      for (const m of clean.matchAll(/\b([a-zA-Z_]\w*)\b/g)) {
        const n = m[1];
        if (SKIP.has(n) || (n === writtenVar && !isCompound)) continue;
        const v = prev[n] !== undefined ? prev[n] : cur[n];
        if (v !== undefined) add(n, n, v, 'read in expression');
      }
    }

    if (stepIdx > 0 && (simSteps[stepIdx - 1].desc || '').includes('→ true')) {
      add('__cond__', 'condition', 'true', `gate: ${simSteps[stepIdx - 1].line.trim()}`);
    }

    return reads;
  }

  function isTerminalStep(si) {
    if (si < 0) return true;
    const line = (simSteps[si].line || '').trim();
    if (/\{.*\}/.test(line)) return true;
    if (/=\s*(-?\d+\.?\d*)\s*;$/.test(line)) return true;
    if (/for\s*\(\s*(?:int\s+)?\w+\s*=\s*(-?\d+)/.test(line) && simSteps[si].desc.startsWith('Init:')) return true;
    return false;
  }

  // ============================================================
  //  4. TREE RENDERING — dots + lines, no cards
  // ============================================================
  function startTrace(varName, value) {
    const lastStep = findLastChange(varName, simSteps.length - 1);
    currentRootNode = mkNode(varName, value, lastStep, 'final value', 0);
    renderTree();
    if (lastStep >= 0) {
      highlightCodeLine(simSteps[lastStep].li);
      stepInfo.textContent = `step ${lastStep + 1} / ${simSteps.length} — ${simSteps[lastStep].desc}`;
    }
  }

  function mkNode(varName, value, stepIdx, reason, depth) {
    return {
      id: 'n' + (nodeIdCounter++), varName, value, stepIdx, reason, depth,
      isTerminal: stepIdx < 0 || isTerminalStep(stepIdx),
      isCondition: varName === '__cond__',
      expanded: false, children: null
    };
  }

  function expandNode(node) {
    if (node.isTerminal || node.isCondition || node.stepIdx < 0 || node.expanded) return;
    const reads = extractReads(node.stepIdx);
    node.children = reads.map(r => {
      const cs = r.name === '__cond__' ? node.stepIdx - 1 : findLastChange(r.name, node.stepIdx - 1);
      return mkNode(r.display, r.value, cs, r.reason, node.depth + 1);
    });
    node.expanded = true;
  }

  function renderTree() {
    treeArea.innerHTML = '<div class="dd-tree">' + renderNodeHTML(currentRootNode) + '</div>';
    bindAll(currentRootNode);
  }

  function renderNodeHTML(node) {
    const term = node.isTerminal ? ' is-terminal' : '';
    const exp  = node.expanded ? ' is-expanded' : '';
    const cond = node.isCondition ? ' is-terminal' : '';
    const val  = node.value !== undefined && node.value !== null ? node.value : '?';

    let h = `<div class="dd-node${term}${exp}${cond}" data-nid="${node.id}">`;
    h += '<div class="dd-dot"></div>';
    h += `<div class="dd-node-info" data-nid="${node.id}">`;
    h += `<span class="dd-node-name">${esc(node.varName)}</span>`;
    h += `<span class="dd-node-eq">=</span>`;
    h += `<span class="dd-node-val">${esc(String(val))}</span>`;
    h += '</div>';
    h += `<div class="dd-node-meta">${esc(node.reason)}</div>`;

    if (node.isTerminal) {
      h += `<div class="dd-node-badge">${ICON.check} origin</div>`;
    } else if (node.isCondition) {
      h += `<div class="dd-node-badge">${ICON.zap} gate</div>`;
    } else if (!node.expanded) {
      h += `<div class="dd-node-action" data-nid="${node.id}">${ICON.unlock}</div>`;
    }

    if (node.expanded && node.children && node.children.length) {
      const multi = node.children.length > 1 ? ' multi' : '';
      h += `<div class="dd-node-children${multi}">`;
      if (node.children.length > 1) {
        h += '<div class="dd-hline" style="left:0;right:0;"></div>';
      }
      node.children.forEach(child => {
        h += `<div class="dd-child-wrapper dd-node-enter">${renderNodeHTML(child)}</div>`;
      });
      h += '</div>';
    }

    h += '</div>';
    return h;
  }

  function bindAll(node) {
    // Bind click on info text and action icon
    const infoEl = treeArea.querySelector(`.dd-node-info[data-nid="${node.id}"]`);
    const actEl  = treeArea.querySelector(`.dd-node-action[data-nid="${node.id}"]`);
    const nodeEl = treeArea.querySelector(`.dd-node[data-nid="${node.id}"]`);

    const handleClick = () => {
      // Focus
      treeArea.querySelectorAll('.dd-node.is-focused').forEach(n => n.classList.remove('is-focused'));
      if (nodeEl) nodeEl.classList.add('is-focused');

      if (node.stepIdx >= 0) {
        highlightCodeLine(simSteps[node.stepIdx].li);
        stepInfo.textContent = `step ${node.stepIdx + 1} / ${simSteps.length} — ${simSteps[node.stepIdx].desc}`;
      }

      // Expand
      if (!node.expanded && !node.isTerminal && !node.isCondition && node.stepIdx >= 0) {
        expandNode(node);
        if (actEl) actEl.remove();
        if (nodeEl && node.children && node.children.length) {
          nodeEl.classList.add('is-expanded');
          const multi = node.children.length > 1 ? ' multi' : '';
          let ch = `<div class="dd-node-children${multi}">`;
          if (node.children.length > 1) ch += '<div class="dd-hline" style="left:0;right:0;"></div>';
          node.children.forEach(c => {
            ch += `<div class="dd-child-wrapper dd-node-enter">${renderNodeHTML(c)}</div>`;
          });
          ch += '</div>';
          nodeEl.insertAdjacentHTML('beforeend', ch);
          node.children.forEach(c => bindAll(c));

          const childCont = nodeEl.querySelector('.dd-node-children');
          if (childCont) setTimeout(() => childCont.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 120);
        }
      }
    };

    if (infoEl) infoEl.addEventListener('click', handleClick);
    if (actEl) actEl.addEventListener('click', handleClick);

    if (node.children) node.children.forEach(c => bindAll(c));
  }

})();
