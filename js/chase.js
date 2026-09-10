/* Scene two: the run. A corridor of broken geometry that never quite
   resolves, and something behind you that keeps closing. */
window.CLEM = window.CLEM || {};
(function (C) {
  'use strict';

  var SEG = 6;           /* metres between path nodes */
  var NODES = 58;
  var HALF_W = 2.7;      /* how far you can stray from the centre line */

  function makePath(rng) {
    var pts = [], x = 0, z = 0, dir = 0, i;
    for (i = 0; i < NODES; i++) {
      pts.push(new THREE.Vector3(x, 0, z));
      dir += (rng() - 0.5) * 0.55;
      dir = Math.max(-1.05, Math.min(1.05, dir));
      x += Math.sin(dir) * SEG;
      z -= Math.cos(dir) * SEG;
    }
    var cum = [0];
    for (i = 1; i < pts.length; i++) {
      cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    }
    return {
      pts: pts,
      cum: cum,
      total: cum[cum.length - 1],
      at: function (s) {
        s = Math.max(0, Math.min(this.total, s));
        var i = 1;
        while (i < this.cum.length - 1 && this.cum[i] < s) i++;
        var t = (s - this.cum[i - 1]) / (this.cum[i] - this.cum[i - 1]);
        var a = this.pts[i - 1], b = this.pts[i];
        var p = a.clone().lerp(b, t);
        var tan = b.clone().sub(a).normalize();
        return { pos: p, tan: tan, index: i };
      },
      /* nearest point on the polyline, searched near the last known index */
      project: function (p, hint, full) {
        var best = null, i;
        var lo = full ? 1 : Math.max(1, (hint | 0) - 3);
        var hi = full ? this.pts.length - 1 : Math.min(this.pts.length - 1, (hint | 0) + 5);
        for (i = lo; i <= hi; i++) {
          var a = this.pts[i - 1], b = this.pts[i];
          var ab = b.clone().sub(a);
          var len2 = ab.lengthSq();
          var t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / len2));
          var proj = a.clone().add(ab.multiplyScalar(t));
          var d = proj.distanceTo(p);
          if (!best || d < best.dist) {
            var tan = b.clone().sub(a).normalize();
            var nrm = new THREE.Vector3(tan.z, 0, -tan.x);
            best = {
              dist: d,
              index: i,
              s: this.cum[i - 1] + t * (this.cum[i] - this.cum[i - 1]),
              point: proj,
              tan: tan,
              normal: nrm,
              lateral: p.clone().sub(proj).dot(nrm)
            };
          }
        }
        if (!full && best && best.dist > 14) return this.project(p, hint, true);
        return best;
      }
    };
  }

  C.buildChase = function () {
    var rng = C.makeRng(1312);
    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0xbdbdbd);
    scene.fog = new THREE.Fog(0xc4c4c4, 14, 62);
    var path = makePath(rng);

    var mats = [
      C.psp.apply(new THREE.MeshBasicMaterial({ map: C.scanTexture(2, false) })),
      C.psp.apply(new THREE.MeshBasicMaterial({ map: C.scanTexture(9, false), color: 0xe8e8e8 })),
      C.psp.apply(new THREE.MeshBasicMaterial({ map: C.scanTexture(23, true), color: 0x9a9a9a })),
      C.psp.apply(new THREE.MeshBasicMaterial({ map: C.scanTexture(57, true), color: 0x6f6f6f }))
    ];

    /* flat pale ground under everything */
    /* no vertex snapping here: on a plane this large the quantisation
       throws the corners around and it swallows the road */
    var floorPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 900, 40, 40),
      new THREE.MeshBasicMaterial({ color: 0xd2d2d2 })
    );
    floorPlane.rotation.x = -Math.PI / 2;
    floorPlane.position.y = -0.08;
    scene.add(floorPlane);

    /* road ribbon down the centre, run back a little past the spawn */
    var verts = [], uvs = [], idx = [], i, j;
    var rpts = path.pts.slice();
    rpts.unshift(path.pts[0].clone().sub(path.at(0).tan.clone().multiplyScalar(9)));
    var rlen = 0;
    for (i = 0; i < rpts.length; i++) {
      var p = rpts[i];
      var nxt = rpts[Math.min(i + 1, rpts.length - 1)];
      var prv = rpts[Math.max(i - 1, 0)];
      if (i > 0) rlen += p.distanceTo(rpts[i - 1]);
      var tan = nxt.clone().sub(prv).normalize();
      var nrm = new THREE.Vector3(tan.z, 0, -tan.x);
      var w = 3.0 + Math.sin(i * 0.7) * 0.35;
      var l = p.clone().add(nrm.clone().multiplyScalar(w));
      var r = p.clone().add(nrm.clone().multiplyScalar(-w));
      verts.push(l.x, 0.06, l.z, r.x, 0.06, r.z);
      uvs.push(0, rlen / 5, 1, rlen / 5);
      if (i > 0) {
        var b = (i - 1) * 2;
        idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
      }
    }
    var roadGeo = new THREE.BufferGeometry();
    roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    roadGeo.setIndex(idx);
    var road = new THREE.Mesh(
      roadGeo,
      C.psp.apply(new THREE.MeshBasicMaterial({ map: C.asphaltTexture(), color: 0x9c9c9c, side: THREE.DoubleSide }))
    );
    scene.add(road);

    /* broken slabs to either side: the rooms that never resolved */
    var chunkGeo = new THREE.BoxGeometry(1, 1, 1);
    for (i = 1; i < path.pts.length; i++) {
      var a = path.pts[i - 1], bb = path.pts[i];
      var t = bb.clone().sub(a).normalize();
      var n = new THREE.Vector3(t.z, 0, -t.x);
      var mid = a.clone().lerp(bb, 0.5);
      var heading = Math.atan2(t.x, t.z);

      for (var side = -1; side <= 1; side += 2) {
        /* the wall that actually forms the alley */
        var wall = new THREE.Mesh(chunkGeo, mats[rng() * 2 | 0]);
        wall.position.copy(mid).add(n.clone().multiplyScalar(3.9 * side));
        wall.position.y = 2.4;
        wall.scale.set(0.9, 5.0 + rng() * 2.6, SEG * 1.2);
        wall.rotation.y = heading;
        wall.rotation.z = (rng() - 0.5) * 0.26 * side;
        scene.add(wall);

        /* torn fragments hanging off it */
        var frag = new THREE.Mesh(chunkGeo, mats[rng() * mats.length | 0]);
        frag.position.copy(a.clone().lerp(bb, rng())).add(n.clone().multiplyScalar((4.5 + rng() * 1.3) * side));
        frag.position.y = 1.2 + rng() * 4.0;
        frag.scale.set(0.8 + rng() * 1.0, 1.2 + rng() * 2.4, 1.0 + rng() * 2.2);
        frag.rotation.set((rng() - 0.5) * 0.7, heading + (rng() - 0.5) * 0.9, (rng() - 0.5) * 0.8);
        scene.add(frag);

        /* the collapsed neighbourhood behind the wall */
        var count = 3 + (rng() * 3 | 0);
        for (j = 0; j < count; j++) {
          var m = new THREE.Mesh(chunkGeo, mats[rng() * mats.length | 0]);
          var base = a.clone().lerp(bb, rng());
          var off = 5.6 + rng() * 6.5;
          m.position.copy(base).add(n.clone().multiplyScalar(off * side));
          m.position.y = -0.8 + rng() * 4.5;
          m.scale.set(2.0 + rng() * 4.5, 2.4 + rng() * 6.0, 2.0 + rng() * 4.5);
          m.rotation.set((rng() - 0.5) * 0.5, rng() * 6.28, (rng() - 0.5) * 0.5);
          scene.add(m);
        }
      }

      /* occasional ceiling: the corridor becomes a room */
      if (rng() < 0.3) {
        var ceil = new THREE.Mesh(chunkGeo, mats[2 + (rng() * 2 | 0)]);
        ceil.position.copy(mid);
        ceil.position.y = 6.0 + rng() * 1.4;
        ceil.scale.set(10 + rng() * 4, 0.9, SEG * (0.7 + rng() * 0.7));
        ceil.rotation.set((rng() - 0.5) * 0.16, heading, (rng() - 0.5) * 0.16);
        scene.add(ceil);
      }
    }

    /* behind the spawn: the way back is already gone */
    var startInfo = path.at(0);
    var backdrop = new THREE.Mesh(new THREE.BoxGeometry(14, 9, 1.6), mats[3]);
    backdrop.position.copy(path.pts[0]).sub(startInfo.tan.clone().multiplyScalar(7));
    backdrop.position.y = 3.6;
    backdrop.rotation.y = Math.atan2(startInfo.tan.x, startInfo.tan.z);
    scene.add(backdrop);

    /* the house at the end, and the line in front of it */
    var end = path.at(path.total);
    var endTan = end.tan;
    var facade = new THREE.Mesh(
      new THREE.BoxGeometry(13, 10, 6),
      C.psp.apply(new THREE.MeshBasicMaterial({ map: C.facadeTexture() }))
    );
    facade.position.copy(end.pos).add(endTan.clone().multiplyScalar(6));
    facade.position.y = 4.4;
    facade.rotation.y = Math.atan2(endTan.x, endTan.z);
    scene.add(facade);

    var finishS = path.total - 4;
    var fp = path.at(finishS);
    var line = new THREE.Mesh(
      new THREE.PlaneGeometry(6.5, 1.1),
      C.psp.apply(new THREE.MeshBasicMaterial({ color: 0x101010, side: THREE.DoubleSide }))
    );
    line.rotation.x = -Math.PI / 2;
    line.rotation.z = -Math.atan2(fp.tan.x, fp.tan.z);
    line.position.copy(fp.pos);
    line.position.y = 0.03;
    scene.add(line);

    var glow = new THREE.Mesh(
      new THREE.PlaneGeometry(7, 6),
      C.psp.apply(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, fog: false }))
    );
    glow.position.copy(fp.pos).add(fp.tan.clone().multiplyScalar(1.6));
    glow.position.y = 3;
    glow.rotation.y = Math.atan2(fp.tan.x, fp.tan.z) + Math.PI;
    scene.add(glow);

    /* obstacles: three kinds, each asking for a different move */
    var obstacles = [];
    var obsMat = C.psp.apply(new THREE.MeshBasicMaterial({ map: C.scanTexture(77, true), color: 0x4e4e4e }));
    var obsBox = new THREE.BoxGeometry(1, 1, 1);

    function addObstacle(os, kind) {
      var info = path.at(os);
      var n = new THREE.Vector3(info.tan.z, 0, -info.tan.x);
      var o = { s: os, kind: kind, halfDepth: 0.6 };
      if (kind === 'jump') {
        o.latMin = -3.4; o.latMax = 3.4; o.yMin = 0; o.yMax = 0.7;
      } else if (kind === 'crouch') {
        o.latMin = -3.4; o.latMax = 3.4; o.yMin = 1.15; o.yMax = 3.6;
      } else {
        var dir = rng() < 0.5 ? -1 : 1;
        o.latMin = dir < 0 ? -3.6 : -0.5;
        o.latMax = dir < 0 ? 0.5 : 3.6;
        o.yMin = 0; o.yMax = 4.6;
      }
      obstacles.push(o);

      var m = new THREE.Mesh(obsBox, obsMat);
      var lat = (o.latMin + o.latMax) / 2;
      m.position.copy(info.pos).add(n.clone().multiplyScalar(lat));
      m.position.y = (o.yMin + o.yMax) / 2;
      m.scale.set(o.latMax - o.latMin, o.yMax - o.yMin, o.halfDepth * 2);
      m.rotation.y = Math.atan2(info.tan.x, info.tan.z);
      scene.add(m);
    }

    var kinds = ['jump', 'crouch', 'side'];
    var os = 30;
    var kindIdx = rng() * 3 | 0;
    while (os < finishS - 16) {
      addObstacle(os, kinds[kindIdx % 3]);
      kindIdx += 1 + (rng() * 2 | 0);
      os += 21 + rng() * 13;
    }

    /* horizontal overlap in path space, padded by the player's radius */
    function nearObstacles(ps, lateral, radius, pad) {
      var hit = [], i, o;
      for (i = 0; i < obstacles.length; i++) {
        o = obstacles[i];
        if (Math.abs(ps - o.s) < o.halfDepth + radius + (pad || 0) &&
            lateral + radius + (pad || 0) > o.latMin &&
            lateral - radius - (pad || 0) < o.latMax) {
          hit.push(o);
        }
      }
      return hit;
    }

    function blockedAt(ps, lateral, radius, feetY, height) {
      var hit = nearObstacles(ps, lateral, radius), i;
      for (i = 0; i < hit.length; i++) {
        if (feetY + 0.06 < hit[i].yMax && feetY + height > hit[i].yMin) return true;
      }
      return false;
    }

    /* the pursuer */
    var mCanvas = C.monsterCanvas();
    var monsterMat = new THREE.MeshBasicMaterial({
      map: C.monsterTexture(mCanvas),
      transparent: true,
      alphaTest: 0.12,
      depthWrite: false,
      fog: true,
      color: 0x8f8f8f
    });
    var monster = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.9), monsterMat);
    monster.position.set(0, 1.45, 4);
    scene.add(monster);

    var state = {
      scene: scene,
      path: path,
      obstacles: obstacles,
      monster: monster,
      monsterCanvas: mCanvas,
      finishS: finishS,
      spawn: path.pts[0].clone().setY(0),
      spawnYaw: Math.atan2(-path.at(0).tan.x, -path.at(0).tan.z),
      hint: 1,
      playerS: 0,
      monsterS: -30,
      time: 0,
      lungeAt: 6.5,
      caught: false,
      finished: false,
      proximity: 0
    };

    state.reset = function () {
      state.hint = 1;
      state.playerS = 0;
      state.monsterS = -30;
      state.time = 0;
      state.lungeAt = 6.5;
      state.caught = false;
      state.finished = false;
      state.proximity = 0;
    };

    /* keep the player on the road, clamped to the corridor, and stop them
       walking through anything they were meant to get over or under */
    state.collide = function (next, prev, radius, player) {
      var pr = path.project(next, state.hint);
      if (!pr) return;
      state.hint = pr.index;
      var limit = HALF_W - radius;
      if (Math.abs(pr.lateral) > limit) {
        var fixed = pr.point.clone().add(pr.normal.clone().multiplyScalar(Math.sign(pr.lateral) * limit));
        next.x = fixed.x;
        next.z = fixed.z;
        pr = path.project(next, state.hint);
      }
      if (pr.s < 0.6) {
        var startFix = path.at(0.6);
        next.x = startFix.pos.x + pr.normal.x * pr.lateral;
        next.z = startFix.pos.z + pr.normal.z * pr.lateral;
        pr.s = 0.6;
      }

      var height = player ? player.height() : 1.75;
      var feetY = next.y;
      if (blockedAt(pr.s, pr.lateral, radius, feetY, height)) {
        var back = path.project(prev, state.hint);
        /* only refuse the step if where they came from was clear, so
           landing badly never wedges them in place */
        if (back && !blockedAt(back.s, back.lateral, radius, feetY, height)) {
          next.x = prev.x;
          next.z = prev.z;
          pr = back;
        }
      }
      state.hint = pr.index;
      state.playerS = pr.s;
    };

    /* the low barriers can be landed on */
    state.groundHeight = function (p, player) {
      var pr = path.project(p, state.hint);
      if (!pr) return 0;
      var hit = nearObstacles(pr.s, pr.lateral, 0, 0.1), i, top = 0;
      for (i = 0; i < hit.length; i++) {
        if (hit[i].yMin <= 0.01 && hit[i].yMax < 1.0 &&
            p.y >= hit[i].yMax - 0.06 && hit[i].yMax > top) {
          top = hit[i].yMax;
        }
      }
      return top;
    };

    state.canStand = function (p, player) {
      var pr = path.project(p, state.hint);
      if (!pr) return true;
      return !blockedAt(pr.s, pr.lateral, player.radius, p.y, player.standHeight);
    };

    state.update = function (dt, camera) {
      state.time += dt;
      var progress = state.playerS / path.total;

      /* it gains on you, but a sprint always beats it */
      var speed = 4.2 + progress * 1.5;
      state.monsterS += speed * dt;

      /* and every so often it stops pretending to walk */
      if (state.time > state.lungeAt) {
        state.lungeAt = state.time + 8 + Math.random() * 5;
        var gap = state.playerS - state.monsterS;
        if (gap > 12) state.monsterS += gap * 0.22;
      }
      if (state.monsterS < state.playerS - 34) state.monsterS = state.playerS - 34;

      var mp = path.at(state.monsterS);
      monster.position.set(mp.pos.x, 1.45 + Math.sin(state.time * 7.5) * 0.06, mp.pos.z);
      monster.lookAt(camera.position.x, monster.position.y, camera.position.z);

      var gapNow = Math.max(0, state.playerS - state.monsterS);
      state.proximity = Math.max(0, Math.min(1, 1 - gapNow / 26));

      /* it brightens as it arrives; it also stutters */
      var lum = 0.35 + state.proximity * 0.65;
      monsterMat.color.setScalar(lum);
      monsterMat.opacity = 1;
      monster.visible = !(Math.random() < 0.035 * (1 - state.proximity));
      var s = 1 + state.proximity * 0.35;
      monster.scale.set(s, s, s);

      if (gapNow < 1.7) state.caught = true;
      if (state.playerS >= finishS) state.finished = true;
      return state;
    };

    return state;
  };
})(window.CLEM);
