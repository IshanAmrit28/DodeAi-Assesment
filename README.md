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
- **Data**: SAP O2C JSONL datasets (Ingested into LibSQL/Turso)

## 🏗️ Architecture Overview

The SAP O2C Assistant is built with a modern, decoupled architecture designed for scalability and reliability:

- **Backend (Node.js/Express)**: A lightweight API layer that manages data flow, AI orchestration, and security validation. It uses a custom-built failover mechanism for LLM interactions.
- **Frontend (React/Vite)**: A responsive SPA that provides an interactive chat interface and a dynamic network graph for data visualization.
- **Data Layer (LibSQL/Turso)**: A high-performance, edge-ready database that stores structured SAP data and pre-computed graph edges.
- **AI Orchestration**: A two-pass generation pipeline that translates natural language to SQL and then summarizes the results back into human-readable insights.

## 🗄️ Database Choice: LibSQL (Turso)

We chose **LibSQL** (the open-source fork of SQLite) and **Turso** for several strategic reasons:

- **Local-First Development**: Uses a local `database.sqlite` file for development, ensuring no latency and zero cost during the initial build.
- **Production Scalability**: Seamlessly migrates to Turso Cloud for edge-distributed data access with minimal configuration changes.
- **SQL Compatibility**: Allows the LLM to generate standard SQL queries, which are highly portable and well-understood by modern AI models.
- **Performance**: Extremely fast read/write operations for the tabular datasets used in SAP O2C flows.

## 🧠 LLM Prompting Strategy

The system employs a sophisticated prompting strategy to ensure accuracy and minimize hallucinations:

1.  **Context Injection (RAG-Lite)**: Every SQL generation prompt includes the full database schema and a detailed map of table relationships (e.g., SO -> Delivery -> Billing).
2.  **Persona Engineering**: The model is instructed to act as an "Expert SAP O2C Data Analyst," grounding its responses in domain-specific logic.
3.  **Strict Output Formatting**: The model is constrained to output *only* raw SQL in the first pass, preventing conversational filler from breaking the database execution.
4.  **Two-Pass Validation**:
    - **Pass 1 (NL to SQL)**: Translates the user's question into a specific `SELECT` query.
    - **Pass 2 (Data to NL)**: Takes the raw JSON result from the database and converts it into a formatted Markdown table or a natural language explanation.
5.  **Failover Resilience**: Uses a 3-key rotation system. If the primary Gemini key hits a rate limit or fails, the system automatically retries with a fallback key within seconds.

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

## 🛡️ Security & Guardrails

We have implemented multiple layers of protection to ensure system stability and data integrity:

- **Intent Validation**: Before reaching the LLM, user queries are scanned for SAP-related keywords. Off-topic questions (e.g., "What's the weather?") are blocked at the entry point.
- **SQL Keyword Filtering**: The system strictly enforces a **"Read-Only" policy**. Any generated SQL containing forbidden keywords (`DROP`, `DELETE`, `UPDATE`, `INSERT`, `ALTER`) is immediately rejected before execution.
- **Execution Sandbox**: Only `SELECT` statements are permitted. The database connection itself can be configured with restricted permissions for added safety.
- **Hallucination Prevention**: The system prompt explicitly forbids the LLM from using tables or columns not defined in the provided schema.
