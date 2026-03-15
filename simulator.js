/* ===== Codeinsigh — simulator.js v2 ===== */
/* C Code Simulator: panel-integrated with Analysis/Simulate tabs */
(() => {
  'use strict';

  // ---- DOM refs ----
  const editor      = document.getElementById('code-editor');
  const codeArea    = document.getElementById('code-area');
  const annotLayer  = document.getElementById('annotation-layer');

  const tabAnalysis = document.getElementById('tab-analysis');
  const tabSimulate = document.getElementById('tab-simulate');
  const panelBody   = document.getElementById('panel-body');
  const simView     = document.getElementById('sim-view');
  const simBody     = document.getElementById('sim-body');

  const simPrev     = document.getElementById('sim-prev');
  const simNext     = document.getElementById('sim-next');
  const simRun      = document.getElementById('sim-run');
  const simPause    = document.getElementById('sim-pause');
  const simSkipLoop = document.getElementById('sim-skip-loop');
  const simProgress = document.getElementById('sim-progress-bar');

  // ============================================================
  //  1. EXPRESSION EVALUATOR
  // ============================================================

  function simEval(expr, state, arrays) {
    expr = expr.trim();
    if (!expr) return 0;
    const toks = [];
    let i = 0;
    while (i < expr.length) {
      if (/\s/.test(expr[i])) { i++; continue; }
      const two = expr.substr(i, 2);
      if (['++','--','<=','>=','==','!=','&&','||','+=','-=','*=','/='].includes(two)) {
        toks.push({ t:'op', v:two }); i += 2; continue;
      }
      if (/\d/.test(expr[i])) {
        let n = '';
        while (i < expr.length && /[\d.]/.test(expr[i])) n += expr[i++];
        while (i < expr.length && /[fFlLuU]/.test(expr[i])) i++;
        toks.push({ t:'num', v:parseFloat(n) }); continue;
      }
      if (/[a-zA-Z_]/.test(expr[i])) {
        let id = '';
        while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i])) id += expr[i++];
        toks.push({ t:'id', v:id }); continue;
      }
      toks.push({ t:'op', v:expr[i] }); i++;
    }
    let pos = 0;
    const peek = () => toks[pos];
    const take = () => toks[pos++];
    function pOr() { let l = pAnd(); while (peek()?.v==='||') { take(); l = (l||pAnd())?1:0; } return l; }
    function pAnd() { let l = pCmp(); while (peek()?.v==='&&') { take(); l = (l&&pCmp())?1:0; } return l; }
    function pCmp() {
      let l = pAdd(); const ops=['<','>','<=','>=','==','!='];
      while (peek()&&ops.includes(peek().v)) {
        const op=take().v, r=pAdd();
        switch(op){case'<':l=l<r?1:0;break;case'>':l=l>r?1:0;break;case'<=':l=l<=r?1:0;break;case'>=':l=l>=r?1:0;break;case'==':l=l==r?1:0;break;case'!=':l=l!=r?1:0;break;}
      } return l;
    }
    function pAdd() { let l=pMul(); while(peek()&&['+','-'].includes(peek().v)&&peek().t==='op'){const op=take().v,r=pMul();l=op==='+'?l+r:l-r;} return l; }
    function pMul() { let l=pUn(); while(peek()&&['*','/','%'].includes(peek().v)){const op=take().v,r=pUn();if(op==='*')l*=r;else if(op==='/')l=r?(Number.isInteger(l)&&Number.isInteger(r)?Math.trunc(l/r):l/r):0;else l=r?l%r:0;} return l; }
    function pUn() {
      if(peek()?.v==='!'&&peek()?.t==='op'){take();return pUn()?0:1;}
      if(peek()?.v==='-'&&peek()?.t==='op'){take();return -pUn();}
      if(peek()?.v==='&'){take();return pPrim();}
      return pPrim();
    }
    function pPrim() {
      const tok=peek(); if(!tok)return 0;
      if(tok.t==='num'){take();return tok.v;}
      if(tok.v==='('){take();const val=pOr();if(peek()?.v===')')take();return val;}
      if(tok.t==='id'){
        take();const name=tok.v;
        if(name==='sizeof'){if(peek()?.v==='('){take();let inner='',d=1;while(peek()&&d>0){if(peek().v==='(')d++;if(peek().v===')')d--;if(d>0)inner+=(peek().v||'');take();}inner=inner.trim();if(inner.includes('['))return 4;if(inner in arrays&&arrays[inner]._len!=null)return arrays[inner]._len*4;return 4;}return 4;}
        if(name==='true')return 1;if(name==='false')return 0;
        if(peek()?.v==='['){take();const idx=pOr();if(peek()?.v===']')take();return(name in arrays)?(arrays[name][idx]??0):0;}
        if(peek()?.v==='('){let d=1;take();while(peek()&&d>0){if(peek().v==='(')d++;if(peek().v===')')d--;take();}return 0;}
        return(name in state)?state[name]:0;
      }
      if(tok.v==='*'&&tok.t==='op'){take();const inner=pPrim();return state['*'+inner]!==undefined?state['*'+inner]:(state['*'+toks[pos]?.v]||0);}
      take();return 0;
    }
    try{return pOr();}catch{return 0;}
  }

  // ============================================================
  //  2. SIMULATOR ENGINE
  // ============================================================

  function simulateCode(snippet, fullCode) {
    const raw = snippet.split('\n');
    const lines = raw.map(l => l.trim());
    const state = {}, arrays = {};
    const steps = [], loopSums = [];
    const MAX_ITER = 100, MAX_STEP = 500;
    const ev = (expr) => simEval(expr, state, arrays);

    function addStep(li, desc, changed) {
      if (steps.length >= MAX_STEP) return;
      steps.push({ n:steps.length+1, li, line:raw[li]||'', desc:desc||'',
        state:{...state}, arrs:JSON.parse(JSON.stringify(arrays)), changed:changed||[] });
    }

    function blockEnd(start) {
      let d=0;
      for(let i=start;i<lines.length;i++){for(const ch of lines[i]){if(ch==='{')d++;if(ch==='}'){d--;if(d<=0)return i;}}}
      return lines.length-1;
    }

    function execLine(li) {
      const L=lines[li];
      if(!L||L==='{'||L==='}'||L.startsWith('//')||L.startsWith('#'))return;

      const aD=L.match(/^(?:int|char|float|double)\s+(\w+)\s*\[\s*\d*\s*\]\s*=\s*\{([^}]+)\}\s*;$/);
      if(aD){const nm=aD[1],vals=aD[2].split(',').map(v=>parseInt(v.trim(),10)||0);arrays[nm]={};vals.forEach((v,i)=>{arrays[nm][i]=v;});arrays[nm]._len=vals.length;addStep(li,`${nm} = [${vals.join(', ')}]`,[nm]);return;}

      const vD=L.match(/^(?:const\s+)?(?:unsigned\s+|signed\s+)?(?:int|char|float|double|long|short)\s+(\*?\w+)\s*=\s*(.+?)\s*;$/);
      if(vD&&!L.includes('[')&&!vD[1].includes('[')&&!L.startsWith('return')){const nm=vD[1],val=ev(vD[2]),prev=state[nm];state[nm]=val;addStep(li,`${nm} = ${val}`,prev!==val?[nm]:[]);return;}

      const vDn=L.match(/^(?:int|char|float|double|long|short)\s+(\*?\w+)\s*;$/);
      if(vDn&&!L.includes('[')&&!L.includes('(')){state[vDn[1]]=0;addStep(li,`${vDn[1]} = 0 (uninitialized)`,[vDn[1]]);return;}

      const aA=L.match(/^(\w+)\[(.+?)\]\s*=\s*(.+?)\s*;$/);
      if(aA){const nm=aA[1],idx=ev(aA[2]),val=ev(aA[3]);if(!(nm in arrays))arrays[nm]={};arrays[nm][idx]=val;addStep(li,`${nm}[${idx}] = ${val}`,[`${nm}[${idx}]`]);return;}

      const cA=L.match(/^(\*?\w+)\s*([+\-*/%])=\s*(.+?)\s*;$/);
      if(cA){const nm=cA[1],op=cA[2],r=ev(cA[3]),prev=state[nm]||0;switch(op){case'+':state[nm]=prev+r;break;case'-':state[nm]=prev-r;break;case'*':state[nm]=prev*r;break;case'/':state[nm]=r?(Number.isInteger(prev)&&Number.isInteger(r)?Math.trunc(prev/r):prev/r):0;break;case'%':state[nm]=r?prev%r:0;break;}addStep(li,`${nm} = ${state[nm]}`,[nm]);return;}

      const sA=L.match(/^(\*?\w+)\s*=\s*(.+?)\s*;$/);
      if(sA&&!/^(?:int|char|float|double|long|short|unsigned|signed|const)\b/.test(L)){const nm=sA[1],val=ev(sA[2]),prev=state[nm];state[nm]=val;addStep(li,`${nm} = ${val}`,prev!==val?[nm]:[]);return;}

      const inc=L.match(/^(\*?\w+)\s*\+\+\s*;?$/);
      if(inc){state[inc[1]]=(state[inc[1]]||0)+1;addStep(li,`${inc[1]} = ${state[inc[1]]}`,[inc[1]]);return;}
      const dec=L.match(/^(\*?\w+)\s*--\s*;?$/);
      if(dec){state[dec[1]]=(state[dec[1]]||0)-1;addStep(li,`${dec[1]} = ${state[dec[1]]}`,[dec[1]]);return;}

      const ret=L.match(/^return\s+(.+?)\s*;$/);
      if(ret){addStep(li,`return ${ev(ret[1])}`,[]);return;}
      if(L.startsWith('printf')){addStep(li,'output to console',[]);return;}

      const fC=L.match(/^(?:int\s+)?(\w+)\s*=\s*(\w+)\s*\((.+?)\)\s*;$/);
      if(fC){addStep(li,`${fC[1]} = ${fC[2]}(…)`,[fC[1]]);return;}

      addStep(li,L,[]);
    }

    function execIf(start) {
      const cM=lines[start].match(/if\s*\((.+?)\)\s*\{?\s*$/);
      if(!cM)return start+1;
      const cond=cM[1],result=ev(cond);
      const bEnd=blockEnd(start);
      addStep(start,`${cond} → ${result?'true':'false'}`,[]);
      if(result)execRange(start+1,bEnd-1);
      let nxt=bEnd+1;
      if(nxt<lines.length){
        const el=lines[nxt];
        if(/^\}\s*else/.test(el)||/^else/.test(el)){
          if(el.includes('if')){if(!result)nxt=execIf(nxt);else nxt=blockEnd(nxt)+1;}
          else{const eEnd=blockEnd(nxt);if(!result)execRange(nxt+1,eEnd-1);nxt=eEnd+1;}
        }
      }
      return nxt;
    }

    function execFor(start) {
      const fM=lines[start].match(/for\s*\(\s*(.+?)\s*;\s*(.+?)\s*;\s*(.+?)\s*\)/);
      if(!fM)return start+1;
      const initE=fM[1].trim(),condE=fM[2].trim(),updE=fM[3].trim();
      const bEnd=blockEnd(start);
      const iD=initE.match(/(?:int|char|float|double)\s+(\w+)\s*=\s*(.+)/);
      if(iD){state[iD[1]]=ev(iD[2]);addStep(start,`Init: ${iD[1]} = ${state[iD[1]]}`,[iD[1]]);}
      else{const iA=initE.match(/(\w+)\s*=\s*(.+)/);if(iA){state[iA[1]]=ev(iA[2]);addStep(start,`Init: ${iA[1]} = ${state[iA[1]]}`,[iA[1]]);}}
      let iters=0;const keyUpd=[];
      while(ev(condE)&&iters<MAX_ITER&&steps.length<MAX_STEP){
        addStep(start,`${condE} → true  (iter ${iters+1})`,[]);
        const before={...state};
        execRange(start+1,bEnd-1);
        for(const k of Object.keys(state)){if(state[k]!==before[k]&&!['i','j','k','n'].includes(k)){keyUpd.push({iter:iters+1,v:k,val:state[k]});}}
        const uI=updE.match(/(\w+)\+\+/),uD=updE.match(/(\w+)--/),uC=updE.match(/(\w+)\s*([+\-])=\s*(.+)/),uA=updE.match(/(\w+)\s*=\s*(.+)/);
        if(uI)state[uI[1]]=(state[uI[1]]||0)+1;
        else if(uD)state[uD[1]]=(state[uD[1]]||0)-1;
        else if(uC){const nm=uC[1],op=uC[2],val=ev(uC[3]);state[nm]=op==='+'?(state[nm]||0)+val:(state[nm]||0)-val;}
        else if(uA)state[uA[1]]=ev(uA[2]);
        iters++;
      }
      if(iters>=MAX_ITER){addStep(start,`⚠ Loop limit (${MAX_ITER} iterations) reached`,[]);loopSums.push({li:start,iters,updates:keyUpd.filter((u,i,a)=>i===a.length-1||a[i+1].val!==u.val).slice(-8),finalState:{...state}});}
      else{addStep(start,`${condE} → false  (loop ended, ${iters} iters)`,[]); }
      return bEnd+1;
    }

    function execRange(s,e) {
      let pc=s;
      while(pc<=e&&steps.length<MAX_STEP){
        const L=lines[pc];
        if(!L||L==='{'||L==='}'||L.startsWith('//')||L.startsWith('#')){pc++;continue;}
        if(/^for\s*\(/.test(L)){pc=execFor(pc);}
        else if(/^if\s*\(/.test(L)){pc=execIf(pc);}
        else{execLine(pc);pc++;}
      }
    }

    // Init params from function signature
    let startPC=0;
    const fSig=lines[0]?.match(/^\w+\s+\w+\s*\(([^)]*)\)\s*\{?\s*$/);
    if(fSig){
      const params=fSig[1].split(',').map(p=>p.trim());
      for(const p of params){
        const pm=p.match(/(?:int|char|float|double|void)\s+\*?\s*(\w+)/);
        if(!pm)continue;const nm=pm[1];
        if(p.includes('*')){
          const am=fullCode.match(/(?:int|char|float|double)\s+\w+\s*\[\s*\d*\s*\]\s*=\s*\{([^}]+)\}/);
          if(am){const v=am[1].split(',').map(x=>parseInt(x.trim(),10)||0);arrays[nm]={};v.forEach((x,i)=>{arrays[nm][i]=x;});arrays[nm]._len=v.length;}
          else{arrays[nm]={0:5,1:3,2:8,3:1,_len:4};}
        }else{
          let found=false;for(const a in arrays){if(arrays[a]._len!=null){state[nm]=arrays[a]._len;found=true;break;}}
          if(!found)state[nm]=0;
        }
      }
      startPC=1;
    }

    execRange(startPC,lines.length-1);
    return {steps,finalState:{...state},arrays,loopSums};
  }

  // ============================================================
  //  3. UI CONTROLLER — inside the analysis panel
  // ============================================================

  let simResult = null;
  let simCurrent = -1;
  let simRunTimer = null;
  let simHighlightEl = null;
  let currentTab = 'analysis';

  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // --- Tab switching ---
  const cpovView = document.getElementById('cpov-view');
  const tabCpov  = document.getElementById('tab-cpov');

  function switchTab(tab) {
    currentTab = tab;
    tabAnalysis.classList.toggle('panel-tab--active', tab === 'analysis');
    tabSimulate.classList.toggle('panel-tab--active', tab === 'simulate');
    if (tabCpov) tabCpov.classList.toggle('panel-tab--active', tab === 'cpov');

    panelBody.style.display = tab === 'analysis' ? '' : 'none';
    simView.style.display   = tab === 'simulate'  ? '' : 'none';
    if (cpovView) cpovView.style.display = tab === 'cpov' ? '' : 'none';

    if (tab === 'simulate') {
      runSimulation();
    } else {
      stopSimRun();
      clearSimHighlight();
    }
  }

  // Expose helpers for computer-pov.js
  window._simStopRun       = () => stopSimRun();
  window._simClearHighlight = () => clearSimHighlight();
  window._switchTab        = switchTab;

  tabAnalysis.addEventListener('click', () => switchTab('analysis'));
  tabSimulate.addEventListener('click', () => switchTab('simulate'));

  // --- Run simulation using the currently selected text ---
  function runSimulation() {
    // Use the selected text stored by script.js (it sets window._codeinsighSelectedText)
    const snippet = window._codeinsighSelectedText || '';
    if (!snippet || snippet.length < 3) {
      simBody.innerHTML = '<div class="sim-empty">No code selected to simulate.</div>';
      return;
    }

    const fullCode = editor.innerText || '';
    simResult = simulateCode(snippet, fullCode);

    if (!simResult.steps.length) {
      simBody.innerHTML = '<div class="sim-empty">No executable statements found in the selection.</div>';
      return;
    }

    renderSteps();
    simCurrent = -1;
    simPause.style.display = 'none';
    simRun.style.display = '';
    simSkipLoop.style.display = 'none';
    showStep(0);
  }

  function renderSteps() {
    if (!simResult) return;
    let html = '';
    for (const s of simResult.steps) {
      const stateEntries = Object.entries(s.state).map(([k,v]) => {
        const cls = s.changed.includes(k) ? ' sim-val--changed' : '';
        return `<span class="sim-val${cls}">${esc(k)} = ${v}</span>`;
      }).join('');
      let arrHTML = '';
      for (const [name, arr] of Object.entries(s.arrs)) {
        const vals = [];
        for (let i = 0; i < (arr._len || 0); i++) vals.push(arr[i] ?? 0);
        if (vals.length) arrHTML += `<span class="sim-val">${esc(name)} = [${vals.join(', ')}]</span>`;
      }
      html += `
        <div class="sim-step" data-step="${s.n}" id="sim-step-${s.n}">
          <div class="sim-step__head">
            <span class="sim-step__num">Step ${s.n}</span>
            <code class="sim-step__line">${esc(s.line.trim())}</code>
          </div>
          <div class="sim-step__desc">${esc(s.desc)}</div>
          <div class="sim-step__state">${stateEntries}${arrHTML}</div>
        </div>`;
    }
    for (const ls of simResult.loopSums) {
      let updHTML = ls.updates.map(u =>
        `<div class="sim-loop-upd">Iter ${u.iter} → <b>${esc(u.v)}</b> = ${u.val}</div>`
      ).join('');
      html += `
        <div class="sim-loop-summary">
          <div class="sim-loop-summary__title">Loop Summary</div>
          <div class="sim-loop-summary__info">Iterations: ${ls.iters}${ls.iters>=100?' (limit)':''}</div>
          ${updHTML}
          <div class="sim-loop-summary__final">Final: ${Object.entries(ls.finalState).map(([k,v])=>`${k}=${v}`).join(', ')}</div>
        </div>`;
    }
    simBody.innerHTML = html;
  }

  function showStep(idx) {
    if (!simResult || idx < 0 || idx >= simResult.steps.length) return;
    simCurrent = idx;
    const step = simResult.steps[idx];
    simBody.querySelectorAll('.sim-step').forEach((el, i) => el.classList.toggle('sim-step--active', i === idx));
    const card = document.getElementById(`sim-step-${step.n}`);
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    simProgress.style.width = `${((idx+1)/simResult.steps.length)*100}%`;
    highlightLine(step.li);
    simSkipLoop.style.display = step.desc.includes('iter') ? '' : 'none';
  }

  function highlightLine(lineIdx) {
    clearSimHighlight();
    const style = window.getComputedStyle(editor);
    const lh = parseFloat(style.lineHeight) || (parseFloat(style.fontSize) * 1.7);
    const pt = parseFloat(style.paddingTop) || 16;
    const fullText = editor.innerText || '';
    const selText = window._codeinsighSelectedText || '';
    let offset = 0;
    if (selText) {
      const idx = fullText.indexOf(selText);
      if (idx > 0) offset = fullText.substring(0, idx).split('\n').length - 1;
    }
    const absLine = offset + lineIdx;
    const top = pt + absLine * lh;
    const hl = document.createElement('div');
    hl.className = 'sim-line-highlight';
    hl.style.top = `${top}px`;
    hl.style.height = `${lh}px`;
    annotLayer.appendChild(hl);
    simHighlightEl = hl;
    codeArea.scrollTo({ top: Math.max(0, top - codeArea.clientHeight / 3), behavior: 'smooth' });
  }

  function clearSimHighlight() {
    if (simHighlightEl) { simHighlightEl.remove(); simHighlightEl = null; }
  }

  // --- Controls ---
  simPrev.addEventListener('click', () => { if (simCurrent > 0) showStep(simCurrent - 1); });
  simNext.addEventListener('click', () => {
    if (simResult && simCurrent < simResult.steps.length - 1) showStep(simCurrent + 1);
    else stopSimRun();
  });
  simRun.addEventListener('click', () => {
    simRun.style.display = 'none'; simPause.style.display = '';
    simRunTimer = setInterval(() => {
      if (simResult && simCurrent < simResult.steps.length - 1) showStep(simCurrent + 1);
      else stopSimRun();
    }, 600);
  });
  simPause.addEventListener('click', stopSimRun);
  simSkipLoop.addEventListener('click', () => {
    if (!simResult) return;
    let target = simCurrent + 1;
    while (target < simResult.steps.length && simResult.steps[target].desc.includes('iter')) target++;
    showStep(Math.min(target, simResult.steps.length - 1));
  });

  function stopSimRun() {
    clearInterval(simRunTimer); simRunTimer = null;
    simRun.style.display = ''; simPause.style.display = 'none';
  }

  // Reset on panel close (listen for panel class removal)
  const observer = new MutationObserver(() => {
    const panel = document.getElementById('explanation-panel');
    if (panel && !panel.classList.contains('open')) {
      stopSimRun(); clearSimHighlight();
      if (currentTab === 'simulate') switchTab('analysis');
    }
  });
  const panel = document.getElementById('explanation-panel');
  if (panel) observer.observe(panel, { attributes: true, attributeFilter: ['class'] });
})();
