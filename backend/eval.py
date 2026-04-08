import os
import time
from dotenv import load_dotenv
from query import query_index, build_prompt, get_embedding
from google import genai
from pinecone import Pinecone

load_dotenv()

client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

def get_answer_for_eval(question: str) -> dict:
    chunks = query_index(question)
    if not chunks:
        return {"answer": "", "contexts": [], "question": question}
    prompt = build_prompt(question, chunks)
    response = client.models.generate_content(
        model="models/gemini-2.0-flash-lite",
        contents=prompt
    )
    return {
        "question": question,
        "answer": response.text,
        "contexts": [c["text"] for c in chunks]
    }

def score_faithfulness(answer: str, contexts: list) -> float:
    context_text = "\n".join(contexts)
    prompt = f"""You are an evaluation system. Score how faithful the answer is to the given context.
Faithfulness means every claim in the answer is supported by the context.

Context:
{context_text}

Answer:
{answer}

Return ONLY a number between 0 and 1 where:
1.0 = every claim is fully supported by context
0.0 = no claims are supported by context

Return only the number, nothing else."""
    response = client.models.generate_content(
        model="models/gemini-2.0-flash-lite",
        contents=prompt
    )
    try:
        return round(float(response.text.strip()), 2)
    except:
        return 0.0

def score_context_recall(question: str, contexts: list) -> float:
    context_text = "\n".join(contexts)
    prompt = f"""You are an evaluation system. Score how well the retrieved context covers what is needed to answer the question.

Question:
{question}

Retrieved Context:
{context_text}

Return ONLY a number between 0 and 1 where:
1.0 = context fully covers everything needed to answer the question
0.0 = context is completely irrelevant to the question

Return only the number, nothing else."""
    response = client.models.generate_content(
        model="models/gemini-2.0-flash-lite",
        contents=prompt
    )
    try:
        return round(float(response.text.strip()), 2)
    except:
        return 0.0

def run_eval(questions: list) -> dict:
    results = []
    total_faithfulness = 0
    total_recall = 0
    for question in questions:
        data = get_answer_for_eval(question)
        if not data["contexts"]:
            continue
        time.sleep(15)
        faithfulness = score_faithfulness(data["answer"], data["contexts"])
        time.sleep(15)
        recall = score_context_recall(data["question"], data["contexts"])
        total_faithfulness += faithfulness
        total_recall += recall
        results.append({
            "question": question,
            "answer": data["answer"],
            "faithfulness": faithfulness,
            "context_recall": recall
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