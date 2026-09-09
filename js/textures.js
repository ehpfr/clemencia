/* Procedural textures. Everything is generated in-browser so the game
   ships with zero binary assets. Low resolutions on purpose: the crunch
   is the point. */
window.CLEM = window.CLEM || {};
(function (C) {
  'use strict';

  C.makeRng = function (seed) {
    var s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  };

  function cv(w, h) {
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h || w;
    return c;
  }
  C.cv = cv;

  /* random blocks of noise, one octave */
  function blocks(ctx, size, cell, alpha, rng, lo, hi, tint) {
    var n = Math.ceil(size / cell), x, y, v, r, g, b;
    ctx.save();
    ctx.globalAlpha = alpha;
    for (y = 0; y < n; y++) {
      for (x = 0; x < n; x++) {
        v = lo + rng() * (hi - lo);
        r = tint ? v * tint[0] : v;
        g = tint ? v * tint[1] : v;
        b = tint ? v * tint[2] : v;
        ctx.fillStyle = 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
        ctx.fillRect(x * cell, y * cell, cell + 1, cell + 1);
      }
    }
    ctx.restore();
  }
  C.blocks = blocks;

  function blur(canvas, px) {
    var out = cv(canvas.width, canvas.height);
    var o = out.getContext('2d');
    o.filter = 'blur(' + px + 'px)';
    o.drawImage(canvas, 0, 0);
    o.filter = 'none';
    return out;
  }
  C.blur = blur;

  function tex(canvas, rx, ry, nearest) {
    var t = new THREE.Texture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx || 1, ry || 1);
    t.magFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.needsUpdate = true;
    return t;
  }
  C.tex = tex;

  /* ---------- exterior ---------- */

  C.grassTexture = function () {
    var s = 256, c = cv(s), x = c.getContext('2d'), rng = C.makeRng(7), i, px, py, l;
    x.fillStyle = '#47582f';
    x.fillRect(0, 0, s, s);
    blocks(x, s, 16, 0.45, rng, 50, 120, [0.7, 0.95, 0.55]);
    c = blur(c, 6);
    x = c.getContext('2d');
    /* blades */
    for (i = 0; i < 9000; i++) {
      px = rng() * s;
      py = rng() * s;
      l = 1.5 + rng() * 3;
      x.strokeStyle = 'rgba(' + (56 + rng() * 46 | 0) + ',' + (74 + rng() * 52 | 0) + ',' + (38 + rng() * 34 | 0) + ',0.6)';
      x.lineWidth = 1;
      x.beginPath();
      x.moveTo(px, py);
      x.lineTo(px + (rng() - 0.5) * 2, py - l);
      x.stroke();
    }
    /* dirt patches */
    for (i = 0; i < 40; i++) {
      x.fillStyle = 'rgba(90,84,50,' + (0.05 + rng() * 0.12) + ')';
      x.beginPath();
      x.ellipse(rng() * s, rng() * s, 8 + rng() * 30, 8 + rng() * 24, rng() * 6, 0, 6.3);
      x.fill();
    }
    return tex(c, 34, 34);
  };

  C.brickTexture = function () {
    var s = 256, c = cv(s), x = c.getContext('2d'), rng = C.makeRng(19);
    var rows = 14, bh = s / rows, cols = 6, bw = s / cols, r, col, ox, px, py, i;
    x.fillStyle = '#6a6167';
    x.fillRect(0, 0, s, s);
    for (r = 0; r < rows; r++) {
      ox = (r % 2) * bw * 0.5;
      for (col = -1; col <= cols; col++) {
        px = col * bw + ox;
        py = r * bh;
        var base = 112 + rng() * 52;
        var rr = base * (0.98 + rng() * 0.3);
        var gg = base * (0.78 + rng() * 0.16);
        var bb = base * (0.8 + rng() * 0.24);
        x.fillStyle = 'rgb(' + (rr | 0) + ',' + (gg | 0) + ',' + (bb | 0) + ')';
        x.fillRect(px + 1, py + 1, bw - 2, bh - 2);
      }
    }
    x.strokeStyle = 'rgba(48,44,48,0.75)';
    x.lineWidth = 1.5;
    for (r = 0; r <= rows; r++) {
      x.beginPath();
      x.moveTo(0, r * bh);
      x.lineTo(s, r * bh);
      x.stroke();
    }
    for (r = 0; r < rows; r++) {
      ox = (r % 2) * bw * 0.5;
      for (col = -1; col <= cols; col++) {
        x.beginPath();
        x.moveTo(col * bw + ox, r * bh);
        x.lineTo(col * bw + ox, (r + 1) * bh);
        x.stroke();
      }
    }
    blocks(x, s, 3, 0.3, rng, 20, 235);
    /* vertical grime streaks, the muddy look of a compressed wall tile */
    for (i = 0; i < 260; i++) {
      px = rng() * s;
      x.strokeStyle = 'rgba(' + (30 + rng() * 90 | 0) + ',' + (30 + rng() * 70 | 0) + ',' + (40 + rng() * 70 | 0) + ',' + (0.06 + rng() * 0.14) + ')';
      x.lineWidth = 1 + rng() * 3;
      x.beginPath();
      x.moveTo(px, rng() * s);
      x.lineTo(px + (rng() - 0.5) * 6, rng() * s);
      x.stroke();
    }
    c = blur(c, 0.6);
    return tex(c, 5, 4);
  };

  C.skyTexture = function () {
    var w = 512, h = 256, c = cv(w, h), x = c.getContext('2d'), rng = C.makeRng(41), i;
    var g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#2a2d31');
    g.addColorStop(0.3, '#53575d');
    g.addColorStop(0.44, '#989ba0');
    g.addColorStop(0.5, '#c8c9cb');
    g.addColorStop(1, '#d6d7d9');
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
    var n = cv(w, h), nx = n.getContext('2d');
    nx.fillStyle = '#808080';
    nx.fillRect(0, 0, w, h);
    blocks(nx, w, 64, 0.6, rng, 20, 235);
    blocks(nx, w, 24, 0.4, rng, 20, 235);
    blocks(nx, w, 8, 0.25, rng, 40, 200);
    var nb = blur(n, 9);
    x.globalAlpha = 0.5;
    x.globalCompositeOperation = 'overlay';
    x.drawImage(nb, 0, 0);
    x.globalCompositeOperation = 'source-over';
    x.globalAlpha = 1;
    /* heavy clot of storm cloud near the top */
    for (i = 0; i < 90; i++) {
      x.fillStyle = 'rgba(26,28,32,' + (0.04 + rng() * 0.1) + ')';
      x.beginPath();
      x.ellipse(rng() * w, rng() * h * 0.36, 40 + rng() * 150, 12 + rng() * 46, 0, 0, 6.3);
      x.fill();
    }
    for (i = 0; i < 40; i++) {
      x.fillStyle = 'rgba(214,216,220,' + (0.03 + rng() * 0.09) + ')';
      x.beginPath();
      x.ellipse(rng() * w, h * (0.35 + rng() * 0.5), 50 + rng() * 130, 8 + rng() * 26, 0, 0, 6.3);
      x.fill();
    }
    /* lift the band just above the horizon so the ground meets bright sky */
    var lift = x.createLinearGradient(0, h * 0.34, 0, h);
    lift.addColorStop(0, 'rgba(255,255,255,0)');
    lift.addColorStop(0.55, 'rgba(236,238,241,0.42)');
    lift.addColorStop(1, 'rgba(240,242,245,0.6)');
    x.fillStyle = lift;
    x.fillRect(0, h * 0.34, w, h * 0.66);
    /* put the weather back on top of the lift */
    for (i = 0; i < 70; i++) {
      x.fillStyle = 'rgba(24,26,30,' + (0.05 + rng() * 0.13) + ')';
      x.beginPath();
      x.ellipse(rng() * w, rng() * h * 0.42, 30 + rng() * 130, 10 + rng() * 34, 0, 0, 6.3);
      x.fill();
    }
    for (i = 0; i < 45; i++) {
      x.fillStyle = 'rgba(226,228,232,' + (0.05 + rng() * 0.12) + ')';
      x.beginPath();
      x.ellipse(rng() * w, rng() * h * 0.46, 26 + rng() * 90, 8 + rng() * 22, 0, 0, 6.3);
      x.fill();
    }
    return tex(blur(c, 3), 1, 1);
  };

  /* ---------- chase ---------- */

  /* blown-out grayscale, like a photogrammetry scan that failed */
  C.scanTexture = function (seed, dark) {
    var s = 256, c = cv(s), x = c.getContext('2d'), rng = C.makeRng(seed), i, px, py;
    x.fillStyle = dark ? '#6d6d6d' : '#c9c9c9';
    x.fillRect(0, 0, s, s);
    blocks(x, s, 32, 0.55, rng, dark ? 20 : 90, dark ? 150 : 255);
    c = blur(c, 7);
    x = c.getContext('2d');
    for (i = 0; i < 70; i++) {
      px = rng() * s;
      py = rng() * s;
      var lum = rng() > 0.5 ? 245 : 16;
      x.strokeStyle = 'rgba(' + lum + ',' + lum + ',' + lum + ',' + (0.05 + rng() * 0.3) + ')';
      x.lineWidth = 1 + rng() * 14;
      x.beginPath();
      x.moveTo(px, py);
      x.lineTo(px + (rng() - 0.5) * 180, py + (rng() - 0.5) * 180);
      x.stroke();
    }
    for (i = 0; i < 26; i++) {
      x.fillStyle = 'rgba(8,8,8,' + (0.05 + rng() * 0.25) + ')';
      x.beginPath();
      x.ellipse(rng() * s, rng() * s, 4 + rng() * 40, 4 + rng() * 40, rng() * 6, 0, 6.3);
      x.fill();
    }
    blocks(x, s, 2, 0.16, rng, 0, 255);
    return tex(blur(c, 1), 2, 2);
  };

  C.asphaltTexture = function () {
    var s = 256, c = cv(s), x = c.getContext('2d'), rng = C.makeRng(88), i;
    x.fillStyle = '#787878';
    x.fillRect(0, 0, s, s);
    blocks(x, s, 6, 0.35, rng, 60, 175);
    c = blur(c, 2);
    x = c.getContext('2d');
    for (i = 0; i < 400; i++) {
      var g2 = 40 + rng() * 130 | 0;
      x.fillStyle = 'rgba(' + g2 + ',' + g2 + ',' + g2 + ',0.35)';
      x.fillRect(rng() * s, rng() * s, 1 + rng() * 3, 1 + rng() * 3);
    }
    return tex(c, 1, 6);
  };

  C.facadeTexture = function () {
    var w = 256, h = 256, c = cv(w, h), x = c.getContext('2d'), rng = C.makeRng(303), i, wx, wy;
    x.fillStyle = '#e2e2e2';
    x.fillRect(0, 0, w, h);
    blocks(x, w, 24, 0.3, rng, 150, 255);
    c = blur(c, 5);
    x = c.getContext('2d');
    /* windows */
    for (i = 0; i < 6; i++) {
      wx = 24 + (i % 3) * 80;
      wy = 40 + Math.floor(i / 3) * 96;
      x.fillStyle = 'rgba(18,18,18,0.92)';
      x.fillRect(wx, wy, 46, 62);
      x.strokeStyle = 'rgba(240,240,240,0.9)';
      x.lineWidth = 4;
      x.strokeRect(wx, wy, 46, 62);
    }
    x.fillStyle = '#151515';
    x.font = 'bold 54px "Times New Roman", serif';
    x.textAlign = 'center';
    x.fillText('26', w * 0.5, 30);
    return tex(blur(c, 1), 1, 1);
  };

  /* ---------- the thing that follows you ---------- */

  C.monsterCanvas = function () {
    var w = 256, h = 320, c = cv(w, h), x = c.getContext('2d'), rng = C.makeRng(666), i, px, py;
    x.clearRect(0, 0, w, h);

    /* shoulders / pale shirt */
    x.fillStyle = '#93a7a0';
    x.beginPath();
    x.moveTo(38, h);
    x.lineTo(58, 236);
    x.quadraticCurveTo(128, 208, 198, 236);
    x.lineTo(218, h);
    x.closePath();
    x.fill();

    /* hair behind */
    x.fillStyle = '#14100f';
    x.beginPath();
    x.ellipse(128, 150, 84, 128, 0, 0, 6.3);
    x.fill();
    x.fillRect(44, 150, 168, 150);

    /* neck */
    x.fillStyle = '#b9b3a2';
    x.fillRect(106, 190, 44, 56);

    /* face, elongated and slightly off-axis */
    x.save();
    x.translate(128, 132);
    x.rotate(-0.06);
    x.fillStyle = '#cfc9b8';
    x.beginPath();
    x.ellipse(0, 0, 52, 74, 0, 0, 6.3);
    x.fill();
    /* cheek hollows */
    x.fillStyle = 'rgba(80,74,66,0.5)';
    x.beginPath();
    x.ellipse(-34, 14, 16, 30, 0.2, 0, 6.3);
    x.fill();
    x.beginPath();
    x.ellipse(34, 14, 16, 30, -0.2, 0, 6.3);
    x.fill();
    /* eyes: sunken, barely there */
    x.fillStyle = 'rgba(14,12,12,0.92)';
    x.beginPath();
    x.ellipse(-21, -16, 11, 7, 0.15, 0, 6.3);
    x.fill();
    x.beginPath();
    x.ellipse(20, -14, 10, 6, -0.1, 0, 6.3);
    x.fill();
    x.fillStyle = 'rgba(40,36,34,0.45)';
    x.beginPath();
    x.ellipse(-21, -6, 14, 12, 0, 0, 6.3);
    x.fill();
    x.beginPath();
    x.ellipse(20, -4, 13, 12, 0, 0, 6.3);
    x.fill();
    /* nose smear */
    x.fillStyle = 'rgba(70,64,58,0.5)';
    x.beginPath();
    x.ellipse(-1, 12, 8, 12, 0, 0, 6.3);
    x.fill();
    /* mouth: open, too wide */
    x.fillStyle = '#0a0808';
    x.beginPath();
    x.ellipse(-2, 44, 20, 26, 0.05, 0, 6.3);
    x.fill();
    x.fillStyle = 'rgba(120,112,100,0.35)';
    x.beginPath();
    x.ellipse(-2, 32, 18, 6, 0, 0, 6.3);
    x.fill();
    x.restore();

    /* hair in front, framing */
    x.fillStyle = '#14100f';
    x.beginPath();
    x.moveTo(60, 60);
    x.quadraticCurveTo(128, 20, 196, 60);
    x.quadraticCurveTo(206, 150, 186, 300);
    x.lineTo(160, 300);
    x.quadraticCurveTo(178, 150, 168, 76);
    x.quadraticCurveTo(128, 52, 88, 76);
    x.quadraticCurveTo(78, 150, 96, 300);
    x.lineTo(70, 300);
    x.quadraticCurveTo(50, 150, 60, 60);
    x.fill();

    /* choker */
    x.fillStyle = '#0d0b0b';
    x.fillRect(104, 196, 48, 9);

    /* analogue grime: noise, bleed, scanlines */
    var g = cv(w, h), gx = g.getContext('2d');
    blocks(gx, Math.max(w, h), 2, 1, rng, 0, 255);
    x.globalCompositeOperation = 'source-atop';
    x.globalAlpha = 0.22;
    x.drawImage(g, 0, 0);
    x.globalAlpha = 1;
    for (i = 0; i < h; i += 3) {
      x.fillStyle = 'rgba(0,0,0,0.16)';
      x.fillRect(0, i, w, 1);
    }
    /* dropouts */
    for (i = 0; i < 30; i++) {
      px = rng() * w;
      py = rng() * h;
      x.fillStyle = 'rgba(0,0,0,' + (0.1 + rng() * 0.4) + ')';
      x.fillRect(px, py, rng() * 60, 1 + rng() * 3);
    }
    x.globalCompositeOperation = 'source-over';

    return blur(c, 1.2);
  };

  C.monsterTexture = function (canvas) {
    var t = new THREE.Texture(canvas);
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    t.needsUpdate = true;
    return t;
  };
})(window.CLEM);
