import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import apiRouter from './routes/api';
import { initAndSeedDb } from './db/seed';
import { runMigrations } from './db/migrate';
import { APP_URL, emailConfigurado, motivoEmailIndisponivel } from './services/email';
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
    await runMigrations();

    // A grade acadêmica é a fonte da verdade do vínculo Professor <-> Turma <-> Disciplina.
    const grade = await importarHorarioAcademico();
    console.log(
      `📅 Horário acadêmico importado: ${grade.aulas} aulas, ${grade.turmas} turmas novas, ` +
        `${grade.professores} docentes (${grade.professoresCriados} criados), ${grade.vinculos} vínculos.`
    );

    // Diagnostico do e-mail transacional: sem ele o autocadastro volta a liberar
    // acesso sem validar e a recuperacao de senha responde indisponivel — melhor
    // saber disso na subida do que pelo aluno que nao recebeu o link.
    if (!emailConfigurado()) {
      console.warn(
        `⚠️  E-mail transacional desligado (${motivoEmailIndisponivel()}): cadastro sem validacao ` +
          'por e-mail e recuperacao de senha indisponivel.'
      );
    } else if (!process.env.APP_URL) {
      console.warn(
        `⚠️  APP_URL nao definida: os links enviados por e-mail vao apontar para ${APP_URL}, ` +
          'que nao serve para o aluno em producao. Defina APP_URL com a URL publica do portal.'
      );
    } else {
      console.log(`✉️  E-mail transacional ativo. Links apontando para ${APP_URL}`);
    }

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
