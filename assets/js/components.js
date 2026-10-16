/* Reusable interactive components for the HTML deck.
   Every component is declared in markup with data-component="name" and configured
   by data-* attributes or an inline <script type="application/json"> child,
   so it can be dropped onto any slide. Progress is kept in localStorage
   (wrapped in try/catch so the deck still works where storage is blocked). */
(function(){
  'use strict';
  const NS='hrs-cities:';
  const store={
    get(k,d){try{const v=localStorage.getItem(NS+k);return v==null?d:JSON.parse(v);}catch(e){return d;}},
    set(k,v){try{localStorage.setItem(NS+k,JSON.stringify(v));}catch(e){}}
  };
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const cfg=el=>{const s=el.querySelector(':scope > script[type="application/json"]');return s?JSON.parse(s.textContent):{};};
  const slideOf=el=>el.closest('.slide');
  const onEnter=(el,fn)=>{const s=slideOf(el);if(s){s.addEventListener('slide:enter',fn);if(s.classList.contains('active'))fn();}};
  const onLeave=(el,fn)=>{const s=slideOf(el);if(s)s.addEventListener('slide:leave',fn);};
  const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const svgNS='http://www.w3.org/2000/svg';
  const mk=(tag,attrs={},parent)=>{const e=document.createElementNS(svgNS,tag);for(const k in attrs)e.setAttribute(k,attrs[k]);if(parent)parent.appendChild(e);return e;};
  const ease=t=>1-Math.pow(1-t,3);
  const scaleNow=()=>parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--scale'))||1;

  const C={};

  /* ---------- flip cards ---------- */
  C.flip=el=>{$$('.flip',el).forEach(f=>f.addEventListener('click',()=>f.classList.toggle('on')));};

  /* ---------- counter: counts up to data-to on slide enter ---------- */
  C.counter=el=>{
    const to=parseFloat(el.dataset.to),dec=+(el.dataset.dec||0),pre=el.dataset.pre||'',suf=el.dataset.suf||'',dur=+(el.dataset.dur||1600);
    const fmt=v=>pre+v.toLocaleString('en-AU',{minimumFractionDigits:dec,maximumFractionDigits:dec})+suf;
    el.textContent=fmt(to);
    onEnter(el,()=>{const t0=performance.now();const tick=t=>{const p=Math.min(1,(t-t0)/dur);el.textContent=fmt(to*ease(p));if(p<1)requestAnimationFrame(tick);};el.textContent=fmt(0);requestAnimationFrame(tick);});
  };

  /* ---------- sorter: drag (mouse/touch/pen) or tap-to-select then tap a bin ---------- */
  C.sorter=el=>{
    const id=el.dataset.id, pool=$('.pool',el), bins=$$('.bin',el), chips=$$('.chip',el);
    const status=$('.status',el); let sel=null;
    const place=(chip,binEl)=>{chip.classList.remove('right','wrong','sel');(binEl?$('.drop',binEl):pool).appendChild(chip);save();el.dispatchEvent(new CustomEvent('sorter:change'));};
    const save=()=>{const s={};chips.forEach(c=>{const b=c.closest('.bin');if(b)s[c.dataset.key]=b.dataset.bin;});store.set('sort:'+id,s);};
    const saved=store.get('sort:'+id,{});
    chips.forEach(c=>{const b=saved[c.dataset.key];if(b){const bin=bins.find(x=>x.dataset.bin===b);if(bin)$('.drop',bin).appendChild(c);}});
    // shuffle unplaced chips once for variety
    [...pool.children].sort(()=>Math.random()-.5).forEach(c=>pool.appendChild(c));
    chips.forEach(chip=>{
      chip.addEventListener('pointerdown',e=>{
        if(e.button!==0)return;
        e.preventDefault();
        const r=chip.getBoundingClientRect(),sc=scaleNow();
        const ox=e.clientX-r.left,oy=e.clientY-r.top; let moved=false; let ghost=null; let overBin=null;
        const move=ev=>{
          const dx=ev.clientX-e.clientX,dy=ev.clientY-e.clientY;
          if(!moved&&Math.hypot(dx,dy)<6)return;
          if(!moved){moved=true;ghost=chip.cloneNode(true);ghost.classList.add('dragging');ghost.style.width=r.width/sc+'px';ghost.style.transform=`scale(${sc})`;ghost.style.transformOrigin='0 0';document.body.appendChild(ghost);chip.style.opacity=.3;}
          ghost.style.left=(ev.clientX-ox)+'px';ghost.style.top=(ev.clientY-oy)+'px';
          const under=document.elementFromPoint(ev.clientX,ev.clientY);const b=under&&under.closest('.bin');const inPool=under&&under.closest('.pool');
          bins.forEach(x=>x.classList.toggle('over',x===b));overBin=b||(inPool?'pool':null);
        };
        const up=()=>{
          window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);
          bins.forEach(x=>x.classList.remove('over'));chip.style.opacity='';
          if(ghost){ghost.remove();if(overBin==='pool')place(chip,null);else if(overBin&&el.contains(overBin))place(chip,overBin);}
          else{ // tap = select
            if(sel===chip){chip.classList.remove('sel');sel=null;}else{sel&&sel.classList.remove('sel');sel=chip;chip.classList.add('sel');}
          }
        };
        window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);
      });
    });
    bins.forEach(b=>b.addEventListener('click',e=>{if(sel&&!e.target.closest('.chip')){place(sel,b);sel=null;}}));
    pool.addEventListener('click',e=>{if(sel&&!e.target.closest('.chip')){place(sel,null);sel=null;}});
    const check=$('[data-act=check]',el), reset=$('[data-act=reset]',el);
    check&&check.addEventListener('click',()=>{
      let right=0,placed=0;
      chips.forEach(c=>{const b=c.closest('.bin');c.classList.remove('right','wrong');if(!b)return;placed++;
        const ok=c.dataset.bin.split(/\s+/).includes(b.dataset.bin);c.classList.add(ok?'right':'wrong');if(ok)right++;});
      if(status){status.className='status '+(right===chips.length?'good':'');
        status.textContent=placed<chips.length?`${right} of ${placed} placed cards correct · ${chips.length-placed} still to place`:(right===chips.length?`All ${right} correct — well sorted!`:`${right} of ${chips.length} correct. Move the red cards and check again.`);}
      el.dispatchEvent(new CustomEvent('sorter:checked',{detail:{right,placed,total:chips.length}}));
    });
    reset&&reset.addEventListener('click',()=>{chips.forEach(c=>{c.classList.remove('right','wrong');pool.appendChild(c);});save();if(status){status.textContent='';}el.dispatchEvent(new CustomEvent('sorter:change'));});
  };

  /* ---------- line chart (animated draw) ---------- */
  C.linechart=el=>{
    const c=cfg(el), W=c.w||900,H=c.h||560,P={l:80,r:30,t:24,b:70};
    const svg=mk('svg',{viewBox:`0 0 ${W} ${H}`,class:'chart',role:'img','aria-label':c.label||'chart'});el.appendChild(svg);
    const xs=c.x, n=xs.length, max=c.max;
    const X=i=>P.l+i*(W-P.l-P.r)/(n-1), Y=v=>H-P.b-(v/max)*(H-P.t-P.b);
    for(let v=0;v<=max;v+=c.step){mk('line',{x1:P.l,x2:W-P.r,y1:Y(v),y2:Y(v),class:'grid'},svg);const t=mk('text',{x:P.l-14,y:Y(v)+6,'text-anchor':'end',class:'tick'},svg);t.textContent=v;}
    xs.forEach((x,i)=>{if(i%(c.every||1))return;const t=mk('text',{x:X(i),y:H-P.b+30,'text-anchor':'middle',class:'tick'},svg);t.textContent=x;});
    mk('line',{x1:P.l,x2:W-P.r,y1:H-P.b,y2:H-P.b,class:'ax'},svg);
    const yl=mk('text',{x:20,y:(H-P.b+P.t)/2,transform:`rotate(-90 20 ${(H-P.b+P.t)/2})`,'text-anchor':'middle',class:'lab'},svg);yl.textContent=c.ylabel||'';
    const paths=[];
    (c.bars||[]).forEach(s=>{const bw=(W-P.l-P.r)/(n-1)*.62;s.v.forEach((v,i)=>{const r=mk('rect',{x:X(i)-bw/2,width:bw,y:Y(0),height:0,fill:s.color,opacity:.85,class:'bar'},svg);paths.push({bar:r,v,i});});});
    c.series.forEach(s=>{const d=s.v.map((v,i)=>(i?'L':'M')+X(i)+','+Y(v)).join('');const p=mk('path',{d,class:'line',stroke:s.color},svg);paths.push({p});
      const last=s.v.length-1;const lab=mk('text',{x:X(last)-6,y:Y(s.v[last])+(s.dy||-14),'text-anchor':'end',class:'lab',fill:s.color},svg);lab.textContent=s.name;paths.push({lab});});
    // hover readout
    const guide=mk('line',{y1:P.t,y2:H-P.b,stroke:'#582D40','stroke-dasharray':'4 4',opacity:0},svg);
    const tip=mk('text',{y:P.t+8,class:'lab',fill:'#582D40','text-anchor':'middle',opacity:0},svg);
    svg.addEventListener('pointermove',e=>{const pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;const p=pt.matrixTransform(svg.getScreenCTM().inverse());
      const i=Math.max(0,Math.min(n-1,Math.round((p.x-P.l)/((W-P.l-P.r)/(n-1)))));guide.setAttribute('x1',X(i));guide.setAttribute('x2',X(i));guide.setAttribute('opacity',1);
      tip.setAttribute('x',Math.min(W-160,Math.max(P.l+140,X(i))));tip.setAttribute('opacity',1);tip.textContent=xs[i]+': '+c.series.map(s=>s.short+' '+s.v[i].toFixed(2)+' bn').join(' · ');});
    svg.addEventListener('pointerleave',()=>{guide.setAttribute('opacity',0);tip.setAttribute('opacity',0);});
    const run=()=>{paths.forEach(o=>{
      if(o.p){const L=o.p.getTotalLength();o.p.style.transition='none';o.p.style.strokeDasharray=L;o.p.style.strokeDashoffset=L;o.p.getBoundingClientRect();o.p.style.transition='stroke-dashoffset 2.2s cubic-bezier(.2,.7,.2,1) .5s';o.p.style.strokeDashoffset=0;}
      if(o.bar){o.bar.style.transition='none';o.bar.setAttribute('y',Y(0));o.bar.setAttribute('height',0);o.bar.getBoundingClientRect();setTimeout(()=>{o.bar.style.transition='';o.bar.setAttribute('y',Y(o.v));o.bar.setAttribute('height',Y(0)-Y(o.v));},300+o.i*70);}
      if(o.lab){o.lab.style.opacity=0;o.lab.style.transition='opacity .6s 2.3s';o.lab.getBoundingClientRect();o.lab.style.opacity=1;}
    });};
    onEnter(el,run);
  };

  /* ---------- bar chart with year toggle (1990 vs 2030) ---------- */
  C.barchart=el=>{
    const c=cfg(el),W=c.w||1000,H=c.h||560,P={l:70,r:20,t:60,b:60};
    const svg=mk('svg',{viewBox:`0 0 ${W} ${H}`,class:'chart',role:'img','aria-label':c.label||'bar chart'});el.appendChild(svg);
    const n=c.cats.length,max=c.max,bw=(W-P.l-P.r)/n;
    const Y=v=>H-P.b-(v/max)*(H-P.t-P.b);
    for(let v=0;v<=max;v+=10){mk('line',{x1:P.l,x2:W-P.r,y1:Y(v),y2:Y(v),class:'grid'},svg);const t=mk('text',{x:P.l-12,y:Y(v)+6,'text-anchor':'end',class:'tick'},svg);t.textContent=v;}
    mk('line',{x1:P.l,x2:W-P.r,y1:H-P.b,y2:H-P.b,class:'ax'},svg);
    const yl=mk('text',{x:18,y:(H-P.b+P.t)/2,transform:`rotate(-90 18 ${(H-P.b+P.t)/2})`,'text-anchor':'middle',class:'lab'},svg);yl.textContent=c.ylabel;
    const bars=c.cats.map((cat,i)=>{
      const x=P.l+i*bw+bw*.16,w=bw*.68;
      const r=mk('rect',{x,width:w,y:Y(0),height:0,rx:3,fill:c.colors[0],class:'bar'},svg);
      const v=mk('text',{x:x+w/2,y:Y(0)-10,'text-anchor':'middle',class:'lab'},svg);
      const pct=mk('text',{x:x+w/2,y:P.t-22,'text-anchor':'middle',class:'tick',fill:'#D00070','font-weight':700,opacity:0},svg);
      const t=mk('text',{x:x+w/2,y:H-P.b+32,'text-anchor':'middle',class:'tick'},svg);t.textContent=cat;
      return {r,v,pct,i};
    });
    let mode=0;
    const show=m=>{mode=m;bars.forEach(b=>{const val=c.series[m][b.i];b.r.setAttribute('y',Y(val));b.r.setAttribute('height',Y(0)-Y(val));b.r.setAttribute('fill',c.colors[m]);
      b.v.textContent=val.toFixed(1);b.v.setAttribute('y',Y(val)-10);b.v.style.transition='y 1s';
      const p=Math.round((c.series[1][b.i]/c.series[0][b.i]-1)*100);b.pct.textContent='+'+p+'%';b.pct.setAttribute('opacity',m===1?1:0);});
      $$('[data-year]',el.parentElement).forEach(x=>x.classList.toggle('on',+x.dataset.year===m));};
    $$('[data-year]',el.parentElement).forEach(b=>b.addEventListener('click',()=>show(+b.dataset.year)));
    const sortBtn=$('[data-act=sort]',el.parentElement);
    sortBtn&&sortBtn.addEventListener('click',()=>{ // reorder by % increase
      const order=c.cats.map((_,i)=>i).sort((a,b)=>(c.series[1][b]/c.series[0][b])-(c.series[1][a]/c.series[0][a]));
      order.forEach((ci,pos)=>{const b=bars[ci];const x=P.l+pos*bw+bw*.16,w=bw*.68;[b.r].forEach(r=>{r.style.transition='x 1s cubic-bezier(.2,.7,.2,1), y 1s, height 1s';r.setAttribute('x',x);});
        b.v.setAttribute('x',x+w/2);b.pct.setAttribute('x',x+w/2);svg.querySelectorAll('text.tick').forEach(()=>{});
        const lbl=[...svg.querySelectorAll('text.tick')].find(t=>t.textContent===c.cats[ci]&&+t.getAttribute('y')>H-P.b);if(lbl)lbl.setAttribute('x',x+w/2);});
      show(1);
    });
    onEnter(el,()=>{bars.forEach(b=>{b.r.setAttribute('y',Y(0));b.r.setAttribute('height',0);});setTimeout(()=>show(mode),250);});
  };

  /* ---------- zoom / pan explorer for big images, with hotspots ---------- */
  C.zoom=el=>{
    const zc=$('.zc',el),img=$('img',zc);let z=1,x=0,y=0,minZ=1;
    const tools=document.createElement('div');tools.className='tools';tools.innerHTML='<button data-z="in" title="Zoom in">+</button><button data-z="out" title="Zoom out">−</button><button data-z="fit" title="Reset">⟲</button>';el.appendChild(tools);
    const help=document.createElement('div');help.className='zhelp';help.textContent='Scroll or pinch to zoom · drag to pan';el.appendChild(help);
    const apply=(anim)=>{const W=el.clientWidth,H=el.clientHeight,iw=img.naturalWidth*z,ih=img.naturalHeight*z;
      x=iw<W?(W-iw)/2:Math.min(0,Math.max(W-iw,x));y=ih<H?(H-ih)/2:Math.min(0,Math.max(H-ih,y));
      zc.style.transition=anim?'transform .45s cubic-bezier(.2,.7,.2,1)':'none';zc.style.transform=`translate(${x}px,${y}px) scale(${z})`;el.style.setProperty('--z',z);};
    const fitImg=()=>{if(!img.naturalWidth)return;const W=el.clientWidth,H=el.clientHeight;minZ=Math.min(W/img.naturalWidth,H/img.naturalHeight)*(el.dataset.cover?Math.max(W/img.naturalWidth,H/img.naturalHeight)/Math.min(W/img.naturalWidth,H/img.naturalHeight):1);z=minZ;x=0;y=0;apply(true);};
    const zoomAt=(f,cx,cy,anim)=>{const nz=Math.max(minZ,Math.min(minZ*6,z*f));x=cx-(cx-x)*nz/z;y=cy-(cy-y)*nz/z;z=nz;apply(anim);};
    const local=(e)=>{const r=el.getBoundingClientRect(),s=scaleNow();return [(e.clientX-r.left)/s,(e.clientY-r.top)/s];};
    el.addEventListener('wheel',e=>{e.preventDefault();const [cx,cy]=local(e);zoomAt(e.deltaY<0?1.15:1/1.15,cx,cy,false);},{passive:false});
    tools.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;e.stopPropagation();const W=el.clientWidth/2,H=el.clientHeight/2;
      if(b.dataset.z==='in')zoomAt(1.5,W,H,true);else if(b.dataset.z==='out')zoomAt(1/1.5,W,H,true);else fitImg();});
    const pts=new Map();let last=null,lastD=0,dragged=false;
    el.addEventListener('pointerdown',e=>{if(e.target.closest('.tools,.hot'))return;el.setPointerCapture(e.pointerId);pts.set(e.pointerId,local(e));last=local(e);dragged=false;el.style.cursor='grabbing';});
    el.addEventListener('pointermove',e=>{if(!pts.has(e.pointerId))return;const p=local(e);pts.set(e.pointerId,p);
      if(pts.size===2){const [a,b]=[...pts.values()];const d=Math.hypot(a[0]-b[0],a[1]-b[1]);if(lastD)zoomAt(d/lastD,(a[0]+b[0])/2,(a[1]+b[1])/2,false);lastD=d;return;}
      x+=p[0]-last[0];y+=p[1]-last[1];if(Math.abs(p[0]-last[0])+Math.abs(p[1]-last[1])>1)dragged=true;last=p;apply(false);});
    const end=e=>{pts.delete(e.pointerId);lastD=0;el.style.cursor='';if(pts.size===1)last=[...pts.values()][0];};
    el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);
    // hotspots: positioned in % of the image; fly to them on click
    $$('.hot',zc).forEach(h=>{h.style.left=h.dataset.x+'%';h.style.top=h.dataset.y+'%';
      h.addEventListener('click',e=>{e.stopPropagation();const tz=Math.max(z,minZ*(+h.dataset.zoom||2.4));const px=img.naturalWidth*h.dataset.x/100,py=img.naturalHeight*h.dataset.y/100;
        z=tz;x=el.clientWidth/2-px*z;y=el.clientHeight/2-py*z;apply(true);h.classList.add('done');showPop(el,h.dataset.pop);});});
    if(img.complete)fitImg();else img.addEventListener('load',fitImg);
    onEnter(el,()=>requestAnimationFrame(fitImg));
  };
  function showPop(root,id){if(!id)return;const host=root.closest('[data-pops]')||root.closest('.body');
    $$('.pop',host).forEach(p=>p.classList.toggle('on',p.id===id));const t=$('.tracker',host);if(t){const s=$(`[data-for="${id}"]`,t);s&&s.classList.add('done');}}

  /* ---------- scene explorer: SVG illustration with hotspots, side panel pops ---------- */
  C.explorer=el=>{$$('.hot',el).forEach(h=>{h.style.left=h.dataset.x+'%';h.style.top=h.dataset.y+'%';h.addEventListener('click',()=>{$$('.hot',el).forEach(x=>x.classList.remove('cur'));h.classList.add('done');showPop(el,h.dataset.pop);});});};

  /* ---------- before/after compare slider ---------- */
  C.compare=el=>{
    const sb=slideOf(el).querySelector('[data-act=sound]');
    const mixNow=()=>{if(window.Soundscape&&window.Soundscape.on)window.Soundscape.mix(parseFloat(el.style.getPropertyValue('--x')||'50')/100);};
    if(sb){sb.addEventListener('click',()=>{const S=window.Soundscape;if(!S)return;if(S.on){S.stop();sb.classList.remove('on');sb.textContent='🔊 City sounds';}else{S.start();mixNow();sb.classList.add('on');sb.textContent='🔇 Stop sounds';}});
      onLeave(el,()=>{if(window.Soundscape&&window.Soundscape.on){window.Soundscape.stop();sb.classList.remove('on');sb.textContent='🔊 City sounds';}});
      new MutationObserver(mixNow).observe(el,{attributes:true,attributeFilter:['style']});}
    const set=px=>{const r=el.getBoundingClientRect();const p=Math.max(0,Math.min(100,(px-r.left)/r.width*100));el.style.setProperty('--x',p+'%');};
    let down=false;
    el.addEventListener('pointerdown',e=>{down=true;el.setPointerCapture(e.pointerId);set(e.clientX);});
    el.addEventListener('pointermove',e=>{if(down)set(e.clientX);});
    el.addEventListener('pointerup',()=>down=false);
    onEnter(el,()=>{el.style.setProperty('--x','50%');let t0=null;const sweep=t=>{if(!t0)t0=t;const p=(t-t0)/2400;if(p>1||down)return;el.style.setProperty('--x',(50+Math.sin(p*Math.PI*2)*22)+'%');requestAnimationFrame(sweep);};setTimeout(()=>requestAnimationFrame(sweep),700);});
  };

  /* ---------- tabs ---------- */
  C.tabs=el=>{const btns=$$('.tl button',el),panes=$$('.tp',el);btns.forEach((b,i)=>b.addEventListener('click',()=>{btns.forEach(x=>x.classList.toggle('on',x===b));panes.forEach((p,j)=>p.classList.toggle('on',j===i));}));btns[0]&&btns[0].click();};

  /* ---------- persistent notes (textarea/input) ---------- */
  C.notes=el=>{const f=$('textarea,input',el),key='note:'+el.dataset.id,lab=$('.saved',el);f.value=store.get(key,'');
    let t;f.addEventListener('input',()=>{clearTimeout(t);t=setTimeout(()=>{store.set(key,f.value);if(lab){lab.textContent='Saved in this browser ✓';}},300);});};

  /* ---------- copy-to-clipboard (collects all notes on the slide) ---------- */
  C.copy=el=>{el.addEventListener('click',()=>{const s=slideOf(el);const txt=$$('[data-component=notes]',s).map(n=>{const l=$('label',n);return (l?l.textContent+'\n':'')+$('textarea,input',n).value;}).join('\n\n');
    const done=()=>{el.textContent='Copied ✓';setTimeout(()=>el.textContent=el.dataset.label||'Copy for Canvas',1600);};
    if(navigator.clipboard)navigator.clipboard.writeText(txt).then(done,()=>fallback());else fallback();
    function fallback(){const ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();try{document.execCommand('copy');}catch(e){}ta.remove();done();}});};

  /* ---------- quick check: multiple choice with progress kept ---------- */
  C.quiz=el=>{
    const c=cfg(el),id=el.dataset.id,st=store.get('quiz:'+id,{});let qi=0;
    const box=document.createElement('div');box.className='qc';el.appendChild(box);
    const tb=slideOf(el).querySelector('[data-act=teams]');tb&&tb.addEventListener('click',()=>window.TeamQuiz&&window.TeamQuiz(c));
    const render=()=>{const q=c.questions[qi],ans=st[qi];
      box.innerHTML=`<div class="q">${esc(q.q)}</div><div class="opts">${q.o.map((o,i)=>`<button class="opt" data-i="${i}"><b>${'ABCD'[i]}</b><span>${esc(o)}</span></button>`).join('')}</div>
      <div class="fb"></div><div class="qnav"><button class="btn ghost" data-nav="-1">◀ Back</button><div class="dots">${c.questions.map((_,i)=>`<i class="${i===qi?'cur':''} ${st[i]==null?'':(st[i]===c.questions[i].a?'r':'w')}"></i>`).join('')}</div><button class="btn" data-nav="1">Next ▶</button><span class="status">${Object.keys(st).filter(k=>st[k]===c.questions[k].a).length} / ${c.questions.length} correct</span></div>`;
      if(ans!=null)mark(ans);
      $$('.opt',box).forEach(b=>b.addEventListener('click',()=>{if(st[qi]!=null)return;st[qi]=+b.dataset.i;store.set('quiz:'+id,st);render();}));
      $$('[data-nav]',box).forEach(b=>b.addEventListener('click',()=>{qi=(qi+ +b.dataset.nav+c.questions.length)%c.questions.length;render();}));
    };
    const mark=a=>{const q=c.questions[qi];$$('.opt',box).forEach((b,i)=>{if(i===q.a)b.classList.add('right');else if(i===a)b.classList.add('wrong');});
      $('.fb',box).innerHTML=`<b class="${a===q.a?'mag':''}" style="color:${a===q.a?'var(--ok)':'var(--bad)'}">${a===q.a?'Correct.':'Not quite.'}</b> ${esc(q.why)}`;};
    render();
  };

  /* ---------- perspective swapper ---------- */
  C.persp=el=>{
    const c=cfg(el);const who=$('.who',el),L=$('.pane.l',el),R=$('.pane.r',el);let l=0,r=1;
    who.innerHTML=c.voices.map((v,i)=>`<button data-i="${i}">${v.icon}<span>${esc(v.name)}<small>${esc(v.role)}</small></span></button>`).join('')+`<p class="small muted" style="margin:8px 4px 0;font-size:17px!important;line-height:1.35">Click = left pane · Shift-click or right-click = right pane</p>`;
    const paint=(pane,i)=>{const v=c.voices[i];pane.innerHTML=`<div class="fadeIn"><div class="nm">${esc(v.name)}<button class="speak" title="Hear ${esc(v.name)}" aria-label="Read aloud">🔊</button></div><div class="rl">${esc(v.role)}</div><blockquote>“${esc(v.say)}”</blockquote></div><div class="ft">${v.tags.map(t=>`<span>${esc(t)}</span>`).join('')}</div>`;
      const b=pane.querySelector('.speak');b.addEventListener('click',()=>{if(!window.Speech)return;b.classList.add('talking');window.Speech.say(v.say,{gender:v.g,pitch:v.pitch||1,rate:v.rate||.97,onend:()=>b.classList.remove('talking')});});};
    const mark=()=>$$('button[data-i]',who).forEach(b=>{b.classList.toggle('on-l',+b.dataset.i===l);b.classList.toggle('on-r',+b.dataset.i===r);});
    who.addEventListener('click',e=>{const b=e.target.closest('button[data-i]');if(!b)return;const i=+b.dataset.i;if(e.shiftKey){r=i;paint(R,r);}else{l=i;paint(L,l);}mark();});
    who.addEventListener('contextmenu',e=>{const b=e.target.closest('button[data-i]');if(!b)return;e.preventDefault();r=+b.dataset.i;paint(R,r);mark();});
    paint(L,l);paint(R,r);mark();
  };

  /* ---------- decision simulator ---------- */
  C.sim=el=>{
    const c=cfg(el);let chosen=new Set();
    const projEl=$('.proj',el),coins=$('.coins',el),meters=$('.meters',el),out=$('.out',el);
    projEl.innerHTML=c.projects.map((p,i)=>`<button class="p" data-i="${i}"><div class="t">${esc(p.t)}</div><div class="d">${esc(p.d)}</div><span class="cost">${p.cost} ●</span></button>`).join('');
    meters.innerHTML=c.meters.map(m=>`<div class="meter" data-m="${m.k}"><div class="ml"><span>${esc(m.name)}</span><span class="v"></span></div><div class="mb"><i style="--c:${m.c}"></i></div></div>`).join('');
    const update=()=>{
      const spent=[...chosen].reduce((s,i)=>s+c.projects[i].cost,0),left=c.budget-spent;
      coins.innerHTML=Array.from({length:c.budget},(_,i)=>`<i class="${i<spent?'spent':''}"></i>`).join('');
      $('.left',el).textContent=left;
      $$('.p',projEl).forEach(b=>{const i=+b.dataset.i;b.classList.toggle('on',chosen.has(i));b.disabled=!chosen.has(i)&&c.projects[i].cost>left;});
      c.meters.forEach(m=>{let v=m.base;chosen.forEach(i=>v+=(c.projects[i].fx[m.k]||0));v=Math.max(0,Math.min(100,v));const me=$(`[data-m="${m.k}"]`,meters);$('i',me).style.setProperty('--v',v+'%');$('.v',me).textContent=v;});
      const notes=[...chosen].map(i=>`<li>${esc(c.projects[i].out)}</li>`);
      // branching consequences depend on the combination chosen
      c.combos.forEach(cb=>{if(cb.if.every(i=>chosen.has(i))&&!(cb.not||[]).some(i=>chosen.has(i)))notes.push(`<li><b class="mag">${esc(cb.title)}:</b> ${esc(cb.text)}</li>`);});
      if(left===0&&chosen.size){const left_out=c.projects.map((p,i)=>chosen.has(i)?null:p.who).filter(Boolean);notes.push(`<li><b>Budget spent.</b> Still waiting: ${esc([...new Set(left_out)].join(', '))}.</li>`);}
      out.innerHTML=notes.length?`<ul style="margin:0;padding-left:1.1em">${notes.join('')}</ul>`:`<span class="muted">Choose projects to see what happens in the ward…</span>`;
    };
    projEl.addEventListener('click',e=>{const b=e.target.closest('.p');if(!b||b.disabled)return;const i=+b.dataset.i;chosen.has(i)?chosen.delete(i):chosen.add(i);update();});
    $('[data-act=reset]',el).addEventListener('click',()=>{chosen.clear();update();});
    update();
  };

  /* ---------- growth time slider (city footprint + population) ---------- */
  C.growth=el=>{
    const c=cfg(el),rng=$('input[type=range]',el),yr=$('.yearbig',el),pop=$('.popbig',el),note=$('.gnote',el),svg=$('svg',el);
    const blobs=$$('[data-yr]',svg);
    rng.min=0;rng.max=c.points.length-1;rng.step=0.01;
    const set=v=>{const i=Math.floor(v),f=v-i,a=c.points[i],b=c.points[Math.min(i+1,c.points.length-1)];
      const p=a.pop+(b.pop-a.pop)*f;const y=Math.round(a.y+(b.y-a.y)*f);
      yr.textContent=y;yr.classList.toggle('proj',y>2020);pop.textContent=p.toFixed(1)+' million'+(y>2020?' (projected)':'');
      const k=Math.sqrt(p/c.points[c.points.length-1].pop);
      blobs.forEach(bl=>{const show=+bl.dataset.yr<=y;bl.style.opacity=show?1:0;});
      const ring=$('.ring',svg);ring.setAttribute('r',40+250*k);
      note.textContent=(f<.5?a:b).note;};
    rng.addEventListener('input',()=>set(+rng.value));
    rng.addEventListener('keydown',e=>e.stopPropagation());
    let raf;const play=()=>{cancelAnimationFrame(raf);let t0=null;const tick=t=>{if(!t0)t0=t;const v=Math.min(+rng.max,(t-t0)/900);rng.value=v;set(v);if(v<+rng.max)raf=requestAnimationFrame(tick);};raf=requestAnimationFrame(tick);};
    $('[data-act=play]',el).addEventListener('click',play);
    rng.addEventListener('pointerdown',()=>cancelAnimationFrame(raf));
    set(0);onEnter(el,()=>{rng.value=0;set(0);setTimeout(play,900);});onLeave(el,()=>cancelAnimationFrame(raf));
  };

  /* ---------- video: online plays YouTube embed; offline shows link + QR ---------- */
  C.video=el=>{el.querySelector('.play').addEventListener('click',()=>{
    if(!navigator.onLine||location.protocol==='file:'&&el.dataset.forceOffline){el.classList.add('off');return;}
    const f=document.createElement('iframe');f.src=`https://www.youtube-nocookie.com/embed/${el.dataset.yt}?autoplay=1&rel=0`;f.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';f.allowFullscreen=true;
    f.onerror=()=>el.classList.add('off');el.appendChild(f);});
    onLeave(el,()=>{const f=$('iframe',el);f&&f.remove();el.classList.remove('off');});};

  /* ---------- multiple nuclei model: legend highlights zones ---------- */
  C.nuclei=el=>{const btns=$$('.lg button',el);let cur=null;
    const pick=k=>{cur=cur===k?null:k;el.classList.toggle('focus',!!cur);btns.forEach(b=>b.classList.toggle('on',b.dataset.k===cur));$$('svg .z',el).forEach(z=>z.classList.toggle('on',z.dataset.k===cur));
      const d=$('.ndesc',slideOf(el)||el);if(d){const b=btns.find(x=>x.dataset.k===cur);d.innerHTML=b?b.dataset.d:d.dataset.default;}};
    btns.forEach(b=>b.addEventListener('click',()=>pick(b.dataset.k)));$$('svg .z',el).forEach(z=>z.addEventListener('click',()=>pick(z.dataset.k)));
    onEnter(el,()=>{const zs=$$('svg .z',el);zs.forEach((z,i)=>{z.style.transition='none';z.style.opacity=0;z.getBoundingClientRect();z.style.transition='opacity .5s '+(0.25+i*0.14)+'s';z.style.opacity='';});setTimeout(()=>zs.forEach(z=>z.style.transition=''),2200);});};

  /* ---------- mind map: students add ideas to branches ---------- */
  C.mind=el=>{const id=el.dataset.id,st=store.get('mind:'+id,{});
    $$('.br',el).forEach(br=>{const k=br.dataset.k,ideas=$('.ideas',br),f=$('form',br),inp=$('input',br);
      const draw=()=>{ideas.innerHTML=(st[k]||[]).map(t=>`<span>${esc(t)}</span>`).join('');};
      f.addEventListener('submit',e=>{e.preventDefault();const v=inp.value.trim();if(!v)return;(st[k]=st[k]||[]).push(v);store.set('mind:'+id,st);inp.value='';draw();});
      ideas.addEventListener('dblclick',e=>{const s=e.target.closest('span');if(!s)return;const i=[...ideas.children].indexOf(s);st[k].splice(i,1);store.set('mind:'+id,st);draw();});
      draw();});};

  /* ---------- step-through flow (click to light up the next step) ---------- */
  C.flow=el=>{const steps=$$('.st,.ar',el);let n=0;const btn=$('[data-act=step]',el.parentElement);
    const paint=()=>{steps.forEach((s,i)=>s.classList.toggle('lit',i<n));if(btn)btn.textContent=n>=steps.length?'Replay ⟲':'Next step ▶';};
    const step=()=>{n=n>=steps.length?1:Math.min(steps.length,n+(n===0?1:2));paint();};
    btn&&btn.addEventListener('click',step);$$('.st',el).forEach((s,i)=>s.addEventListener('click',()=>{n=i*2+1;paint();}));
    onEnter(el,()=>{n=0;paint();setTimeout(()=>{n=1;paint();},700);});};

  /* ---------- CER strength meter (wraps a sorter) ---------- */
  C.cer=el=>{const sorter=$('[data-component=sorter]',el),meter=$('.meter',el),txt=$('.cerfb',el);
    const calc=()=>{const sup=$$('.bin[data-bin=supports] .chip',sorter).length,ch=$$('.bin[data-bin=challenges] .chip',sorter).length;
      const v=Math.min(100,sup*14+ch*10+(sup&&ch?16:0));$('i',meter).style.setProperty('--v',v+'%');$('.v',meter).textContent=v+'%';
      txt.textContent=!sup&&!ch?'Drag evidence onto the claim to build your argument.':!ch?'Strong so far, but a convincing argument also deals with the evidence that challenges the claim.':!sup?'You have challenged the claim. Which evidence supports it?':'Good: you are weighing both sides. Now explain your judgement in the reasoning box.';};
    sorter.addEventListener('sorter:change',calc);sorter.addEventListener('sorter:checked',calc);calc();};

  C.globe=el=>{if(window.GlobeComponent)window.GlobeComponent(el);};
  /* ---------- zone map: light up one land-use zone on a real map (pre-cut layers per zone) ---------- */
  C.zonemap=el=>{const btns=$$('.zlegend button',el),layers=$$('img.zl',el);let cur=null;
    const pick=k=>{cur=cur===k?null:k;el.classList.toggle('focus',!!cur);btns.forEach(b=>b.classList.toggle('on',b.dataset.k===cur));layers.forEach(l=>l.classList.toggle('on',l.dataset.k===cur));
      const r=$('.zread',el);if(r){const b=btns.find(x=>x.dataset.k===cur);r.innerHTML=b?b.dataset.read:r.dataset.default;}if(cur&&window.Sfx)window.Sfx.pop();};
    btns.forEach(b=>b.addEventListener('click',()=>pick(b.dataset.k)));
    onEnter(el,()=>{cur=null;el.classList.remove('focus');btns.forEach(b=>b.classList.remove('on'));layers.forEach(l=>l.classList.remove('on'));
      // a short tour: flash each zone once when the slide opens
      let i=0;clearInterval(el._tour);el._tour=setInterval(()=>{if(i<btns.length){layers.forEach((l,j)=>l.classList.toggle('flash',j===i));i++;}else{layers.forEach(l=>l.classList.remove('flash'));clearInterval(el._tour);}},650);});
    onLeave(el,()=>clearInterval(el._tour));};
  C.globemap=el=>{window.MapGlobes&&window.MapGlobes.globemap(el);};
  C.globenight=el=>{window.MapGlobes&&window.MapGlobes.globenight(el);};
  C.globecities=el=>{window.MapGlobes&&window.MapGlobes.globecities(el);};

  window.Components={init(root){$$('[data-component]',root).forEach(el=>{const n=el.dataset.component;if(C[n]&&!el.__c){el.__c=1;try{C[n](el);}catch(err){console.error('Component',n,err);}}});}};
})();
