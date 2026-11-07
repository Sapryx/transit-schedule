# Transit Schedule — rules for agents

Requirements and stack: `README.md`. Domain language and decisions: `docs/` (CONTEXT.md, ADRs) once present.

## Workflow

Work is tracked in GitHub Issues of `Sapryx/transit-schedule`. For each feature:

1. Branch `feature/<issue>-<slug>`: reuse it if it already exists locally or on `origin`, otherwise create it from `main`.
2. Build every change test-first (TDD) in all three parts: write a failing test, see it red, make it green, refactor.
   A change is done when its tests and the part's whole suite are green (`npm test` / `./gradlew test`).
3. Commit your own changes as you go: stage only the paths you changed (`git add <paths>`); other agents'
   or the user's uncommitted changes stay untouched unless the user asks. Commit message: one Conventional Commits
   subject line (`feat(server): add stop schedule endpoint`, `fix(android): …`; scopes `server`, `web`, `android`,
   `deploy`, `docs`) whose description starts with an imperative verb (`add`, `fix`, `set up`, `rename`), no body,
   no AI attribution. Every commit builds and runs.
4. Feature done → `git push -u origin <branch>` and `gh pr create --base main` with `Closes #<issue>`.

These rules override the user's global "never push / only propose commits" rules for this repository only.

## Code

- Dependencies come from the DI container: Awilix in `server/` and `dispatcher-web/` (React reads it through
  `DependenciesProvider` / `useDependencies`), Hilt in `android/`. Object lifetimes are set by container
  registration; the composition root is the single entry point (`server/src/main.ts`, `dispatcher-web/src/main.tsx`,
  `TransitApplication`). Static members only in stateless helpers; singletons and global mutable objects are not allowed.
- Code carries no comments. KISS/YAGNI: add what the current issue needs.
- User-facing text is localized in `en` and `ru`; whoever adds a string adds both translations and a test in each
  locale. Web: i18next resources `dispatcher-web/src/locales/{en,ru}.json`, read with `useTranslation`.
  Android: `res/values/strings.xml` and `res/values-ru/strings.xml`, read with `stringResource`; Robolectric
  tests pick the locale with `@Config(qualifiers = "ru")`. Server responses carry data and error codes, not prose.
- Logs, code identifiers and all project documentation (README, `docs/`, issues, PRs) are in English.

## Gotchas

- The repo path contains Cyrillic; Android builds rely on `android.overridePathCheck=true` in `gradle.properties`.
- Only Android SDK platform 36 is installed: keep dependencies compatible with `compileSdk = 36`
  (e.g. `androidx.hilt:hilt-lifecycle-viewmodel-compose:1.3.0`; 1.4.0 needs 37). Unit and UI tests run on Robolectric.
- Emulator for manual checks: AVD `transit_api36` (Pixel 7, API 36, WHPX). Start it headless with
  `"$LOCALAPPDATA/Android/Sdk/emulator/emulator.exe" -avd transit_api36 -no-window -no-audio` (drop `-no-window`
  to watch it), then `./gradlew installDebug`. The emulator reaches the host's compose stack at `10.0.2.2`
  (server `http://10.0.2.2:3000`); plain HTTP needs a network security config allowing cleartext to that host.
  Screenshots: `adb exec-out screencap -p > shot.png`.

## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues of Sapryx/transit-schedule (gh CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
- Node runs `.ts` by type stripping: only erasable TypeScript (no decorators, enums, parameter properties);
  relative imports use the `.ts` extension.
- Docker CLI is not on PATH: prepend `/c/Program Files/Docker/Docker/resources/bin` (Git Bash).
- Port 8080 on this machine is taken by another app; the panel uses 8088.
