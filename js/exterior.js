/* Scene one: a grass dome under a storm, and a brick block with one way in. */
window.CLEM = window.CLEM || {};
(function (C) {
  'use strict';

  var FIELD = 150;
  var DOOR_X = 2.1;        /* door sits off centre, like the reference */
  var DOOR_W = 2.0;
  var DOOR_H = 3.3;
  var HALF = 7.2;          /* building half-extent */
  var HEIGHT = 11.0;
  var WALL_T = 0.55;

  function terrainHeight(x, z) {
    var d = x * x + z * z;
    return -d * 0.0016 + Math.sin(x * 0.07) * 0.25 + Math.cos(z * 0.06) * 0.25;
  }

  C.buildExterior = function () {
    var scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x9ea1a5, 50, 140);

    var sky = new THREE.Mesh(
      new THREE.SphereGeometry(500, 24, 16),
      new THREE.MeshBasicMaterial({ map: C.skyTexture(), side: THREE.BackSide, fog: false })
    );
    scene.add(sky);

    scene.add(new THREE.HemisphereLight(0xb4bcc6, 0x4e5934, 1.3));
    var sun = new THREE.DirectionalLight(0xbfc4cc, 0.5);
    sun.position.set(-40, 60, 25);
    scene.add(sun);

    /* ground */
    var gGeo = new THREE.PlaneGeometry(FIELD, FIELD, 64, 64);
    gGeo.rotateX(-Math.PI / 2);
    var pos = gGeo.attributes.position;
    for (var i = 0; i < pos.count; i++) {
      pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i)));
    }
    gGeo.computeVertexNormals();
    var ground = new THREE.Mesh(
      gGeo,
      C.psp.apply(new THREE.MeshLambertMaterial({ map: C.grassTexture() }))
    );
    scene.add(ground);

    /* building */
    var brick = C.psp.apply(new THREE.MeshLambertMaterial({ map: C.brickTexture() }));
    var dark = C.psp.apply(new THREE.MeshLambertMaterial({ color: 0x0a0a0b }));
    var pale = C.psp.apply(new THREE.MeshLambertMaterial({ color: 0xbfbcb2 }));
    var boxes = [];

    function wall(w, h, d, x, y, z, mat, solid) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat || brick);
      m.position.set(x, y, z);
      scene.add(m);
      if (solid !== false) {
        boxes.push(new THREE.Box3(
          new THREE.Vector3(x - w / 2, y - h / 2, z - d / 2),
          new THREE.Vector3(x + w / 2, y + h / 2, z + d / 2)
        ));
      }
      return m;
    }

    var baseY = terrainHeight(0, 0);
    var cy = baseY + HEIGHT / 2;

    /* back and sides */
    wall(HALF * 2, HEIGHT, WALL_T, 0, cy, -HALF);
    wall(WALL_T, HEIGHT, HALF * 2, -HALF, cy, 0);
    wall(WALL_T, HEIGHT, HALF * 2, HALF, cy, 0);
    /* front, split around the doorway */
    var lx0 = -HALF, lx1 = DOOR_X - DOOR_W / 2;
    var rx0 = DOOR_X + DOOR_W / 2, rx1 = HALF;
    wall(lx1 - lx0, HEIGHT, WALL_T, (lx0 + lx1) / 2, cy, HALF);
    wall(rx1 - rx0, HEIGHT, WALL_T, (rx0 + rx1) / 2, cy, HALF);
    wall(DOOR_W, HEIGHT - DOOR_H, WALL_T, DOOR_X, baseY + DOOR_H + (HEIGHT - DOOR_H) / 2, HALF, brick, false);
    /* roof and floor */
    wall(HALF * 2, WALL_T, HALF * 2, 0, baseY + HEIGHT, 0, brick, false);
    wall(HALF * 2 - WALL_T, 0.1, HALF * 2 - WALL_T, 0, baseY + 0.02, 0, dark, false);

    /* the interior is a void; a pale slab catches the light in the gap */
    var slab = new THREE.Mesh(new THREE.BoxGeometry(1.0, DOOR_H - 0.35, 0.12), pale);
    slab.position.set(DOOR_X - 0.05, baseY + (DOOR_H - 0.35) / 2, HALF - 0.75);
    slab.rotation.y = 0.12;
    scene.add(slab);

    var voidWall = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, HEIGHT), dark);
    voidWall.position.set(0, cy, -HALF + WALL_T);
    scene.add(voidWall);

    /* padded copies for collision so the player never clips a corner */
    function collide(next, prev, radius) {
      for (var i = 0; i < boxes.length; i++) {
        var b = boxes[i];
        if (next.x > b.min.x - radius && next.x < b.max.x + radius &&
            next.z > b.min.z - radius && next.z < b.max.z + radius) {
          var dxl = Math.abs(next.x - (b.min.x - radius));
          var dxr = Math.abs((b.max.x + radius) - next.x);
          var dzl = Math.abs(next.z - (b.min.z - radius));
          var dzr = Math.abs((b.max.z + radius) - next.z);
          var m = Math.min(dxl, dxr, dzl, dzr);
          if (m === dxl) next.x = b.min.x - radius;
          else if (m === dxr) next.x = b.max.x + radius;
          else if (m === dzl) next.z = b.min.z - radius;
          else next.z = b.max.z + radius;
        }
      }
      var r = Math.sqrt(next.x * next.x + next.z * next.z);
      if (r > FIELD / 2 - 8) {
        next.x *= (FIELD / 2 - 8) / r;
        next.z *= (FIELD / 2 - 8) / r;
      }
    }

    function groundHeight(p) {
      return terrainHeight(p.x, p.z);
    }

    function reachedDoor(p) {
      return p.z < HALF - 0.1 && p.z > -HALF &&
             Math.abs(p.x - DOOR_X) < DOOR_W * 0.7;
    }

    var spawn = new THREE.Vector3(-16, 0, 25);
    spawn.y = terrainHeight(spawn.x, spawn.z);

    return {
      scene: scene,
      collide: collide,
      groundHeight: groundHeight,
      reachedDoor: reachedDoor,
      spawn: spawn,
      spawnYaw: -0.58,
      doorPoint: new THREE.Vector3(DOOR_X, baseY + 1.6, HALF + 1.2),
      terrainHeight: terrainHeight
    };
  };
})(window.CLEM);
