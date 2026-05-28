# CloudVote – Player Frontend

React + Vite application for quiz players. Allows joining a room by code, answering questions in real-time, and viewing final results.

## Tech Stack

- **React 18** + **Vite**
- **Firebase SDK v10** — Firestore (real-time listeners)
- **React Router v6** — client-side routing

## Project Structure

```
player/
├── src/
│   ├── firebase.js      # Firebase app initialization
│   ├── App.jsx          # Router setup
│   └── pages/
│       ├── Join.jsx     # Enter room code and nickname
│       ├── Play.jsx     # Answer questions in real-time
│       └── Results.jsx  # Final score and leaderboard
├── .env                 # Firebase credentials (not committed)
└── vite.config.js
```

## Routes

| Path | Page | Description |
|---|---|---|
| `/` | Join | Enter room code and nickname |
| `/play/:roomId` | Play | Answer questions live |
| `/results/:roomId` | Results | Final score and leaderboard |

No authentication required — players join anonymously with a nickname.

## Firestore Data Model

The player frontend reads from and writes to the following Firestore paths:

```
rooms/{roomId}                        # listened to for room status and current question index
rooms/{roomId}/players/{playerId}     # player's score and last answer are updated here
quizzes/{quizId}/questions            # questions are loaded once when the game starts
```

## Player Session

Player identity is stored in `sessionStorage` (not persisted across browser sessions):

```
sessionStorage.playerId   # Firestore document ID of the player
sessionStorage.nickname   # player's chosen nickname
```

## Environment Variables

Create a `.env` file in the `player/` folder (same values as host):

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

## Getting Started

```bash
npm install
npm run dev
```

Runs on `http://localhost:5174` by default (configured in `vite.config.js`).

## Game Flow

1. Player opens the app and enters a **room code** (6-character uppercase) and a **nickname**
2. If the room exists and is in `waiting` status, the player is added to `rooms/{roomId}/players/`
3. Player waits on the Play page until the host starts the quiz
4. For each question, the player sees the question text and 4 answer buttons
5. After selecting an answer:
   - The correct answer is highlighted green, wrong answers red
   - Score is updated in Firestore (+100 for correct answer)
   - Player waits for the host to advance to the next question
6. When the host ends the quiz, the player is automatically redirected to the Results page
7. Results page shows the player's final score, position, and full leaderboard

## Known Limitations

- Player answers are currently written **directly to Firestore**. In production this should go through the API Gateway → Pub/Sub → Worker pipeline to handle the Thundering Herd problem at scale.
- `sessionStorage` means the player loses their session if they close the browser tab. A more robust solution would use a URL parameter or localStorage.
- Firestore security rules are currently open (`allow read, write: if true`). These should be tightened before any public deployment.

## Player

```bash
cd frontend/player
npm run build
firebase deploy --only hosting:player
```

Live at: `https://qhoot-player.web.app`