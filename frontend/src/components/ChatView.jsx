import React, { useState } from 'react';
import { Send, User, Bot, Terminal } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const ChatView = ({ onSendMessage, messages, isLoading }) => {
  const [input, setInput] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input);
      setInput('');
    }
  };

  return (
    <div className="sidebar">
      <div className="header">
        <h1>SAP O2C Assistant</h1>
      </div>
      
      <div className="chat-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem' }}>
              {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              <span style={{ fontWeight: 600, fontSize: '0.75rem' }}>
                {msg.role === 'user' ? 'You' : 'AI Assistant'}
              </span>
            </div>
            <div className="message-content">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  table: ({node, ...props}) => (
                    <div style={{ overflowX: 'auto', width: '100%', borderRadius: '0.5rem' }}>
                      <table {...props} />
                    </div>
                  )
                }}
              >
                {msg.content}
              </ReactMarkdown>
            </div>
            
            {/* SQL hidden as per user request */}
          </div>
        ))}
        {isLoading && (
          <div className="message bot">
            <span className="loading-dots">Thinking...</span>
          </div>
        )}
      </div>

      <div className="chat-input-container">
        <form onSubmit={handleSubmit} className="chat-input-wrapper">
          <input
            type="text"
            className="chat-input"
            placeholder="Ask about orders, deliveries..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
          />
          <button type="submit" className="send-button" disabled={isLoading || !input.trim()}>
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatView;
