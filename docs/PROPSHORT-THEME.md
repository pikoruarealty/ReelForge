# PropShort brand template — cached rendering

## What this upgrade changes

- PropShort mode renders black, cream, white and orange backgrounds, real phone-style screenshot cards, animated headlines, an image push-in and pull-back, a three-card reveal and a clear PropShort CTA.
- Optional numeric counter is only shown when explicitly supplied through `scenes[i].graphic.counter`. The renderer never extracts random numbers and never generates invented 99% progress indicators.
- Uploaded screenshots are preserved as the image assets. The renderer does **not** regenerate them or use an image model when rendering from cache.
- The previous default motion-graphics renderer remains selectable per project.

## Start and test without AI costs

1. Keep your existing project `.env`, `storage` and API keys. Set `USE_REMOTION=true`. Optionally set `RENDER_THEME=propshort` in `.env` for new Reels.
2. Start `npm run dev`. Select a completed Reel in Reel Library.
3. Under **Asset cache & versions**, set **Render theme** to **PropShort · Orange / Cream / Black**.
4. Click **Render Again**. This reuses cached images and narration without invoking Claude, OpenRouter, ElevenLabs or video generation.
5. Download the new `version-N.mp4` link from the cache panel. Verify the new branded frames rather than the old blue background.

Changing the visual theme does not correct an earlier narration or scene script. To use the ready-made PropShort storyboard, see below.

## Working with the three supplied PropShort screenshots

The three images in `examples/screenshots/` match the uploaded examples in this conversation. The recommended order is:

1. `01-sarojini-auction.jpeg`
2. `02-land-sale-report.jpeg`
3. `03-chandigarh-policy.jpeg`

For a **new** Reel, use **Fresh Generation** mode and **Uploaded Images** source, then select the three screenshots in that order. The existing backend uses a repeating six-scene assignment (1,2,3,1,2,3); the PropShort renderer intentionally draws these first three shots in news panels and the carousel, and uses the initial one for the closing phone view.

To use the advertising copy in `examples/propshort-ad-storyboard.json`, open the generated project's **Edit Storyboard JSON** panel and replace its contents with this file. Click **Save storyboard**. Because the sample narration is different from previously generated narration, the cache will mark audio as stale. Choose **Regenerate voice** once (ElevenLabs usage), then **Render Again**. Scene visuals remain uploaded assets: no OpenRouter image generation is needed.

You can also use the sample as a creative guide and retain your existing narration; in that case change *only* the scene `graphic` and `subtitle` fields in the editor, so you don't trigger a voiceover refresh.

## Optional JSON fields

Each scene in `storyboard.json` may contain:

```json
"graphic": {
  "headline": "66 LUXURY APARTMENTS",
  "subheading": "Sarojini Nagar e-auction news",
  "background": "#F8F5F0",
  "counter": {"from": 0, "to": 66, "suffix": " homes"}
}
```

`graphic` metadata is preserved by storyboard validation and editing. Supported background choices: `#181818`, `#F8F5F0`, `#FFFFFF`, `#F6DACA`, `#E65323`. Counters must contain externally verified facts; do not invent numerical claims.

The six scene layouts are: (0) dark hook; (1) auction numeric card; (2) news article card; (3) policy card; (4) multi-card swipe; (5) orange CTA. Scene duration remains 3,4,5,6,6,6 seconds in the current pipeline.

## Troubleshooting

- If the background remains blue: ensure the selected project's theme says `propshort`, restart the API after updating code, and click **Render Again** (existing MP4s are not overwritten retroactively except the `reel.mp4` latest copy).
- If you see placeholders: the selected project lacks cached scene images. Use an existing completed uploaded-image project, or create a new one with the provided three screenshots.
- If the counter is absent: supply `graphic.counter` on Scene 2 (array index 1). This is intentionally not inferred from generated headlines.
- If audio is stale: keep the original `narration` fields or regenerate narration once after editing them.
- If Remotion fails: `USE_REMOTION=true` is mandatory for branded motion graphics; verify Chromium/Remotion dependencies and logs locally.

This is a local-development tool. Do not publicly expose its unauthenticated APIs. The sample screenshot headlines describe the user-provided news cards, not independently fact-checked breaking news or proof of features such as instant notifications.
