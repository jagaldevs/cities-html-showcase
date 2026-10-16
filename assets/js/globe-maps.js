/* Map globes built on globe-core.js
   - globemap:    countries shaded by % urban (UN WUP 2018), year slider 1950–2050, hover and click for figures
   - globenight:  Earth at night with numbered pins that fly the camera to each place
   - globecities: the 30 largest cities as spikes of light, rising 1950–2035, with a live leaderboard */
(function(){
  'use strict';
  const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const size=el=>({w:el.clientWidth||el.offsetWidth,h:el.clientHeight||el.offsetHeight});
  const fallback=(el,img)=>{el.classList.add('static');if(img){const i=document.createElement('img');i.src=img;i.className='gstatic';el.appendChild(i);}};
  const canUse=()=>window.HRSGlobe&&HRSGlobe.ok()&&Deck.mode==='deck';
  function lifecycle(el,G,onEnter){const sl=el.closest('.slide');sl.addEventListener('slide:enter',()=>{G.resize();G.play();onEnter&&onEnter();});sl.addEventListener('slide:leave',()=>G.stop());if(sl.classList.contains('active')){G.play();onEnter&&onEnter();}}

  /* OWID-style 10-step brown→teal scale for % urban */
  const BINS=['#7b4a12','#a8692a','#c99a5b','#e2c58f','#f1e4c3','#cfe8e2','#93cfc4','#4ea79b','#1f7a70','#0b4f49'];
  const binColor=p=>p==null?'#5a5560':BINS[Math.min(9,Math.floor(p/10))];

  /* ---------- urban share choropleth ---------- */
  function globemap(el){
    const W=window.WORLD_DATA,cfg=JSON.parse($('script[type="application/json"]',el).textContent);
    const sl=el.closest('.slide'),stage=$('.gstage',el);
    const yr=$('[data-g=year]',sl),wp=$('[data-g=world]',sl),rng=$('[data-g=range]',sl),play=$('[data-g=play]',sl),card=$('[data-g=card]',sl),tip=$('.gtip',el),orig=$('[data-g=orig]',sl),origBox=$('.gorig',el);
    rng.min=0;rng.max=W.years.length-1;rng.step=.01;
    let yi=W.years.indexOf(cfg.year||2020),sel=null;
    const setYearText=i=>{const y=Math.round(W.years[0]+i*5);yr.textContent=y;yr.classList.toggle('proj',y>2020);const k=Math.round(i);wp.textContent=W.world[k][0].toFixed(1)+'%';};
    orig&&orig.addEventListener('click',()=>{const on=origBox.classList.toggle('on');orig.textContent=on?'🌍 Back to the globe':'🗺 Original map';});
    if(!canUse()){fallback(stage,cfg.fallback);setYearText(yi);rng.value=yi;return;}
    const {w,h}=size(stage);const cv=document.createElement('canvas');cv.style.width=w+'px';cv.style.height=h+'px';stage.appendChild(cv);
    const G=new HRSGlobe(cv,{w,h,z:3.35,spin0:-1.1,tilt0:.35,minZ:1.5,maxZ:5,atmosphere:[.6,.7,1]});
    // texture: countries coloured for the current year
    const TW=2048,TH=1024,tex=document.createElement('canvas');tex.width=TW;tex.height=TH;const g=tex.getContext('2d');
    const ids=document.createElement('canvas');ids.width=TW;ids.height=TH;const gi=ids.getContext('2d',{willReadFrequently:true});
    const X=lon=>(lon+180)/360*TW,Y=lat=>(90-lat)/180*TH;
    function trace(ctx,ring,shift){ctx.moveTo(X(ring[0])+shift,Y(ring[1]));let px=ring[0];let off=0;for(let i=2;i<ring.length;i+=2){let x=ring[i]+off;if(x-px>180){off-=360;x-=360;}else if(px-x>180){off+=360;x+=360;}px=x;ctx.lineTo(X(x)+shift,Y(ring[i+1]));}ctx.closePath();}
    function path(ctx,c){ctx.beginPath();for(const r of c.r){trace(ctx,r,0);trace(ctx,r,-TW);trace(ctx,r,TW);}}
    W.countries.forEach((c,i)=>{gi.fillStyle=`rgb(${(i+1)&255},${((i+1)>>8)&255},0)`;path(gi,c);gi.fill('evenodd');});
    function draw(i){const k=Math.max(0,Math.min(W.years.length-1,i));const a=Math.floor(k),b=Math.min(W.years.length-1,a+1),f=k-a;
      g.fillStyle='#0e1b2c';g.fillRect(0,0,TW,TH);
      g.strokeStyle='rgba(255,255,255,.06)';g.lineWidth=1;for(let la=-60;la<=60;la+=30){g.beginPath();g.moveTo(0,Y(la));g.lineTo(TW,Y(la));g.stroke();}for(let lo=-150;lo<=180;lo+=30){g.beginPath();g.moveTo(X(lo),0);g.lineTo(X(lo),TH);g.stroke();}
      for(const c of W.countries){let p=null;if(c.d&&c.d[a]&&c.d[b])p=c.d[a][0]+(c.d[b][0]-c.d[a][0])*f;path(g,c);g.fillStyle=binColor(p);g.fill('evenodd');g.strokeStyle='rgba(20,20,30,.55)';g.lineWidth=1.2;g.stroke();}
      if(sel){path(g,sel);g.strokeStyle='#fff';g.lineWidth=4;g.stroke();g.strokeStyle='#D00070';g.lineWidth=2;g.stroke();}
      if(G.tex)G.tex.needsUpdate=true;}
    draw(yi);G.setTexture(tex);
    const countryAt=e=>{const p=G.pick(e);if(!p)return null;const d=gi.getImageData(Math.floor(p.u*TW)%TW,Math.floor(p.v*TH),1,1).data;const idx=d[0]+(d[1]<<8)-1;return idx>=0?W.countries[idx]:null;};
    const fmt=(c,k)=>{if(!c.d||!c.d[k])return '<span class="muted">No UN data</span>';const [p,u]=c.d[k];return `<b>${p.toFixed(1)}%</b> urban · ${u>=1?u.toFixed(1)+' million':Math.round(u*1000)+' thousand'} people in towns and cities`;};
    function showCard(c){const k=Math.round(yi);if(!c){card.innerHTML='<span class="muted">Click a country to see its figures. Drag to spin, scroll to zoom.</span>';return;}
      const d=c.d;const spark=d?`<svg viewBox="0 0 200 50" class="spark">${(()=>{const pts=d.map((v,j)=>v?`${j*10},${50-v[0]/2}`:'').filter(Boolean).join(' ');return `<polyline points="${pts}" fill="none" stroke="#840B55" stroke-width="2.5"/><line x1="${k*10}" x2="${k*10}" y1="0" y2="50" stroke="#D00070" stroke-dasharray="3 3"/>`;})()}</svg>`:'';
      card.innerHTML=`<div class="cn">${esc(c.n)}</div><div class="cv">${fmt(c,k)} in ${W.years[k]}</div>${d?`<div class="cs">${spark}<span>1950</span><span>2050</span></div><div class="cc">1950: ${d[0][0].toFixed(0)}% → 2050: ${d[20][0].toFixed(0)}%</div>`:''}`;}
    G.onClick=(la,lo,e)=>{const c=countryAt(e);sel=c;draw(yi);showCard(c);if(c)window.Sfx&&window.Sfx.pop();};
    G.hover=e=>{const c=countryAt(e);if(!c){tip.classList.remove('on');return;}const r=stage.getBoundingClientRect(),s=r.width/stage.clientWidth;const k=Math.round(yi);
      tip.innerHTML=`<b>${esc(c.n)}</b> ${c.d&&c.d[k]?c.d[k][0].toFixed(0)+'% urban':'no data'}`;tip.style.transform=`translate(${(e.clientX-r.left)/s+14}px,${(e.clientY-r.top)/s+10}px)`;tip.classList.add('on');};
    cv.addEventListener('pointerleave',()=>tip.classList.remove('on'));
    const setYear=i=>{yi=i;setYearText(i);draw(i);if(sel)showCard(sel);};
    rng.value=yi;setYearText(yi);showCard(null);
    rng.addEventListener('input',()=>{stopPlay();setYear(+rng.value);});rng.addEventListener('keydown',e=>e.stopPropagation());
    let raf=0;const stopPlay=()=>{cancelAnimationFrame(raf);raf=0;play.textContent='▶ Play 1950–2050';};
    play.addEventListener('click',()=>{if(raf){stopPlay();return;}let t0=null;const from=+rng.value>=W.years.length-1.01?0:+rng.value;play.textContent='❚❚ Pause';
      const tick=t=>{if(!t0)t0=t;const v=Math.min(W.years.length-1,from+(t-t0)/450);rng.value=v;setYear(v);if(v<W.years.length-1)raf=requestAnimationFrame(tick);else stopPlay();};raf=requestAnimationFrame(tick);});
    $$('[data-g=fly]',sl).forEach(b=>b.addEventListener('click',()=>{const [la,lo]=b.dataset.ll.split(',').map(Number);G.flyTo(la,lo,2.3,1500);}));
    lifecycle(el,G);el.closest('.slide').addEventListener('slide:leave',stopPlay);
  }

  /* ---------- night-lights explorer with pins ---------- */
  function globenight(el){
    const cfg=JSON.parse($('script[type="application/json"]',el).textContent),stage=$('.gstage',el),host=el.closest('[data-pops]')||el.closest('.body');
    const pinEls=$$('.gpin',el);
    const show=id=>{$$('.pop',host).forEach(p=>p.classList.toggle('on',p.id===id));const t=$('.tracker',host);if(t){const s=$(`[data-for="${id}"]`,t);s&&s.classList.add('done');}};
    pinEls.forEach(p=>p.addEventListener('click',()=>{p.classList.add('done');show(p.dataset.pop);if(G)G.flyTo(+p.dataset.lat,+p.dataset.lon,+(p.dataset.z||2.2),1600);}));
    $$('.tracker [data-for]',host).forEach(s=>s.addEventListener('click',()=>{const p=pinEls.find(x=>x.dataset.pop===s.dataset.for);p&&p.click();}));
    if(!canUse()){fallback(stage,cfg.fallback);return;}
    const {w,h}=size(stage);const cv=document.createElement('canvas');cv.style.width=w+'px';cv.style.height=h+'px';stage.prepend(cv);
    var G=new HRSGlobe(cv,{w,h,z:3.4,spin0:-.6,tilt0:.45,minZ:1.5,maxZ:5});G.setTexture(window.GLOBE_TEXTURE);
    pinEls.forEach(p=>G.addLabel(p,+p.dataset.lat,+p.dataset.lon,.25));
    $('[data-g=reset]',el.closest('.slide'))?.addEventListener('click',()=>G.animateTo({z:3.4,tilt:.45},1200));
    lifecycle(el,G);
  }

  /* ---------- megacities: spikes of light 1950–2035 ---------- */
  function globecities(el){
    const C=window.CITY_DATA,sl=el.closest('.slide'),stage=$('.gstage',el);
    const yr=$('[data-g=year]',sl),rng=$('[data-g=range]',sl),play=$('[data-g=play]',sl),board=$('[data-g=board]',sl),card=$('[data-g=card]',sl);
    const N=C.years.length;rng.min=0;rng.max=N-1;rng.step=.01;
    let yi=0,sel=null;
    const popAt=(c,i)=>{const a=Math.floor(i),b=Math.min(N-1,a+1),f=i-a;return c.p[a]+(c.p[b]-c.p[a])*f;};
    // leaderboard: top 10, rows slide into rank order
    board.innerHTML=C.cities.map((c,j)=>`<button class="lb" data-j="${j}"><span class="rk"></span><span class="nm">${esc(c.n)}</span><span class="bar"><i></i></span><span class="pv"></span></button>`).join('');
    const rows=$$('.lb',board);
    function update(i){yi=i;const y=Math.round(C.years[0]+i*5);yr.textContent=y;yr.classList.toggle('proj',y>C.projFrom);
      const v=C.cities.map((c,j)=>({j,p:popAt(c,i)})).sort((a,b)=>b.p-a.p),max=v[0].p;
      v.forEach((o,r)=>{const el=rows[o.j],me=C.cities[o.j].n==='Bengaluru',pos=me&&r>=10?10:r;el.style.transform=`translateY(${pos*40}px)`;el.classList.toggle('hide',r>=10&&!me);el.classList.toggle('pinned',me&&r>=10);el.querySelector('.rk').textContent=r+1;
        el.querySelector('.pv').textContent=o.p.toFixed(1)+' m';el.querySelector('.bar i').style.width=(o.p/38*100)+'%';el.classList.toggle('me',C.cities[o.j].n==='Bengaluru');});
      if(spikes)spikes.forEach((s,j)=>{const p=popAt(C.cities[j],i);const hgt=.015+p*.0068;s.m.scale.set(1,hgt,1);s.m.position.y=hgt/2;s.cap.position.y=hgt;s.lab.show=v.findIndex(o=>o.j===j)<8||sel===j;});
      if(sel!=null)showCard(sel);}
    function showCard(j){const c=C.cities[j];const k=Math.round(yi);const pts=c.p.map((p,i)=>`${i*12},${60-p*1.5}`).join(' ');
      card.innerHTML=`<div class="cn">${esc(c.n)}</div><div class="cv"><b>${popAt(c,yi).toFixed(1)} million</b> in ${Math.round(C.years[0]+yi*5)}${C.years[0]+yi*5>C.projFrom?' (projected)':''}</div>
        <svg viewBox="0 0 204 62" class="spark"><polyline points="${pts}" fill="none" stroke="#840B55" stroke-width="2.5"/><line x1="${yi*12}" x2="${yi*12}" y1="0" y2="62" stroke="#D00070" stroke-dasharray="3 3"/></svg>
        <div class="cc">1950: ${c.p[0].toFixed(1)} m → 2035: ${c.p[N-1].toFixed(1)} m (×${(c.p[N-1]/c.p[0]).toFixed(1)})</div>`;}
    let spikes=null,G=null;
    rows.forEach(r=>r.addEventListener('click',()=>{const j=+r.dataset.j;sel=j;rows.forEach(x=>x.classList.toggle('sel',x===r));showCard(j);if(G){const [la,lo]=C.cities[j].ll;G.flyTo(la,lo,2.7,1500);}update(yi);}));
    const setFromRange=()=>{update(+rng.value);};
    rng.addEventListener('input',()=>{stopPlay();setFromRange();});rng.addEventListener('keydown',e=>e.stopPropagation());
    let raf=0;const stopPlay=()=>{cancelAnimationFrame(raf);raf=0;play.textContent='▶ Play 1950–2035';};
    play.addEventListener('click',()=>{if(raf){stopPlay();return;}let t0=null;const from=+rng.value>=N-1.01?0:+rng.value;play.textContent='❚❚ Pause';
      const tick=t=>{if(!t0)t0=t;const v=Math.min(N-1,from+(t-t0)/420);rng.value=v;update(v);if(v<N-1)raf=requestAnimationFrame(tick);else stopPlay();};raf=requestAnimationFrame(tick);});
    sl.addEventListener('slide:leave',stopPlay);
    if(!canUse()){fallback(stage);rng.value=N-1;update(N-1);return;}
    const {w,h}=size(stage);const cv=document.createElement('canvas');cv.style.width=w+'px';cv.style.height=h+'px';stage.prepend(cv);
    G=new HRSGlobe(cv,{w,h,z:3.6,spin0:-2.4,tilt0:.42,minZ:1.5,maxZ:5});G.setTexture(window.GLOBE_TEXTURE);G.mat.color.setRGB(.55,.55,.7);
    const up=new THREE.Vector3(0,1,0);
    spikes=C.cities.map((c,j)=>{const g=new THREE.Group();const n=G.vec(c.ll[0],c.ll[1],1);g.position.copy(n);g.quaternion.setFromUnitVectors(up,n.clone().normalize());G.spinG.add(g);
      const col=c.n==='Bengaluru'?0xffe14a:0xff4fa8;
      const m=new THREE.Mesh(new THREE.CylinderGeometry(.006,.009,1,12),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false}));g.add(m);
      const cap=new THREE.Sprite(new THREE.SpriteMaterial({map:HRSGlobe.glowTexture(),color:col,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));cap.scale.set(.05,.05,.05);g.add(cap);
      const lab=document.createElement('div');lab.className='glabel city-s'+(c.n==='Bengaluru'?' me':'');lab.innerHTML=`<span>${esc(c.n)}</span>`;stage.appendChild(lab);
      const L=G.addLabel(lab,c.ll[0],c.ll[1],.2);return {g,m,cap,lab:L};});
    G.onClick=(la,lo)=>{let best=-1,bd=8;C.cities.forEach((c,j)=>{const d=Math.hypot(c.ll[0]-la,(c.ll[1]-lo)*Math.cos(la*Math.PI/180));if(d<bd){bd=d;best=j;}});if(best>=0)rows[best].click();};
    rng.value=0;update(0);
    lifecycle(el,G,()=>{if(!raf&&+rng.value===0)setTimeout(()=>{if(!raf)play.click();},900);});
  }

  window.MapGlobes={globemap,globenight,globecities};
})();
