import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import apiRouter from './routes/api';
import { initAndSeedDb } from './db/seed';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API Routes
app.use('/api', apiRouter);

// Serve static uploaded files directory for public previews if permitted
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// Root Endpoint Status
app.get('/health', (req, res) => {
  res.json({ status: 'OK', system: 'Plataforma PBL Backend API', timestamp: new Date() });
});

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ message: err.message || 'Erro interno no servidor.' });
});

// Boot Server and Init Database
async function startServer() {
  try {
    await initAndSeedDb();
    app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`🚀 SERVIDOR PBL BACKEND RODANDO NA PORTA ${PORT}`);
      console.log(`📍 URL: http://localhost:${PORT}`);
      console.log(`=======================================================`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
