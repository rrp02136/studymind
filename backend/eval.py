import os
import json
import time
from dotenv import load_dotenv
from query import query_index, build_prompt
from google import genai
from groq import Groq

load_dotenv()

gemini_client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

def get_answer_for_eval(question: str) -> dict:
    chunks = query_index(question)
    if not chunks:
        return {"answer": "", "contexts": [], "question": question}
    prompt = build_prompt(question, chunks)
    response = gemini_client.models.generate_content(
        model="models/gemini-2.5-flash",
        contents=prompt
    )
    return {
        "question": question,
        "answer": response.text,
        "contexts": [c["text"] for c in chunks]
    }

def score_answer(question: str, answer: str, contexts: list) -> dict:
    context_text = "\n".join(contexts)
    prompt = f"""You are an evaluation system. Score the following answer on two metrics.

Context:
{context_text}

Question:
{question}

Answer:
{answer}

Return ONLY a JSON object with exactly this format, nothing else:
{{"faithfulness": 0.0, "context_recall": 0.0}}

Where:
- faithfulness: 0-1 score of how well the answer is supported by the context
- context_recall: 0-1 score of how well the context covers what is needed to answer the question"""

    response = groq_client.chat.completions.create(
        model="llama3-8b-8192",
        messages=[{"role": "user", "content": prompt}],
        temperature=0
    )
    try:
        text = response.choices[0].message.content.strip()
        text = text.replace("```json", "").replace("```", "").strip()
        scores = json.loads(text)
        return {
            "faithfulness": round(float(scores.get("faithfulness", 0)), 2),
            "context_recall": round(float(scores.get("context_recall", 0)), 2)
        }
    except:
        return {"faithfulness": 0.0, "context_recall": 0.0}

def run_eval(questions: list) -> dict:
    results = []
    total_faithfulness = 0
    total_recall = 0
    for question in questions:
        data = get_answer_for_eval(question)
        if not data["contexts"]:
            continue
        scores = score_answer(data["question"], data["answer"], data["contexts"])
        total_faithfulness += scores["faithfulness"]
        total_recall += scores["context_recall"]
        results.append({
            "question": question,
            "answer": data["answer"],
            "faithfulness": scores["faithfulness"],
            "context_recall": scores["context_recall"]
        })
    n = len(results)
    return {
        "results": results,
        "summary": {
            "avg_faithfulness": round(total_faithfulness / n, 2) if n else 0,
            "avg_context_recall": round(total_recall / n, 2) if n else 0,
            "num_questions": n
        }
    }