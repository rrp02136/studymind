import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = 'http://127.0.0.1:8000';
const WS_URL = 'ws://127.0.0.1:8000/ws';

function App() {
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [connecting, setConnecting] = useState(false);
  const wsRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const uploadFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axios.post(`${API_URL}/ingest`, formData);
      setUploadedFiles(prev => [...prev, file.name]);
      setMessages(prev => [...prev, {
        role: 'system',
        content: `Successfully uploaded "${file.name}" — ${res.data.chunks} chunks indexed.`
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'system',
        content: 'Upload failed. Make sure the backend is running.'
      }]);
    }
    setUploading(false);
  };

  const sendQuestion = () => {
    if (!question.trim()) return;
    const q = question;
    setQuestion('');
    setMessages(prev => [...prev, { role: 'user', content: q }]);
    setConnecting(true);

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    let assistantMessage = '';
    let sources = [];

    ws.onopen = () => {
      setConnecting(false);
      ws.send(JSON.stringify({ question: q }));
      setMessages(prev => [...prev, { role: 'assistant', content: '', sources: [] }]);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'sources') {
        sources = data.content;
      } else if (data.type === 'token') {
        assistantMessage += data.content;
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: 'assistant',
            content: assistantMessage,
            sources
          };
          return updated;
        });
      } else if (data.type === 'done') {
        ws.close();
      } else if (data.type === 'error') {
        setMessages(prev => [...prev, { role: 'system', content: data.content }]);
        ws.close();
      }
    };

    ws.onerror = () => {
      setMessages(prev => [...prev, { role: 'system', content: 'Connection error.' }]);
      setConnecting(false);
    };
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendQuestion();
    }
  };

  return (
    <div className="app">
      <div className="sidebar">
        <h1 className="logo">StudyMind</h1>
        <p className="tagline">AI study assistant for your course materials</p>
        <div className="upload-section">
          <label className="upload-btn">
            {uploading ? 'Uploading...' : 'Upload PDF / PPTX'}
            <input type="file" accept=".pdf,.pptx,.ppt" onChange={uploadFile} hidden />
          </label>
          {uploadedFiles.length > 0 && (
            <div className="file-list">
              {uploadedFiles.map((f, i) => (
                <p key={i} className="uploaded-file">📄 {f}</p>
              ))}
            </div>
          )}
        </div>
        <div className="tips">
          <p>Tips:</p>
          <ul>
            <li>Upload a syllabus or lecture notes</li>
            <li>Ask specific questions</li>
            <li>Sources are cited in answers</li>
          </ul>
        </div>
      </div>

      <div className="chat">
        <div className="messages">
          {messages.length === 0 && (
            <div className="empty">
              Upload a PDF and start asking questions
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`message ${msg.role}`}>
              <div className="bubble">{msg.content}</div>
              {msg.sources && msg.sources.length > 0 && (
                <div className="sources">
                  {msg.sources.map((s, j) => (
                    <span key={j} className="source-tag">
                      Source {j + 1}: {s.source} ({Math.round(s.score * 100)}% match)
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="input-row">
          <textarea
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your materials..."
            rows={2}
          />
          <button onClick={sendQuestion} disabled={connecting || !question.trim()}>
            {connecting ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;