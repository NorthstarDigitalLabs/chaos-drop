# Chaos Drop — Android Beta

Chaos Drop is an original, offline-first mobile physics puzzle game. The Android app is a lightweight native WebView shell around a self-contained Canvas game; it uses original code-drawn visuals and locally synthesized sound effects with no third-party art, game engine, network service, or paid SDK.

## Play

1. Choose **Start Game** to continue, or open **Level Select** to replay any unlocked puzzle.
2. Drag on the board to draw one temporary bumper.
3. Tap **Drop It** to release the orb.
4. Use the bumper and the level's rails to collect sparks and guide the orb into the **WINNER** cup.
5. Use **Restart** for a quick retry. Completing a puzzle unlocks the next one; progress and sound preference are saved locally.

The beta includes 20 original puzzles. Levels 1–10 use the neon green world; Levels 11–20 introduce neon cyan. The ball stays contrasting, while restrained glow, impact particles, and sound effects reinforce interactions without obscuring the board. Audio is synthesized locally and can be toggled off. The game works offline and requests no network or tracking permissions.

## Build and test

The Android project uses Java 17, Gradle 8.11, and Android Gradle Plugin 8.7.3. Automated checks validate JavaScript syntax, title and level-select navigation, unlock/completion persistence, audio controls, restart/next flow, and physics-based winning routes for all 20 levels. On an Android SDK-equipped machine, run:

```sh
gradle --no-daemon :app:assembleDebug
```

The debug APK is written to `app/build/outputs/apk/debug/app-debug.apk`. GitHub Actions runs the same checks and builds the APK on pushes, pull requests, or a manual workflow run. Workflow artifacts are retained for three days.

## Project layout

- `app/src/main/java/.../MainActivity.kt` — full-screen Android WebView host and Back navigation.
- `app/src/main/assets/index.html` — title, level select, gameplay screen, and accessible controls.
- `app/src/main/assets/style.css` — responsive dark-neon mobile UI.
- `app/src/main/assets/game.js` — physics, 20 levels, world themes, local progression, and synthesized sound.
- `tests/` — UI/progression smoke checks and simulated winning-route coverage for every level.
- `.github/workflows/android.yml` — checks and free standard-runner debug build.
