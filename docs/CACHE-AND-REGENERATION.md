# ReelForge 3.2 — Reuse-first video generation

This update builds on ReelForge 3.1, retaining OpenRouter text/image, ElevenLabs/Kokoro voice, uploaded images, hybrid motion and Remotion/FFmpeg.

## How to run

```bash
cp .env.example .env
npm install
npm run check
npm run dev
```

Open http://127.0.0.1:5173. Keep your existing `.env` file and `storage/` directory when upgrading an existing installation.

## Main workflow

- **Testing — reuse selected Reel:** Select an existing project from the Reel Library and click *Render Selected Reel — No AI cost*. Only the local rendering process runs. This does not make Claude, OpenRouter, ElevenLabs or Kokoro generation calls. It may consume local compute.
- **Fresh Generation:** Create a new Reel from the topic. In live mode, this always calls AI providers and generates fresh content; previous cache is not reused across new production runs.
- **Edit Storyboard JSON:** Open a saved project, modify subtitle, hook, narration, image prompt and other supported JSON fields, and save. The backend reports which assets became stale. Edit subtitle/animation metadata and re-render without API costs; changing narration requires a new TTS recording; changing a generated image prompt requires regenerating that scene image.
- **Refresh changed assets:** Make API calls only for assets marked stale. You will be asked to confirm billable actions in live mode. Cache state is kept in `storage/reel-*/asset-manifest.json`.
- **Regenerate scene image:** Changes only the selected scene image and invalidates associated AI motion.
- **Regenerate voice:** Recreates narration and, when enabled, word-level caption alignment.
- **Render Again:** Reuses the saved storyboard, scene PNG files, audio and existing valid AI video clips. Each successful render is preserved at `storage/reel-*/renders/version-N.mp4` and added to the Reel Library.

## Dependencies / invalidation

| Edit | Next operation |
|---|---|
| Text overlay/subtitle text | Render Again (zero AI API calls) |
| Renderer template, zoom/animation, background music arrangement | Render Again (zero AI API calls) |
| Narration | Regenerate voice, then Render Again |
| Generated image prompt | Refresh changed assets, then Render Again |
| Uploaded image source | Uploaded asset remains cached; changing its image prompt does not force API calls |
| Scene motion prompt | The old motion clip reference is removed from new storyboard; scene falls back to still image unless a new clip is generated |
| New production project | Fresh idea, script, storyboard and assets as configured |

## API endpoints

- `GET /api/jobs/:id/cache` — inspect cached assets and staleness
- `PUT /api/jobs/:id/storyboard` — `{ "storyboard": <saved-json> }`
- `POST /api/jobs/:id/render-again` — `{}` (no generation calls)
- `POST /api/jobs/:id/regenerate` — `{ "kind":"stale"|"image"|"audio"|"motion", "sceneIndex":0, "allowPaid":true }`; `allowPaid` is required in live mode.

## Known constraints

- This is a **single-owner localhost demo** with no login. Do not expose the API to the public Internet without authentication, access controls and CSRF protection.
- A running ReelForge instance is required for browser-based media access during rendering.
- The existing pipeline limits storyboards to six scenes and normalizes scene durations to [3,4,5,6,6,6].
- The scene image selector in *uploaded* mode uses images in upload order, repeating if needed.
- Full motion clip generation is still separate from the cheaper local Remotion motion-graphics layer.
- Older jobs produced before v3.2 have no saved manifest. The editor backfills signatures from their old storyboard when it first updates them; if their media assets are missing, those assets must be regenerated.
- Local rerendering consumes CPU/GPU resources even though no external generation API is called.
- On a failed render the current `reel.mp4` may be overwritten. Prior archived render versions remain available.
