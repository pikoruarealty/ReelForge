// Language handling for narration and on-screen text.
//
// A job has one `language` value:
//   en        English voice, English on-screen text (default)
//   hi        Hindi voice, Hindi (Devanagari) on-screen text
//   hi_voice  Hindi voice, short English on-screen text (common for Indian real-estate reels)
export const LANGUAGES = ['en', 'hi', 'hi_voice'];
export const normLang = (l) => (LANGUAGES.includes(l) ? l : 'en');
export const narrationCode = (l) => (normLang(l) === 'en' ? 'en' : 'hi');
export const screenCode = (l) => (normLang(l) === 'hi' ? 'hi' : 'en');

// Measured with ElevenLabs flash v2.5: 96 Hindi words took 42.6 s (~2.25 words/second including pauses), so a 30 second Reel is about 66-72 Hindi words.
export function narrationBudget(l) {
  if (narrationCode(l) === 'hi') {
    const cap = Number(process.env.NARRATION_MAX_WORDS_HI || 76);
    return {cap, max: 70, perScene: 14, prompt: 'the TOTAL across all six scenes must be 62-70 words (about 11 per scene, hard maximum 14 for any scene; count them)'};
  }
  const cap = Number(process.env.NARRATION_MAX_WORDS || 66);
  return {cap, max: 62, perScene: 12, prompt: 'the TOTAL across all six scenes must be 54-62 words (about 10 per scene, hard maximum 12 for any scene; count them)'};
}

// Extra instructions appended to the script / revision prompts.
export function languageClause(l) {
  const lang = normLang(l);
  if (lang === 'en') return '';
  const voice = 'Write every narration in natural, conversational spoken Hindi in Devanagari script (common English loanwords such as फ्लैट, रजिस्ट्री, टोकन are fine, written in Devanagari). Write numbers inside narration as Hindi words (for example बारह प्रतिशत, अठारह लाख) so the voice pronounces them correctly.';
  if (lang === 'hi') return `LANGUAGE: ${voice} Also write subtitle and graphic.headline / graphic.highlight / graphic.subheading in short Hindi (Devanagari); digits are fine in graphic.headline; graphic.highlight must be one word copied exactly from graphic.headline. image_prompt and motion_prompt stay in English.`;
  return `LANGUAGE: ${voice} Write subtitle and graphic.headline / graphic.highlight / graphic.subheading in short English (they are shown on screen); graphic.highlight must be one word copied exactly from graphic.headline. image_prompt and motion_prompt stay in English.`;
}

// Free demo-mode copy (no model calls) so the whole flow can be tried in Hindi.
const HI_NARRATION = (topic) => [
  `क्या आप ${topic} के बारे में जानते हैं? यह जानना ज़रूरी है।`,
  'यह बात आज आपके लिए इतनी अहम क्यों है?',
  'पहली काम की बात आपका नज़रिया बदल सकती है।',
  'बड़ा क़दम उठाने से पहले एक छोटा प्रयोग करके देखिए।',
  'जो काम करे उसे परखिए और एक बात सुधारिए।',
  'ऐसी और काम की बातों के लिए हमें फ़ॉलो कीजिए।',
];
const HI_SUBTITLES = ['ज़रूर जानिए', 'यह क्यों ज़रूरी है', 'छोटी शुरुआत', 'आज़माकर देखिए', 'नतीजे परखिए', 'सेव कर लीजिए'];
export const hindiDemo = (topic, l) => ({
  narration: HI_NARRATION(topic),
  subtitle: screenCode(l) === 'hi' ? HI_SUBTITLES : null, // null = keep the English subtitles
});
