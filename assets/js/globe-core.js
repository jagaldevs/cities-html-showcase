/* Shared 3D globe engine (three.js r149). Used by the fly-in, the urban-share map,
   the night-lights explorer and the megacities globe.
   - drag to spin, scroll or pinch to zoom, gentle auto-spin until someone touches it
   - flyTo(lat, lon, zoom) with eased animation
   - pick(event) → {lat, lon} under the pointer
   - pins / spikes / HTML labels that follow the surface and hide on the far side
   Coordinates follow three.js's sphere UV mapping, so equirectangular textures line up. */
(function(){
  'use strict';
  const D2R=Math.PI/180;
  const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
  function vec(lat,lon,r=1){const phi=(lon+180)*D2R,th=(90-lat)*D2R;return new THREE.Vector3(-Math.cos(phi)*Math.sin(th)*r,Math.cos(th)*r,Math.sin(phi)*Math.sin(th)*r);}
  function webglOK(){try{const c=document.createElement('canvas');return !!(c.getContext('webgl')||c.getContext('experimental-webgl'));}catch(e){return false;}}

  class Globe{
    constructor(canvas,o={}){
      this.canvas=canvas;this.o=Object.assign({w:1920,h:1080,z:4.2,minZ:1.45,maxZ:6,spin:.00012,atmosphere:[.45,.6,1],stars:true,interactive:true},o);
      const R=this.R=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
      this.scene=new THREE.Scene();this.cam=new THREE.PerspectiveCamera(32,this.o.w/this.o.h,.01,200);
      this.st={spin:o.spin0??2.2,tilt:o.tilt0??.3,z:this.o.z,ox:o.ox??0,oy:o.oy??0};
      this.tilt=new THREE.Group();this.spinG=new THREE.Group();this.scene.add(this.tilt);this.tilt.add(this.spinG);
      if(this.o.stars){const g=new THREE.BufferGeometry(),p=[];for(let i=0;i<2500;i++){const v=new THREE.Vector3().randomDirection().multiplyScalar(40+Math.random()*30);p.push(v.x,v.y,v.z);}
        g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));this.scene.add(new THREE.Points(g,new THREE.PointsMaterial({color:0xffffff,size:.09,transparent:true,opacity:.75})));}
      this.mat=new THREE.MeshBasicMaterial({color:0xffffff});
      this.earth=new THREE.Mesh(new THREE.SphereGeometry(1,128,96),this.mat);this.spinG.add(this.earth);
      const [ar,ag,ab]=this.o.atmosphere;
      this.atm=new THREE.Mesh(new THREE.SphereGeometry(1.13,96,64),new THREE.ShaderMaterial({transparent:true,side:THREE.BackSide,blending:THREE.AdditiveBlending,depthWrite:false,
        vertexShader:'varying vec3 vN;void main(){vN=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
        fragmentShader:`varying vec3 vN;void main(){float i=pow(0.68-dot(vN,vec3(0,0,1.0)),3.6);gl_FragColor=vec4(${ar},${ag},${ab},1.0)*i*1.25;}`}));
      this.scene.add(this.atm);
      this.labels=[];this.anim=null;this.running=false;this.touched=false;this.onFrame=null;this.ray=new THREE.Raycaster();
      this.resize();window.addEventListener('resize',()=>this.resize());
      if(this.o.interactive)this.bindPointer();
    }
    resize(){const s=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--scale'))||1;
      this.R.setPixelRatio(Math.max(.6,Math.min(2,(window.devicePixelRatio||1)*s)));this.R.setSize(this.o.w,this.o.h,false);this.cam.aspect=this.o.w/this.o.h;this.cam.updateProjectionMatrix();}
    setTexture(src,cb){if(src instanceof HTMLCanvasElement){const t=new THREE.CanvasTexture(src);t.encoding=THREE.sRGBEncoding;t.anisotropy=8;this.mat.map=t;this.mat.needsUpdate=true;this.tex=t;cb&&cb();return t;}
      const t=new THREE.TextureLoader().load(src,()=>{this.render();cb&&cb();});t.encoding=THREE.sRGBEncoding;t.anisotropy=8;this.mat.map=t;this.mat.needsUpdate=true;this.tex=t;return t;}
    vec(lat,lon,r){return vec(lat,lon,r);}
    /* orientation that faces (lat,lon) towards the camera */
    target(lat,lon){const v=vec(lat,lon);return {spin:Math.atan2(-v.x,v.z),tilt:lat*D2R};}
    flyTo(lat,lon,z,dur=1800,extra={},done){const t=this.target(lat,lon);let d=(t.spin-this.st.spin)%(Math.PI*2);if(d>Math.PI)d-=Math.PI*2;if(d<-Math.PI)d+=Math.PI*2;
      if(extra.turns)d-=Math.PI*2*extra.turns;
      this.anim={t0:performance.now(),dur,from:{...this.st},to:Object.assign({spin:this.st.spin+d,tilt:t.tilt,z:z??this.st.z},extra.to||{}),done};this.touched=true;this.play();}
    animateTo(to,dur=1200,done){this.anim={t0:performance.now(),dur,from:{...this.st},to,done};this.play();}
    /* pointer: drag to spin, wheel/pinch to zoom; a click (no drag) fires onClick(lat,lon,event) */
    bindPointer(){const c=this.canvas,pts=new Map();let last=null,moved=0,pinch=0,vel=0;
      const sc=()=>parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--scale'))||1;
      c.style.touchAction='none';c.style.cursor='grab';
      c.addEventListener('pointerdown',e=>{c.setPointerCapture(e.pointerId);pts.set(e.pointerId,[e.clientX,e.clientY]);last=[e.clientX,e.clientY];moved=0;this.touched=true;this.anim=null;c.style.cursor='grabbing';this.play();});
      c.addEventListener('pointermove',e=>{if(!pts.has(e.pointerId)){this.hover&&this.hover(e);return;}pts.set(e.pointerId,[e.clientX,e.clientY]);
        if(pts.size===2){const [a,b]=[...pts.values()];const d=Math.hypot(a[0]-b[0],a[1]-b[1]);if(pinch)this.zoomBy(pinch/d);pinch=d;return;}
        const dx=(e.clientX-last[0])/sc(),dy=(e.clientY-last[1])/sc();moved+=Math.abs(dx)+Math.abs(dy);last=[e.clientX,e.clientY];
        const k=.0042*this.st.z/4;this.st.spin+=dx*k;vel=dx*k;this.st.tilt=Math.max(-1.25,Math.min(1.25,this.st.tilt+dy*k));});
      const up=e=>{if(!pts.has(e.pointerId))return;pts.delete(e.pointerId);pinch=0;c.style.cursor='grab';
        if(moved<6&&this.onClick){const p=this.pick(e);if(p)this.onClick(p.lat,p.lon,e);}this.vel=vel;vel=0;};
      c.addEventListener('pointerup',up);c.addEventListener('pointercancel',up);
      c.addEventListener('wheel',e=>{e.preventDefault();this.touched=true;this.anim=null;this.zoomBy(e.deltaY>0?1.1:1/1.1);this.play();},{passive:false});}
    zoomBy(f){this.st.z=Math.max(this.o.minZ,Math.min(this.o.maxZ,this.st.z*f));}
    pick(e){const r=this.canvas.getBoundingClientRect();const x=((e.clientX-r.left)/r.width)*2-1,y=-((e.clientY-r.top)/r.height)*2+1;
      this.ray.setFromCamera({x,y},this.cam);const hit=this.ray.intersectObject(this.earth)[0];if(!hit)return null;
      const p=this.earth.worldToLocal(hit.point.clone()).normalize();const lat=Math.asin(p.y)/D2R;let lon=Math.atan2(p.z,-p.x)/D2R-180;if(lon<-180)lon+=360;if(lon>180)lon-=360;
      const th=(90-lat)*D2R,phi=Math.atan2(p.z,-p.x);return {lat,lon,u:((phi/D2R)%360+360)%360/360,v:(90-lat)/180};}
    /* HTML label pinned to the surface */
    addLabel(el,lat,lon,minFacing=.15){this.labels.push({el,v:vec(lat,lon,1.0),min:minFacing,show:true});el.style.position='absolute';el.style.left='0';el.style.top='0';return this.labels[this.labels.length-1];}
    project(v){const w=v.clone();this.spinG.localToWorld(w);const s=w.clone().project(this.cam);const facing=w.clone().sub(this.scene.position).normalize().dot(this.cam.position.clone().sub(w).normalize());
      return {x:(s.x+1)/2*this.o.w,y:(1-s.y)/2*this.o.h,facing};}
    frame(t){if(!this.running)return;requestAnimationFrame(tt=>this.frame(tt));const dt=Math.min(50,t-(this.last||t));this.last=t;
      if(!this.anim){if(!this.touched)this.st.spin+=dt*this.o.spin;else if(this.vel){this.st.spin+=this.vel;this.vel*=.93;if(Math.abs(this.vel)<1e-5)this.vel=0;}}
      if(this.anim){const a=this.anim,p=Math.min(1,(t-a.t0)/a.dur),e=ease(p);for(const k in a.to)this.st[k]=a.from[k]+(a.to[k]-a.from[k])*e;if(p>=1){this.anim=null;a.done&&a.done();}}
      this.spinG.rotation.y=this.st.spin;this.tilt.rotation.x=this.st.tilt;this.cam.position.set(0,0,this.st.z);this.scene.position.set(this.st.ox,this.st.oy,0);
      this.onFrame&&this.onFrame(t,dt);
      this.render();
      for(const L of this.labels){const p=this.project(L.v);L.el.style.transform=`translate(${p.x}px,${p.y}px)`;L.el.classList.toggle('on',L.show&&p.facing>L.min);}}
    render(){this.R.render(this.scene,this.cam);}
    play(){if(!this.running){this.running=true;this.last=0;requestAnimationFrame(t=>this.frame(t));}}
    stop(){this.running=false;}
  }
  /* Glow sprite texture shared by pins */
  let glow=null;
  Globe.glowTexture=function(){if(glow)return glow;const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d'),gr=g.createRadialGradient(64,64,0,64,64,64);
    gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.25,'rgba(255,80,170,.95)');gr.addColorStop(1,'rgba(208,0,112,0)');g.fillStyle=gr;g.fillRect(0,0,128,128);glow=new THREE.CanvasTexture(c);return glow;};
  Globe.ok=()=>!!window.THREE&&webglOK();
  window.HRSGlobe=Globe;
})();
