import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import { collection, addDoc } from "firebase/firestore";
import { Plus, Trash2, Check } from "lucide-react";

export default function CreateQuiz() {
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState([
    { text: "", answers: ["", "", "", ""], correctAnswer: 0 },
  ]);
  const [saving, setSaving] = useState(false);

  function updateQuestion(index, field, value) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, [field]: value } : q))
    );
  }

  function updateAnswer(qIndex, aIndex, value) {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex) return q;
        const answers = [...q.answers];
        answers[aIndex] = value;
        return { ...q, answers };
      })
    );
  }

  function addQuestion() {
    setQuestions((prev) => [
      ...prev,
      { text: "", answers: ["", "", "", ""], correctAnswer: 0 },
    ]);
  }

  function removeQuestion(index) {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCreate() {
    setSaving(true);
    try {
      const quizRef = await addDoc(collection(db, "quizzes"), {
        title,
        hostUid: auth.currentUser.uid,
        createdAt: new Date(),
      });

      const questionsRef = collection(db, "quizzes", quizRef.id, "questions");
      for (let i = 0; i < questions.length; i++) {
        await addDoc(questionsRef, { ...questions[i], order: i });
      }

      navigate(`/`);
    } catch (e) {
      console.error(e);
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-parchment px-6 py-12">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <header className="border-b border-line pb-6">
          <p className="text-[0.7rem] font-medium uppercase tracking-[0.24em] text-camel">
            Compose
          </p>
          <h1 className="mt-1.5 font-serif text-4xl font-semibold tracking-tight text-ink">
            Create Quiz
          </h1>
        </header>

        {/* Title field */}
        <div className="mt-8">
          <label className="block text-[0.7rem] font-medium uppercase tracking-[0.2em] text-stone">
            Title
          </label>
          <input
            className="mt-2 w-full rounded-xl border border-line bg-ivory px-4 py-3 font-serif text-lg text-ink placeholder:font-sans placeholder:text-base placeholder:text-stone-soft focus:border-oxford focus:outline-none focus:ring-2 focus:ring-oxford/15"
            placeholder="Quiz title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {/* Questions */}
        <div className="mt-6 space-y-5">
          {questions.map((q, qIndex) => (
            <div
              key={qIndex}
              className="rounded-2xl border border-line bg-ivory p-6 shadow-[0_1px_2px_rgba(42,39,36,0.04),0_12px_32px_-16px_rgba(42,39,36,0.12)]"
            >
              <div className="flex items-center justify-between">
                <strong className="font-serif text-lg font-semibold tracking-tight text-ink">
                  Question {qIndex + 1}
                </strong>
                {questions.length > 1 && (
                  <button
                    onClick={() => removeQuestion(qIndex)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-burgundy/25 bg-transparent px-3.5 py-1.5 text-xs font-medium tracking-wide text-burgundy transition-colors duration-300 hover:bg-burgundy hover:text-alabaster"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Remove
                  </button>
                )}
              </div>

              <input
                className="mt-4 w-full rounded-xl border border-line bg-alabaster px-4 py-3 text-base text-ink placeholder:text-stone-soft focus:border-oxford focus:outline-none focus:ring-2 focus:ring-oxford/15"
                placeholder="Question text"
                value={q.text}
                onChange={(e) => updateQuestion(qIndex, "text", e.target.value)}
              />

              <div className="mt-4 space-y-2.5">
                {q.answers.map((a, aIndex) => {
                  const isCorrect = q.correctAnswer === aIndex;
                  return (
                    <div
                      key={aIndex}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors duration-300 ${
                        isCorrect
                          ? "border-oxford/40 bg-oxford/5"
                          : "border-line bg-alabaster"
                      }`}
                    >
                      <label className="flex cursor-pointer items-center">
                        <input
                          type="radio"
                          name={`correct-${qIndex}`}
                          checked={isCorrect}
                          onChange={() =>
                            updateQuestion(qIndex, "correctAnswer", aIndex)
                          }
                          className="peer sr-only"
                        />
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full border transition-colors duration-300 ${
                            isCorrect
                              ? "border-oxford bg-oxford text-alabaster"
                              : "border-line-strong bg-parchment text-transparent"
                          }`}
                        >
                          <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                        </span>
                      </label>
                      <input
                        className="flex-1 bg-transparent px-1 py-1.5 text-[0.95rem] text-ink placeholder:text-stone-soft focus:outline-none"
                        placeholder={`Answer ${aIndex + 1}`}
                        value={a}
                        onChange={(e) =>
                          updateAnswer(qIndex, aIndex, e.target.value)
                        }
                      />
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-xs italic tracking-wide text-stone-soft">
                Select the circle to mark the correct answer.
              </p>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-line pt-6">
          <button
            onClick={addQuestion}
            className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-ivory px-6 py-2.5 text-sm font-medium tracking-wide text-stone transition-colors duration-300 hover:bg-alabaster hover:text-ink"
          >
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            Add Question
          </button>

          <button
            onClick={handleCreate}
            disabled={saving || !title}
            className="inline-flex items-center gap-2 rounded-full bg-oxford px-7 py-2.5 text-sm font-medium tracking-wide text-alabaster shadow-[0_8px_24px_-12px_rgba(27,42,74,0.6)] transition-colors duration-300 hover:bg-oxford-soft disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            {saving ? "Saving…" : "Create Quiz"}
          </button>
        </div>
      </div>
    </div>
  );
}
