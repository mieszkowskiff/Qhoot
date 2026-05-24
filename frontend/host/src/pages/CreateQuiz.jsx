import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import { collection, addDoc } from "firebase/firestore";

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
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "2rem" }}>
      <h1>Create Quiz</h1>

      <input
        style={{ width: "100%", padding: 8, marginBottom: "1.5rem" }}
        placeholder="Quiz title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      {questions.map((q, qIndex) => (
        <div
          key={qIndex}
          style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: "1rem",
            marginBottom: "1rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <strong>Question {qIndex + 1}</strong>
            {questions.length > 1 && (
              <button onClick={() => removeQuestion(qIndex)}>Remove</button>
            )}
          </div>

          <input
            style={{ width: "100%", marginTop: 8, padding: 8 }}
            placeholder="Question text"
            value={q.text}
            onChange={(e) => updateQuestion(qIndex, "text", e.target.value)}
          />

          {q.answers.map((a, aIndex) => (
            <div
              key={aIndex}
              style={{ display: "flex", alignItems: "center", marginTop: 6 }}
            >
              <input
                type="radio"
                name={`correct-${qIndex}`}
                checked={q.correctAnswer === aIndex}
                onChange={() => updateQuestion(qIndex, "correctAnswer", aIndex)}
              />
              <input
                style={{ flex: 1, marginLeft: 8, padding: 6 }}
                placeholder={`Answer ${aIndex + 1}`}
                value={a}
                onChange={(e) => updateAnswer(qIndex, aIndex, e.target.value)}
              />
            </div>
          ))}
        </div>
      ))}

      <button onClick={addQuestion} style={{ marginRight: 12 }}>
        + Add Question
      </button>

      <button onClick={handleCreate} disabled={saving || !title}>
        {saving ? "Saving..." : "Create Quiz"}
      </button>
    </div>
  );
}