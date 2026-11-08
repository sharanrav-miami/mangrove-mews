# Mews cat animation provenance

Created November 8, 2026 using the built-in OpenAI image generation tool. The mascot is an original fictional orange-and-white cartoon cat wearing a forest-green collar. It is decorative and does not depict a rescue animal, an observed cat, a care outcome, or a real tracker.

Each action began as an AI-generated six-cell sprite sheet in a 3-column by 2-row layout. The wave sheet established the character. The peek and celebrate sheets used that image as a visual reference to preserve the character and illustration style.

## Prompt set

- **Wave:** original cute orange-and-white cat, green collar and outline, white muzzle/chest, seated with one front paw raised. Six sequential frames tilt the paw left/right, add a gentle blink, and return to the first pose. Fixed camera, scale and position. Warm cream background. No words, logos, people or photographic animal evidence.
- **Peek:** same character and style, paws on an invisible ledge, head rises from a low peek to a full curious look, gently tilts, then returns. Six sequential frames with safe cell margins and the same cream background.
- **Celebrate:** same character and style, seated smile, gently raises both front paws, small happy bounce and two tiny gold sparkles, then returns. No flashing or large confetti. Six frames with the same cream background.

## Packaging

Image-generated art was cropped into its six existing cells, downscaled to 320×320, palette-quantized, and assembled with Pillow. No illustrative cat shapes or poses were drawn programmatically. The GIFs loop continuously with frame durations of 480, 180, 180, 180, 260, and 500 milliseconds (1.78 seconds total).

| File | Frames | Dimensions | Bytes |
| --- | ---: | --- | ---: |
| mews-cat-wave.gif | 6 | 320×320 | 140061 |
| mews-cat-peek.gif | 6 | 320×320 | 94209 |
| mews-cat-celebrate.gif | 6 | 320×320 | 128424 |

Matching `-poster.png` stills support paused/reduced-motion/offscreen states. The peek poster uses the fully visible head frame; other posters use the first frame. No third-party GIFs, Giphy embeds, live animal images, external tracking requests, or sound are included.

## Transparent background update

At the user's request, the built-in image tool edited each original sprite sheet to remove only its surrounding cream background. Prompt: background removal only, preserve all six poses, exact canvas/grid/scale/positions/colors/outlines, retain opaque white muzzle/chest/paws/tail fur, and return real transparent alpha with no painted checkerboard. The same asset filenames now hold transparent versions.

The 320×320 PNG posters preserve RGBA alpha. GIF packaging reserves palette index zero for transparent pixels, uses a binary alpha threshold of 128, and clears each frame with disposal mode 2. All six frames of each GIF were checked for transparency. Transparent coverage is about 59% for wave, 68–80% for peek, and 64–65% for celebrate. White fur remains opaque. Static previews were inspected over white and forest-green backgrounds for edge halos, missing fur, and leftover rectangles.
