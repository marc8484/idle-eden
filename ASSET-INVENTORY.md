# DAoC/Eden Asset Catalog

The supplied asset set was scanned recursively, so counts include nested files. Sizes are rounded. The `icons` directory contains 55 files recursively, of which 29 are at its root.

| Source folder | Files | Size | Main formats | Browser notes |
| --- | ---: | ---: | --- | --- |
| `items` | 3,443 | 283.5 MB | `.nif`, `.dds` | Models and textures need extraction or conversion. |
| `ui/fonts` | 21 | 8.2 MB | 4 `.ttf`, 17 `.tga` | TTF fonts can be used by CSS; TGA files need conversion. |
| `ui/maps` | 519 | 17.9 MB | 517 `.dds`, 2 `.dat` | DDS maps need conversion; DAT files are game data. |
| `effects` | 2,519 | 161.9 MB | `.nif`, `.dds`, `.tga` | Requires game-specific model/texture handling. |
| `anims` | 4,073 | 148.2 MB | `.kfa` | Game animation format; not browser-renderable directly. |
| `notes` | 28 | 0.3 MB | `.gif`, `.jpg`, `.htm` | Includes launcher graphics and web-friendly reference images. |
| `icons` | 55 | 12.1 MB | `.bmp`, `.cur` | BMP sprite atlases are browser-readable; CUR files are cursors. |
| `figures` | 843 | 538.3 MB | `.nif`, `.mpk` | Character models require a compatible model converter/viewer. |

## Integrated selection

- `assets/ui/` contains the compressed launcher panorama, logo, and tiled background used by the game theme.
- `assets/gameplay/icons/` contains six 32×32 PNG crops from `wpn_1000.bmp` and `itm_1200.bmp`, used by the equipment slots and inventory.
- `assets/gameplay/portraits/` contains five 64×64 class/creature portrait crops from the supplied combat icon atlas.
- `assets/gameplay/maps/albion-regions.png` is a browser-ready conversion of `ui/maps/r001.dds` (DXT1, 256×256), shown in the World tab as the Albion region map.
- `assets/gameplay/zones.js` contains 446 unique zone IDs from `regions.dat`, with 288 source-derived names and fallback labels for the remaining IDs. The game assigns ten character levels to each of the first 100 zones (level cap 1,000); Mastery ranks then unlock the remaining 346 zones.
- `assets/gameplay/raids/raid-history.txt` preserves the supplied raid-history snapshot. `assets/gameplay/raid-data.js` indexes 76 named raid bosses and the supplied top eight player snapshots for each realm.

The supplied asset set is much larger than the selected web assets. The game does not load the full model, effect, animation, or texture libraries. The user confirmed they have permission to redistribute these assets.
