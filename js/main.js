/* State machine: title -> exterior -> transition -> chase -> ending. */
(function (C) {
  'use strict';

  var canvas = document.getElementById('game');
  var grainCanvas = document.getElementById('grain');
  var titleEl = document.getElementById('title');
  var hintEl = document.getElementById('hint');
  var pauseEl = document.getElementById('pause');
  var fadeEl = document.getElementById('fade');
  var scareEl = document.getElementById('jumpscare');
  var endEl = document.getElementById('ending');
  var glitchEl = document.getElementById('glitch');

  var renderer = C.psp.init(canvas);
  renderer.setClearColor(0x000000, 1);

  var camera = new THREE.PerspectiveCamera(72, 1, 0.1, 900);
  camera.rotation.order = 'YXZ';

  var player = new C.Player(camera, canvas);
  var grain = new C.Grain(grainCanvas);

  var exterior = null;
  var chase = null;
  var mode = 'title';
  var clock = new THREE.Clock();
  var fadeVal = 0;
  var stateTime = 0;
  var scareTimer = 0;

  C.psp.resize(camera);
  window.addEventListener('resize', function () { C.psp.resize(camera); });

  function setFade(v) {
    fadeVal = Math.max(0, Math.min(1, v));
    fadeEl.style.opacity = fadeVal;
  }

  function show(el, on) { el.classList.toggle('on', !!on); }

  function startExterior() {
    if (!exterior) exterior = C.buildExterior();
    player.pos.copy(exterior.spawn);
    player.yaw = exterior.spawnYaw;
    player.pitch = -0.03;
    player.speed = 4.3;
    player.extraRoll = 0;
    camera.fov = 72;
    camera.updateProjectionMatrix();
    C.psp.setJitter(190);
    grain.intensity = 0.05;
    scene = exterior.scene;
    mode = 'exterior';
    stateTime = 0;
    player.enabled = true;
    show(hintEl, true);
    hintEl.textContent = 'WASD / arrows to move · mouse to look';
    setTimeout(function () { if (mode === 'exterior') hintEl.textContent = 'find the way in'; }, 7000);
  }

  function startChase(fresh) {
    if (!chase) chase = C.buildChase();
    if (fresh) chase.reset();
    player.pos.copy(chase.spawn);
    player.yaw = chase.spawnYaw;
    player.pitch = 0;
    player.speed = 7.6;
    camera.fov = 80;
    camera.updateProjectionMatrix();
    grain.intensity = 0.1;
    scene = chase.scene;
    mode = 'chase';
    stateTime = 0;
    player.enabled = true;
    show(hintEl, true);
    hintEl.textContent = 'run';
    setTimeout(function () { if (mode === 'chase') show(hintEl, false); }, 2600);
  }

  function toChase() {
    mode = 'transition';
    player.enabled = false;
    show(hintEl, false);
    show(glitchEl, true);
    stateTime = 0;
  }

  function toEnding() {
    mode = 'ending';
    player.enabled = false;
    show(hintEl, false);
    stateTime = 0;
    if (document.exitPointerLock) document.exitPointerLock();
  }

  function jumpscare() {
    scareEl.style.backgroundImage = 'url(' + chase.monsterCanvas.toDataURL() + ')';
    show(scareEl, true);
    scareTimer = 0.85;
    mode = 'caught';
    player.enabled = false;
    stateTime = 0;
  }

  var scene = new THREE.Scene();

  /* input to begin / resume */
  function begin() {
    if (mode === 'title') {
      show(titleEl, false);
      player.requestLock();
      startExterior();
    } else if (mode === 'exterior' || mode === 'chase') {
      player.requestLock();
    }
  }
  titleEl.addEventListener('click', begin);
  titleEl.addEventListener('touchend', function (e) { e.preventDefault(); begin(); });
  pauseEl.addEventListener('click', begin);
  canvas.addEventListener('click', function () {
    if (mode === 'exterior' || mode === 'chase') player.requestLock();
  });

  var isTouch = ('ontouchstart' in window);
  if (isTouch) {
    document.getElementById('controls-note').textContent = 'left side to move · right side to look';
  }

  function loop() {
    requestAnimationFrame(loop);
    var dt = Math.min(0.05, clock.getDelta());
    stateTime += dt;
    grain.update(dt);

    if (mode === 'exterior') {
      show(pauseEl, !player.locked && !isTouch);
      player.update(dt, exterior.collide);
      if (exterior.reachedDoor(player.pos)) toChase();
      setFade(Math.max(0, fadeVal - dt * 2));
    } else if (mode === 'transition') {
      /* a hard cut through static */
      setFade(Math.min(1, stateTime * 2.2));
      C.psp.setJitter(190 - Math.min(150, stateTime * 260));
      grain.intensity = 0.05 + Math.min(0.55, stateTime * 0.8);
      if (stateTime > 0.95) {
        show(glitchEl, false);
        grain.intensity = 0.1;
        C.psp.setJitter(160);
        startChase(true);
        setFade(1);
      }
    } else if (mode === 'chase') {
      show(pauseEl, !player.locked && !isTouch);
      player.update(dt, chase.collide);
      var st = chase.update(dt, camera);
      var prox = st.proximity;

      /* everything degrades as it closes */
      C.psp.setJitter(165 - prox * 85);
      grain.intensity = 0.09 + prox * 0.22;
      player.extraRoll = Math.sin(stateTime * 1.7) * 0.02 + prox * Math.sin(stateTime * 9) * 0.05;
      camera.fov = 80 + prox * 9 + Math.sin(stateTime * 3.1) * 1.5;
      camera.updateProjectionMatrix();
      chase.scene.fog.far = 62 - prox * 20;

      setFade(Math.max(0, fadeVal - dt * 1.6));
      if (st.caught) jumpscare();
      else if (st.finished) toEnding();
    } else if (mode === 'caught') {
      scareTimer -= dt;
      if (scareTimer <= 0) {
        show(scareEl, false);
        setFade(1);
        startChase(true);
      }
    } else if (mode === 'ending') {
      setFade(Math.min(1, stateTime * 1.6));
      if (stateTime > 1.1) {
        show(endEl, true);
        show(grainCanvas, false);
        grainCanvas.style.opacity = 0;
      }
    }

    if (mode !== 'title') renderer.render(scene, camera);
  }

  /* first frame: build the exterior up front so the cut into the chase is
     the only thing that ever stalls */
  setTimeout(function () {
    exterior = C.buildExterior();
    chase = C.buildChase();
    titleEl.classList.add('ready');
    document.getElementById('title-action').textContent = isTouch ? 'tap to begin' : 'click to begin';
  }, 60);

  loop();

  /* small handle for debugging and for driving the scenes in tests */
  window.__clem = {
    begin: begin,
    toChase: toChase,
    player: player,
    camera: camera,
    chase: function () { return chase; },
    mode: function () { return mode; }
  };
})(window.CLEM);
