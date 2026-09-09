/* The look: tiny internal framebuffer scaled up, vertex snapping so
   geometry swims the way it did on a handheld, and a grain overlay. */
window.CLEM = window.CLEM || {};
(function (C) {
  'use strict';

  var INTERNAL_W = 480; /* PSP was 480x272 */

  C.psp = {
    shaders: [],
    jitter: 190,
    renderer: null,
    canvas: null
  };

  C.psp.init = function (canvas) {
    var r = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false
    });
    r.setPixelRatio(1);
    r.autoClear = true;
    C.psp.renderer = r;
    C.psp.canvas = canvas;
    C.psp.resize();
    return r;
  };

  C.psp.resize = function (camera) {
    var w = window.innerWidth, h = window.innerHeight;
    var scale = Math.max(1, Math.round(w / INTERNAL_W));
    var iw = Math.max(240, Math.round(w / scale));
    var ih = Math.max(160, Math.round(h / scale));
    C.psp.renderer.setSize(iw, ih, false);
    var el = C.psp.renderer.domElement;
    el.style.width = '100%';
    el.style.height = '100%';
    if (camera) {
      camera.aspect = iw / ih;
      camera.updateProjectionMatrix();
    }
  };

  /* Snap clip-space xy to a coarse grid: the classic wobble. */
  C.psp.apply = function (material) {
    material.onBeforeCompile = function (shader) {
      shader.uniforms.uJitter = { value: C.psp.jitter };
      shader.vertexShader =
        'uniform float uJitter;\n' +
        shader.vertexShader.replace(
          '#include <project_vertex>',
          [
            '#include <project_vertex>',
            'vec4 pspPos = gl_Position;',
            'pspPos.xyz /= pspPos.w;',
            'pspPos.xy = floor(pspPos.xy * uJitter) / uJitter;',
            'pspPos.xyz *= pspPos.w;',
            'gl_Position = pspPos;'
          ].join('\n')
        );
      C.psp.shaders.push(shader);
    };
    return material;
  };

  C.psp.setJitter = function (v) {
    C.psp.jitter = v;
    for (var i = 0; i < C.psp.shaders.length; i++) {
      if (C.psp.shaders[i].uniforms.uJitter) {
        C.psp.shaders[i].uniforms.uJitter.value = v;
      }
    }
  };

  C.psp.clearShaders = function () {
    C.psp.shaders.length = 0;
  };

  /* Animated grain / tracking noise drawn over the top of everything. */
  function Grain(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = 160;
    this.h = 96;
    canvas.width = this.w;
    canvas.height = this.h;
    this.img = this.ctx.createImageData(this.w, this.h);
    this.intensity = 0.06;
    this.acc = 0;
  }
  Grain.prototype.update = function (dt) {
    this.acc += dt;
    if (this.acc < 0.055) return;
    this.acc = 0;
    var d = this.img.data, n = this.w * this.h, i, v, a = this.intensity;
    for (i = 0; i < n; i++) {
      v = Math.random() * 255 | 0;
      d[i * 4] = v;
      d[i * 4 + 1] = v;
      d[i * 4 + 2] = v;
      d[i * 4 + 3] = (Math.random() < 0.5 ? a * 255 : a * 120) | 0;
    }
    /* tracking band */
    if (Math.random() < 0.18) {
      var band = Math.random() * this.h | 0, bh = 1 + Math.random() * 4 | 0, x, y;
      for (y = band; y < Math.min(this.h, band + bh); y++) {
        for (x = 0; x < this.w; x++) {
          i = (y * this.w + x) * 4;
          d[i] = d[i + 1] = d[i + 2] = 220;
          d[i + 3] = 40 + Math.random() * 90 | 0;
        }
      }
    }
    this.ctx.putImageData(this.img, 0, 0);
  };
  C.Grain = Grain;
})(window.CLEM);
