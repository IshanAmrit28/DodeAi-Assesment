import React, { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';

const GraphView = ({ data, onNodeClick, selectedNodeId }) => {
  const cyRef = useRef(null);
  const cyInstance = useRef(null);

  useEffect(() => {
    if (!data || !cyRef.current) return;

    const cy = cytoscape({
      container: cyRef.current,
      elements: [
        ...data.nodes.map(n => ({ data: { id: n.id, label: n.label, type: n.type, ...n.metadata } })),
        ...data.edges.map(e => ({ data: { id: e.id, source: e.source, target: e.target, label: e.type } }))
      ],
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#6366f1',
            'label': 'data(label)',
            'color': '#fff',
            'font-size': '10px',
            'text-valign': 'center',
            'text-halign': 'center',
            'width': '30px',
            'height': '30px',
            'border-width': 2,
            'border-color': '#fff'
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#475569',
            'target-arrow-color': '#475569',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'label': 'data(label)',
            'font-size': '8px',
            'color': '#94a3b8',
            'text-rotation': 'autorotate',
            'text-margin-y': -10
          }
        },
        {
          selector: ':selected',
          style: {
            'background-color': '#f43f5e',
            'line-color': '#f43f5e',
            'target-arrow-color': '#f43f5e'
          }
        }
      ],
      layout: {
        name: 'cose',
        nodeRepulsion: (node) => 10000000,
        idealEdgeLength: (edge) => 200,
        edgeElasticity: (edge) => 100,
        nodeOverlap: 20,
        refresh: 20,
        fit: true,
        padding: 50,
        randomize: false,
        componentSpacing: 200,
        nodeSpacing: (node) => 200,
        animate: true,
        animationDuration: 1000,
      }
    });

    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      onNodeClick(node.data());
    });

    cyInstance.current = cy;

    return () => cy.destroy();
  }, [data, onNodeClick]);

  useEffect(() => {
    if (cyInstance.current && selectedNodeId) {
      const node = cyInstance.current.getElementById(selectedNodeId);
      if (node.length) {
        cyInstance.current.$(':selected').unselect();
        node.select();
        cyInstance.current.animate({
          center: { eles: node },
          zoom: 1.5
        }, { duration: 500 });
      }
    }
  }, [selectedNodeId]);

  return <div id="cy" ref={cyRef} />;
};

export default GraphView;
