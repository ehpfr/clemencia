# clemencia

A short first-person horror piece that runs in the browser. No install, no
plugins, no audio.

You wake on a grass hill under a storm with one brick building in front of
you. Walk to the doorway. Whatever is inside puts you somewhere else, and
something starts running after you. Reach the end of the street.

The street is not clear. Barriers block it at knee height, slabs hang low
enough to stop you, and collapsed walls close off one side at a time, so the
run is a sequence of jumps, ducks and swerves. Sprinting outruns the thing
behind you; walking does not.

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
| shift | sprint |
| space | jump |
| C or ctrl | crouch (hold) |
| touch | left half moves, right half looks, buttons for sprint, jump and crouch |

## How it is put together

- `index.html`, `styles.css` — page shell, overlays, grain and scanline layers.
- `js/textures.js` — every texture is drawn on a canvas at load time, so the
  repository carries no image assets.
- `js/psp.js` — the handheld look. The scene renders into a framebuffer around
  480 pixels wide and is scaled up with nearest-neighbour, and a shader patch
  snaps clip-space coordinates to a coarse grid so geometry swims the way it
  did on a PSP.
- `js/player.js` — pointer-lock and touch controls, gravity, sprint, crouch
  and jump. Its position is the player's feet; the camera rides at eye height.
- `js/exterior.js` — the hill, the storm and the brick building.
- `js/chase.js` — the corridor, its broken geometry, the obstacles and the
  pursuer. Obstacles and collision are resolved in path space: distance along
  the centre line and offset from it, rather than world coordinates.
- `js/main.js` — the state machine: title, exterior, transition, chase, ending.
- `vendor/three.min.js` — Three.js r128, vendored so the game runs offline.

The vertex snapping is deliberately not applied to the very large ground plane
in the chase: quantising the corners of a plane that size throws them far
enough to cover the road.

The camera itself does nothing but follow the player: no head bob, no roll, no
field-of-view pulsing. The grain, scanlines and vignette are fixed overlays on
the page rather than anything the camera does.

There is no audio anywhere in the project.
