const path = require('path');
const Expense = require('../models/expense');
const User = require('../models/User');
const Company = require('../models/Company');
const currencyConverter = require('../utils/currencyConverter');

const buildApprovalStages = (company, employee) => {
    const flowStages = company?.approvalFlow?.stages;
    if (!Array.isArray(flowStages) || flowStages.length === 0) {
        return null;
    }

    const stages = [];
    for (let i = 0; i < flowStages.length; i += 1) {
        const stageConfig = flowStages[i] || {};
        const approverIds = new Set();

        if (stageConfig.useManager) {
            if (!employee.manager) {
                throw new Error('No manager assigned. Please contact admin.');
            }
            approverIds.add(String(employee.manager));
        }

        if (Array.isArray(stageConfig.approverUserIds)) {
            stageConfig.approverUserIds.forEach(id => approverIds.add(String(id)));
        }

        if (Array.isArray(stageConfig.specificApproverIds)) {
            stageConfig.specificApproverIds.forEach(id => approverIds.add(String(id)));
        }

        if (approverIds.size === 0) {
            throw new Error(`Approval stage ${i + 1} has no approvers.`);
        }

        stages.push({
            name: stageConfig.name || `Stage ${i + 1}`,
            type: stageConfig.type || 'SEQUENTIAL',
            percentage: stageConfig.percentage,
            approvers: Array.from(approverIds).map(id => ({ approver: id, status: 'Pending' })),
            specificApproverIds: stageConfig.specificApproverIds || [],
            status: 'Pending'
        });
    }

    return stages;
};

const evaluateStageCompletion = (stage) => {
    if (!stage || !Array.isArray(stage.approvers)) {
        return false;
    }

    const totalApprovers = stage.approvers.length;
    const approvedCount = stage.approvers.filter(approver => approver.status === 'Approved').length;
    if (totalApprovers === 0) {
        return true;
    }

    const type = stage.type || 'SEQUENTIAL';
    const percentageMet = totalApprovers > 0
        ? (approvedCount / totalApprovers) * 100 >= Number(stage.percentage || 0)
        : false;
    const overrideMet = Array.isArray(stage.specificApproverIds) &&
        stage.specificApproverIds.some(id =>
            stage.approvers.some(approver =>
                String(approver.approver) === String(id) && approver.status === 'Approved'
            )
        );

    switch (type) {
        case 'PERCENTAGE':
            return percentageMet;
        case 'SPECIFIC_OVERRIDE':
            return overrideMet || approvedCount === totalApprovers;
        case 'HYBRID':
            return percentageMet || overrideMet;
        case 'SEQUENTIAL':
        default:
            return approvedCount === totalApprovers;
    }
};

// @desc    Get employee dashboard with their expenses
// @route   GET /employee/dashboard
exports.getEmployeeDashboard = async (req, res) => {
    try {
        const expenses = await Expense.find({ employee: req.session.user.id }).sort({ date: -1 });
        const company = await Company.findById(req.session.user.companyId).select('requireReceiptEnabled requireReceiptOverAmount autoApproveEnabled autoApproveUnderAmount defaultCurrency');
        const stats = expenses.reduce(
            (acc, expense) => {
                acc.total += 1;
                if (expense.status === 'Approved') {
                    acc.approved += 1;
                } else if (expense.status === 'Rejected') {
                    acc.rejected += 1;
                } else if (expense.status === 'Pending' || expense.status === 'Processing') {
                    acc.pending += 1;
                }
                return acc;
            },
            { total: 0, approved: 0, pending: 0, rejected: 0 }
        );

        const recentActivity = expenses.slice(0, 5).map(expense => ({
            title: `${expense.category} Expense ${expense.status}`,
            status: expense.status,
            date: expense.updatedAt || expense.date
        }));

        const notifications = expenses
            .filter(expense => expense.statusUpdatedBy && ['Approved', 'Rejected'].includes(expense.status))
            .sort((a, b) => {
                const aTime = a.statusUpdatedAt ? new Date(a.statusUpdatedAt).getTime() : 0;
                const bTime = b.statusUpdatedAt ? new Date(b.statusUpdatedAt).getTime() : 0;
                return bTime - aTime;
            })
            .slice(0, 5)
            .map(expense => ({
                title: `${expense.category} Expense ${expense.status}`,
                status: expense.status,
                date: expense.statusUpdatedAt || expense.updatedAt || expense.date
            }));

        const companySettings = {
            requireReceiptEnabled: company?.requireReceiptEnabled !== false,
            requireReceiptOverAmount: company?.requireReceiptOverAmount || 0,
            autoApproveEnabled: company?.autoApproveEnabled || false,
            autoApproveUnderAmount: company?.autoApproveUnderAmount || 0,
            defaultCurrency: company?.defaultCurrency || ''
        };

        res.render('employee-dashboard', { expenses, stats, recentActivity, notifications, companySettings });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Failed to load employee dashboard.');
        res.redirect('/');
    }
};

// @desc    Get manager dashboard with expenses to approve
// @route   GET /manager/dashboard
exports.getManagerDashboard = async (req, res) => {
    try {
        // Find expenses where the current user is an approver with a pending status
        const managerId = req.session.user.id;
        const expenses = await Expense.find({
            status: 'Processing',
            $or: [
                { approvers: { $elemMatch: { approver: managerId, status: 'Pending' } } },
                { approvalStages: { $elemMatch: { approvers: { $elemMatch: { approver: managerId, status: 'Pending' } } } } }
            ]
        }).populate('employee').populate('company');

        const pendingExpenses = expenses.filter(expense => {
            if (expense.approvalStages && expense.approvalStages.length > 0) {
                const stageIndex = expense.currentStageIndex || 0;
                const stage = expense.approvalStages[stageIndex];
                if (!stage) {
                    return false;
                }
                return stage.approvers.some(approver =>
                    String(approver.approver) === String(managerId) && approver.status === 'Pending'
                );
            }
            return expense.approvers.some(approver =>
                String(approver.approver) === String(managerId) && approver.status === 'Pending'
            );
        });

        const teamMembers = await User.find({ manager: managerId, status: 'Approved', isActive: true }).select('name email role');
        const pendingTeamMembers = await User.find({ manager: managerId, status: 'Pending', role: 'Employee', isActive: true }).select('name email');
        const teamMemberIds = teamMembers.map(member => member._id);

        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const nextMonth = new Date(startOfMonth);
        nextMonth.setMonth(startOfMonth.getMonth() + 1);

        const approvedThisMonth = teamMemberIds.length
            ? await Expense.countDocuments({
                  employee: { $in: teamMemberIds },
                  status: 'Approved',
                  date: { $gte: startOfMonth, $lt: nextMonth }
              })
            : 0;

        const managerStats = {
            pendingApprovals: pendingExpenses.length,
            teamMembers: teamMembers.length,
            approvedThisMonth
        };

        res.render('manager-dashboard', { expenses: pendingExpenses, managerStats, teamMembers, pendingTeamMembers });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Failed to load manager dashboard.');
        res.redirect('/');
    }
};

// @desc    Export manager team expenses as CSV
// @route   GET /manager/expenses/export
exports.exportTeamExpenses = async (req, res) => {
    try {
        const managerId = req.session.user.id;
        const teamMembers = await User.find({ manager: managerId }).select('_id');
        const teamMemberIds = teamMembers.map(member => member._id);

        const expenses = teamMemberIds.length
            ? await Expense.find({ employee: { $in: teamMemberIds } })
                  .sort({ date: -1 })
                  .populate('employee', 'name email')
                  .populate('company', 'defaultCurrency')
                  .populate('statusUpdatedBy', 'name email role')
            : [];

        const escapeCsv = (value) => {
            if (value === null || value === undefined) {
                return '';
            }
            const stringValue = String(value).replace(/"/g, '""');
            if (/[",\n]/.test(stringValue)) {
                return `"${stringValue}"`;
            }
            return stringValue;
        };

        const headers = [
            'Date',
            'Employee Name',
            'Employee Email',
            'Category',
            'Amount',
            'Currency',
            'Amount In Company Currency',
            'Company Currency',
            'Status',
            'Description',
            'Other Category Details',
            'Receipt URL',
            'Approved/Rejected By',
            'Approved/Rejected At'
        ];

        const rows = expenses.map(expense => {
            const dateValue = expense.date ? new Date(expense.date).toISOString().split('T')[0] : '';
            const receiptUrl = expense.receiptUrl
                ? `${req.protocol}://${req.get('host')}${expense.receiptUrl}`
                : '';
            const approvalBy = expense.statusUpdatedBy
                ? `${expense.statusUpdatedBy.name || ''}${expense.statusUpdatedBy.email ? ` (${expense.statusUpdatedBy.email})` : ''}`.trim()
                : (expense.status === 'Approved' ? 'System' : '');
            const approvalAt = expense.statusUpdatedAt
                ? new Date(expense.statusUpdatedAt).toISOString()
                : '';
            return [
                dateValue,
                expense.employee?.name || '',
                expense.employee?.email || '',
                expense.category || '',
                expense.amount ?? '',
                expense.currency || '',
                expense.amountInCompanyCurrency ?? '',
                expense.company?.defaultCurrency || '',
                expense.status || '',
                expense.description || '',
                expense.otherCategoryDetails || '',
                receiptUrl,
                approvalBy,
                approvalAt
            ];
        });

        const csv = [headers, ...rows]
            .map(row => row.map(escapeCsv).join(','))
            .join('\n');

        const fileDate = new Date().toISOString().split('T')[0];
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="team-expenses-${fileDate}.csv"`);
        return res.send(csv);
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Failed to export expenses.');
        return res.redirect('/manager/dashboard');
    }
};


// @desc    Submit a new expense
// @route   POST /expenses/submit
exports.submitExpense = async (req, res) => {
    const { amount, currency, category, description, date, otherCategoryDetails } = req.body;
    const employeeId = req.session.user.id;

    try {
        const parsedAmount = Number(amount);
        const normalizedCurrency = (currency || '').trim().toUpperCase();
        const parsedDate = date ? new Date(date) : null;

        if (
            !normalizedCurrency ||
            !category ||
            !parsedDate ||
            Number.isNaN(parsedDate.getTime()) ||
            !Number.isFinite(parsedAmount) ||
            parsedAmount <= 0
        ) {
            req.flash('error_msg', 'Please provide valid expense details.');
            return res.redirect('/employee/dashboard');
        }

        const descriptionValue = (description || '').trim();
        const otherDetailsValue = (otherCategoryDetails || '').trim();

        if (category === 'Other' && !otherDetailsValue) {
            req.flash('error_msg', 'Please explain the other expense.');
            return res.redirect('/employee/dashboard');
        }

        if (category !== 'Other' && !descriptionValue) {
            req.flash('error_msg', 'Please provide an expense description.');
            return res.redirect('/employee/dashboard');
        }

        const employee = await User.findById(employeeId);
        if (!employee) {
            req.flash('error_msg', 'Employee not found.');
            return res.redirect('/employee/dashboard');
        }

        const company = await Company.findById(employee.company);
        if (!company) {
            req.flash('error_msg', 'Company not found.');
            return res.redirect('/employee/dashboard');
        }

        const conversion = await currencyConverter.convert(
            normalizedCurrency,
            company.defaultCurrency,
            parsedAmount
        );
        const amountInCompanyCurrency = conversion.convertedAmount;
        const conversionRateUsed = conversion.rate;

        const receiptRuleEnabled = company.requireReceiptEnabled !== false;
        const receiptThreshold = Number(company.requireReceiptOverAmount || 0);
        const receiptRequired = receiptRuleEnabled
            ? (receiptThreshold <= 0 ? true : amountInCompanyCurrency > receiptThreshold)
            : false;

        if (receiptRequired && !req.file) {
            req.flash('error_msg', 'Receipt is required for this amount.');
            return res.redirect('/employee/dashboard');
        }

        const autoApproveLimit = Number(company.autoApproveUnderAmount || 0);
        const autoApproveEnabled = company.autoApproveEnabled && autoApproveLimit > 0;
        const shouldAutoApprove = autoApproveEnabled && amountInCompanyCurrency <= autoApproveLimit;

        let status = 'Processing';
        let approvalStages = [];
        let currentStageIndex = 0;

        if (shouldAutoApprove) {
            status = 'Approved';
        } else {
            try {
                const configuredStages = buildApprovalStages(company, employee);
                if (configuredStages && configuredStages.length > 0) {
                    approvalStages = configuredStages;
                } else if (employee.manager) {
                    approvalStages = [
                        {
                            name: 'Manager Approval',
                            type: 'SEQUENTIAL',
                            approvers: [{ approver: employee.manager, status: 'Pending' }],
                            specificApproverIds: [],
                            status: 'Pending'
                        }
                    ];
                } else {
                    req.flash('error_msg', 'No manager assigned. Please contact admin.');
                    return res.redirect('/employee/dashboard');
                }
            } catch (stageError) {
                req.flash('error_msg', stageError.message || 'Approval flow is misconfigured.');
                return res.redirect('/employee/dashboard');
            }
        }

        const descriptionValueFinal = category === 'Other'
            ? otherDetailsValue
            : descriptionValue;

        const expense = new Expense({
            employee: employeeId,
            company: employee.company,
            amount: parsedAmount,
            currency: normalizedCurrency,
            originalAmount: parsedAmount,
            originalCurrency: normalizedCurrency,
            conversionRateUsed,
            amountInCompanyCurrency,
            category,
            description: descriptionValueFinal,
            otherCategoryDetails: category === 'Other' ? otherDetailsValue : '',
            date: parsedDate,
            receiptUrl: req.file ? path.posix.join('/uploads/receipts', req.file.filename) : null,
            status,
            approvalStages,
            currentStageIndex,
            auditTrail: shouldAutoApprove
                ? [{
                    action: 'AutoApproved',
                    comment: 'Auto-approved under company limit.',
                    timestamp: new Date()
                }]
                : []
        });

        if (shouldAutoApprove) {
            expense.statusUpdatedAt = new Date();
        }

        await expense.save();
        req.flash('success_msg', 'Expense submitted successfully.');
        res.redirect('/employee/dashboard');

    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Failed to submit expense.');
        res.redirect('/employee/dashboard');
    }
};

// @desc    Approve an expense
// @route   POST /expenses/approve/:id
exports.approveExpense = async (req, res) => {
    // Approval logic will be complex, involving approvalLogic.js
    // For now, a simple approve
    try {
        const expense = await Expense.findById(req.params.id);
        if (!expense) {
            req.flash('error_msg', 'Expense not found.');
            return res.redirect('/manager/dashboard');
        }

        if (expense.status === 'Approved' || expense.status === 'Rejected') {
            req.flash('error_msg', 'This expense is already finalized.');
            return res.redirect('/manager/dashboard');
        }

        const userId = String(req.session.user.id);
        const approver = expense.approvers.find(item => String(item.approver) === userId);
        if (!approver) {
            req.flash('error_msg', 'You are not authorized to approve this expense.');
            return res.redirect('/manager/dashboard');
        }

        if (approver.status !== 'Pending') {
            req.flash('error_msg', 'You have already actioned this expense.');
            return res.redirect('/manager/dashboard');
        }

        approver.status = 'Approved';
        approver.approvedAt = new Date();
        if (req.body.comment) {
            approver.comment = req.body.comment;
        }

        const hasPending = expense.approvers.some(item => item.status === 'Pending');
        expense.status = hasPending ? 'Processing' : 'Approved';
        expense.statusUpdatedBy = req.session.user.id;
        expense.statusUpdatedAt = new Date();

        await expense.save();
        req.flash('success_msg', 'Expense approved.');
        res.redirect('/manager/dashboard');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Failed to approve expense.');
        res.redirect('/manager/dashboard');
    }
};

// @desc    Reject an expense
// @route   POST /expenses/reject/:id
exports.rejectExpense = async (req, res) => {
    try {
        const expense = await Expense.findById(req.params.id);
        if (!expense) {
            req.flash('error_msg', 'Expense not found.');
            return res.redirect('/manager/dashboard');
        }

        if (expense.status === 'Approved' || expense.status === 'Rejected') {
            req.flash('error_msg', 'This expense is already finalized.');
            return res.redirect('/manager/dashboard');
        }

        const userId = String(req.session.user.id);
        const approver = expense.approvers.find(item => String(item.approver) === userId);
        if (!approver) {
            req.flash('error_msg', 'You are not authorized to reject this expense.');
            return res.redirect('/manager/dashboard');
        }

        if (approver.status !== 'Pending') {
            req.flash('error_msg', 'You have already actioned this expense.');
            return res.redirect('/manager/dashboard');
        }

        approver.status = 'Rejected';
        approver.approvedAt = new Date();
        if (req.body.comment || req.body.reason) {
            approver.comment = req.body.comment || req.body.reason;
        }

        expense.status = 'Rejected';
        expense.statusUpdatedBy = req.session.user.id;
        expense.statusUpdatedAt = new Date();
        await expense.save();

        req.flash('success_msg', 'Expense rejected.');
        res.redirect('/manager/dashboard');
    } catch(err) {
        console.error(err);
        req.flash('error_msg', 'Failed to reject expense.');
        res.redirect('/manager/dashboard');
    }
};
