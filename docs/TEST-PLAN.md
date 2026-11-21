# Acceptance test plan

1. Ensure `.env` has `DEMO_MODE=true` and `USE_REMOTION=true`.
2. Start `npm run dev`. Expect dashboard port 5173 and API port 8787.
3. `curl http://127.0.0.1:8787/api/health` returns `ok:true` and `mode:demo`.
4. Enter `3 tools for junior developers`. Generate.
5. Confirm progress advances and a completed project appears.
6. Confirm six images, `storyboard.json`, `narration.mp3`, and `reel.mp4` in `storage/reel-.../`.
7. Play MP4; confirm 9:16 portrait video and audio. If Remotion launches correctly, confirm large scene subtitles.
8. Check `job.json` lists scores for one or more revisions.
9. Restart the server; confirm existing projects persist.
10. Test invalid topic with `curl -X POST localhost:8787/api/jobs -H 'Content-Type: application/json' -d '{"topic":"a"}'`; expect HTTP 400.
11. For a live test, add provider keys, change `DEMO_MODE=false`, restart, create a small topic and monitor paid API usage. Do not assume external services are free.

A nonzero exit from video rendering is visible in the job's `error`; Remotion failure may trigger a fallback render warning.
