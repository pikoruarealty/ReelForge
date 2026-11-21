# ReelForge 4.0 — Creative Director

## What changed

- **18 implemented Remotion layouts**: kinetic_hook, word_wall, bold_statement, split_headline, phone_focus, floating_phone, phone_zoom, app_spotlight, news_stack, news_grid, headline_ticker, editorial_card, stat_highlight, news_compare, city_pills, swipe_gallery, spotlight_reveal, brand_endcard.
- **Creative direction presets** on new Reel generation: Auto Mix, Kinetic Typography, App Showcase, News Montage, Cinematic Reveal. These select layout families, not a different brand palette.
- **Visual variety** between new creative plans; adjacent identical layouts are prevented.
- **Creative seed**: every new job receives a seed, retained in job.json and passed through to the renderer. Remixes receive new seeds. The same seed generates the same scene layouts and transitions.
- **Remix Animations** in Reel Library. Uses saved narration, screenshots, generated images, scene text and Remotion. Never calls Claude, OpenRouter, or ElevenLabs. It creates a saved render version.
- **Instagram export review**: checks video resolution, codecs, duration, scene repetition, subtitle presence/length, and theme. It is *not* a substitute for a human quality check.
- Prompt limit raised to 5,000 characters in frontend, API, and provider prompt builder (up to 3,500 passed to idea/script model).

## How to test without new credits

1. Stop the running ReelForge API and website.
2. Back up the old project, including .env and storage.
3. Install patch or complete new project, then copy the old `.env` and `storage/` to the project root.
4. `npm install`, `npm run check`, `npm run test:creative`, and `npm run dev`.
5. Open `http://localhost:5173` and select an existing completed PropShort Reel in **Reel Library**.
6. In **Creative Director 4.0**, choose **Auto Mix** and **90% variety**. Click **Remix Animations**.
7. Inspect Version N and Version N+1. The script, image files and narration do not change. Repeat Remix Animations to compare designs.
8. Click **Check Instagram Readiness**. Watch the video manually and check text clipping and accuracy.

For *new* production Reels, select **Fresh Generation** (not Testing), set the creative direction, supply the topic and images, and generate. This mode uses normal external AI calls; *only creative remix / rerender is generation-API-free*.

## API contract

- `POST /api/jobs` `{topic,imageSource,assetIds,creativeMode:'auto',visualVariety:85,creativitySeed?:number}`. New generation uses AI providers if live mode is enabled.
- `POST /api/jobs/:id/remix` `{mode:'auto'|'kinetic'|'showcase'|'news'|'cinematic',energy:80,variety:90,seed?:number,render:true}`. Saves a new creative plan in job metadata; renders the cached media. If assets are stale, returns 409.
- `GET /api/jobs/:id/quality` returns `status`, `checks`, and manual-review items.
- `POST /api/jobs/:id/render-again` rerenders with the currently saved creative plan without external generation requests.

Storyboards can override a particular scene using `graphic.layout` with one of the above registered layouts. Changing `graphic.layout` is a visual-only change and does not invalidate the image or audio cache. Creative plans are separately preserved in `job.json` under `creativePlan` and `creativeHistory`.

## Known limits

- A *deterministic motion-layout planner*, not an additional paid AI storyboard-planning model. Claude still creates scripts/storyboards for fresh projects; the planner varies their visual composition locally. It cannot guarantee creative originality or virality.
- Layouts are stylized 2D/2.5D Remotion motion graphics, not real 3D phone videos or interactions with a running app.
- Only six scenes, with durations controlled by the existing workflow. More advanced custom timing requires a further pipeline change.
- Quality check reads MP4 metadata and text; it does not use AI visual review, verify news claims, or check visual crop/legibility in individual frames.
- Local API is for a trusted developer workstation; do not expose it to the public internet without authentication and queue controls.
