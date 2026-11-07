# Voltage RAM Thruster Judge — branded iPad prototype

A single-athlete, camera-based RAM thruster **training prototype**. It uses MediaPipe Pose Landmarker to estimate body joints, squat depth and overhead lockout. Includes 60-rep target, session timer, approximate valid/no-rep counts, audio cues, coach corrections and CSV event export.

## Install on iPad

1. Upload **all seven app files** (`index.html`, `app.js`, `manifest.webmanifest`, `icon.svg`, `sw.js`, `voltage-logo.png`, `voltage-icon.png`) together to an **HTTPS** static website, such as Netlify Drop or GitHub Pages. Do not open `index.html` directly from Files; iPad camera permissions and ES modules require a secure web origin.
2. Open the resulting HTTPS URL in **Safari** on your iPad. Keep internet access on for the initial MediaPipe JavaScript/model download; later offline operation is **not guaranteed** because model assets are served from external hosts.
3. Tap **Share → Add to Home Screen → Add**. Launch the app from the home-screen icon.
4. Grant camera permission, choose rear/front camera, and tap **Start camera**. Put the tablet in landscape orientation on a stable stand, around hip height, 2–4 m from one athlete, with a clear side view and their entire body visible throughout.
5. Select depth threshold and target reps; tap **Start session**. Use the coach override buttons when a rep is misjudged. Export CSV after the class if desired.

## How this prototype judges

- Tracks a single person's landmarks with MediaPipe Pose Landmarker Lite in the browser.
- Picks the visible side of the body; requires a knee angle under 120° and hip landmark approximately level with (or below) the knee landmark.
- Counts a rep when the athlete subsequently straightens the knees and raises the wrist above the shoulder with an approximately straight elbow.
- Includes a brief stability delay to reduce duplicate counts; detects only certain suspected no-reps.

**Important limitations:** 2D joint positions are not reliable competition-grade judging, especially with occluded hips/knees, camera tilt, RAM blocking joints, front-facing camera views or variable athlete proportions. The software does not validate load, RAM handling or all movement faults. Thresholds are experimental training heuristics, **not verified official TRYKA standards**. The app is not affiliated with or approved by TRYKA. A coach should supervise and override counts as needed. Test extensively with your athletes before using results in competitions.

## Privacy

Pose inference runs locally in the browser after downloading external MediaPipe assets. The prototype does not upload or record camera video, and session events remain in browser memory until exported. External CDN/model requests may transmit standard network metadata. Do not film participants without their informed consent.

## Development

Edit `app.js` to tune thresholds. Bump the cache name in `sw.js` when deploying updates to ensure clients receive new versions. The prototype depends on public third-party CDN and Google model URLs, so production deployment should self-host versioned dependencies and models.
