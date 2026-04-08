import os
import json
from eval import run_eval
from fastapi import FastAPI, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from ingest import ingest_pdf
from query import get_answer
from google import genai
load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"status": "StudyMind API is running"}

@app.post("/ingest")
async def ingest(file: UploadFile = File(...)):
    contents = await file.read()
    num_chunks = ingest_pdf(contents, file.filename)
    return {"message": f"Ingested {file.filename}", "chunks": num_chunks}

@app.post("/query")
async def query(data: dict):
    question = data.get("question", "")
    if not question:
        return {"error": "No question provided"}
    result = get_answer(question)
    return result

@app.post("/eval")
async def eval_endpoint(data: dict):
    questions = data.get("questions", [])
    if not questions:
        return {"error": "No questions provided"}
    results = run_eval(questions)
    return results

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            question = payload.get("question", "")
            from query import query_index, build_prompt
            chunks = query_index(question)
            if not chunks:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "content": "No documents uploaded yet."
                }))
                continue
            prompt = build_prompt(question, chunks)
            client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
            await websocket.send_text(json.dumps({
                "type": "sources",
                "content": chunks
            }))
            response = client.models.generate_content_stream(
                 model="models/gemini-2.5-flash",
                 contents=prompt
                 )
            for chunk in response:
                if chunk.text:
                    await websocket.send_text(json.dumps({
                        "type": "token",
                        "content": chunk.text
                    }))
            await websocket.send_text(json.dumps({"type": "done"}))
    except WebSocketDisconnect:
        print("Client disconnected")