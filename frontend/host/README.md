# CloudVote – Host Frontend

React + Vite application for quiz hosts. Allows creating quizzes, launching rooms, and monitoring live results.

## Tech Stack

- **React 18** + **Vite**
- **Firebase SDK v10** — Firestore (real-time listeners), Firebase Auth (Google Sign-In)
- **React Router v6** — client-side routing
- **Recharts** — live vote bar charts

## Project Structure

```
host/
├── src/
│   ├── firebase.js              # Firebase app initialization
│   ├── App.jsx                  # Router setup
│   ├── hooks/
│   │   └── useAuth.js           # Auth state hook
│   ├── components/
│   │   └── ProtectedRoute.jsx   # Redirects unauthenticated users to /login
│   └── pages/
│       ├── Login.jsx            # Google Sign-In page
│       ├── Home.jsx             # Quiz list + New Quiz button
│       ├── CreateQuiz.jsx       # Quiz creation form
│       ├── LaunchRoom.jsx       # Generates room code and creates room
│       ├── Lobby.jsx            # Waiting room with live player list
│       └── LiveDashboard.jsx    # Live question view + vote chart + leaderboard
├── .env                         # Firebase credentials (not committed)
└── vite.config.js
```

## Routes

| Path | Page | Description |
|---|---|---|
| `/login` | Login | Google Sign-In |
| `/` | Home | List of host's quizzes |
| `/quiz/new` | CreateQuiz | Create a new quiz |
| `/quiz/:quizId/launch` | LaunchRoom | Launch a room for a quiz |
| `/lobby/:roomId` | Lobby | Wait for players to join |
| `/live/:roomId` | LiveDashboard | Run the quiz live |

All routes except `/login` are protected — unauthenticated users are redirected to `/login`.

## Firestore Data Model

```
quizzes/
└── {quizId}/
    ├── title: string
    ├── hostUid: string        # UID of the creator
    ├── createdAt: timestamp
    └── questions/             # subcollection
        └── {questionId}/
            ├── text: string
            ├── answers: string[]
            ├── correctAnswer: number  # index of correct answer
            └── order: number

rooms/
└── {roomId}/                  # 6-character uppercase code e.g. "ABC123"
    ├── quizId: string
    ├── hostUid: string
    ├── status: "waiting" | "question" | "finished"
    ├── currentQuestionIndex: number
    ├── createdAt: timestamp
    └── players/               # subcollection
        └── {playerId}/
            ├── nickname: string
            ├── score: number
            ├── lastAnswer: number
            └── joinedAt: timestamp
```

## Environment Variables

Create a `.env` file in the `host/` folder:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Get these values from Firebase Console → Project Settings → Your Apps → Web App.

## Getting Started

```bash
npm install
npm run dev
```

Runs on `http://localhost:5173` by default.

## Authentication

Uses Firebase Auth with Google Sign-In. Only the host who created a room can access its Lobby and LiveDashboard — ownership is enforced via `hostUid` stored on the room document.

## Known Limitations

- Player answers are currently written **directly to Firestore** from the player frontend. In production this should go through the API Gateway → Pub/Sub → Worker pipeline to handle the Thundering Herd problem.
- Firestore security rules are currently open (`allow read, write: if true`). These should be tightened before any public deployment.
