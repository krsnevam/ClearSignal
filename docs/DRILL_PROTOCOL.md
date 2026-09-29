# 90-second comprehension drill

**Claim under test:** a trained non-analyst can name the top village *and* a reason to trust it within 90 seconds of first seeing ClearSignal.

**Status: not yet run.** Fill in the tables below as you go. Report the median, not the mean. If the median is over 90 s, drop the claim from the video and keep only the qualitative footage (spec §20).

## Setup

- Phone: Samsung Galaxy A54 or A34, PWA installed from the live URL and opened once while online (warm cache). Screen brightness at maximum.
- Replay restarted before each participant: `curl -X POST -H "authorization: Bearer $INGEST_TOKEN" https://api.clearsignal.app/replay/restart`, so everyone sees the same 09:00 IST frame. At that frame the correct answer is the top card (expected **Bhagamandala** or **Makkandur**; record which one was on top).
- 5–8 volunteers, not on the team, 18+, signed consent (photo/video) collected first.

## Script

1. **3-minute onboarding** (read verbatim): "You are a district disaster-response coordinator in Kodagu during the August 2018 floods. Your job is to decide where to send a rescue team first. This app pulls in satellite, river gauge, weather, road and citizen-text information."
2. Hand over the phone. **Start the stopwatch.**
3. Ask: **"Which village should we send help to first, and why should you trust that?"**
4. **Stop** when they name the correct village **and** state at least one reason (for example "river gauges and satellite agree", "high confidence, several sources", "it's fresh").
5. Ask for one sentence of feedback.

## Results

| # | Consent ✓ | Time (s) | Correct village? | Reason given | One-sentence feedback |
|---|---|---|---|---|---|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
| 5 | | | | | |
| 6 | | | | | |
| 7 | | | | | |
| 8 | | | | | |

**Median time:** ___ s · **Correct:** ___ / ___

Photos (with consent): `docs/drill/`.

## Laminated field card: Kannada glossary

Verify every line with a native speaker before printing.

| English | Kannada | Transliteration |
|---|---|---|
| Which villages need evacuation support first? | ಮೊದಲು ಯಾವ ಗ್ರಾಮಗಳಿಗೆ ಸ್ಥಳಾಂತರ ಸಹಾಯ ಬೇಕು? | Modalu yāva grāmagaḷige sthaḷāntara sahāya bēku? |
| High confidence | ಹೆಚ್ಚಿನ ವಿಶ್ವಾಸ | Heccina viśvāsa |
| Medium confidence | ಮಧ್ಯಮ ವಿಶ್ವಾಸ | Madhyama viśvāsa |
| Low confidence | ಕಡಿಮೆ ವಿಶ್ವಾಸ | Kaḍime viśvāsa |
| Offline | ಆಫ್‌ಲೈನ್ | Āphlain |
| Sources disagree | ಮೂಲಗಳು ಒಪ್ಪುತ್ತಿಲ್ಲ | Mūlagaḷu opputtilla |
