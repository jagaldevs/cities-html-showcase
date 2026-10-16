/* Classroom tools for the HTML deck — all offline, no libraries.
   Ink (pen/highlighter/laser) · countdown timer · name picker · read aloud · learning journal
   · presenter view UI · team quiz · confetti · synthesised sound (Web Audio) · city soundscape */
(function(){
  'use strict';
  const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const NS='hrs-cities:';
  const store={get(k,d){try{const v=localStorage.getItem(NS+k);return v==null?d:JSON.parse(v);}catch(e){return d;}},set(k,v){try{localStorage.setItem(NS+k,JSON.stringify(v));}catch(e){}}};
  const stageEl=()=>document.getElementById('stage');
  const toStage=e=>{const r=stageEl().getBoundingClientRect();return [(e.clientX-r.left)/r.width*1920,(e.clientY-r.top)/r.height*1080];};

  /* =================== SOUND (Web Audio, synthesised — no files) =================== */
  let AC=null;const ac=()=>{if(!AC){try{AC=new (window.AudioContext||window.webkitAudioContext)();}catch(e){}}if(AC&&AC.state==='suspended')AC.resume();return AC;};
  function tone(f,d=.2,type='sine',g=.15,when=0,slide){const c=ac();if(!c)return;const t=c.currentTime+when,o=c.createOscillator(),v=c.createGain();o.type=type;o.frequency.setValueAtTime(f,t);if(slide)o.frequency.exponentialRampToValueAtTime(slide,t+d);
    v.gain.setValueAtTime(0,t);v.gain.linearRampToValueAtTime(g,t+.01);v.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(v).connect(c.destination);o.start(t);o.stop(t+d+.05);}
  const Sfx={tick(){tone(1200,.05,'square',.05);},chime(){[784,988,1175,1568].forEach((f,i)=>tone(f,.9,'sine',.12,i*.12));},
    buzzer(){tone(140,.6,'sawtooth',.18);tone(147,.6,'square',.08);},pop(){tone(600,.12,'sine',.15,0,1200);},
    fanfare(){[523,659,784,1047,784,1047].forEach((f,i)=>tone(f,i===5?.9:.18,'triangle',.16,[0,.15,.3,.45,.7,.85][i]));},
    whoosh(){const c=ac();if(!c)return;const n=noiseNode(c,1.2),bp=c.createBiquadFilter(),g=c.createGain();bp.type='bandpass';bp.Q.value=1.2;const t=c.currentTime;bp.frequency.setValueAtTime(300,t);bp.frequency.exponentialRampToValueAtTime(3000,t+1);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.25,t+.5);g.gain.linearRampToValueAtTime(0,t+1.2);n.connect(bp).connect(g).connect(c.destination);n.start(t);n.stop(t+1.25);}};
  function noiseBuffer(c,sec,brown){const b=c.createBuffer(1,c.sampleRate*sec,c.sampleRate),d=b.getChannelData(0);let last=0;for(let i=0;i<d.length;i++){const w=Math.random()*2-1;if(brown){last=(last+.02*w)/1.02;d[i]=last*3.5;}else d[i]=w;}return b;}
  function noiseNode(c,sec,brown,loop){const s=c.createBufferSource();s.buffer=noiseBuffer(c,sec,brown);s.loop=!!loop;return s;}
  window.Sfx=Sfx;

  /* City soundscape for the Two Bengalurus slider: left = tech corridor, right = settlement lanes */
  const Soundscape=(function(){
    let on=false,busA,busB,master,timers=[],srcs=[];
    function every(fn,min,max){let t;const loop=()=>{fn();t=setTimeout(loop,min+Math.random()*(max-min));timers.push(t);};t=setTimeout(loop,Math.random()*min);timers.push(t);}
    function start(){const c=ac();if(!c||on)return;on=true;master=c.createGain();master.gain.value=0;master.connect(c.destination);master.gain.linearRampToValueAtTime(.9,c.currentTime+1);
      busA=c.createGain();busB=c.createGain();busA.connect(master);busB.connect(master);
      // A: traffic rumble + horns + metro whoosh
      const r=noiseNode(c,4,true,true),lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=420;const rg=c.createGain();rg.gain.value=.55;r.connect(lp).connect(rg).connect(busA);r.start();srcs.push(r);
      every(()=>{const t=c.currentTime,f=[392,440,494,523][Math.random()*4|0];[f,f*1.26].forEach(ff=>{const o=c.createOscillator(),g=c.createGain(),bp=c.createBiquadFilter();o.type='square';o.frequency.value=ff;bp.type='bandpass';bp.frequency.value=ff*2;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.05,t+.02);g.gain.setValueAtTime(.05,t+.22);g.gain.linearRampToValueAtTime(0,t+.3);o.connect(bp).connect(g).connect(busA);o.start(t);o.stop(t+.35);if(Math.random()<.4){const o2=c.createOscillator();o2.type='square';o2.frequency.value=ff;const g2=c.createGain();g2.gain.setValueAtTime(0,t+.4);g2.gain.linearRampToValueAtTime(.04,t+.42);g2.gain.linearRampToValueAtTime(0,t+.6);o2.connect(g2).connect(busA);o2.start(t+.4);o2.stop(t+.65);}});},1800,4200);
      every(()=>{const t=c.currentTime,n=noiseNode(c,3),bp=c.createBiquadFilter(),g=c.createGain();bp.type='bandpass';bp.Q.value=.8;bp.frequency.setValueAtTime(200,t);bp.frequency.linearRampToValueAtTime(1400,t+1.4);bp.frequency.linearRampToValueAtTime(200,t+2.8);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.18,t+1.4);g.gain.linearRampToValueAtTime(0,t+2.8);n.connect(bp).connect(g).connect(busA);n.start(t);n.stop(t+2.9);},7000,12000);
      // B: birds, splashing water at the tap, a pressure-cooker whistle, soft ambience
      const amb=noiseNode(c,4,false,true),alp=c.createBiquadFilter();alp.type='lowpass';alp.frequency.value=900;const ag=c.createGain();ag.gain.value=.025;amb.connect(alp).connect(ag).connect(busB);amb.start();srcs.push(amb);
      every(()=>{const t=c.currentTime,n=2+Math.random()*4|0;for(let i=0;i<n;i++){const o=c.createOscillator(),g=c.createGain(),s=t+i*.13,f=2400+Math.random()*1800;o.frequency.setValueAtTime(f,s);o.frequency.exponentialRampToValueAtTime(f*(Math.random()<.5?1.4:.7),s+.09);g.gain.setValueAtTime(0,s);g.gain.linearRampToValueAtTime(.05,s+.015);g.gain.exponentialRampToValueAtTime(.0001,s+.1);o.connect(g).connect(busB);o.start(s);o.stop(s+.12);}},900,2600);
      every(()=>{const t=c.currentTime;for(let i=0;i<6;i++){const s=t+i*.09+Math.random()*.05,n=noiseNode(c,.2),hp=c.createBiquadFilter(),g=c.createGain();hp.type='bandpass';hp.frequency.value=1500+Math.random()*2500;hp.Q.value=2;g.gain.setValueAtTime(.12,s);g.gain.exponentialRampToValueAtTime(.0001,s+.15);n.connect(hp).connect(g).connect(busB);n.start(s);n.stop(s+.2);}},2500,5000);
      every(()=>{const t=c.currentTime,o=c.createOscillator(),lfo=c.createOscillator(),lg=c.createGain(),g=c.createGain();o.frequency.value=1750;lfo.frequency.value=7;lg.gain.value=40;lfo.connect(lg).connect(o.frequency);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.025,t+.3);g.gain.setValueAtTime(.025,t+1.6);g.gain.linearRampToValueAtTime(0,t+2);o.connect(g).connect(busB);o.start(t);lfo.start(t);o.stop(t+2.1);lfo.stop(t+2.1);},9000,15000);
      mix(.5);}
    function mix(x){if(!on||!AC)return;const t=AC.currentTime;busA.gain.setTargetAtTime(Math.cos(x*Math.PI/2),t,.08);busB.gain.setTargetAtTime(Math.sin(x*Math.PI/2)*1.4,t,.08);}
    function stop(){if(!on)return;on=false;timers.forEach(clearTimeout);timers=[];const m=master,ss=srcs;srcs=[];m.gain.setTargetAtTime(0,AC.currentTime,.2);setTimeout(()=>{ss.forEach(s=>{try{s.stop()}catch(e){}});m.disconnect();},900);}
    return {start,stop,mix,get on(){return on}};
  })();
  window.Soundscape=Soundscape;

  /* =================== CONFETTI =================== */
  function confetti(n=180){
    const cv=document.createElement('canvas');cv.className='confetti';cv.width=1920;cv.height=1080;stageEl().appendChild(cv);const g=cv.getContext('2d');
    const cols=['#840B55','#D00070','#FBDE40','#E1B87F','#ffffff','#84754E'];
    const P=Array.from({length:n},()=>({x:960+(Math.random()-.5)*400,y:600,vx:(Math.random()-.5)*34,vy:-Math.random()*30-12,s:8+Math.random()*12,r:Math.random()*6,vr:(Math.random()-.5)*.4,c:cols[Math.random()*cols.length|0]}));
    let f=0;(function step(){g.clearRect(0,0,1920,1080);P.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=.9;p.vx*=.99;p.r+=p.vr;g.save();g.translate(p.x,p.y);g.rotate(p.r);g.fillStyle=p.c;g.fillRect(-p.s/2,-p.s/4,p.s,p.s/2);g.restore();});
      if(++f<170)requestAnimationFrame(step);else cv.remove();})();
  }
  window.Confetti=confetti;

  /* =================== MODAL helper (scaled with the stage) =================== */
  function modal(cls,html,{onKey,onClose}={}){
    const m=document.createElement('div');m.className='tool-modal '+cls;m.innerHTML=html;stageEl().appendChild(m);
    const close=()=>{m.classList.add('out');setTimeout(()=>m.remove(),250);if(Deck.modal&&Deck.modal.el===m)Deck.modal=null;onClose&&onClose();};
    Deck.modal={el:m,close,key:onKey};
    $$('[data-close]',m).forEach(b=>b.addEventListener('click',close));
    m.addEventListener('click',e=>{if(e.target===m)close();});
    return {el:m,close};
  }

  /* =================== INK: pen, highlighter, laser =================== */
  const Ink=(function(){
    let cv,g,lz,lg,bar,mode=null,color='#D00070',drawing=null,trail=[],raf=0;
    const strokes=new Map();
    function init(){
      cv=document.createElement('canvas');cv.id='ink';cv.width=1920;cv.height=1080;
      lz=document.createElement('canvas');lz.id='laser';lz.width=1920;lz.height=1080;
      stageEl().append(cv,lz);g=cv.getContext('2d');lg=lz.getContext('2d');
      bar=document.createElement('div');bar.id='inkbar';
      bar.innerHTML=`<button data-m="pen" data-c="#D00070" title="Magenta pen"><i style="background:#D00070"></i></button><button data-m="pen" data-c="#1f5fa8" title="Blue pen"><i style="background:#1f5fa8"></i></button><button data-m="pen" data-c="#111" title="Black pen"><i style="background:#111"></i></button>
        <button data-m="hl" data-c="rgba(251,222,64,.45)" title="Highlighter"><i style="background:#FBDE40;border-radius:3px;height:12px"></i></button><button data-m="laser" title="Laser pointer (L)">●</button>
        <button data-a="undo" title="Undo">↶</button><button data-a="clear" title="Clear (C)">✕</button><button data-a="close" title="Stop drawing (D)">⏏</button>`;
      document.body.appendChild(bar);
      bar.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
        if(b.dataset.m){set(b.dataset.m,b.dataset.c);} else if(b.dataset.a==='undo'){const s=list();s.pop();redraw();} else if(b.dataset.a==='clear')clear(); else set(null);});
      cv.addEventListener('pointerdown',down);cv.addEventListener('pointermove',move);window.addEventListener('pointerup',up);
      Deck.onChange(()=>{redraw();});
    }
    const list=()=>{const i=Deck.index;if(!strokes.has(i))strokes.set(i,[]);return strokes.get(i);};
    function set(m,c){mode=m;if(c)color=c;document.body.classList.toggle('inking',!!m);document.body.classList.toggle('lasering',m==='laser');
      $$('button',bar).forEach(b=>b.classList.toggle('on',(b.dataset.m===m&&(!b.dataset.c||b.dataset.c===color))));
      if(m==='laser'&&!raf)loop();}
    function down(e){if(!mode)return;cv.setPointerCapture(e.pointerId);const p=toStage(e);
      if(mode==='laser'){trail.push({p,t:performance.now()});return;}
      drawing={m:mode,c:color,w:mode==='hl'?30:6,pts:[p]};list().push(drawing);}
    function move(e){if(!mode)return;const p=toStage(e);
      if(mode==='laser'){trail.push({p,t:performance.now()});return;}
      if(!drawing)return;drawing.pts.push(p);if(drawing.m==='hl')redraw();else paint(drawing,true);}
    function up(){drawing=null;}
    function paint(s,last){g.save();g.lineCap=g.lineJoin='round';g.strokeStyle=s.c;g.lineWidth=s.w;g.globalCompositeOperation=s.m==='hl'?'multiply':'source-over';
      g.beginPath();const P=s.pts,st=last?Math.max(0,P.length-2):0;g.moveTo(P[st][0],P[st][1]);for(let i=st+1;i<P.length;i++)g.lineTo(P[i][0],P[i][1]);if(P.length===1)g.lineTo(P[0][0]+.1,P[0][1]);g.stroke();g.restore();}
    function redraw(){if(!g)return;g.clearRect(0,0,1920,1080);(strokes.get(Deck.index)||[]).forEach(s=>paint(s));}
    function clear(){strokes.set(Deck.index,[]);redraw();Deck.toast('Ink cleared');}
    function loop(){raf=requestAnimationFrame(loop);const now=performance.now();trail=trail.filter(t=>now-t.t<700);lg.clearRect(0,0,1920,1080);
      if(mode!=='laser'&&!trail.length){cancelAnimationFrame(raf);raf=0;return;}
      for(let i=1;i<trail.length;i++){const a=1-(now-trail[i].t)/700;lg.strokeStyle=`rgba(255,40,60,${a*.85})`;lg.lineWidth=14*a+2;lg.lineCap='round';lg.shadowColor='rgba(255,0,40,.9)';lg.shadowBlur=24;lg.beginPath();lg.moveTo(...trail[i-1].p);lg.lineTo(...trail[i].p);lg.stroke();}}
    // laser dot follows the pointer even when the button is not held
    window.addEventListener('pointermove',e=>{if(mode==='laser'){const p=toStage(e);trail.push({p,t:performance.now()});}});
    return {init,set,clear,get mode(){return mode}};
  })();

  /* =================== COUNTDOWN TIMER =================== */
  const Timer=(function(){
    let el,end=0,dur=0,left=0,running=false,iv,lastSec=-1;
    function ui(){el=document.createElement('div');el.id='timer';el.innerHTML=`<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" class="tb"/><circle cx="60" cy="60" r="52" class="tr"/></svg><div class="tt">2:00</div>
      <div class="tp"><button data-s="60">1</button><button data-s="120">2</button><button data-s="180">3</button><button data-s="300">5</button><button data-s="600">10</button></div>
      <div class="tc"><button data-a="pp">Pause</button><button data-a="x">✕</button></div>`;document.body.appendChild(el);
      el.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.s)start(+b.dataset.s);else if(b.dataset.a==='pp')toggle();else hide();});}
    function start(s){dur=s;left=s;end=Date.now()+s*1000;running=true;el.classList.remove('done');tick();clearInterval(iv);iv=setInterval(tick,200);$('[data-a=pp]',el).textContent='Pause';}
    function toggle(){if(!dur)return;running=!running;if(running){end=Date.now()+left*1000;}$('[data-a=pp]',el).textContent=running?'Pause':'Resume';}
    function tick(){if(running)left=Math.max(0,(end-Date.now())/1000);const s=Math.ceil(left);$('.tt',el).textContent=Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
      $('.tr',el).style.strokeDashoffset=326.7*(1-left/dur);el.classList.toggle('warn',s<=10&&s>0);
      if(running&&s<=5&&s>0&&s!==lastSec){Sfx.tick();}lastSec=s;
      if(running&&left<=0){running=false;clearInterval(iv);el.classList.add('done');Sfx.chime();Deck.toast('Time!');}}
    function show(){if(!el)ui();el.classList.add('on');if(!dur)start(120);}
    function hide(){el.classList.remove('on');running=false;clearInterval(iv);dur=0;}
    return {toggle:()=>{if(el&&el.classList.contains('on'))hide();else show();},start};
  })();

  /* =================== NAME PICKER =================== */
  function picker(){
    const names=store.get('names','');
    const m=modal('picker',`<div class="mbox"><div class="mh"><h2>Random name picker</h2><button data-close class="x">✕</button></div>
      <div class="pk"><div class="reel"><span>Ready?</span></div><div class="pb"><button class="btn solid big" data-a="pick">Pick a name</button><label><input type="checkbox" data-a="norep" ${store.get('norep',true)?'checked':''}> Don't repeat</label></div></div>
      <label class="nl">Class list (one name per line, saved in this browser)</label><textarea rows="5" placeholder="Aisha&#10;Ben&#10;Chloe…">${esc(names)}</textarea><p class="muted pr"></p></div>`);
    const ta=$('textarea',m.el),reel=$('.reel span',m.el),pr=$('.pr',m.el);
    let picked=store.get('picked',[]);
    const pool=()=>ta.value.split('\n').map(s=>s.trim()).filter(Boolean);
    const status=()=>{const p=pool();pr.textContent=p.length?`${p.length} names · ${picked.filter(x=>p.includes(x)).length} already picked`:'Add names to start.';};
    ta.addEventListener('input',()=>{store.set('names',ta.value);status();});status();
    $('[data-a=norep]',m.el).addEventListener('change',e=>store.set('norep',e.target.checked));
    $('[data-a=pick]',m.el).addEventListener('click',()=>{let p=pool();if(!p.length){ta.focus();return;}
      const norep=$('[data-a=norep]',m.el).checked;let cand=norep?p.filter(x=>!picked.includes(x)):p;if(!cand.length){picked=[];cand=p;Deck.toast('Everyone has had a turn: starting again');}
      const win=cand[Math.random()*cand.length|0];let t=0,delay=40;reel.parentElement.classList.remove('win');
      const spin=()=>{reel.textContent=p[t++%p.length];Sfx.tick();delay*=1.11;if(delay<420)setTimeout(spin,delay);else{reel.textContent=win;reel.parentElement.classList.add('win');Sfx.fanfare();confetti(90);picked.push(win);store.set('picked',picked);status();}};spin();});
  }

  /* =================== READ ALOUD (speech synthesis) =================== */
  const Speech=(function(){
    const ok='speechSynthesis' in window;
    function voice(gender){if(!ok)return null;const vs=speechSynthesis.getVoices().filter(v=>/^en/i.test(v.lang));if(!vs.length)return null;
      const F=/female|heera|neerja|zira|aria|jenny|sonia|natasha|catherine|hazel|susan|samantha|karen|veena|libby/i,M=/male|ravi|prabhat|david|guy|ryan|william|mark|george|daniel|james|rishi/i;
      const inn=vs.filter(v=>/en-IN/i.test(v.lang));const pool=inn.length?inn:vs;const want=gender==='f'?F:M;
      return pool.find(v=>want.test(v.name)&&!(gender==='f'?M:F).test(v.name.replace(want,'')))||pool.find(v=>want.test(v.name))||pool[0];}
    function say(text,o={}){if(!ok){Deck.toast('Speech is not available in this browser');return;}speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);
      const v=voice(o.gender);if(v)u.voice=v;u.rate=o.rate||1;u.pitch=o.pitch||1;u.onend=o.onend||null;speechSynthesis.speak(u);}
    function stop(){if(ok)speechSynthesis.cancel();}
    if(ok)speechSynthesis.onvoiceschanged=()=>{};
    function readSlide(){if(!ok){Deck.toast('Speech is not available in this browser');return;}if(speechSynthesis.speaking){stop();Deck.toast('Stopped reading');return;}
      const sl=Deck.slides[Deck.index].cloneNode(true);$$('script,.facil,.showcase,.footer,.chrome,button,.btnrow,svg,.answer'+(document.body.classList.contains('reveal')?'-x':''),sl).forEach(e=>e.remove());
      const t=sl.innerText||sl.textContent;say(t.replace(/\s+/g,' ').trim(),{rate:.98});Deck.toast('Reading aloud: press R to stop');}
    return {say,stop,readSlide,get ok(){return ok}};
  })();
  window.Speech=Speech;

  /* =================== LEARNING JOURNAL (print / save as PDF) =================== */
  function journal(){
    const slides=Deck.slides,sec=[];
    slides.forEach((sl,i)=>{const items=[];
      $$('[data-component=notes]',sl).forEach(n=>{const f=$('textarea,input',n);if(!f||!f.value.trim())return;
        const q=($('label',n)?.textContent)||n.closest('.card')?.querySelector('p')?.textContent||n.closest('div')?.previousElementSibling?.textContent||'Notes';items.push({q:q.trim(),a:f.value.trim()});});
      $$('[data-component=sorter]',sl).forEach(s=>{const rows=$$('.bin',s).map(b=>({b:$('h4',b).textContent,c:$$('.chip',b).map(c=>c.textContent.trim())})).filter(r=>r.c.length);if(rows.length)items.push({q:'My sort',a:rows.map(r=>`${r.b}: ${r.c.join('; ')}`).join('\n')});});
      $$('[data-component=quiz]',sl).forEach(q=>{const st=$('.status',q);if(st)items.push({q:'Quick check score',a:st.textContent});});
      $$('[data-component=mind]',sl).forEach(m=>{const rows=$$('.br',m).map(b=>({h:$('h4',b).textContent,i:$$('.ideas span',b).map(x=>x.textContent)})).filter(r=>r.i.length);if(rows.length)items.push({q:'Solutions mind map',a:rows.map(r=>`${r.h}: ${r.i.join('; ')}`).join('\n')});});
      if(items.length)sec.push({t:sl.dataset.title,n:i+1,items});});
    const nm=store.get('student','');
    const body=sec.length?sec.map(s=>`<section><h3><span>Slide ${s.n}</span>${esc(s.t)}</h3>${s.items.map(it=>`<p class="q">${esc(it.q)}</p><p class="a">${esc(it.a).replace(/\n/g,'<br>')}</p>`).join('')}</section>`).join(''):'<p class="muted">No answers yet. Type into the answer boxes on the slides, then open the journal again.</p>';
    const m=modal('journal',`<div class="mbox"><div class="mh"><h2>My learning journal</h2><button data-close class="x">✕</button></div>
      <div class="jt"><label>Name <input type="text" value="${esc(nm)}" placeholder="Your name"></label><span>Human Landscapes: Cities · Year 8 Geography · ${new Date().toLocaleDateString('en-AU',{day:'numeric',month:'long',year:'numeric'})}</span></div>
      <div class="jb">${body}</div>
      <div class="btnrow"><button class="btn solid" data-a="print">Save as PDF / print</button><button class="btn" data-a="copy">Copy text</button><span class="muted small">Choose “Save as PDF” as the printer, then upload the file to Canvas.</span></div></div>`);
    $('input',m.el).addEventListener('input',e=>store.set('student',e.target.value));
    $('[data-a=print]',m.el).addEventListener('click',()=>{const w=$('input',m.el).value;document.body.classList.add('printing');const pj=document.createElement('div');pj.id='printjournal';
      pj.innerHTML=`<header><img src="assets/img/crest-magenta.svg" alt=""><div><h1>My learning journal</h1><p>${esc(w||'Name: ____________________')} · Human Landscapes: Cities · ${new Date().toLocaleDateString('en-AU')}</p></div></header>`+$('.jb',m.el).innerHTML;document.body.appendChild(pj);
      setTimeout(()=>{window.print();setTimeout(()=>{pj.remove();document.body.classList.remove('printing');},500);},100);});
    $('[data-a=copy]',m.el).addEventListener('click',e=>{const txt=sec.map(s=>`${s.t}\n`+s.items.map(i=>`${i.q}\n${i.a}`).join('\n\n')).join('\n\n---\n\n');navigator.clipboard?.writeText(txt).then(()=>{e.target.textContent='Copied ✓';});});
  }

  /* =================== TEAM QUIZ =================== */
  function teamQuiz(cfg){
    const Q=cfg.questions;let teams=[],qi=0,phase='setup',timer=null,tleft=0;
    const m=modal('tq',`<div class="tqin"></div>`,{onKey:e=>{
      if(/^[1-4]$/.test(e.key)&&phase==='reveal'){award(+e.key-1);return;}
      if(e.key===' '||e.key==='Enter'||e.key==='ArrowRight'){e.preventDefault();if(phase==='ask')reveal();else if(phase==='reveal')nextQ();return;}
      return false;},onClose:()=>clearInterval(timer)});
    const root=$('.tqin',m.el);
    const board=()=>`<div class="sb">${teams.map((t,i)=>`<div class="team" style="--tc:${t.c}"><b>${esc(t.n)}</b><span class="sc">${t.s}</span>${phase==='reveal'?`<button data-aw="${i}">+1 <small>(${i+1})</small></button>`:''}</div>`).join('')}</div>`;
    function setup(){phase='setup';root.innerHTML=`<div class="tqh"><span class="kick">TEAM QUIZ</span><button data-close class="x">✕</button></div><h2 class="big">How many teams?</h2>
      <div class="tsel">${[2,3,4].map(n=>`<button data-n="${n}">${n}</button>`).join('')}</div><p class="muted">${Q.length} questions · 20 seconds each · award points with the buttons or keys 1–4</p>`;
      $$('[data-n]',root).forEach(b=>b.addEventListener('click',()=>{const C=['#D00070','#1f5fa8','#c9a400','#3f8f55'],NM=['Magenta','Blue','Gold','Green'];teams=Array.from({length:+b.dataset.n},(_,i)=>({n:NM[i],c:C[i],s:0}));qi=0;ask();}));$('[data-close]',root).onclick=m.close;}
    function ask(){phase='ask';const q=Q[qi];tleft=20;
      root.innerHTML=`<div class="tqh"><span class="kick">QUESTION ${qi+1} / ${Q.length}</span><div class="clock"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" class="cb"/><circle cx="50" cy="50" r="44" class="cr"/></svg><span>20</span></div><button data-close class="x">✕</button></div>
        <h2 class="q">${esc(q.q)}</h2><div class="opts">${q.o.map((o,i)=>`<div class="o" data-i="${i}"><b>${'ABCD'[i]}</b>${esc(o)}</div>`).join('')}</div><div class="why"></div>
        <div class="foot"><button class="btn solid" data-a="rev">Reveal answer ▶</button></div>${board()}`;
      $('[data-close]',root).onclick=m.close;$('[data-a=rev]',root).onclick=reveal;Sfx.whoosh();
      clearInterval(timer);timer=setInterval(()=>{tleft--;const c=$('.clock',root);if(!c)return;$('span',c).textContent=Math.max(0,tleft);$('.cr',c).style.strokeDashoffset=276.5*(1-tleft/20);c.classList.toggle('warn',tleft<=5);
        if(tleft<=5&&tleft>0)Sfx.tick();if(tleft<=0){clearInterval(timer);Sfx.buzzer();reveal();}},1000);}
    function reveal(){if(phase!=='ask')return;clearInterval(timer);phase='reveal';const q=Q[qi];
      $$('.o',root).forEach((o,i)=>o.classList.add(i===q.a?'right':'dim'));$('.why',root).innerHTML=`<b>${'ABCD'[q.a]}.</b> ${esc(q.why)}`;Sfx.chime();
      $('.foot',root).innerHTML=`<span class="muted">Award points, then</span> <button class="btn solid" data-a="next">${qi<Q.length-1?'Next question ▶':'Final scores ▶'}</button>`;$('[data-a=next]',root).onclick=nextQ;
      $('.sb',root).outerHTML=board();bindAw();}
    function bindAw(){$$('[data-aw]',root).forEach(b=>b.onclick=()=>award(+b.dataset.aw));}
    function award(i){if(!teams[i])return;teams[i].s++;Sfx.pop();$('.sb',root).outerHTML=board();bindAw();const t=$$('.team',root)[i];t.classList.add('bump');}
    function nextQ(){qi++;if(qi<Q.length)ask();else final();}
    function final(){phase='final';const max=Math.max(1,...teams.map(t=>t.s));const best=Math.max(...teams.map(t=>t.s));const win=teams.filter(t=>t.s===best);
      root.innerHTML=`<div class="tqh"><span class="kick">FINAL SCORES</span><button data-close class="x">✕</button></div><h2 class="big">${win.length>1?'It’s a tie!':esc(win[0].n)+' team wins!'}</h2>
        <div class="bars">${teams.map(t=>`<div class="bar"><div class="col" style="--tc:${t.c};--h:${t.s/max*100}%"><span>${t.s}</span></div><b>${esc(t.n)}</b></div>`).join('')}</div><div class="foot"><button class="btn" data-a="again">Play again</button></div>`;
      $('[data-close]',root).onclick=m.close;$('[data-a=again]',root).onclick=setup;Sfx.fanfare();setTimeout(()=>confetti(220),400);}
    setup();
  }
  window.TeamQuiz=teamQuiz;

  /* =================== PRESENTER VIEW (index.html?presenter) =================== */
  window.Presenter=function(Deck){
    const base=location.pathname;let i=0,t0=null,acc=0,run=false;
    const notesOf=n=>{const sl=Deck.slides[n];if(!sl)return'';const d=sl.dataset.notes;const f=$$('.facil',sl).map(x=>$$('p,li',x).map(e=>e.textContent.replace(/\s+/g,' ').trim()).filter(Boolean).join('\n')).join('\n\n');return [d,f].filter(Boolean).join('\n\n')||'No notes for this slide.';};
    const P=document.createElement('div');P.id='presenter';
    P.innerHTML=`<header><div><b class="pt"></b><span class="pn"></span></div><div class="pclock"><span class="el">0:00</span><button data-a="tp">Start</button><button data-a="tr">Reset</button><span class="now"></span></div></header>
      <main><section class="cur"><iframe title="Current slide"></iframe></section><aside><div class="nx"><span class="lbl">NEXT</span><iframe title="Next slide"></iframe></div>
      <div class="notes"><span class="lbl">NOTES</span><div class="nt"></div></div>
      <div class="pbtns"><button data-a="prev">◀ Back</button><button data-a="next" class="go">Next ▶</button></div>
      <div class="ptools"><button data-k="a">Answers (A)</button><button data-k="t">Timer (T)</button><button data-k="n">Name picker (N)</button><button data-k="d">Draw (D)</button><button data-k="l">Laser (L)</button><button data-k="o">Overview (O)</button></div></aside></main>`;
    document.body.appendChild(P);
    const fc=$('.cur iframe',P),fn=$('.nx iframe',P);
    function show(n){i=Math.max(0,Math.min(Deck.N-1,n));fc.src=base+'?preview#'+(i+1);fn.src=base+'?preview#'+Math.min(Deck.N,i+2);
      $('.pt',P).textContent=Deck.slides[i].dataset.title||'';$('.pn',P).textContent=` · slide ${i+1} of ${Deck.N}`;$('.nt',P).textContent=notesOf(i);
      history.replaceState(null,'',location.pathname+location.search+'#'+(i+1));}
    const tell=n=>{if(window.opener&&!window.opener.closed)window.opener.postMessage({hrsDeck:'go',i:n},'*');show(n);if(!run){run=true;t0=Date.now();$('[data-a=tp]',P).textContent='Pause';}};
    P.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const a=b.dataset.a;
      if(a==='next')tell(i+1);else if(a==='prev')tell(i-1);
      else if(a==='tp'){if(run){acc+=Date.now()-t0;run=false;b.textContent='Start';}else{t0=Date.now();run=true;b.textContent='Pause';}}
      else if(a==='tr'){acc=0;t0=Date.now();}
      else if(b.dataset.k&&window.opener)window.opener.postMessage({hrsDeck:'tool',k:b.dataset.k},'*');});
    document.addEventListener('keydown',e=>{if(/^(ArrowRight|PageDown| )$/.test(e.key)){e.preventDefault();tell(i+1);}else if(/^(ArrowLeft|PageUp)$/.test(e.key)){e.preventDefault();tell(i-1);}},true);
    window.addEventListener('message',e=>{const d=e.data||{};if(d.hrsDeck==='at'&&d.i!==i)show(d.i);});
    setInterval(()=>{const ms=acc+(run?Date.now()-t0:0),s=Math.floor(ms/1000);$('.el',P).textContent=Math.floor(s/60)+':'+String(s%60).padStart(2,'0');$('.now',P).textContent=new Date().toLocaleTimeString('en-AU',{hour:'numeric',minute:'2-digit'});},500);
    const n0=parseInt(location.hash.slice(1),10);show(isNaN(n0)?0:n0-1);
    if(window.opener)window.opener.postMessage({hrsDeck:'hello'},'*');
    document.title='Presenter · Human Landscapes: Cities';
  };

  /* =================== register keys with the deck =================== */
  (window.DeckPlugins=window.DeckPlugins||[]).push(Deck=>{
    if(Deck.mode!=='deck')return;
    Ink.init();
    Object.assign(Deck.keys,{
      d:()=>{Ink.set(Ink.mode&&Ink.mode!=='laser'?null:'pen');Deck.toast(Ink.mode?'Drawing on: press D to stop':'Drawing off');},
      l:()=>{Ink.set(Ink.mode==='laser'?null:'laser');Deck.toast(Ink.mode?'Laser pointer on':'Laser off');},
      c:()=>Ink.clear(),
      t:()=>Timer.toggle(),
      n:()=>picker(),
      r:()=>Speech.readSlide(),
      j:()=>journal()});
    Deck.onChange(()=>{Speech.stop();});
    document.addEventListener('click',e=>{const b=e.target.closest('[data-tool]');if(!b)return;const k=b.dataset.tool;if(Deck.keys[k])Deck.keys[k]();});
  });
})();
