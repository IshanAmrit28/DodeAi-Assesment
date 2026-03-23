# SAP O2C Assistant 🚀

A powerful, AI-driven assistant for exploring and visualizing SAP Order-to-Cash (O2C) data. This tool combines a natural language chat interface with a dynamic graph visualization to help business analysts track document flows, identify bottlenecks, and explore entity relationships effortlessly.

## ✨ Key Features

- **Gemini-First LLM Pipeline**: Advanced failover system using 3 Gemini API keys for maximum reliability and uptime.
- **Natural Language Querying**: Ask questions like "Trace the full flow of billing document 90504204" and get instant tabular answers.
- **Dynamic Graph Visualization**: Interactive network graph showing relationships between Customers, Billing Documents, Journal Entries, Payments, and Products.
- **SQL Guardrails & Validation**: Built-in security to prevent hallucination and block destructive SQL queries.
- **Persistent Caching**: Intelligent query caching for lightning-fast responses on repeated inquiries.

## 🛠️ Tech Stack

- **Backend**: Node.js (Express), Better-SQLite3, Google Gemini AI (3-Key Failover)
- **Frontend**: React (Vite, Cytoscape.js, React-Markdown with GFM, Lucide-React)
- **Data**: SAP O2C JSONL datasets

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- 1 to 3 Google Gemini API Keys
- Python 3.10+ (optional, for utility scripts in `scripts/`)

### 1. Backend Setup

1. **Navigate to the backend directory**:
   ```powershell
   cd backend
   ```

2. **Install dependencies**:
   ```powershell
   npm install
   ```

3. **Set up Environment Variables**:
   Create a `.env` file in the `backend/` folder based on `.env.example`:
   ```env
   GEMINI_API_KEY_1=your_primary_key
   GEMINI_API_KEY_2=your_fallback_key
   GEMINI_API_KEY_3=your_tertiary_key
   CORS_ALLOWED_ORIGINS=http://localhost:5173
   ```

4. **Ingest SAP Data**:
   ```powershell
   node src/services/ingest.js
   ```

5. **Run the Server**:
   ```powershell
   npm start
   ```
   *Server runs on http://localhost:3000*

### 2. Frontend Setup

1.  **Navigate to the frontend directory**:
    ```powershell
    cd ../frontend
    ```

2.  **Install dependencies**:
    ```powershell
    npm install
    ```

3.  **Set up Environment Variables**:
    Create a `.env` file in the `frontend/` folder:
    ```env
    VITE_API_BASE_URL=http://localhost:3000
    ```

4.  **Run the Dev Server**:
    ```powershell
    npm run dev
    ```
    *Client runs on http://localhost:5173*

### 3. Data Auditing (Optional)

To verify the integrity and consistency of the ingested SAP data:
```powershell
node scripts/audit.js
```

## 📂 Project Structure

- `backend/`: Node.js Express server and AI logic.
  - `src/services/ingest.js`: Dynamic schema generation and data loading.
  - `src/services/chatService.js`: Gemini-powered SQL generation, failover logic, and Markdown formatting.
  - `src/models/schemas.js`: Data models for API contracts.
  - `app.js`: API entry point and Express application logic.
- `frontend/`: React components and styles.
  - `src/components/GraphView.jsx`: Network visualization.
  - `src/components/ChatView.jsx`: AI chat with Markdown/GFM support.
- `scripts/`: Utility scripts.
  - `audit.js`: Node.js script for data auditing and integrity checks.

## 🛡️ Security Guardrails

The system is restricted to answering questions related to:
- Orders, deliveries, billing/invoices, payments, customers, and products.
- Only `SELECT` queries are permitted; all other operations (DROP, DELETE, etc.) are strictly blocked.
