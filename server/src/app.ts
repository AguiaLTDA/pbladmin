import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import apiRouter from './routes/api';
import { initAndSeedDb } from './db/seed';
import { runMigrations } from './db/migrate';
import { importarHorarioAcademico } from './services/horarioImport';

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
  res.json({
    status: 'OK',
    system: 'Plataforma PBL Backend API',
    timestamp: new Date(),
    // Diagnóstico temporário de deploy: só diz se cada variável crítica está
    // presente no processo, nunca expõe o valor. Remover depois de confirmar.
    config: {
      dbHost: Boolean(process.env.DB_HOST),
      googleDriveKeyJson: Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON),
      googleDriveKeyFile: Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE),
      googleDriveFolderId: Boolean(process.env.GOOGLE_DRIVE_FOLDER_ID),
      jwtSecretCustom: Boolean(process.env.JWT_SECRET)
    }
  });
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
    await runMigrations();

    // A grade acadêmica é a fonte da verdade do vínculo Professor <-> Turma <-> Disciplina.
    const grade = await importarHorarioAcademico();
    console.log(
      `📅 Horário acadêmico importado: ${grade.aulas} aulas, ${grade.turmas} turmas novas, ` +
        `${grade.professores} docentes (${grade.professoresCriados} criados), ${grade.vinculos} vínculos.`
    );

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
