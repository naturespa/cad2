# cad2

Browser-based CAD helper for making simple 3D-printable STL models from Japanese text.

## Offline Windows app

Run:

```bat
RunCad2Offline.cmd
```

This opens a local Windows desktop app. It does not use a browser, server, or internet connection.

The offline app supports:

- Japanese text input
- 3D preview with mouse drag rotation
- STL export
- Built-in shape generation for globes, chairs, tables, houses, vehicles, airplanes, boats, animals, cylinders, spheres, and boxes

## Run

Serve the folder locally:

```sh
node server.mjs
```

Then open `http://localhost:8000`.

## Features

- Japanese text prompt to create common printable shapes
- Server-side reference lookup from the internet before generation, with an offline fallback
- Composite generation for less predefined requests, such as plates with holes, bases with parts, roofs, legs, handles, stairs, cones, pyramids, and polygon prisms
- Interactive 3D preview with orbit controls
- STL export for 3D printers

This first version runs fully in the browser and uses deterministic shape generation rather than a cloud AI service.
