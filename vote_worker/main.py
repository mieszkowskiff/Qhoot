import base64
import json
import os
import functions_framework
from google.cloud import firestore

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

project_id = os.environ.get("PROJECT_ID", "your-project-id")
db = firestore.Client(project=project_id, database="qhoot-database")

@functions_framework.cloud_event
def process_vote(cloud_event):
    try:
        # 1. Decode Pub/Sub message
        encoded_data = cloud_event.data["message"]["data"]
        vote_data = json.loads(base64.b64decode(encoded_data).decode("utf-8"))

        room_id = vote_data.get("roomId")
        player_id = vote_data.get("playerId")
        question_index = vote_data.get("questionIndex")
        answer_index = vote_data.get("answerIndex")

        print(f"Processing vote: room={room_id} player={player_id} question={question_index} answer={answer_index}")

        # 2. Validate — check room exists and is on the right question
        room_ref = db.collection("rooms").document(room_id)
        room = room_ref.get()

        if not room.exists:
            print(f"Room {room_id} not found, skipping.")
            return

        room_data = room.to_dict()

        if room_data.get("status") != "question":
            print(f"Room {room_id} is not in question state, skipping.")
            return

        if room_data.get("currentQuestionIndex") != question_index:
            print(f"Question index mismatch for room {room_id}, skipping (late vote).")
            return

        # 3. Get quiz and correct answer
        quiz_id = room_data.get("quizId")
        questions = (
            db.collection("quizzes")
            .document(quiz_id)
            .collection("questions")
            .order_by("order")
            .stream()
        )
        questions_list = list(questions)

        if question_index >= len(questions_list):
            print(f"Question index {question_index} out of range, skipping.")
            return

        question_data = questions_list[question_index].to_dict()
        correct_answer = question_data.get("correctAnswer")
        is_correct = answer_index == correct_answer

        # 4. Update player score + save per-question answer history
        player_ref = room_ref.collection("players").document(player_id)
        player = player_ref.get()

        if not player.exists:
            print(f"Player {player_id} not found in room {room_id}, skipping.")
            return

        current_score = player.to_dict().get("score", 0)
        new_score = current_score + (100 if is_correct else 0)

        player_ref.update({
            "lastAnswer": answer_index,
            "score": new_score,
            # Historia odpowiedzi per pytanie — używana przez analytics_worker
            f"answers.q{question_index}": {
                "isCorrect": is_correct,
                "answerIndex": answer_index,
            }
        })

        print(f"Vote processed: player={player_id} correct={is_correct} score={new_score}")

    except Exception as e:
        print(f"Error processing vote: {str(e)}")
        raise e