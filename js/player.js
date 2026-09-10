/* First person controls: pointer lock on desktop, twin-stick style drag
   on touch. The camera itself is the player; a radius handles collision. */
window.CLEM = window.CLEM || {};
(function (C) {
  'use strict';

  function Player(camera, dom) {
    this.camera = camera;
    this.dom = dom;
    this.yaw = 0;
    this.pitch = 0;
    this.pos = new THREE.Vector3(0, 1.62, 0);
    this.vel = new THREE.Vector3();
    this.radius = 0.42;
    this.eye = 1.62;
    this.bob = 0;
    this.speed = 4.2;
    this.locked = false;
    this.keys = {};
    this.touchMove = { x: 0, y: 0 };
    this.enabled = false;
    this.sensitivity = 0.0022;
    this._bind();
  }

  Player.prototype._bind = function () {
    var self = this;

    document.addEventListener('keydown', function (e) {
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

    /* touch: left half drives, right half looks */
    var moveId = null, lookId = null, moveStart = { x: 0, y: 0 }, lookLast = { x: 0, y: 0 };
    function start(e) {
      if (!self.enabled) return;
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
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
      e.preventDefault();
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
      e.preventDefault();
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

  /* collide(nextPos, prevPos) may modify nextPos in place */
  Player.prototype.update = function (dt, collide) {
    if (!this.enabled) return { moving: false };
    var inp = this.inputVector();
    var sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    var dx = (-sin * inp.f + cos * inp.s) * this.speed;
    var dz = (-cos * inp.f - sin * inp.s) * this.speed;

    var prev = this.pos.clone();
    this.pos.x += dx * dt;
    this.pos.z += dz * dt;
    if (collide) collide(this.pos, prev, this.radius);

    if (inp.moving) this.bob += dt * this.speed * 1.9;
    var bobY = Math.sin(this.bob) * 0.045;
    var bobR = Math.cos(this.bob * 0.5) * 0.012;

    this.camera.position.set(this.pos.x, this.pos.y + bobY, this.pos.z);
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.camera.rotation.z = bobR + (this.extraRoll || 0);
    return inp;
  };

  C.Player = Player;
})(window.CLEM);
