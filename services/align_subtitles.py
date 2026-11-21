"""Optional subtitle alignment using faster-whisper. Produces JSON + SRT.
Usage: python3 services/align_subtitles.py narration.mp3 word-captions.json subtitles.srt
This runs ASR on generated narration; timestamps are estimates, not forced alignment.
"""
import json
import os
import sys
from pathlib import Path
from faster_whisper import WhisperModel

def stamp(t):
    ms = round(max(0, t) * 1000)
    return f"{ms // 3600000:02d}:{(ms // 60000) % 60:02d}:{(ms // 1000) % 60:02d},{ms % 1000:03d}"

def main():
    source, json_out, srt_out = map(Path, sys.argv[1:4])
    lang = sys.argv[4] if len(sys.argv) > 4 else 'en'
    # tiny.en is English-only; other languages (Hindi) need a multilingual model. Override with WHISPER_MODEL.
    model = WhisperModel(os.environ.get('WHISPER_MODEL') or ('tiny.en' if lang == 'en' else 'small'), device='cpu', compute_type='int8')
    segments, _ = model.transcribe(str(source), word_timestamps=True, vad_filter=True, language=lang)
    words = []
    for segment in segments:
        for w in segment.words or []:
            words.append({'text': w.word.strip(), 'start': round(w.start, 2), 'end': round(w.end, 2)})
    json_out.write_text(json.dumps(words, indent=2), encoding='utf-8')
    srt_out.write_text('\n\n'.join(f"{i}\n{stamp(w['start'])} --> {stamp(w['end'])}\n{w['text']}" for i, w in enumerate(words, 1)), encoding='utf-8')
    print(f'Aligned {len(words)} words')
if __name__ == '__main__':
    main()
