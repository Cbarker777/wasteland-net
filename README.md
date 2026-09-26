# Wasteland Net

A gamified study tool for the FCC **Technician** (Element 2), **General** (Element 3), and **Amateur Extra** (Element 4) license exams. The grid is down, and your radio knowledge is what keeps your survivor fed, powered, and connected.

- **Official question pools.** Pick one on the Base screen and study, skills, and boss battles all use it:
  - **Technician:** all 409 questions from the NCVEC 2026–2030 pool, including the Feb 19, 2026 errata.
  - **General:** all 423 active questions from the NCVEC 2023–2027 pool, current through the 6th errata (Feb 4, 2026).
  - **Extra:** all 599 active questions from the NCVEC 2024–2028 pool, current through the 4th errata (Feb 4, 2026).

  All three include their pools' diagrams. XP, rank, Supplies, and streaks are shared across pools.
- **Spaced repetition.** Missed questions come back within 3–5 questions. Three correct in a row moves a question to the medium-term pool. Continued success moves it to a long-term pool that still resurfaces now and then.
- **Survivor rank.** XP from correct answers moves you through Scavenger → Signal Runner → Relay Keeper → Net Control → Wasteland Elmer.
- **Ten skill trees per pool.** Each sub-element (T1–T0, G1–G0, or E1–E0) levels up on its own. The Skills screen shows your strengths and weak spots.
- **Supplies.** They decay a little every day. Correct answers restock them, and fixing a question you missed pays a bonus. Wrong answers never cost anything. Running out puts the radio in a low-power state until you study again. It is never game over.
- **Outpost.** Correct answers also bring back Scrap, a building material that never decays. Spend it to build and upgrade six structures (Radio Tower, Water Purifier, Greenhouse, Field Clinic, Solar Array, Signal Bunker). Each one changes the outpost scene and adds a small Supplies or Scrap perk. None of them make questions easier.
- **Boss battle.** A simulated exam that draws one question from each group, matching the real sub-element distribution. Technician and General are 35 questions (26 to pass), Extra is 50 (37 to pass).
- **Badges.** Study streaks (7/30/100 days), building and maxing the outpost, passing and perfect boss battles and sub-element mastery for each pool, and a survivor badge for 30 straight days with Supplies above zero.

## Run it on Unraid

The container is a static site served by nginx. It holds no server-side state and needs no volumes.

**Option A: pull the published image (easiest).** Every push to `master` runs the tests, then builds and publishes `ghcr.io/cbarker777/wasteland-net:latest`. In Unraid, go to **Docker → Add Container** and enter:

| Field | Value |
|---|---|
| Name | `wasteland-net` |
| Repository | `ghcr.io/cbarker777/wasteland-net:latest` |
| Port | Container `80` → Host `8282` |

Then open `http://<unraid-ip>:8282`. To update, use **Check for Updates** on the Docker tab.

**Option B: docker compose.** From a checkout on the server:

```bash
docker compose pull && docker compose up -d
```

Or build locally with `docker compose up -d --build`.

**Option C: build from source with the update script.** Clone the repo onto the server, then after each new commit run:

```bash
bash update.sh
```

It pulls, rebuilds the image, and replaces the running container on port 8282.

## Your progress lives in the browser

No accounts, no sync. Progress is saved in the browser's `localStorage` for the address you open it at, so each browser or device keeps its own save. Use **Radio Log → Export save** to back it up, or to move it to another device with **Import save**. Clearing site data for the address erases the save.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # game logic + pool checks
npm run lint
npm run build
```

- `src/game/` holds all game rules as pure functions with tests: spaced repetition (`srs.ts`), rank and skills (`progression.ts`), the outpost (`outpost.ts`), Supplies, streaks, boss exam, badges, and save transitions (`save.ts`). Every tunable number is in `config.ts`.
- `src/data/pools/*.json` are generated from the official pools and should not be edited by hand.

### Updating the question pools

NCVEC publishes the pools and their errata at <https://www.ncvec.org/index.php/amateur-question-pools>. When a new errata comes out:

1. Save the new `.docx` in `pool-source/`.
2. Update that pool's entry in `POOLS` in `scripts/ingest-pool.ts` (`docx` and `version`).
3. Run `npm run ingest:pool`. It validates every question, group, and figure and fails loudly if anything is off.
4. Run `npm test` and commit.

The General pool expires June 30, 2027, Extra on June 30, 2028, and Technician on June 30, 2030. A new pool may change its figures, so check each pool's `figures` list in the ingest script against the new diagrams.

Question pool text is public domain, published by the NCVEC Question Pool Committee.
