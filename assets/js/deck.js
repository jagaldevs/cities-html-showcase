/* Haileybury Rendall HTML deck engine
   Keys: ←/→/Space move · M menu · O overview · F full screen · A answers · H showcase tags
         D draw · L laser · C clear ink · T timer · N name picker · R read aloud · J journal
         P presenter view · ? help
   The slide number lives in the address bar (#12).
   Modes: index.html?presenter (speaker window) · index.html?preview (static mirror used by the speaker window) */
(function(){
  'use strict';
  const qs=new URLSearchParams(location.search);
  const MODE=qs.has('presenter')?'presenter':qs.has('preview')?'preview':'deck';
  document.body.classList.add('mode-'+MODE);
  const stage=document.getElementById('stage');
  const slides=[...stage.querySelectorAll(':scope > .slide')];
  const N=slides.length;
  let cur=-1,pending=null;
  const listeners=[];
  const Deck=window.Deck={slides,N,go,next,prev,mode:MODE,keys:{},modal:null,
    get index(){return cur},onChange(fn){listeners.push(fn);},toast};
  slides.forEach((s,i)=>s.dataset.n=i+1);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- scale fixed 1920×1080 stage to the window ---- */
  function fit(){
    const s=Math.min(window.innerWidth/1920,window.innerHeight/1080);
    stage.style.transform=`translate(-50%,-50%) scale(${s})`;
    stage.style.transformOrigin='50% 50%';stage.style.left='50%';stage.style.top='50%';
    document.documentElement.style.setProperty('--scale',s);
  }
  window.addEventListener('resize',fit);fit();
  slides.forEach(sl=>{sl.querySelectorAll('.s').forEach((el,i)=>el.style.setProperty('--i',el.dataset.i??i));});

  /* ---- morph transitions (View Transitions API) ----
     Elements that share a name on consecutive slides glide between positions.
     Names are only applied to the outgoing and incoming slides, so they stay unique. */
  const MORPH=[['.chrome','chrome'],['.head .kicker','kicker'],['.head .title','title'],['.footer','footer'],['.frame','frame'],['.crest','crest'],['.hero-inner h1, .hero-inner h2','herotitle']];
  function names(sl,on){
    if(!sl)return;
    MORPH.forEach(([sel,n])=>{const el=sl.querySelector(sel);if(el)el.style.viewTransitionName=on?n:'';});
    sl.querySelectorAll('[data-morph]').forEach(el=>el.style.viewTransitionName=on?'m-'+el.dataset.morph:'');
  }

  /* ---- navigation ---- */
  function swap(i,opts){
    const old=slides[cur];
    if(old){old.classList.remove('active');old.dispatchEvent(new CustomEvent('slide:leave'));}
    cur=i;const sl=slides[i];
    sl.classList.remove('active');void sl.offsetWidth;sl.classList.add('active');
    sl.dispatchEvent(new CustomEvent('slide:enter'));
    if(!opts.fromHash)history.replaceState(null,'',location.pathname+location.search+'#'+(i+1));
    const pr=document.getElementById('progress');if(pr)pr.style.width=((i+1)/N*100)+'%';
    markMenu();
    document.title=(sl.dataset.title||'Slide '+(i+1))+' · Human Landscapes: Cities';
    listeners.forEach(f=>{try{f(i)}catch(e){console.error(e)}});
  }
  function go(i,opts={}){
    i=Math.max(0,Math.min(N-1,i|0));
    if(i===cur)return;
    // Morph only when this window is visible and focused: browsers pause transitions in windows they are not painting.
    const useVT=document.startViewTransition&&!reduced&&MODE==='deck'&&cur>=0&&!opts.noMorph&&!document.body.classList.contains('ov')&&!document.hidden&&document.hasFocus();
    if(pending){pending();}
    if(!useVT)return swap(i,opts);
    const old=slides[cur],nw=slides[i];let done=false;
    const run=()=>{if(done)return;done=true;pending=null;names(old,false);swap(i,opts);names(nw,true);};
    names(old,true);
    document.documentElement.classList.add('vt');
    const vt=document.startViewTransition(run);
    pending=()=>{try{vt.skipTransition();}catch(e){}run();};
    // watchdog: never let a stalled transition hold the slide change
    setTimeout(()=>{if(!done){pending&&pending();}},450);
    vt.finished.finally(()=>{names(nw,false);document.documentElement.classList.remove('vt');}).catch(()=>{});
  }
  function next(){go(cur+1)} function prev(){go(cur-1)}
  function fromHash(){const n=parseInt(location.hash.slice(1),10);go(isNaN(n)?0:n-1,{fromHash:true,noMorph:true});}
  window.addEventListener('hashchange',fromHash);

  /* ---- overview: zoom out to every slide at once (O) ---- */
  function overview(on){
    const b=document.body;on=on??!b.classList.contains('ov');
    if(on===b.classList.contains('ov'))return;
    const cols=8,rows=Math.ceil(N/cols),pad=46,gap=26;
    const s=Math.min((1920-2*pad-(cols-1)*gap)/cols/1920,(1080-2*pad-(rows-1)*gap)/rows/1080);
    const gw=cols*1920*s+(cols-1)*gap,gh=rows*1080*s+(rows-1)*gap,ox=(1920-gw)/2,oy=(1080-gh)/2;
    if(on){
      b.classList.add('ov');
      slides.forEach((sl,i)=>{const x=ox+(i%cols)*(1920*s+gap),y=oy+Math.floor(i/cols)*(1080*s+gap);
        sl.style.transform=`translate(${x}px,${y}px) scale(${s})`;});
    }else{
      slides.forEach(sl=>sl.style.transform='');
      setTimeout(()=>b.classList.remove('ov'),650);
      b.classList.add('ov-out');setTimeout(()=>b.classList.remove('ov-out'),700);
    }
  }
  Deck.overview=overview;
  stage.addEventListener('click',e=>{if(!document.body.classList.contains('ov'))return;const sl=e.target.closest('.slide');if(!sl)return;e.preventDefault();e.stopPropagation();
    go(slides.indexOf(sl),{noMorph:true});overview(false);},true);

  /* ---- keyboard (ignored while typing in a field) ---- */
  function typing(e){const t=e.target;return t&&(t.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));}
  document.addEventListener('keydown',e=>{
    if(typing(e)){if(e.key==='Escape')e.target.blur();e.stopPropagation();return;}
    if(e.ctrlKey||e.metaKey||e.altKey)return;
    if(Deck.modal){if(Deck.modal.key&&Deck.modal.key(e)!==false)return; if(e.key==='Escape'){Deck.modal.close();return;} return;}
    const k=e.key;
    if(menu.classList.contains('open')&&!/^[mM]$|Escape/.test(k))return;
    if(MODE==='preview')return;
    const ext=Deck.keys[k.toLowerCase()];
    switch(k){
      case 'ArrowRight':case 'PageDown':case ' ':e.preventDefault();next();break;
      case 'ArrowLeft':case 'PageUp':e.preventDefault();prev();break;
      case 'Home':go(0);break; case 'End':go(N-1);break;
      case 'm':case 'M':toggleMenu();break;
      case 'o':case 'O':overview();break;
      case 'Escape':if(document.body.classList.contains('ov'))overview(false);else{toggleMenu(false);help(false);}break;
      case 'f':case 'F':fullscreen();break;
      case 'a':case 'A':document.body.classList.toggle('reveal');toast(document.body.classList.contains('reveal')?'Answers revealed':'Answers hidden');break;
      case 'h':case 'H':document.body.classList.toggle('noshow');toast(document.body.classList.contains('noshow')?'Showcase tags hidden':'Showcase tags shown');break;
      case '?':case '/':help();break;
      case 'p':case 'P':openPresenter();break;
      default:if(ext){e.preventDefault();ext(e);}
    }
  },true);
  function fullscreen(){if(!document.fullscreenElement)document.documentElement.requestFullscreen?.().catch(()=>{});else document.exitFullscreen?.();}

  /* ---- swipe ---- */
  let sx=null,sy=0,st=0;
  document.addEventListener('touchstart',e=>{if(Deck.modal||e.target.closest('[data-noswipe],.zoom,.compare,.sorter,input,textarea,canvas,input[type=range]')){sx=null;return;}sx=e.touches[0].clientX;sy=e.touches[0].clientY;st=Date.now();},{passive:true});
  document.addEventListener('touchend',e=>{if(sx==null)return;const dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.5&&Date.now()-st<700){dx<0?next():prev();}sx=null;},{passive:true});

  /* ---- answers: click to reveal one at a time ---- */
  document.addEventListener('click',e=>{const a=e.target.closest('.answer');if(a&&!a.classList.contains('shown')&&!document.body.classList.contains('reveal')){a.classList.add('shown');}});

  /* ---- contents menu, grouped by section ---- */
  const menu=document.getElementById('menu');
  (function buildMenu(){
    const secs=[];
    slides.forEach((sl,i)=>{
      const sec=sl.dataset.section||'Start';
      let g=secs.find(s=>s.name===sec);if(!g){g={name:sec,items:[]};secs.push(g);}
      if(sl.dataset.cont==='1')return;
      g.items.push({i,t:sl.dataset.title||('Slide '+(i+1))});
    });
    menu.innerHTML=`<h2>Contents</h2><div class="keys"><kbd>←</kbd><kbd>→</kbd> move · <kbd>O</kbd> overview · <kbd>P</kbd> presenter view · <kbd>?</kbd> all shortcuts</div><div class="grid">`+
      secs.map(s=>`<div class="sec"><h3>${s.name}</h3>${s.items.map(it=>`<a href="#${it.i+1}" data-i="${it.i}"><span>${it.i+1}</span>${it.t}</a>`).join('')}</div>`).join('')+'</div>';
    menu.addEventListener('click',e=>{const a=e.target.closest('a');if(a){e.preventDefault();toggleMenu(false);go(+a.dataset.i);} else if(e.target===menu)toggleMenu(false);});
  })();
  function toggleMenu(force){menu.classList.toggle('open',force);markMenu();}
  function markMenu(){menu.querySelectorAll('a').forEach(a=>a.classList.toggle('cur',+a.dataset.i===cur));}

  /* ---- help overlay (?) ---- */
  const helpEl=document.createElement('div');helpEl.id='help';
  helpEl.innerHTML=`<div class="hbox"><h2>Keyboard shortcuts</h2><div class="hgrid">
    <div><h3>Move</h3><p><kbd>→</kbd> <kbd>Space</kbd> next · <kbd>←</kbd> back</p><p><kbd>O</kbd> overview of every slide</p><p><kbd>M</kbd> contents menu</p><p><kbd>Home</kbd> <kbd>End</kbd> first / last</p><p>Swipe on touch screens</p></div>
    <div><h3>Present</h3><p><kbd>P</kbd> presenter view (notes, timer, next slide)</p><p><kbd>F</kbd> full screen</p><p><kbd>A</kbd> reveal all answers</p><p><kbd>H</kbd> hide the ⚡ showcase tags</p><p><kbd>R</kbd> read this slide aloud</p></div>
    <div><h3>Classroom tools</h3><p><kbd>D</kbd> draw · <kbd>L</kbd> laser pointer · <kbd>C</kbd> clear ink</p><p><kbd>T</kbd> countdown timer</p><p><kbd>N</kbd> random name picker</p><p><kbd>J</kbd> learning journal (save as PDF)</p><p><kbd>Esc</kbd> close any tool</p></div></div>
    <p class="hfoot">Press <kbd>?</kbd> or <kbd>Esc</kbd> to close</p></div>`;
  document.body.appendChild(helpEl);
  helpEl.addEventListener('click',e=>{if(e.target===helpEl)help(false);});
  function help(force){helpEl.classList.toggle('open',force);}
  Deck.help=help;

  /* ---- on-screen buttons ---- */
  const bind=(id,fn)=>{const b=document.getElementById(id);if(b)b.onclick=fn;};
  bind('btnPrev',prev);bind('btnNext',next);bind('btnMenu',()=>toggleMenu());bind('btnFull',fullscreen);bind('btnOv',()=>overview());bind('btnHelp',()=>help());
  let ut;const wake=()=>{document.body.classList.add('ui');clearTimeout(ut);ut=setTimeout(()=>document.body.classList.remove('ui'),2500);};
  document.addEventListener('mousemove',wake);document.addEventListener('touchstart',wake,{passive:true});

  /* ---- toast ---- */
  let tt;function toast(m){const t=document.getElementById('toast');if(!t)return;t.textContent=m;t.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('on'),1500);}

  /* ---- presenter view: a second window that drives this one via postMessage ---- */
  let pwin=null;
  function openPresenter(){
    if(pwin&&!pwin.closed){pwin.focus();return;}
    pwin=window.open(location.pathname+'?presenter#'+(cur+1),'hrs-presenter','width=1280,height=760');
    if(!pwin)toast('Allow pop-ups to open presenter view');
  }
  Deck.openPresenter=openPresenter;
  const send=()=>{if(pwin&&!pwin.closed)pwin.postMessage({hrsDeck:'at',i:cur},'*');};
  Deck.onChange(send);
  window.addEventListener('message',e=>{const d=e.data||{};
    if(d.hrsDeck==='go'&&MODE==='deck')go(d.i,{noMorph:true});
    if(d.hrsDeck==='hello'&&MODE==='deck'){pwin=e.source;send();}
    if(d.hrsDeck==='tool'&&MODE==='deck')document.dispatchEvent(new KeyboardEvent('keydown',{key:d.k,bubbles:true}));
  });

  /* ---- boot ---- */
  if(window.Components&&MODE!=='presenter')window.Components.init(document);
  (window.DeckPlugins||[]).forEach(f=>{try{f(Deck)}catch(e){console.error(e)}});
  if(MODE==='presenter'&&window.Presenter){window.Presenter(Deck);return;}
  fromHash();
})();
