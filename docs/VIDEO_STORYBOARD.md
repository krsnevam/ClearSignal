# Video storyboard: 3 minutes (locked)

Spec §16, updated to match the build. Every second maps to a judged criterion and to one of the three winning moments: **the one text**, **airplane mode**, **Village A vs Village B**.

Audience: 5 of 7 reviewers are non-engineers. Lead with the scenario, keep the math to one on-screen moment, and don't open with architecture.

## Shoot setup (do this first)

| Item | Setting |
|---|---|
| Phone | Samsung Galaxy A54, screen recorder on, brightness max, Do Not Disturb |
| App | Installed from the live URL, opened once online (warm cache) |
| Replay speed | `REPLAY_SPEED=1` for beats 2–5 so the list holds still and only *your* actions change it. Use 60 only for a time-lapse B-roll |
| First frame | Before each take: `POST /replay/restart` with the ingest token → header reads **16 Aug · 09:00** |
| SMS | Twilio number live (US number if India DLT isn't ready, per risk log). Nokia/feature phone with credit |
| Village B | **Ponnampet** in the list: a lone SMS, 3 h old, scores **18 Low**, marked *Stale* |

What you should see at 09:00 IST (the deterministic replay): **Bhagamandala** and **Makkandur** High at the top, **Kushalnagar** High, **Mukkodlu** Medium with *Sources disagree*, and **Ponnampet** Low near the bottom.

## Beat sheet

**00:00–00:20 · The Kodagu question** *(Scenario fit)*
- V/O: "August 2018. Kodagu district, Karnataka. More than three hundred millimetres of rain in a day. A hundred and five landslides in eight days. Towers down. Roads cut. A rescue team had one question: which village first."
- Shot: 2018 photo → dissolve to the phone.

**00:20–00:55 · One screen** *(Usability, timeliness)*
- V/O: "One question, one screen, a few seconds."
- Shot: cold launch → question pre-filled → ranked list. Callouts: "Cold cache · 3G" · "First recommendation: X.X s" *(put the time measured on the A54 here; don't reuse a laptop number)*.

**00:55–01:30 · The confidence math** *(Integration)*
- V/O: "Every village gets a number. Every number has three parts: how fresh, how many independent sources agree, and how trustworthy they are."
- Shot: tap the top card → the "Why NN?" panel shows the three bars adding up. Overlay: `Score = 0.35 × fresh + 0.45 × agreement + 0.20 × trust`.
- Village A graphic (7 signals, all within 22 minutes → **87 High**). This is the golden test's exact input; show it as a graphic, since the live card's number moves with the replay.
- Cut to **Ponnampet** on the phone: one unverified SMS, 3 hours old → **18 Low**, *Stale*.
- V/O: "Both are villages. Only one is worth the boat."

**01:30–02:05 · Airplane mode** *(Timeliness, reliability)*
- V/O: "In 2018, the towers went down."
- Shot: airplane mode on → blue banner *"Offline · showing last data from 09:00"* → scroll, tap a card, details still open → airplane off → banner clears.
- V/O: "Offline isn't a failure mode. It's Tuesday."

**02:05–02:40 · The one text** *(Comprehensiveness, novel data)*
- V/O: "One volunteer in Bhagamandala has a basic phone and no data plan. That's enough."
- Shot: split screen, feature phone left, ClearSignal right (Bhagamandala detail open). Text **"Bhagamandala flooded near school"** → new SMS appears under *Signals*, the list card flashes. Target: under 4 s.
- Contradiction: text **"Bhagamandala water gone down we are safe"** → *Sources disagree*, both sides listed ("Says safe" / "Says hazard").
- V/O: "We don't hide disagreement. We show it."

**02:40–03:00 · IEEE fit and the ask** *(Scenario and ecosystem fit)*
- V/O: "IEEE MOVE brings power and connectivity to disaster zones. IEEE SIGHT is on the ground in Karnataka and Kerala. ClearSignal is the decision layer they can run on any phone."
- Closing card: live URL + QR · "Kodagu district. Open on any phone."
- End frame (2 s): "Data: Copernicus · IMD · CWC · NASA FIRMS · GDACS · USGS · © OpenStreetMap contributors · 2018 scenario reconstructed; citizen SMS synthetic."

## Post-production

- Filmed on the phone's own screen recorder; no emulator. Real time, no speed-ups.
- On-screen text ≥ 32 px for legibility.
- Hard budget: 3:00. Shoot beats separately and cut to time.
