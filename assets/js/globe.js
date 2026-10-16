/* Fly-in globe (slide "From space to street"): spins, flies to Bengaluru, lands with a pulsing
   marker; after landing the viewer can drag to spin and scroll to zoom. Built on globe-core.js. */
(function(){
  'use strict';
  window.GlobeComponent=function(el){
    const cv=el.querySelector('canvas'),slide=el.closest('.slide');
    const cfg=JSON.parse(el.querySelector('script[type="application/json"]').textContent);
    const facts=slide.querySelector('.gfacts');
    const fly=slide.querySelector('[data-act=fly]'),replay=slide.querySelector('[data-act=replay]');
    if(!window.HRSGlobe||!HRSGlobe.ok()||Deck.mode!=='deck'){el.classList.add('static');facts&&facts.classList.add('on');return;}
    const G=new HRSGlobe(cv,{z:4.4,spin0:2.2,tilt0:.32,ox:.62,minZ:1.3,maxZ:6});
    G.setTexture(window.GLOBE_TEXTURE);
    // marker: glowing dot, pulsing ring, beam of light
    const target=G.vec(cfg.lat,cfg.lon,1),normal=target.clone().normalize();
    const mk=new THREE.Group();mk.position.copy(target);mk.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),normal);G.spinG.add(mk);
    const dot=new THREE.Sprite(new THREE.SpriteMaterial({map:HRSGlobe.glowTexture(),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));dot.scale.set(.035,.035,.035);mk.add(dot);
    const ring=new THREE.Mesh(new THREE.RingGeometry(.012,.015,48),new THREE.MeshBasicMaterial({color:0xff4fa8,transparent:true,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=.002;mk.add(ring);
    const beam=new THREE.Mesh(new THREE.CylinderGeometry(.004,.012,1,16,1,true),new THREE.MeshBasicMaterial({color:0xff6fbf,transparent:true,opacity:.75,blending:THREE.AdditiveBlending,depthWrite:false}));mk.add(beam);
    mk.visible=false;
    const labels=[...el.querySelectorAll('.glabel')].map(l=>G.addLabel(l,+l.dataset.lat,+l.dataset.lon,.2));
    labels.forEach(L=>L.show=false);
    let phase='idle',mkT=0;
    G.onFrame=(t,dt)=>{if(phase==='landed'){mkT+=dt/1000;const p=(mkT%1.6)/1.6;ring.scale.setScalar(1+p*2.6);ring.material.opacity=1-p;const bh=Math.min(1,mkT/.8)*.35;beam.scale.set(1,bh,1);beam.position.y=bh/2;}};
    function startFly(){phase='fly';mk.visible=false;facts&&facts.classList.remove('on');labels.forEach(L=>L.show=false);
      G.touched=false;G.flyTo(cfg.lat,cfg.lon,1.75,4200,{turns:1,to:{ox:0}},landed);G.touched=true;
      setTimeout(()=>labels.forEach(L=>L.show=true),2900);window.Sfx&&window.Sfx.whoosh();fly&&(fly.disabled=true);}
    function landed(){phase='landed';mk.visible=true;mkT=0;labels.forEach(L=>L.show=true);facts&&facts.classList.add('on');window.Sfx&&window.Sfx.chime();
      fly&&(fly.disabled=false,fly.textContent='Street level ▶');el.classList.add('free');}
    function reset(){Object.assign(G.st,{spin:2.2,tilt:.32,z:4.4,ox:.62});G.anim=null;G.touched=false;G.vel=0;phase='idle';mk.visible=false;labels.forEach(L=>L.show=false);facts&&facts.classList.remove('on');el.classList.remove('free');}
    slide.addEventListener('slide:enter',()=>{G.resize();reset();fly&&(fly.textContent='Fly to Bengaluru ▶',fly.disabled=false);G.play();clearTimeout(el._auto);el._auto=setTimeout(()=>{if(phase==='idle'&&!G.touched)startFly();},1800);});
    slide.addEventListener('slide:leave',()=>{G.stop();clearTimeout(el._auto);});
    // dragging before the flight cancels the auto-fly; dragging after landing just explores
    cv.addEventListener('pointerdown',()=>{if(phase==='idle')clearTimeout(el._auto);});
    fly&&fly.addEventListener('click',()=>{if(phase==='landed'){Deck.next();return;}if(phase!=='fly')startFly();});
    replay&&replay.addEventListener('click',()=>{reset();startFly();});
    if(slide.classList.contains('active'))slide.dispatchEvent(new CustomEvent('slide:enter'));
  };
})();
