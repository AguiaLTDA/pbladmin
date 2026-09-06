import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateToken, requireRole } from '../middleware/auth';
import * as authCtrl from '../controllers/authController';
import * as academicCtrl from '../controllers/academicController';
import * as pblCtrl from '../controllers/pblController';
import * as pubCtrl from '../controllers/publicationController';
import * as subCtrl from '../controllers/submissionController';
import * as fileCtrl from '../controllers/fileController';
import * as dashCtrl from '../controllers/dashboardController';
import * as reportCtrl from '../controllers/reportController';
import * as notifCtrl from '../controllers/notificationController';
import * as auditCtrl from '../controllers/auditController';
import * as preCadastroCtrl from '../controllers/preCadastroController';

const router = Router();

// --- AUTHENTICATION ---
router.post('/auth/login', authCtrl.login);
router.get('/auth/profile', authenticateToken, authCtrl.getProfile);
router.put('/auth/change-password', authenticateToken, authCtrl.changePassword);

// --- CADASTRO PÚBLICO DE ESTUDANTES (sem autenticação, sujeito a aprovação do admin) ---
const preCadastroLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Muitas tentativas de cadastro. Tente novamente em alguns minutos.' }
});
router.post('/public/pre-cadastro', preCadastroLimiter, preCadastroCtrl.criarPreCadastro);

router.get('/admin/pre-cadastros', authenticateToken, requireRole('ADMIN'), preCadastroCtrl.listarPreCadastros);
router.post('/admin/pre-cadastros/:id/aprovar', authenticateToken, requireRole('ADMIN'), preCadastroCtrl.aprovarPreCadastro);
router.post('/admin/pre-cadastros/:id/rejeitar', authenticateToken, requireRole('ADMIN'), preCadastroCtrl.rejeitarPreCadastro);

// --- ACADEMIC MANAGEMENT (ADMIN ONLY) ---
router.get('/academic/users', authenticateToken, requireRole('ADMIN'), academicCtrl.listUsers);
router.post('/academic/users', authenticateToken, requireRole('ADMIN'), academicCtrl.createUser);
router.put('/academic/users/:id/toggle-status', authenticateToken, requireRole('ADMIN'), academicCtrl.toggleUserStatus);

router.get('/academic/courses', authenticateToken, academicCtrl.listCourses);
router.post('/academic/courses', authenticateToken, requireRole('ADMIN'), academicCtrl.createCourse);

router.get('/academic/disciplines', authenticateToken, academicCtrl.listDisciplines);
router.post('/academic/disciplines', authenticateToken, requireRole('ADMIN'), academicCtrl.createDiscipline);

router.get('/academic/classes', authenticateToken, academicCtrl.listClasses);
router.post('/academic/classes', authenticateToken, requireRole('ADMIN'), academicCtrl.createClass);

router.get('/academic/groups', authenticateToken, academicCtrl.listGroups);
router.post('/academic/groups', authenticateToken, requireRole('ADMIN'), academicCtrl.createGroup);
router.get('/academic/groups/:id/membros', authenticateToken, academicCtrl.listGroupMembers);
router.post('/academic/groups/:id/membros', authenticateToken, requireRole('ALUNO'), academicCtrl.addGroupMember);

router.get('/academic/periods', authenticateToken, academicCtrl.listPeriods);

// --- AUTO-MATRÍCULA DO ALUNO (portal do aluno: escolhe a turma e informa o grupo) ---
router.get('/academic/my-enrollment', authenticateToken, requireRole('ALUNO'), academicCtrl.listMyEnrollment);
router.post('/academic/my-enrollment', authenticateToken, requireRole('ALUNO'), academicCtrl.selfEnroll);
router.get('/academic/students/search', authenticateToken, requireRole('ALUNO'), academicCtrl.searchStudents);

// --- HORÁRIO ACADÊMICO & VÍNCULOS DO DOCENTE ---
// Professor recebe apenas a própria grade; admin recebe a grade completa.
router.get('/academic/schedule', authenticateToken, academicCtrl.listSchedule);
router.get('/academic/my-bindings', authenticateToken, academicCtrl.listMyBindings);
router.post('/academic/schedule/import', authenticateToken, requireRole('ADMIN'), academicCtrl.reimportSchedule);

router.post('/academic/bind-professor', authenticateToken, requireRole('ADMIN'), academicCtrl.bindProfessor);
router.post('/academic/enroll-student', authenticateToken, requireRole('ADMIN'), academicCtrl.enrollStudent);

// --- ARQUIVO ORIENTADOR (vinculado à conta do professor) ---
// O Admin supre e vincula o arquivo; o professor revisa e pode substituir (editar) o próprio.
router.get('/academic/orientador-files', authenticateToken, requireRole('ADMIN'), academicCtrl.listOrientadorFiles);
router.post('/academic/orientador-files', authenticateToken, requireRole('ADMIN'), academicCtrl.linkOrientadorFile);
router.delete('/academic/orientador-files/:professorId', authenticateToken, requireRole('ADMIN'), academicCtrl.unlinkOrientadorFile);
router.get('/academic/my-orientador-file', authenticateToken, requireRole('PROFESSOR'), academicCtrl.getMyOrientadorFile);
router.put('/academic/my-orientador-file', authenticateToken, requireRole('PROFESSOR'), academicCtrl.replaceMyOrientadorFile);

// Sugestões/comentários do professor sobre o arquivo orientador vigente, por disciplina.
// O admin só consulta (aba "Revisão pelos Professores"), sem campo de edição próprio.
router.post('/academic/my-orientador-file/comments', authenticateToken, requireRole('PROFESSOR'), academicCtrl.addOrientadorComment);
router.get('/academic/my-orientador-file/comments', authenticateToken, requireRole('PROFESSOR'), academicCtrl.listMyOrientadorComments);
router.get('/academic/orientador-reviews', authenticateToken, requireRole('ADMIN'), academicCtrl.listOrientadorReviews);

// Aprova o kit vigente do professor e replica em novas atividades PBL (uma por disciplina,
// turmas pré-designadas via segmentação). Só o admin aciona; não exige liberação prévia do professor.
router.post('/academic/orientador-files/:professorId/aprovar-replicar', authenticateToken, requireRole('ADMIN'), academicCtrl.aprovarEReplicarOrientador);

// --- PBL ACTIVITIES & WORKFLOW ---
// Autoria é exclusiva do ADMIN — o professor só revisa, avalia e libera entregas (ver /submissions abaixo).
router.get('/pbl/mandatory-fields', authenticateToken, pblCtrl.getMandatoryFields);
router.put('/pbl/mandatory-fields', authenticateToken, requireRole('ADMIN'), pblCtrl.updateMandatoryFields);

router.get('/pbl/activities', authenticateToken, pblCtrl.listPBLActivities);
router.get('/pbl/activities/:id', authenticateToken, pblCtrl.getPBLDetails);
router.post('/pbl/activities', authenticateToken, requireRole('ADMIN'), pblCtrl.createPBLActivity);
router.put('/pbl/activities/:id', authenticateToken, requireRole('ADMIN'), pblCtrl.updatePBLActivity);
router.post('/pbl/activities/:id/submit', authenticateToken, requireRole('ADMIN'), pblCtrl.submitForAnalysis);
router.post('/pbl/activities/:id/review', authenticateToken, requireRole('ADMIN'), pblCtrl.reviewPBLActivity);

// --- PUBLICATION & SEGMENTATION ---
router.post('/publication/preview', authenticateToken, requireRole('ADMIN'), pubCtrl.previewAudience);
router.post('/publication/activities/:id/publish', authenticateToken, requireRole('ADMIN'), pubCtrl.publishActivity);
router.put('/publication/activities/:id/status', authenticateToken, requireRole('ADMIN'), pubCtrl.changePublicationStatus);

// --- STUDENT PORTAL & SUBMISSIONS ---
router.get('/submissions/student/activities', authenticateToken, requireRole('ALUNO'), subCtrl.getStudentActivities);
router.get('/submissions/student/activities/:id', authenticateToken, requireRole('ALUNO'), subCtrl.getStudentActivityDetails);
router.post('/submissions/student/activities/:atividadeId/answer', authenticateToken, requireRole('ALUNO'), subCtrl.submitStudentAnswer);

router.get('/submissions/activity/:atividadeId', authenticateToken, requireRole('ADMIN', 'PROFESSOR'), subCtrl.listSubmissionsForActivity);
router.post('/submissions/:entregaId/evaluate', authenticateToken, requireRole('ADMIN', 'PROFESSOR'), subCtrl.evaluateSubmission);

// --- FILE MANAGEMENT ---
router.post('/files/upload', authenticateToken, fileCtrl.uploadMiddleware.single('file'), fileCtrl.uploadFile);
router.get('/files/download/:id', authenticateToken, fileCtrl.downloadFile);
router.delete('/files/:id', authenticateToken, requireRole('ADMIN', 'PROFESSOR'), fileCtrl.deleteFile);
router.get('/files', authenticateToken, requireRole('ADMIN'), fileCtrl.listAllFiles);

// --- DASHBOARD & REPORTS ---
router.get('/dashboard', authenticateToken, dashCtrl.getDashboardData);
router.get('/reports/general', authenticateToken, requireRole('ADMIN'), reportCtrl.getGeneralReport);
router.get('/reports/export/csv', authenticateToken, requireRole('ADMIN'), reportCtrl.exportReportCSV);

// --- NOTIFICATIONS & AUDIT ---
router.get('/notifications', authenticateToken, notifCtrl.listNotifications);
router.put('/notifications/:id/read', authenticateToken, notifCtrl.markAsRead);
router.get('/audit', authenticateToken, requireRole('ADMIN'), auditCtrl.listAuditLogs);

export default router;
