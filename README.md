# StudyMind 🧠

An AI-powered study assistant that lets you upload course materials (PDFs) and ask questions about them in natural language — with cited answers streamed in real time.

## Tech Stack

- **Backend**: FastAPI, Python
- **Frontend**: React
- **Vector Database**: Pinecone
- **LLM**: Google Gemini 2.5 Flash
- **RAG**: LangChain, custom chunking + embedding pipeline
- **Streaming**: WebSockets
- **Eval**: Custom faithfulness + context recall scoring (RAGAS-inspired)

## Features

- Upload any PDF (syllabus, lecture notes, textbook chapters)
- Ask questions in natural language
- Answers stream in real time via WebSockets
- Every answer cites which source chunks it pulled from with match scores
- Eval tab scores answer quality: faithfulness + context recall per question

## Architecture

1. PDF uploaded → chunked into 500-token segments → embedded via Gemini → stored in Pinecone vector DB
2. User asks question → question embedded → top-5 chunks retrieved via cosine similarity
3. Retrieved chunks + question sent to Gemini with citation prompt → streamed back via WebSocket
4. Eval endpoint scores answers on faithfulness and context recall

## Running Locally

### Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install fastapi uvicorn python-multipart pypdf langchain-text-splitters google-genai pinecone python-dotenv websockets langchain-google-genai
```

Create `backend/.env`:
```
GOOGLE_API_KEY=your_key_here
PINECONE_API_KEY=your_key_here
PINECONE_INDEX_NAME=studymind
```

```bash
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm start
```

## Built by Ronit Parikh — UGA CS 2027