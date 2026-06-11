import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db, auth } from "../firebase";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { Users, Play } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

export default function Lobby() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "rooms", roomId), (snap) => {
      const data = snap.data();
      if (data?.hostUid !== auth.currentUser?.uid) {
        navigate("/");
        return;
      }
      setRoom({ id: snap.id, ...data });
    });
    return () => unsubscribe();
  }, [roomId]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "rooms", roomId, "players"),
      (snapshot) => {
        setPlayers(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      }
    );
    return () => unsubscribe();
  }, [roomId]);

  async function handleStart() {
    await updateDoc(doc(db, "rooms", roomId), {
      status: "question",
      currentQuestionIndex: 0,
    });
    navigate(`/live/${roomId}`);
  }

  if (!room)
    return (
      <div className="flex min-h-screen items-center justify-center bg-parchment">
        <p className="font-serif text-2xl italic text-stone">Loading…</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-parchment px-6 py-12">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-[0.7rem] font-medium uppercase tracking-[0.24em] text-camel">
          The Lobby
        </p>
        <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight text-ink">
          Gathering Guests
        </h1>

        {/* Room code — prestigious entry code */}
        <div className="mx-auto mt-8 max-w-md rounded-3xl border border-line bg-ivory px-10 py-10 shadow-[0_1px_2px_rgba(42,39,36,0.04),0_20px_48px_-24px_rgba(42,39,36,0.18)]">
          <p className="text-[0.7rem] font-medium uppercase tracking-[0.28em] text-stone">
            Room Code
          </p>
          <p className="mt-4 font-serif text-6xl font-semibold tracking-widest text-oxford">
            {roomId}
          </p>
          <p className="mt-5 text-sm tracking-wide text-stone-soft">
            Share this code or scan to join.
          </p>
          <div className="mt-6 flex justify-center">
            <div className="rounded-2xl border border-line bg-alabaster p-4 shadow-[0_1px_2px_rgba(42,39,36,0.06)]">
              <QRCodeSVG
                value={`https://qhoot-player.web.app/join?code=${roomId}`}
                size={160}
                bgColor="transparent"
                fgColor="#1B2A4A"
                level="M"
              />
            </div>
          </div>
        </div>

        {/* Players */}
        <div className="mt-10 text-left">
          <div className="flex items-center justify-center gap-2.5">
            <Users className="h-4 w-4 text-camel" strokeWidth={1.75} />
            <h2 className="font-serif text-xl font-semibold tracking-tight text-ink">
              Players
              <span className="ml-2 font-sans text-sm font-normal tracking-[0.18em] text-stone-soft">
                ({players.length})
              </span>
            </h2>
          </div>

          {players.length === 0 ? (
            <p className="mt-5 rounded-2xl border border-dashed border-line bg-ivory px-6 py-10 text-center text-sm italic tracking-wide text-stone-soft">
              Waiting for players to join…
            </p>
          ) : (
            <ul className="mt-6 flex flex-wrap justify-center gap-2.5">
              {players.map((p) => (
                <li
                  key={p.id}
                  className="rounded-full border border-line bg-cashmere px-5 py-2.5 text-sm font-medium tracking-wide text-ink shadow-[0_1px_2px_rgba(42,39,36,0.04)]"
                >
                  {p.nickname}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Start */}
        <button
          onClick={handleStart}
          disabled={players.length === 0}
          className="mt-12 inline-flex items-center gap-2.5 rounded-full bg-oxford px-10 py-4 text-base font-medium tracking-wide text-alabaster shadow-[0_10px_28px_-12px_rgba(27,42,74,0.6)] transition-colors duration-300 hover:bg-oxford-soft disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          <Play className="h-5 w-5" strokeWidth={1.75} />
          Start Quiz
        </button>
      </div>
    </div>
  );
}