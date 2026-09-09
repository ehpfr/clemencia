# clemencia

A short first-person horror piece that runs in the browser. No install, no
plugins, no audio.

You wake on a grass hill under a storm with one brick building in front of
you. Walk to the doorway. Whatever is inside puts you somewhere else, and
something starts running after you. Reach the end of the street.

## Running it

Open `index.html` in a browser, or serve the folder:

```
python3 -m http.server 8000
```

Then visit `http://localhost:8000`. It also works as a static GitHub Pages
site straight from the repository root.

## Controls

| Input | Action |
| --- | --- |
| W A S D / arrow keys | move |
| mouse | look (click to capture the pointer) |
| touch | left half of the screen moves, right half looks |

## How it is put together

- `index.html`, `styles.css` — page shell, overlays, grain and scanline layers.
- `js/textures.js` — every texture is drawn on a canvas at load time, so the
  repository carries no image assets.
- `js/psp.js` — the handheld look. The scene renders into a framebuffer around
  480 pixels wide and is scaled up with nearest-neighbour, and a shader patch
  snaps clip-space coordinates to a coarse grid so geometry swims the way it
  did on a PSP.
- `js/player.js` — pointer-lock and touch controls.
- `js/exterior.js` — the hill, the storm and the brick building.
- `js/chase.js` — the corridor, its broken geometry, and the pursuer.
- `js/main.js` — the state machine: title, exterior, transition, chase, ending.
- `vendor/three.min.js` — Three.js r128, vendored so the game runs offline.

The vertex snapping is deliberately not applied to the very large ground plane
in the chase: quantising the corners of a plane that size throws them far
enough to cover the road.

There is no audio anywhere in the project.
