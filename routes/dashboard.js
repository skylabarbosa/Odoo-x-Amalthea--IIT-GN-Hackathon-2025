const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { checkRole } = require('../middleware/roleCheck');
const {
    getEmployeeDashboard,
    getManagerDashboard,
    exportTeamExpenses
} = require('../controllers/expenseController');
const { getAdminDashboard, updateCompanyConfig, updateApprovalFlow, getProfile } = require('../controllers/userController');

router.get('/employee/dashboard', protect, checkRole('Employee'), getEmployeeDashboard);
router.get('/manager/dashboard', protect, checkRole('Manager', 'Admin'), getManagerDashboard);
router.get('/manager/expenses/export', protect, checkRole('Manager', 'Admin'), exportTeamExpenses);
router.get('/admin/dashboard', protect, checkRole('Admin'), getAdminDashboard);
router.get('/profile', protect, getProfile);
router.post('/admin/config', protect, checkRole('Admin'), updateCompanyConfig);
router.post('/admin/approval-flow', protect, checkRole('Admin'), updateApprovalFlow);

module.exports = router;
