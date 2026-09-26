# Wasteland Net

A gamified study tool for the FCC **Amateur Extra** license exam (Element 4). The grid is down, and your radio knowledge is what keeps your survivor fed, powered, and connected.

- **Official question pool.** All 599 active questions from the NCVEC 2024–2028 Extra pool, current through the 4th errata (Feb 4, 2026), with the pool's diagrams.
- **Spaced repetition.** Missed questions come back within 3–5 questions. Three correct in a row moves a question to the medium-term pool. Continued success moves it to a long-term pool that still resurfaces now and then.
- **Survivor rank.** XP from correct answers moves you through Scavenger → Signal Runner → Relay Keeper → Net Control → Wasteland Elmer.
- **Ten skill trees.** Each sub-element (E1–E9, E0) levels up on its own. The Skills screen shows your strengths and weak spots.
- **Supplies.** They decay a little every day. Correct answers restock them, and fixing a question you missed pays a bonus. Wrong answers never cost anything. Running out puts the radio in a low-power state until you study again. It is never game over.
- **Boss battle.** A 50-question simulated exam that draws one question from each group, matching the real sub-element distribution. 37 correct passes.
- **Badges.** Study streaks (7/30/100 days), passing and perfect boss battles, mastery of each of the ten sub-elements, and a survivor badge for 30 straight days with Supplies above zero.

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

- `src/game/` holds all game rules as pure functions with tests: spaced repetition (`srs.ts`), rank and skills (`progression.ts`), Supplies, streaks, boss exam, badges, and save transitions (`save.ts`). Every tunable number is in `config.ts`.
- `src/data/pool.json` is generated from the official pool and should not be edited by hand.

### Updating the question pool

NCVEC publishes the pool and its errata at <https://www.ncvec.org/index.php/2024-2028-extra-class-question-pool-release>. When a new errata comes out:

1. Save the new `.docx` in `pool-source/`.
2. Point `SOURCE_DOCX` in `scripts/ingest-pool.ts` at it and update `POOL_VERSION`.
3. Run `npm run ingest:pool`. It validates every question, group, and figure and fails loudly if anything is off.
4. Run `npm test` and commit.

The next pool (2028–2032) will take effect July 1, 2028. Its figure order may change, so check `FIGURE_ORDER` in the ingest script against the new diagrams.

Question pool text is public domain, published by the NCVEC Question Pool Committee.
