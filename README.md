# Chaos Drop — Android Prototype

Chaos Drop is an original, mobile-first physics puzzle prototype. The Android app is a small native WebView shell around a self-contained Canvas game; it uses no third-party art, game engine, network service, or paid SDK.

## Play

1. Drag on the board to draw one temporary bumper.
2. Tap **Drop It** to release the orb.
3. Use the bumper and the level's rails to collect sparks and guide the orb into the goal cup.
4. You have three drops per puzzle. Reset and try a different bumper, then continue through five handmade puzzles.

The prototype includes gravity, bounces, hazards, collectibles, scoring, saved best score/current puzzle, retry, and next-puzzle controls. All visuals are drawn from original shapes in Canvas.

## Build

The Android project uses Java 17, Gradle 8.11, and Android Gradle Plugin 8.7.3. On an Android SDK-equipped machine, run:

```sh
gradle --no-daemon :app:assembleDebug
```

The debug APK is written to `app/build/outputs/apk/debug/app-debug.apk`. GitHub Actions checks the game script and builds that APK on pushes, pull requests, or a manual workflow run. The workflow retains its APK artifact for three days.

## Project layout

- `app/src/main/java/.../MainActivity.kt` — full-screen Android WebView host.
- `app/src/main/assets/index.html` — game screen and accessible controls.
- `app/src/main/assets/style.css` — responsive portrait UI.
- `app/src/main/assets/game.js` — original physics puzzle, five levels, rendering, and progression.
- `.github/workflows/android.yml` — syntax check and free standard-runner debug build.
