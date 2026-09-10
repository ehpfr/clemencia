/* First person controls: pointer lock on desktop, twin-stick style drag
   on touch, plus sprint, crouch and a jump with real gravity.
   `pos` is the player's feet; the camera sits at eye height above it. */
window.CLEM = window.CLEM || {};
(function (C) {
  'use strict';

  var GRAVITY = 22;
  var JUMP_SPEED = 6.8;

  function Player(camera, dom) {
    this.camera = camera;
    this.dom = dom;
    this.yaw = 0;
    this.pitch = 0;
    this.pos = new THREE.Vector3(0, 0, 0);   /* feet */
    this.velY = 0;
    this.onGround = true;

    this.radius = 0.42;
    this.standHeight = 1.75;
    this.crouchHeight = 1.05;
    this.eyeStand = 1.62;
    this.eyeCrouch = 0.92;
    this.eye = this.eyeStand;

    this.walkSpeed = 4.6;
    this.sprintMult = 1.62;
    this.crouchMult = 0.62;

    this.crouching = false;
    this.sprinting = false;
    this.locked = false;
    this.keys = {};
    this.touchMove = { x: 0, y: 0 };
    this.touchBtn = { jump: false, crouch: false, sprint: false };
    this.enabled = false;
    this.sensitivity = 0.0022;
    this._jumpQueued = false;
    this._bind();
  }

  Player.prototype.height = function () {
    return this.crouching ? this.crouchHeight : this.standHeight;
  };

  Player.prototype._bind = function () {
    var self = this;

    document.addEventListener('keydown', function (e) {
      if (!self.keys[e.code] && (e.code === 'Space' || e.code === 'KeyJ')) self._jumpQueued = true;
      self.keys[e.code] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].indexOf(e.code) >= 0) e.preventDefault();
    });
    document.addEventListener('keyup', function (e) { self.keys[e.code] = false; });
    window.addEventListener('blur', function () { self.keys = {}; });

    document.addEventListener('pointerlockchange', function () {
      self.locked = document.pointerLockElement === self.dom;
    });
    document.addEventListener('mousemove', function (e) {
      if (!self.locked || !self.enabled) return;
      self.yaw -= e.movementX * self.sensitivity;
      self.pitch -= e.movementY * self.sensitivity;
      self.pitch = Math.max(-1.35, Math.min(1.35, self.pitch));
    });

    /* on-screen buttons take their touches out of the look/move handling */
    function bindButton(id, name) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('touchstart', function (e) {
        e.preventDefault();
        e.stopPropagation();
        self.touchBtn[name] = true;
        if (name === 'jump') self._jumpQueued = true;
        if (name === 'crouch') el.classList.add('held');
        if (name === 'sprint') el.classList.add('held');
      }, { passive: false });
      function release(e) {
        e.preventDefault();
        self.touchBtn[name] = false;
        el.classList.remove('held');
      }
      el.addEventListener('touchend', release);
      el.addEventListener('touchcancel', release);
    }
    bindButton('btn-jump', 'jump');
    bindButton('btn-crouch', 'crouch');
    bindButton('btn-sprint', 'sprint');

    /* touch: left half drives, right half looks */
    var moveId = null, lookId = null, moveStart = { x: 0, y: 0 }, lookLast = { x: 0, y: 0 };
    function onButton(t) {
      var el = document.elementFromPoint(t.clientX, t.clientY);
      return !!(el && el.classList && el.classList.contains('touch-btn'));
    }
    function start(e) {
      if (!self.enabled) return;
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (onButton(t)) continue;
        if (t.clientX < window.innerWidth * 0.5 && moveId === null) {
          moveId = t.identifier;
          moveStart.x = t.clientX;
          moveStart.y = t.clientY;
        } else if (lookId === null) {
          lookId = t.identifier;
          lookLast.x = t.clientX;
          lookLast.y = t.clientY;
        }
      }
    }
    function move(e) {
      if (!self.enabled) return;
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (t.identifier === moveId) {
          self.touchMove.x = Math.max(-1, Math.min(1, (t.clientX - moveStart.x) / 60));
          self.touchMove.y = Math.max(-1, Math.min(1, (t.clientY - moveStart.y) / 60));
        } else if (t.identifier === lookId) {
          self.yaw -= (t.clientX - lookLast.x) * 0.006;
          self.pitch -= (t.clientY - lookLast.y) * 0.006;
          self.pitch = Math.max(-1.35, Math.min(1.35, self.pitch));
          lookLast.x = t.clientX;
          lookLast.y = t.clientY;
        }
      }
      if (moveId !== null || lookId !== null) e.preventDefault();
    }
    function end(e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (t.identifier === moveId) {
          moveId = null;
          self.touchMove.x = 0;
          self.touchMove.y = 0;
        }
        if (t.identifier === lookId) lookId = null;
      }
    }
    document.addEventListener('touchstart', start, { passive: false });
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', end);
    document.addEventListener('touchcancel', end);
  };

  Player.prototype.requestLock = function () {
    if (this.dom.requestPointerLock) this.dom.requestPointerLock();
  };

  Player.prototype.reset = function (x, y, z, yaw) {
    this.pos.set(x, y, z);
    this.yaw = yaw;
    this.pitch = 0;
    this.velY = 0;
    this.onGround = true;
    this.crouching = false;
    this.eye = this.eyeStand;
  };

  Player.prototype.inputVector = function () {
    var f = 0, s = 0, k = this.keys;
    if (k.KeyW || k.ArrowUp) f += 1;
    if (k.KeyS || k.ArrowDown) f -= 1;
    if (k.KeyA || k.ArrowLeft) s -= 1;
    if (k.KeyD || k.ArrowRight) s += 1;
    f -= this.touchMove.y;
    s += this.touchMove.x;
    var len = Math.sqrt(f * f + s * s);
    if (len > 1) { f /= len; s /= len; }
    return { f: f, s: s, moving: len > 0.05 };
  };

  /* world: { collide(next, prev, radius, player),
              groundHeight(pos, player),
              canStand(pos, player) }  — the last two are optional */
  Player.prototype.update = function (dt, world) {
    if (!this.enabled) {
      this.camera.position.set(this.pos.x, this.pos.y + this.eye, this.pos.z);
      return { moving: false };
    }

    var k = this.keys;
    var wantCrouch = !!(k.ControlLeft || k.ControlRight || k.KeyC || this.touchBtn.crouch);
    var blocked = this.crouching && !wantCrouch && world.canStand && !world.canStand(this.pos, this);
    this.crouching = wantCrouch || blocked;

    this.sprinting = !this.crouching && this.onGround &&
      !!(k.ShiftLeft || k.ShiftRight || this.touchBtn.sprint);

    var inp = this.inputVector();
    var speed = this.walkSpeed;
    if (this.crouching) speed *= this.crouchMult;
    else if (this.sprinting && inp.f > 0.1) speed *= this.sprintMult;

    var sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    var dx = (-sin * inp.f + cos * inp.s) * speed;
    var dz = (-cos * inp.f - sin * inp.s) * speed;

    var prev = this.pos.clone();
    this.pos.x += dx * dt;
    this.pos.z += dz * dt;
    if (world.collide) world.collide(this.pos, prev, this.radius, this);

    /* vertical */
    if (this._jumpQueued && this.onGround && !this.crouching) {
      this.velY = JUMP_SPEED;
      this.onGround = false;
    }
    this._jumpQueued = false;

    this.velY -= GRAVITY * dt;
    this.pos.y += this.velY * dt;

    var ground = world.groundHeight ? world.groundHeight(this.pos, this) : 0;
    if (this.pos.y <= ground) {
      this.pos.y = ground;
      this.velY = 0;
      this.onGround = true;
    } else if (this.velY < 0 && this.pos.y - ground < 0.02) {
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    /* eye height eases between standing and crouching */
    var targetEye = this.crouching ? this.eyeCrouch : this.eyeStand;
    this.eye += (targetEye - this.eye) * Math.min(1, dt * 12);

    this.camera.position.set(this.pos.x, this.pos.y + this.eye, this.pos.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(this.pitch, this.yaw, 0);
    return inp;
  };

  C.Player = Player;
})(window.CLEM);
