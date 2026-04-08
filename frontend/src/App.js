import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = 'http://127.0.0.1:8000';
const WS_URL = 'ws://127.0.0.1:8000/ws';

function App() {
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [evalQuestions, setEvalQuestions] = useState('');
  const [evalResults, setEvalResults] = useState(null);
  const [evalLoading, setEvalLoading] = useState(false);
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
      setUploadedFile(file.name);
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

  const runEval = async () => {
    const questions = evalQuestions.split('\n').map(q => q.trim()).filter(q => q);
    if (!questions.length) return;
    setEvalLoading(true);
    setEvalResults(null);
    try {
      const res = await axios.post(`${API_URL}/eval`, { questions });
      setEvalResults(res.data);
    } catch (err) {
      alert('Eval failed. Make sure a PDF is uploaded.');
    }
    setEvalLoading(false);
  };

  return (
    <div className="app">
      <div className="sidebar">
        <h1 className="logo">StudyMind</h1>
        <p className="tagline">AI study assistant for your course materials</p>
        <div className="upload-section">
          <label className="upload-btn">
            {uploading ? 'Uploading...' : 'Upload PDF'}
            <input type="file" accept=".pdf" onChange={uploadFile} hidden />
          </label>
          {uploadedFile && <p className="uploaded-file">📄 {uploadedFile}</p>}
        </div>
        <div className="tab-buttons">
          <button
            className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >Chat</button>
          <button
            className={`tab-btn ${activeTab === 'eval' ? 'active' : ''}`}
            onClick={() => setActiveTab('eval')}
          >Eval</button>
        </div>
        <div className="tips">
          <p>Tips:</p>
          <ul>
            <li>Upload a syllabus or lecture notes</li>
            <li>Ask specific questions</li>
            <li>Use Eval tab to score answer quality</li>
          </ul>
        </div>
      </div>

      <div className="chat">
        {activeTab === 'chat' && (
          <>
            <div className="messages">
              {messages.length === 0 && (
                <div className="empty">Upload a PDF and start asking questions</div>
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
          </>
        )}

        {activeTab === 'eval' && (
          <div className="eval-panel">
            <h2>Answer quality evaluation</h2>
            <p className="eval-desc">Enter one question per line. StudyMind will answer each and score faithfulness and context recall.</p>
            <textarea
              className="eval-input"
              value={evalQuestions}
              onChange={e => setEvalQuestions(e.target.value)}
              placeholder={"What is BFS?\nHow does DFS work?\nWhat is a shortest path?"}
              rows={6}
            />
            <button className="eval-run-btn" onClick={runEval} disabled={evalLoading}>
              {evalLoading ? 'Running eval...' : 'Run eval'}
            </button>

            {evalResults && (
              <div className="eval-results">
                <div className="eval-summary">
                  <div className="eval-metric">
                    <span className="metric-label">Avg faithfulness</span>
                    <span className="metric-value">{evalResults.summary.avg_faithfulness}</span>
                  </div>
                  <div className="eval-metric">
                    <span className="metric-label">Avg context recall</span>
                    <span className="metric-value">{evalResults.summary.avg_context_recall}</span>
                  </div>
                  <div className="eval-metric">
                    <span className="metric-label">Questions scored</span>
                    <span className="metric-value">{evalResults.summary.num_questions}</span>
                  </div>
                </div>
                {evalResults.results.map((r, i) => (
                  <div key={i} className="eval-item">
                    <p className="eval-question">{r.question}</p>
                    <div className="eval-scores">
                      <span className="score-tag">Faithfulness: {r.faithfulness}</span>
                      <span className="score-tag">Context recall: {r.context_recall}</span>
                    </div>
                    <p className="eval-answer">{r.answer}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;