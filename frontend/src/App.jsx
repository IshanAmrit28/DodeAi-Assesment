import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import GraphView from './components/GraphView';
import ChatView from './components/ChatView';
import { Info, X } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

function App() {
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [messages, setMessages] = useState([
    { role: 'bot', content: 'Hello! I can help you explore the SAP O2C data. Ask me anything about orders, deliveries, or customers.' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);

  const fetchGraph = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/graph`);
      setGraphData(res.data);
    } catch (err) {
      console.error("Failed to fetch graph:", err);
      // alert("Failed to fetch graph from backend. Make sure the backend is running on port 3000.");
    }
  }, []);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  const handleSendMessage = async (input) => {
    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await axios.post(`${API_BASE}/chat`, { message: input });
      const botMsg = { 
        role: 'bot', 
        content: res.data.answer,
        sql: res.data.sql 
      };
      setMessages(prev => [...prev, botMsg]);
      
      // Auto-select related nodes if returned
      if (res.data.relatedNodeIds && res.data.relatedNodeIds.length > 0) {
        const ids = res.data.relatedNodeIds;
        
        // Fetch focused data for these IDs
        try {
          const focusRes = await axios.get(`${API_BASE}/graph/focus?ids=${ids.join(',')}`);
          
          // Merge with existing graph data
          setGraphData(prev => {
            const newNodes = [...prev.nodes];
            const newEdges = [...prev.edges];
            
            focusRes.data.nodes.forEach(node => {
              if (!newNodes.find(n => n.id === node.id)) {
                newNodes.push(node);
              }
            });
            
            focusRes.data.edges.forEach(edge => {
              if (!newEdges.find(e => e.id === edge.id)) {
                newEdges.push(edge);
              }
            });
            
            return { nodes: newNodes, edges: newEdges };
          });

          // Select the first node once data is merged
          const firstId = ids[0];
          const node = focusRes.data.nodes.find(n => n.id === firstId);
          if (node) {
            setSelectedNode(node);
          }
        } catch (focusErr) {
          console.error("Failed to fetch focus graph:", focusErr);
        }
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'bot', content: 'Sorry, I encountered an error processing your request.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNodeClick = (nodeData) => {
    setSelectedNode(nodeData);
  };

  return (
    <div className="app-container">
      <div className="graph-container">
        <GraphView 
          data={graphData} 
          onNodeClick={handleNodeClick} 
          selectedNodeId={selectedNode?.id}
        />
        
        {selectedNode && (
          <div className="node-details">
            <div className="node-details-header">
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <Info size={18} color="#c084fc" />
                <h3>{selectedNode.type} Details</h3>
              </div>
              <X size={18} onClick={() => setSelectedNode(null)} style={{ cursor: 'pointer', opacity: 0.6 }} />
            </div>
            
            <div className="node-details-row">
              <span className="node-details-label">ID</span>
              <span className="node-details-value">{selectedNode.id}</span>
            </div>
            
            {/* Display Metadata fields */}
            {selectedNode.metadata && Object.entries(selectedNode.metadata).map(([key, val]) => {
              if (['id', 'label', 'type'].includes(key)) return null;
              // Skip empty or complex values for cleaner UI
              if (val === null || val === undefined || typeof val === 'object') return null;
              
              return (
                <div key={key} className="node-details-row">
                  <span className="node-details-label">{key}</span>
                  <span className="node-details-value">{String(val)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ChatView 
        messages={messages} 
        onSendMessage={handleSendMessage} 
        isLoading={isLoading} 
      />
    </div>
  );
}

export default App;
