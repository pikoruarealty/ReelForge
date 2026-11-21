# ReelForge 3.4 — Creative Direction for PropShort

## What has changed

The PropShort orange / cream / white / black brand palette remains unchanged. Creative Direction is a **render-only** per-project setting in the Asset cache & versions panel. It changes actual Remotion animation parameters rather than AI prompts:

- **Editorial** — restrained UI reveals, clean motion, subtle accents.
- **Energetic** — fast entrances, more dramatic image/phone zooms and burst accents.
- **Cinematic** — slower premium camera movement, atmosphere and soft rings.
- **App Showcase** — balanced swipe cards and focused product screens (default).
- **Intensity slider** (0–100) — adjusts travel distance, zoom scale and tilt.
- **Scene entrance** — slide, zoom, wipe or pop.

All settings are saved per job (`creativePreset`, `creativeIntensity`, `creativeTransition`) and passed into Remotion during rendering. Old jobs default to App Showcase 70% / Slide.

## Test with zero new generation API calls

1. Start the original project as normal; keep the same `.env` and storage.
2. Choose a **completed** PropShort project in Reel Library.
3. Under **Asset cache & versions**, choose **PropShort** as the render theme.
4. Change Creative Direction to **Energetic**, set 80% intensity, select **Zoom reveal**.
5. Select **Render Again**. This uses saved storyboard, images and narration.
6. Compare the new MP4 under **Previous renders** against the original.
7. Try **Editorial** 40% / Wipe and **Cinematic** 60% / Zoom for comparison.

Do not use **Fresh Generation** when merely testing animations. That would invoke paid generation APIs in live mode.

## Per-scene overrides (optional)

In **Edit Storyboard JSON**, a scene's `graphic` object can contain:

```json
{
  "graphic": {
    "headline": "66 luxury apartments",
    "motion_preset": "energetic",
    "motion_intensity": 90,
    "transition": "zoom",
    "counter": {"from": 0, "to": 66, "suffix": " apartments"}
  }
}
```

The scene's `graphic.motion_preset`, `graphic.motion_intensity`, and `graphic.transition` override that project's global creative settings for this scene only. The existing brand colors remain fixed. These fields survive storyboard validation. Keep counters factual; do not use fabricated statistics.

## Important limitations

- Presets are algorithmic motion effects applied to existing templates. They do not automatically infer a creative direction from a video reference, animate actual people in photos, or perform 3D camera tracking.
- This is a six-layout PropShort advertising template, not a full timeline editor.
- A new render consumes local compute, but no new Claude, OpenRouter or ElevenLabs generation calls if cached assets are valid. If an asset is stale, refresh is required before rendering.
- A real Remotion end-to-end render needs to be tested on the user's machine with project dependencies installed.
