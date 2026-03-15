/* ===== Codeinsigh — computer-pov.js ===== */
/* Shows how the computer interprets selected C code at a lower level */
(() => {
  'use strict';

  // ── DOM refs ──────────────────────────────────────────────
  const tabCpov   = document.getElementById('tab-cpov');
  const tabAnalysis = document.getElementById('tab-analysis');
  const tabSim    = document.getElementById('tab-simulate');
  const panelBody = document.getElementById('panel-body');
  const simView   = document.getElementById('sim-view');
  const cpovView  = document.getElementById('cpov-view');

  // ── Tab integration ───────────────────────────────────────
  // Use the centralised switchTab exposed by simulator.js (window._switchTab).
  // We only need to handle the Computer POV tab click.

  tabCpov.addEventListener('click', () => {
    if (window._switchTab) {
      window._switchTab('cpov');
    }
    buildCpov(window._codeinsighSelectedText || '');
  });

  // ── Helpers ───────────────────────────────────────────────
  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function card(title, accentClass, bodyHTML) {
    return `
      <div class="insight-card cpov-card ${accentClass}">
        <div class="insight-card__label">${title}</div>
        <div class="cpov-card__body">${bodyHTML}</div>
      </div>`;
  }

  function bullets(arr) {
    return `<ul class="cpov-list">${arr.map(t => `<li>${t}</li>`).join('')}</ul>`;
  }

  // ── Pattern matching helpers ──────────────────────────────
  const TYPES = /^(?:int|char|float|double|long|short|unsigned|signed|void|bool|size_t)/;

  function stripComments(code) {
    return code
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*/g, '');
  }

  // ── Line-level interpretation ─────────────────────────────
  function interpretLine(raw) {
    const L = raw.trim();
    if (!L) return null;

    const result = { original: L, instructions: [], execModel: [], mem: [] };

    // ── Variable declaration with init: int x = expr; ──
    const varDecl = L.match(/^(?:const\s+)?(?:unsigned\s+|signed\s+)?(?:int|char|float|double|long|short|bool)\s+(\w+)\s*=\s*(.+?)\s*;$/);
    if (varDecl && !L.includes('*') && !L.includes('[')) {
      const [, nm, val] = varDecl;
      result.instructions = [
        `Allocate memory on the stack for integer variable <code>${esc(nm)}</code>`,
        `Evaluate expression <code>${esc(val)}</code>`,
        `Store the result into the memory location of <code>${esc(nm)}</code>`,
      ];
      result.execModel = [
        `CPU executes a MOV-style instruction`,
        `Right-hand side (<code>${esc(val)}</code>) is resolved first`,
        `Result is written to the stack address allocated for <code>${esc(nm)}</code>`,
      ];
      result.mem = [
        `<code>${esc(nm)}</code> → new stack slot`,
        `Initial value: <code>${esc(val.replace(/arr\[(\w+)\]/g, '*(arr+$1)'))}</code>`,
      ];
      return result;
    }

    // ── Array declaration: int arr[] = {…}; ──
    const arrDecl = L.match(/^(?:int|char|float|double)\s+(\w+)\s*\[\s*(\d*)\s*\]\s*=\s*\{([^}]+)\}/);
    if (arrDecl) {
      const [, nm, , vals] = arrDecl;
      const items = vals.split(',').map(v => v.trim());
      result.instructions = [
        `Allocate a contiguous block of memory for ${items.length} element${items.length > 1 ? 's' : ''} (array <code>${esc(nm)}</code>)`,
        `Store each element sequentially: <code>${items.map((v, i) => `${esc(nm)}[${i}]=${v}`).join(', ')}</code>`,
        `<code>${esc(nm)}</code> itself holds the address of the first element`,
      ];
      result.execModel = [
        `Array is laid out linearly in memory`,
        `Element at index <code>i</code> lives at address <code>${esc(nm)} + i × sizeof(element)</code>`,
      ];
      result.mem = items.map((v, i) => `<code>${esc(nm)}[${i}]</code> = ${v}  (addr: 0x${(0x100 + i * 4).toString(16).toUpperCase()})`);
      return result;
    }

    // ── Pointer declaration: int *p = &x; ──
    const ptrDecl = L.match(/^(?:int|char|float|double|void)\s+\*\s*(\w+)\s*=\s*&\s*(\w+)/);
    if (ptrDecl) {
      const [, ptr, target] = ptrDecl;
      result.instructions = [
        `Allocate a pointer variable <code>${esc(ptr)}</code> (size = address width, typically 8 bytes on 64-bit)`,
        `Take the address of <code>${esc(target)}</code> using the address-of operator <code>&</code>`,
        `Store that address into <code>${esc(ptr)}</code>`,
      ];
      result.execModel = [
        `<code>&${esc(target)}</code> resolves to the memory address of <code>${esc(target)}</code>`,
        `CPU writes that address value into the slot for <code>${esc(ptr)}</code>`,
        `Dereferencing: <code>*${esc(ptr)}</code> later = load from address stored in <code>${esc(ptr)}</code>`,
      ];
      result.mem = [
        `<code>${esc(ptr)}</code> → stores an address, not a value`,
        `<code>*${esc(ptr)}</code> → value at that address (same as <code>${esc(target)}</code>)`,
      ];
      return result;
    }

    // ── Array access in expression: arr[i] ──
    if (L.includes('[') && !L.match(/^(?:int|char|float|double|long|short)/)) {
      const arrAcc = L.match(/(\w+)\[(\w+|\d+)\]/);
      if (arrAcc) {
        const [, nm, idx] = arrAcc;
        result.instructions = [
          `Array subscript <code>${esc(nm)}[${esc(idx)}]</code> is pointer arithmetic: <code>*(${esc(nm)} + ${esc(idx)})</code>`,
          `Load base address of <code>${esc(nm)}</code>`,
          `Add offset <code>${esc(idx)} × sizeof(element)</code>`,
          `Dereference the resulting address to get the value`,
        ];
        result.execModel = [
          `Load value of index <code>${esc(idx)}</code> from register / memory`,
          `Multiply index by element size (e.g. 4 bytes for int)`,
          `Add to base address of array <code>${esc(nm)}</code>`,
          `Load content of that computed address`,
        ];
        result.mem = [
          `Base address of <code>${esc(nm)}</code>: 0x100 (conceptual)`,
          `Address of <code>${esc(nm)}[${esc(idx)}]</code>: 0x100 + ${esc(idx)} × 4`,
        ];
        return result;
      }
    }

    // ── Assignment: x = expr; ──
    const assign = L.match(/^(\w+)\s*=\s*(.+?)\s*;$/);
    if (assign && !TYPES.test(L)) {
      const [, lhs, rhs] = assign;
      result.instructions = [
        `Evaluate right-hand side: <code>${esc(rhs)}</code>`,
        `Write result into memory location of <code>${esc(lhs)}</code>`,
      ];
      result.execModel = [
        `ALU computes <code>${esc(rhs)}</code>`,
        `Store (STR/MOV) instruction writes result to address of <code>${esc(lhs)}</code>`,
      ];
      result.mem = [`<code>${esc(lhs)}</code> updated: old value overwritten with result of <code>${esc(rhs)}</code>`];
      return result;
    }

    // ── Comparison: if (a > b), if (arr[i] > max) ──
    const cmpExpr = L.match(/if\s*\((.+?)\)/);
    if (cmpExpr) {
      const expr = cmpExpr[1].trim();
      const ops = expr.match(/(.+?)\s*(>|<|>=|<=|==|!=)\s*(.+)/);
      result.instructions = [
        `Evaluate condition: <code>${esc(expr)}</code>`,
        ops ? `Load <code>${esc(ops[1].trim())}</code> into a register` : `Load left operand`,
        ops ? `Load <code>${esc(ops[3].trim())}</code> into a register` : `Load right operand`,
        `CPU performs CMP instruction (subtraction, discards result, sets flags)`,
        `Branch instruction checks flag register for the comparison result`,
      ];
      result.execModel = [
        `CMP sets CPU flags: Zero, Negative, Carry, Overflow`,
        ops ? `"${esc(ops[2])}" maps to flag check: ${flagCheck(ops[2])}` : `Flag check determines branch`,
        `If condition is true: execute the body block`,
        `If condition is false: skip to the next block / else branch`,
      ];
      result.mem = [
        ops ? `<code>${esc(ops[1].trim())}</code> and <code>${esc(ops[3].trim())}</code> are temporarily loaded into CPU registers` : `Operands loaded into registers`,
        `No memory is modified by the comparison itself`,
        `Only the CPU flag register is affected`,
      ];
      return result;
    }

    // ── For loop ──
    const forLoop = L.match(/^for\s*\(/);
    if (forLoop) {
      result.instructions = [
        `Initialise loop counter (runs once)`,
        `Check condition before each iteration (produces a boolean via CMP)`,
        `Execute loop body when condition is true`,
        `Run the update expression at the end of each iteration`,
        `Repeat condition test; exit when false`,
      ];
      result.execModel = [
        `CPU evaluates condition via CMP and a conditional jump (JGE / JL etc.)`,
        `Loop body is a block of instructions at a labelled address`,
        `Update expression modifies the counter (INC / ADD instruction)`,
        `A JMP instruction sends control back to the condition test`,
        `When condition is false, a conditional JMP exits the loop`,
      ];
      result.mem = [
        `Loop variable occupies a stack slot`,
        `Counter is incremented in-place each iteration`,
        `Loop body may read/write other stack or heap memory`,
      ];
      return result;
    }

    // ── Return statement ──
    const retStmt = L.match(/^return\s+(.+?)\s*;$/);
    if (retStmt) {
      const val = retStmt[1];
      result.instructions = [
        `Evaluate return value: <code>${esc(val)}</code>`,
        `Place result in the return-value register (e.g. EAX / RAX on x86)`,
        `Pop the current stack frame`,
        `Jump to the caller's next instruction`,
      ];
      result.execModel = [
        `RET instruction transfers control back to caller`,
        `Return value is passed in a dedicated CPU register`,
        `Stack pointer (RSP) is restored to caller's frame`,
      ];
      result.mem = [
        `Local variables on the stack are no longer valid after return`,
        `Return value is in register, not memory (unless struct return)`,
      ];
      return result;
    }

    // ── Function call ──
    const funcCall = L.match(/(\w+)\s*\(([^)]*)\)/);
    if (funcCall) {
      const [, fnName, args] = funcCall;
      const argList = args.split(',').map(a => a.trim()).filter(Boolean);
      result.instructions = [
        `Push arguments onto the stack or into argument registers: ${argList.map(a => `<code>${esc(a)}</code>`).join(', ') || 'none'}`,
        `Push return address onto stack`,
        `Jump to the address of function <code>${esc(fnName)}</code>`,
        `On return: retrieve result from return register`,
      ];
      result.execModel = [
        `CALL instruction saves next instruction address and jumps to <code>${esc(fnName)}</code>`,
        `Callee sets up its own stack frame`,
        `Arguments passed via registers (e.g. RDI, RSI, RDX on x86-64) or stack`,
        `RET in callee resumes execution here`,
      ];
      result.mem = [
        `New stack frame created for <code>${esc(fnName)}</code>`,
        `Arguments may be on stack or in registers`,
        `Caller's stack frame preserved across the call`,
      ];
      return result;
    }

    // ── Increment / decrement ──
    const incDec = L.match(/^(\w+)(\+\+|--)\s*;?$/);
    if (incDec) {
      const [, nm, op] = incDec;
      const dir = op === '++' ? 'increment' : 'decrement';
      result.instructions = [
        `Load current value of <code>${esc(nm)}</code> from memory`,
        `${dir.charAt(0).toUpperCase() + dir.slice(1)} value by 1 using the CPU's ${op === '++' ? 'INC' : 'DEC'} instruction`,
        `Write updated value back to <code>${esc(nm)}</code>`,
      ];
      result.execModel = [
        `${op === '++' ? 'INC' : 'DEC'} is a single instruction on x86`,
        `Reads, modifies, and writes in one operation (read-modify-write cycle)`,
      ];
      result.mem = [`<code>${esc(nm)}</code> updated: value ${op === '++' ? '+1' : '−1'}`];
      return result;
    }

    // ── Printf ──
    if (L.startsWith('printf')) {
      result.instructions = [
        `Call C standard library function <code>printf</code>`,
        `Arguments: format string address + value arguments`,
        `Library formats string and makes a system call (write) to stdout`,
      ];
      result.execModel = [
        `CALL printf → jumps into libc`,
        `libc internally calls the OS write() syscall`,
        `OS kernel writes the bytes to the terminal buffer`,
      ];
      result.mem = [
        `Format string lives in the read-only data section (.rodata)`,
        `printf uses a temporary internal buffer for formatting`,
      ];
      return result;
    }

    // ── Fallback ──
    result.instructions = [`Execute: <code>${esc(L)}</code>`];
    result.execModel   = [`CPU processes this statement sequentially`];
    result.mem         = [`Memory state may be modified depending on assignments`];
    return result;
  }

  function flagCheck(op) {
    const m = { '>': 'JG (jump if greater)', '<': 'JL (jump if less)', '>=': 'JGE', '<=': 'JLE', '==': 'JE (jump if equal)', '!=': 'JNE' };
    return m[op] || 'conditional jump';
  }

  // ── Memory perspective for whole snippet ─────────────────
  function buildMemPerspective(snippet) {
    const lines = snippet.split('\n').map(l => l.trim()).filter(Boolean);
    const vars = [], arrs = [], ptrs = [];

    for (const L of lines) {
      const arrD = L.match(/^(?:int|char|float|double)\s+(\w+)\s*\[\s*\d*\s*\]\s*=\s*\{([^}]+)\}/);
      if (arrD) { arrs.push({ nm: arrD[1], vals: arrD[2].split(',').map(v => v.trim()) }); continue; }

      const vD = L.match(/^(?:const\s+)?(?:unsigned\s+|signed\s+)?(?:int|char|float|double|long|short|bool)\s+(\w+)\s*(?:=\s*(.+?))?\s*;$/);
      if (vD && !L.includes('*') && !L.includes('[')) { vars.push({ nm: vD[1], val: vD[2] || '?' }); continue; }

      const pD = L.match(/^(?:int|char|float|double|void)\s+\*\s*(\w+)/);
      if (pD) ptrs.push({ nm: pD[1] });
    }

    const rows = [];
    let addr = 0x100;
    for (const { nm, vals } of arrs) {
      rows.push(`<div class="cpov-mem-group"><span class="cpov-mem-name">${esc(nm)}</span><span class="cpov-mem-addr">→ 0x${addr.toString(16).toUpperCase()}</span></div>`);
      vals.forEach((v, i) => {
        rows.push(`<div class="cpov-mem-row"><span class="cpov-mem-key">${esc(nm)}[${i}]</span><span class="cpov-mem-val">${esc(v)}</span><span class="cpov-mem-addr">0x${(addr + i * 4).toString(16).toUpperCase()}</span></div>`);
      });
      addr += vals.length * 4 + 16;
    }
    for (const { nm, val } of vars) {
      rows.push(`<div class="cpov-mem-group"><span class="cpov-mem-name">${esc(nm)}</span><span class="cpov-mem-addr">→ 0x${addr.toString(16).toUpperCase()}</span></div>`);
      rows.push(`<div class="cpov-mem-row"><span class="cpov-mem-key">value</span><span class="cpov-mem-val">${esc(val)}</span></div>`);
      addr += 4;
    }
    for (const { nm } of ptrs) {
      rows.push(`<div class="cpov-mem-group"><span class="cpov-mem-name">${esc(nm)} <span class="cpov-mem-badge">ptr</span></span><span class="cpov-mem-addr">→ 0x${addr.toString(16).toUpperCase()}</span></div>`);
      rows.push(`<div class="cpov-mem-row"><span class="cpov-mem-key">stores</span><span class="cpov-mem-val">address</span></div>`);
      addr += 8;
    }

    if (!rows.length) {
      rows.push('<div class="cpov-mem-row"><span class="cpov-mem-key" style="color:var(--text-muted);font-style:italic">No declarations in snippet</span></div>');
    }

    return rows.join('');
  }

  // ── Machine logic summary for whole snippet ───────────────
  function buildMachineLogic(snippet) {
    const tags = [];
    if (/\[/.test(snippet))          tags.push('accesses array memory via pointer arithmetic');
    if (/\*/.test(snippet))          tags.push('performs pointer dereferencing');
    if (/>|<|==|!=/.test(snippet))   tags.push('compares values using CPU flags');
    if (/=/.test(snippet) && !/==/.test(snippet)) tags.push('writes values to memory');
    if (/for\s*\(/.test(snippet))    tags.push('executes a loop with a conditional branch');
    if (/if\s*\(/.test(snippet))     tags.push('performs conditional branching');
    if (/\+\+|--/.test(snippet))     tags.push('increments or decrements a counter');
    if (/return/.test(snippet))      tags.push('transfers control back to the caller');
    if (/printf/.test(snippet))      tags.push('invokes a system-level write call via stdlib');
    if (/\w+\s*\(/.test(snippet))    tags.push('calls a function (stack frame created)');

    if (!tags.length) tags.push('performs sequential CPU operations');
    return tags;
  }

  // ── Main builder ─────────────────────────────────────────
  function buildCpov(snippet) {
    if (!snippet || snippet.trim().length < 2) {
      cpovView.innerHTML = '<div class="sim-empty">Select some code first — then click ⚙ Computer POV.</div>';
      return;
    }

    const clean = stripComments(snippet);
    const rawLines = clean.split('\n').filter(l => l.trim());

    // Section 1 — Instruction Breakdown
    const breakdownCards = rawLines.map(raw => {
      const info = interpretLine(raw);
      if (!info) return '';
      return `
        <div class="cpov-line-block">
          <div class="cpov-line-original"><span class="cpov-line-label">Line:</span><code>${esc(info.original)}</code></div>
          ${bullets(info.instructions)}
        </div>`;
    }).filter(Boolean).join('');

    const sec1 = card('Instruction Breakdown', 'cpov-card--instr', breakdownCards || '<em>No interpretable statements.</em>');

    // Section 2 — Execution Model
    const execRows = rawLines.map(raw => {
      const info = interpretLine(raw);
      if (!info || !info.execModel.length) return '';
      return `
        <div class="cpov-line-block">
          <div class="cpov-line-original"><span class="cpov-line-label">Op:</span><code>${esc(info.original)}</code></div>
          ${bullets(info.execModel)}
        </div>`;
    }).filter(Boolean).join('');

    const sec2 = card('Execution Model', 'cpov-card--exec', execRows || '<em>No operations found.</em>');

    // Section 3 — Memory Perspective
    const memHTML = `<div class="cpov-mem-table">${buildMemPerspective(clean)}</div>`;
    const sec3 = card('Memory Perspective', 'cpov-card--mem', memHTML);

    // Section 4 — Machine Logic Summary
    const logic = buildMachineLogic(clean);
    const sec4 = card('Machine Logic Summary', 'cpov-card--logic', bullets(logic));

    cpovView.innerHTML = sec1 + sec2 + sec3 + sec4;
  }
})();
