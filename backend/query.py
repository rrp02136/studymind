import os
from dotenv import load_dotenv
from google import genai
from pinecone import Pinecone

load_dotenv()

pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

def get_embedding(text: str):
    result = client.models.embed_content(
        model="models/gemini-embedding-001",
        contents=text
    )
    return result.embeddings[0].values

def query_index(question: str, top_k: int = 5):
    index = pc.Index(os.getenv("PINECONE_INDEX_NAME"))
    question_embedding = get_embedding(question)
    results = index.query(
        vector=question_embedding,
        top_k=top_k,
        include_metadata=True
    )
    chunks = []
    for match in results.matches:
        chunks.append({
            "text": match.metadata["text"],
            "source": match.metadata["source"],
            "score": match.score
        })
    return chunks

def build_prompt(question: str, chunks: list) -> str:
    context = ""
    for i, chunk in enumerate(chunks):
        context += f"[Source {i+1} - {chunk['source']}]\n{chunk['text']}\n\n"
    return f"""You are a helpful study assistant. Answer the question below using ONLY the context provided.
For every fact you state, cite the source like this: [Source 1], [Source 2], etc.
If the answer is not in the context, say "I couldn't find that in the uploaded materials."

Context:
{context}

Question: {question}

Answer:"""

def get_answer(question: str):
    chunks = query_index(question)
    if not chunks:
        return {"answer": "No documents uploaded yet.", "sources": []}
    prompt = build_prompt(question, chunks)
    response = client.models.generate_content(
        model="models/gemini-2.5-flash",
        contents=prompt
    )
    return {
        "answer": response.text,
        "sources": chunks
    }