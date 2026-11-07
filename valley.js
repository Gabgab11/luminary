/* ==========================================================================
   Luminary — the lantern valley
   An original WebGL scene: thousands of warm points of light scattered over a
   rolling night valley. The camera drifts forward on its own, scrolling speeds
   it up, the mouse pushes nearby lights aside and makes them glow, and
   hovering the hero arrow brings the flight to a stop while the lights lift
   and scatter. Ambient sound is synthesised live with Web Audio (no files).
   ========================================================================== */
(function () {
  "use strict";

  var root = document.documentElement;
  var host = document.getElementById("valley");
  var loader = document.getElementById("loader");
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function revealUI() { root.classList.add("ui-on"); }
  function hideLoader() { if (loader) loader.classList.add("gone"); }
  // never leave the page hidden if anything below fails
  var safety = setTimeout(function () { hideLoader(); revealUI(); }, 3500);

  var api = { startHover: function () {}, stopHover: function () {}, toggleSound: function () { return false; } };
  window.LuminaryValley = api;

  if (!host) { hideLoader(); revealUI(); return; }

  /* ---------------- terrain (shared by JS camera and GLSL) ---------------- */
  function path(z) { return Math.sin(z * 0.012) * 14 + Math.sin(z * 0.005) * 8; }
  function height(x, z) {
    var dx = Math.abs(x - path(z)) / 18;
    return Math.pow(dx, 1.6) * 7 + Math.sin(x * 0.11 + z * 0.05) * 1.6 +
      Math.sin(z * 0.031 - x * 0.07) * 2.2 + Math.sin(x * 0.37 + z * 0.21) * 0.35;
  }
  var GLSL_TERRAIN =
    "float pathX(float z){return sin(z*0.012)*14.0+sin(z*0.005)*8.0;}\n" +
    "float terrain(float x,float z){float dx=abs(x-pathX(z))/18.0;" +
    "return pow(dx,1.6)*7.0+sin(x*0.11+z*0.05)*1.6+sin(z*0.031-x*0.07)*2.2+sin(x*0.37+z*0.21)*0.35;}\n";

  /* ---------------- GL setup ---------------- */
  var canvas = document.createElement("canvas");
  host.insertBefore(canvas, host.firstChild);
  var gl = null;
  try {
    gl = canvas.getContext("webgl", { antialias: false, alpha: false, depth: false, powerPreference: "high-performance" }) ||
      canvas.getContext("experimental-webgl");
  } catch (e) { gl = null; }
  if (!gl) { root.classList.add("no-gl"); hideLoader(); revealUI(); return; }

  var small = Math.min(window.innerWidth, window.innerHeight) < 700;
  var COUNT = small ? 5200 : 10000;
  var DEPTH = 180;

  var VERT_POINTS =
    "precision highp float;\n" + GLSL_TERRAIN +
    "attribute vec3 aPos; attribute vec4 aSeed;\n" +
    "uniform mat4 uView; uniform mat4 uProj;\n" +
    "uniform float uCamZ, uTime, uDepth, uDisperse, uPx, uAspect, uMouseOn, uIntro;\n" +
    "uniform vec2 uMouse;\n" +
    "varying float vAlpha; varying vec3 vColor; varying float vGlow;\n" +
    "vec3 palette(float k){\n" +
    "  if(k<0.25) return vec3(0.96,0.94,0.88);\n" +       // cream
    "  if(k<0.55) return vec3(0.95,0.73,0.40);\n" +       // lantern gold
    "  if(k<0.80) return vec3(1.00,0.52,0.22);\n" +       // ember orange
    "  return vec3(0.72,0.80,0.96);\n" +                  // moon blue, sparse
    "}\n" +
    "void main(){\n" +
    "  float seed=aSeed.x;\n" +
    "  float wz=uCamZ+mod(aPos.y-uCamZ,uDepth)-6.0;\n" +
    "  float x=aPos.x;\n" +
    "  vec3 p=vec3(x, terrain(x,wz)+aPos.z, wz);\n" +
    "  p.x+=sin(uTime*0.6+seed*6.283)*0.18;\n" +
    "  p.y+=sin(uTime*0.8+seed*12.0)*0.14*(1.0+aPos.z*0.3);\n" +
    "  vec3 dir=normalize(vec3(sin(seed*43.1),0.7+fract(seed*7.3),cos(seed*17.7)*0.6));\n" +
    "  float d=uDisperse;\n" +
    "  p+=dir*d*(1.5+6.0*fract(seed*91.7));\n" +
    "  p.y+=d*sin(uTime*0.9+seed*20.0)*0.7;\n" +
    "  vec4 view=uView*vec4(p,1.0);\n" +
    "  float depth=-view.z;\n" +
    "  vec4 clip=uProj*view;\n" +
    "  vec2 ndc=clip.xy/max(clip.w,0.0001);\n" +
    "  vec2 m=ndc-uMouse; m.x*=uAspect;\n" +
    "  float dist=length(m);\n" +
    "  float push=exp(-dist*dist*14.0)*uMouseOn;\n" +
    "  vec2 md=dist>0.0001?m/dist:vec2(0.0); md.x/=uAspect;\n" +
    "  ndc+=md*push*0.10;\n" +
    "  clip.xy=ndc*clip.w;\n" +
    "  gl_Position=clip;\n" +
    "  float bloom=smoothstep(uDepth*0.9,uDepth*0.3,depth);\n" +
    "  float size=aSeed.w*(0.3+0.7*bloom)*uPx*150.0/max(depth,0.6);\n" +
    "  size*=1.0+push*1.6+d*0.5;\n" +
    "  gl_PointSize=clamp(size,1.0,70.0*uPx);\n" +
    "  float fog=smoothstep(uDepth-6.0,uDepth*0.4,depth)*smoothstep(0.4,4.0,depth);\n" +
    "  float tw=0.7+0.3*sin(uTime*(1.2+seed*2.5)+seed*50.0);\n" +
    "  vAlpha=fog*tw*uIntro*(0.55+0.45*bloom);\n" +
    "  vGlow=push+d*0.35;\n" +
    "  vColor=palette(aSeed.z);\n" +
    "}\n";

  var FRAG_POINTS =
    "precision mediump float;\n" +
    "varying float vAlpha; varying vec3 vColor; varying float vGlow;\n" +
    "void main(){\n" +
    "  vec2 c=gl_PointCoord-0.5; float r=length(c)*2.0;\n" +
    "  if(r>1.0) discard;\n" +
    "  float core=exp(-r*r*22.0);\n" +
    "  float halo=exp(-r*r*4.5)*0.38;\n" +
    "  float a=(core+halo)*vAlpha;\n" +
    "  vec3 col=vColor*(1.0+vGlow*1.8)+vec3(core*0.5*vGlow);\n" +
    "  gl_FragColor=vec4(col*a,1.0);\n" +
    "}\n";

  // sky: night gradient, warm horizon haze and faint light rays
  var VERT_SKY = "attribute vec2 aQuad; varying vec2 vUv; void main(){vUv=aQuad*0.5+0.5; gl_Position=vec4(aQuad,0.0,1.0);}";
  var FRAG_SKY =
    "precision mediump float; varying vec2 vUv; uniform float uTime, uAspect, uHorizon, uIntro;\n" +
    "void main(){\n" +
    "  vec2 uv=vUv;\n" +
    "  vec3 top=vec3(0.010,0.012,0.022); vec3 low=vec3(0.022,0.016,0.012);\n" +
    "  vec3 col=mix(low,top,smoothstep(0.2,1.0,uv.y));\n" +
    "  float hz=exp(-pow((uv.y-uHorizon)*5.5,2.0));\n" +
    "  col+=vec3(0.12,0.065,0.025)*hz*0.55;\n" +
    "  vec2 o=vec2(0.18,1.15); vec2 q=uv-o; q.x*=uAspect;\n" +
    "  float ang=atan(q.y,q.x);\n" +
    "  float rays=pow(0.5+0.5*sin(ang*38.0+uTime*0.05),6.0)*0.5+pow(0.5+0.5*sin(ang*17.0-uTime*0.03),8.0)*0.5;\n" +
    "  float fall=smoothstep(1.6,0.2,length(q))*smoothstep(-0.2,0.6,uv.y);\n" +
    "  col+=vec3(0.07,0.06,0.045)*rays*fall*0.6;\n" +
    "  gl_FragColor=vec4(col*uIntro,1.0);\n" +
    "}\n";

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { throw new Error(gl.getShaderInfoLog(s)); }
    return s;
  }
  function program(vs, fs) {
    var p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { throw new Error(gl.getProgramInfoLog(p)); }
    return p;
  }

  var progPts, progSky;
  try {
    progPts = program(VERT_POINTS, FRAG_POINTS);
    progSky = program(VERT_SKY, FRAG_SKY);
  } catch (err) {
    console.warn("Valley shaders failed:", err);
    canvas.remove(); root.classList.add("no-gl"); hideLoader(); revealUI(); return;
  }

  /* ---------------- geometry ---------------- */
  function rnd(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  var pos = new Float32Array(COUNT * 3);
  var seed = new Float32Array(COUNT * 4);
  for (var i = 0; i < COUNT; i++) {
    var t = rnd(i * 3.1);
    var kind = t < 0.12 ? 2 : (t < 0.58 ? 1 : 0); // 2 lantern, 1 bloom, 0 drifting seed
    // lights cluster toward the valley floor, thinning up the slopes
    var side = rnd(i * 1.7) * 2 - 1;
    var x = Math.sign(side) * Math.pow(Math.abs(side), 1.35) * 62;
    var lift, size, colour;
    if (kind === 2) { lift = 0.3 + rnd(i * 5.3) * 0.9; size = 1.7 + rnd(i * 2.9) * 1.1; colour = 0.3 + rnd(i * 8.1) * 0.48; }
    else if (kind === 1) { lift = 0.05 + rnd(i * 5.3) * 0.5; size = 0.9 + rnd(i * 2.9) * 0.7; colour = rnd(i * 8.1) * 0.8; }
    else { lift = 0.6 + rnd(i * 5.3) * 7.5; size = 0.35 + rnd(i * 2.9) * 0.35; colour = rnd(i * 8.1) < 0.82 ? rnd(i * 4.4) * 0.24 : 0.85; }
    pos[i * 3] = x;
    pos[i * 3 + 1] = rnd(i * 9.7) * DEPTH;
    pos[i * 3 + 2] = lift;
    seed[i * 4] = rnd(i * 6.6);
    seed[i * 4 + 1] = kind;
    seed[i * 4 + 2] = colour;
    seed[i * 4 + 3] = size;
  }
  function buffer(data) { var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); return b; }
  var bPos = buffer(pos), bSeed = buffer(seed), bQuad = buffer(new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]));

  var U = {}, A = {};
  ["uView", "uProj", "uCamZ", "uTime", "uDepth", "uDisperse", "uPx", "uAspect", "uMouseOn", "uIntro", "uMouse"].forEach(function (n) { U[n] = gl.getUniformLocation(progPts, n); });
  A.pos = gl.getAttribLocation(progPts, "aPos");
  A.seed = gl.getAttribLocation(progPts, "aSeed");
  var US = {};
  ["uTime", "uAspect", "uHorizon", "uIntro"].forEach(function (n) { US[n] = gl.getUniformLocation(progSky, n); });
  A.quad = gl.getAttribLocation(progSky, "aQuad");

  /* ---------------- matrices ---------------- */
  function perspective(fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
  }
  function lookAt(e, c, up) {
    var zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2];
    var l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
    var xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
    l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
    var yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return new Float32Array([
      xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
      -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1
    ]);
  }

  /* ---------------- input ---------------- */
  var mouse = { x: 0, y: 0, tx: 0, ty: 0, on: 0, ton: 0 };
  window.addEventListener("pointermove", function (e) {
    if (e.pointerType === "touch") return;
    mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.ty = -((e.clientY / window.innerHeight) * 2 - 1);
    mouse.ton = 1;
  }, { passive: true });
  document.addEventListener("pointerleave", function () { mouse.ton = 0; });

  var boost = 0, lastScroll = window.scrollY;
  window.addEventListener("scroll", function () {
    var dy = window.scrollY - lastScroll; lastScroll = window.scrollY;
    boost = Math.max(-6, Math.min(26, boost + dy * (reduced ? 0.01 : 0.06)));
  }, { passive: true });

  var disperse = 0, disperseTarget = 0;

  /* ---------------- size ---------------- */
  var dpr = 1, W = 0, H = 0, proj;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, small ? 1.25 : 1.6);
    W = Math.floor(window.innerWidth * dpr);
    H = Math.floor(window.innerHeight * dpr);
    canvas.width = W; canvas.height = H;
    gl.viewport(0, 0, W, H);
    proj = perspective(56 * Math.PI / 180, W / H, 0.1, 400);
  }
  resize();
  window.addEventListener("resize", resize);

  /* ---------------- loop ---------------- */
  var camZ = 40, t0 = performance.now(), last = t0, intro = reduced ? 1 : 0, introDone = false, firstFrame = true;
  var camX = path(camZ), camY = height(camX, camZ) + 20, vigNow = 62;
  var running = true;
  document.addEventListener("visibilitychange", function () {
    running = !document.hidden;
    if (running) { last = performance.now(); requestAnimationFrame(frame); }
  });

  function frame(now) {
    if (!running) return;
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    var time = (now - t0) / 1000;

    // intro: lights fade up while the camera glides down into the valley
    if (!reduced) intro = Math.min(1, intro + dt / 3.2);
    var ease = 1 - Math.pow(1 - intro, 3);
    if (!introDone && intro > 0.72) { introDone = true; revealUI(); clearTimeout(safety); }

    disperse += (disperseTarget - disperse) * Math.min(1, dt * 2.2);
    boost *= Math.pow(0.12, dt);
    var base = reduced ? 0.6 : 2.4;
    var speed = (base + Math.max(0, boost)) * (1 - disperse * 0.97);
    camZ += speed * dt;

    mouse.x += (mouse.tx - mouse.x) * Math.min(1, dt * 3);
    mouse.y += (mouse.ty - mouse.y) * Math.min(1, dt * 3);
    mouse.on += (mouse.ton - mouse.on) * Math.min(1, dt * 4);

    var aheadZ = camZ + 16;
    var tx = path(camZ), ty = height(tx, camZ) + 3.2 + (1 - ease) * 16;
    camX += (tx - camX) * Math.min(1, dt * 2);
    camY += (ty - camY) * Math.min(1, dt * 2.5);
    var lx = path(aheadZ) + mouse.x * 2.6, ly = height(path(aheadZ), aheadZ) + 0.6 + mouse.y * 1.6 - (1 - ease) * 6;
    var view = lookAt([camX, camY, camZ], [lx, ly, aheadZ], [0, 1, 0]);

    // vignette tightens as you move faster
    var vig = 62 - Math.min(26, Math.max(0, boost) * 1.4);
    if (Math.abs(vig - vigNow) > 0.4) { vigNow = vig; host.style.setProperty("--vig", vig.toFixed(1)); }

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.useProgram(progSky);
    gl.bindBuffer(gl.ARRAY_BUFFER, bQuad);
    gl.enableVertexAttribArray(A.quad);
    gl.vertexAttribPointer(A.quad, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1f(US.uTime, time);
    gl.uniform1f(US.uAspect, W / H);
    gl.uniform1f(US.uHorizon, 0.52 + mouse.y * 0.03);
    gl.uniform1f(US.uIntro, 0.4 + 0.6 * ease);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disableVertexAttribArray(A.quad);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(progPts);
    gl.bindBuffer(gl.ARRAY_BUFFER, bPos);
    gl.enableVertexAttribArray(A.pos);
    gl.vertexAttribPointer(A.pos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, bSeed);
    gl.enableVertexAttribArray(A.seed);
    gl.vertexAttribPointer(A.seed, 4, gl.FLOAT, false, 0, 0);
    gl.uniformMatrix4fv(U.uView, false, view);
    gl.uniformMatrix4fv(U.uProj, false, proj);
    gl.uniform1f(U.uCamZ, camZ);
    gl.uniform1f(U.uTime, time);
    gl.uniform1f(U.uDepth, DEPTH);
    gl.uniform1f(U.uDisperse, disperse);
    gl.uniform1f(U.uPx, dpr * Math.min(1.25, Math.max(0.75, window.innerHeight / 900)));
    gl.uniform1f(U.uAspect, W / H);
    gl.uniform1f(U.uMouseOn, mouse.on);
    gl.uniform1f(U.uIntro, ease);
    gl.uniform2f(U.uMouse, mouse.x, mouse.y);
    gl.drawArrays(gl.POINTS, 0, COUNT);

    if (firstFrame) { firstFrame = false; hideLoader(); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ---------------- ambient sound (synthesised, starts muted) ---------------- */
  var audio = null;
  function buildAudio() {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    var ctx = new Ctx();
    var master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    var filter = ctx.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 1500; filter.Q.value = 0.6;
    filter.connect(master);
    var lfo = ctx.createOscillator(); lfo.frequency.value = 0.06;
    var lfoGain = ctx.createGain(); lfoGain.gain.value = 320; lfo.connect(lfoGain); lfoGain.connect(filter.frequency); lfo.start();
    // a soft G-major-add9 pad
    [98, 146.83, 196, 246.94, 293.66, 440].forEach(function (f, i) {
      [-4, 4].forEach(function (cents) {
        var o = ctx.createOscillator(); o.type = i < 2 ? "sine" : "triangle";
        o.frequency.value = f; o.detune.value = cents + (i * 1.7);
        var g = ctx.createGain(); g.gain.value = i === 5 ? 0.008 : 0.035;
        o.connect(g); g.connect(filter); o.start();
      });
    });
    // night air: filtered noise that breathes slowly
    var len = ctx.sampleRate * 3, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (var k = 0; k < len; k++) d[k] = Math.random() * 2 - 1;
    var noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
    var band = ctx.createBiquadFilter(); band.type = "bandpass"; band.frequency.value = 700; band.Q.value = 0.8;
    var air = ctx.createGain(); air.gain.value = 0.02;
    var airLfo = ctx.createOscillator(); airLfo.frequency.value = 0.09;
    var airDepth = ctx.createGain(); airDepth.gain.value = 0.014; airLfo.connect(airDepth); airDepth.connect(air.gain); airLfo.start();
    noise.connect(band); band.connect(air); air.connect(filter); noise.start();
    return { ctx: ctx, master: master, filter: filter, on: false };
  }
  api.toggleSound = function () {
    if (!audio) audio = buildAudio();
    if (!audio) return false;
    var ctx = audio.ctx, now = ctx.currentTime;
    audio.on = !audio.on;
    if (audio.on) {
      if (ctx.state === "suspended") ctx.resume();
      audio.master.gain.cancelScheduledValues(now);
      audio.master.gain.setTargetAtTime(0.5, now, 0.6);
    } else {
      audio.master.gain.cancelScheduledValues(now);
      audio.master.gain.setTargetAtTime(0, now, 0.35);
      setTimeout(function () { if (!audio.on) ctx.suspend(); }, 1800);
    }
    return audio.on;
  };
  api.startHover = function () {
    disperseTarget = 1;
    if (audio) audio.filter.frequency.setTargetAtTime(320, audio.ctx.currentTime, 0.25);
  };
  api.stopHover = function () {
    disperseTarget = 0;
    if (audio) audio.filter.frequency.setTargetAtTime(1500, audio.ctx.currentTime, 0.35);
  };
})();
