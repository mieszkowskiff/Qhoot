import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { Plus, LogOut, Play, BookOpen } from "lucide-react";

export default function Home() {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);

  useEffect(() => {
    const q = query(
      collection(db, "quizzes"),
      where("hostUid", "==", auth.currentUser.uid),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setQuizzes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, []);

  async function handleSignOut() {
    await signOut(auth);
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-parchment px-6 py-12">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-6">
          <div>
            <p className="text-[0.7rem] font-medium uppercase tracking-[0.24em] text-camel">
              CloudVote
            </p>
            <h1 className="mt-1.5 font-serif text-4xl font-semibold tracking-tight text-ink">
              My Quizzes
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/quiz/new")}
              className="inline-flex items-center gap-2 rounded-full bg-oxford px-6 py-2.5 text-sm font-medium tracking-wide text-alabaster shadow-[0_8px_24px_-12px_rgba(27,42,74,0.6)] transition-colors duration-300 hover:bg-oxford-soft"
            >
              <Plus className="h-4 w-4" strokeWidth={1.75} />
              New Quiz
            </button>
            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-ivory px-5 py-2.5 text-sm font-medium tracking-wide text-stone transition-colors duration-300 hover:bg-alabaster hover:text-ink"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.75} />
              Sign Out
            </button>
          </div>
        </header>

        {/* List */}
        {quizzes.length === 0 ? (
          <p className="mt-10 rounded-2xl border border-dashed border-line bg-ivory px-6 py-12 text-center text-sm italic tracking-wide text-stone-soft">
            No quizzes yet. Create your first one!
          </p>
        ) : (
          <div className="mt-8 space-y-3.5">
            {quizzes.map((quiz) => (
              <div
                key={quiz.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-ivory px-6 py-5 shadow-[0_1px_2px_rgba(42,39,36,0.04),0_12px_32px_-16px_rgba(42,39,36,0.12)] transition-colors duration-300 hover:bg-alabaster"
              >
                <div className="flex items-center gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-alabaster text-camel">
                    <BookOpen className="h-5 w-5" strokeWidth={1.5} />
                  </span>
                  <div>
                    <strong className="block font-serif text-lg font-semibold tracking-tight text-ink">
                      {quiz.title}
                    </strong>
                    <p className="mt-0.5 text-xs uppercase tracking-[0.16em] text-stone-soft">
                      {quiz.createdAt?.toDate().toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/quiz/${quiz.id}/launch`)}
                  className="inline-flex items-center gap-2 rounded-full border border-oxford/30 bg-transparent px-5 py-2.5 text-sm font-medium tracking-wide text-oxford transition-colors duration-300 hover:bg-oxford hover:text-alabaster"
                >
                  <Play className="h-4 w-4" strokeWidth={1.75} />
                  Launch
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
