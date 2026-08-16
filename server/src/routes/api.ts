import { Router } from 'express';
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

const router = Router();

// --- AUTHENTICATION ---
router.post('/auth/login', authCtrl.login);
router.get('/auth/profile', authenticateToken, authCtrl.getProfile);
router.put('/auth/change-password', authenticateToken, authCtrl.changePassword);

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

router.get('/academic/periods', authenticateToken, academicCtrl.listPeriods);
router.post('/academic/bind-professor', authenticateToken, requireRole('ADMIN'), academicCtrl.bindProfessor);
router.post('/academic/enroll-student', authenticateToken, requireRole('ADMIN'), academicCtrl.enrollStudent);

// --- PBL ACTIVITIES & WORKFLOW ---
router.get('/pbl/mandatory-fields', authenticateToken, pblCtrl.getMandatoryFields);
router.put('/pbl/mandatory-fields', authenticateToken, requireRole('ADMIN'), pblCtrl.updateMandatoryFields);

router.get('/pbl/activities', authenticateToken, pblCtrl.listPBLActivities);
router.get('/pbl/activities/:id', authenticateToken, pblCtrl.getPBLDetails);
router.post('/pbl/activities', authenticateToken, requireRole('PROFESSOR', 'ADMIN'), pblCtrl.createPBLActivity);
router.put('/pbl/activities/:id', authenticateToken, requireRole('PROFESSOR', 'ADMIN'), pblCtrl.updatePBLActivity);
router.post('/pbl/activities/:id/submit', authenticateToken, requireRole('PROFESSOR'), pblCtrl.submitForAnalysis);
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
