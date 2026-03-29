const User = require('../models/User');
const Expense = require('../models/expense');
const Company = require('../models/Company');

// @desc    Get admin dashboard with users and managers
// @route   GET /admin/dashboard
exports.getAdminDashboard = async (req, res) => {
    try {
        const companyId = req.session.user.companyId;
        const users = await User.find({ company: companyId, isActive: true });
        const managers = users.filter(user => user.role === 'Manager' || user.role === 'Admin');

        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const nextMonth = new Date(startOfMonth);
        nextMonth.setMonth(startOfMonth.getMonth() + 1);

        const [pendingApprovals, expenseStats, company, pendingManagers, recentUserActions, recentExpenseActions] = await Promise.all([
            Expense.countDocuments({ company: companyId, status: 'Processing' }),
            Expense.aggregate([
                {
                    $match: {
                        company: companyId,
                        date: { $gte: startOfMonth, $lt: nextMonth }
                    }
                },
                {
                    $group: {
                        _id: '$status',
                        totalAmount: { $sum: '$amountInCompanyCurrency' },
                        count: { $sum: 1 }
                    }
                }
            ]),
            Company.findById(companyId).select('defaultCurrency name autoApproveEnabled autoApproveUnderAmount requireReceiptEnabled requireReceiptOverAmount approvalFlow'),
            User.find({ company: companyId, role: 'Manager', status: 'Pending', isActive: true }).select('name email'),
            User.find({
                company: companyId,
                role: 'Employee',
                statusUpdatedBy: { $ne: null }
            })
                .sort({ statusUpdatedAt: -1 })
                .limit(10)
                .populate('statusUpdatedBy', 'name email role')
                .select('name email status statusUpdatedAt statusUpdatedBy')
            ,
            Expense.find({
                company: companyId,
                statusUpdatedBy: { $ne: null }
            })
                .sort({ statusUpdatedAt: -1 })
                .limit(10)
                .populate('statusUpdatedBy', 'name email role')
                .populate('employee', 'name email')
                .select('status statusUpdatedAt statusUpdatedBy employee category amount amountInCompanyCurrency currency')
        ]);

        const totalMonthlyExpenses = expenseStats.reduce(
            (sum, item) => sum + (item.totalAmount || 0),
            0
        );
        const totalExpensesThisMonth = expenseStats.reduce(
            (sum, item) => sum + (item.count || 0),
            0
        );
        const approvedThisMonth = expenseStats.find(item => item._id === 'Approved')?.count || 0;
        const approvalRate = totalExpensesThisMonth
            ? Math.round((approvedThisMonth / totalExpensesThisMonth) * 1000) / 10
            : 100;

        const adminStats = {
            totalUsers: users.length,
            pendingApprovals,
            monthlyExpenses: totalMonthlyExpenses,
            approvalRate,
            currency: company?.defaultCurrency || '',
            companyName: company?.name || ''
        };

        const companySettings = {
            autoApproveEnabled: company?.autoApproveEnabled || false,
            autoApproveUnderAmount: company?.autoApproveUnderAmount || 0,
            requireReceiptEnabled: company?.requireReceiptEnabled !== false,
            requireReceiptOverAmount: company?.requireReceiptOverAmount || 0
        };

        const approvalFlowConfig = company?.approvalFlow
            ? JSON.stringify(company.approvalFlow, null, 2)
            : '';

        res.render('admin-dashboard', {
            users,
            managers,
            adminStats,
            pendingManagers,
            recentUserActions,
            recentExpenseActions,
            companySettings,
            approvalFlowConfig
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Failed to load admin dashboard.');
        res.redirect('/');
    }
};

// @desc    Show user profile
// @route   GET /profile
exports.getProfile = async (req, res) => {
    try {
        const profile = await User.findById(req.session.user.id)
            .populate('company', 'name defaultCurrency')
            .select('name email role status company');

        if (!profile) {
            req.flash('error_msg', 'Profile not found.');
            return res.redirect('/');
        }

        res.render('profile', { profile });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Failed to load profile.');
        res.redirect('/');
    }
};


// @desc    Create a new user
// @route   POST /users/create
exports.createUser = async (req, res) => {
    const { name, email, password, role, managerId } = req.body;
    try {
        const creatorRole = req.session.user.role;
        let resolvedManagerId = managerId;

        const existing = await User.findOne({ email });
        if (existing) {
            req.flash('error_msg', 'User already exists.');
            return res.redirect(creatorRole === 'Manager' ? '/manager/dashboard' : '/admin/dashboard');
        }

        if (creatorRole === 'Manager') {
            if (role !== 'Employee') {
                req.flash('error_msg', 'Managers can only create employees.');
                return res.redirect('/manager/dashboard');
            }
            resolvedManagerId = req.session.user.id;
        }

        if (role === 'Employee' && !resolvedManagerId) {
            req.flash('error_msg', 'Employees must be assigned to a manager.');
            return res.redirect(creatorRole === 'Manager' ? '/manager/dashboard' : '/admin/dashboard');
        }

        if (role === 'Employee' && resolvedManagerId && creatorRole !== 'Manager') {
            const manager = await User.findOne({
                _id: resolvedManagerId,
                company: req.session.user.companyId,
                role: { $in: ['Manager', 'Admin'] },
                isActive: true
            });
            if (!manager) {
                req.flash('error_msg', 'Selected manager is invalid.');
                return res.redirect('/admin/dashboard');
            }
        }

        const newUser = new User({
            name,
            email,
            password,
            role,
            company: req.session.user.companyId,
            manager: role === 'Employee' ? resolvedManagerId : (resolvedManagerId || null)
        });
        await newUser.save();
        req.flash('success_msg', 'User created successfully.');
        res.redirect(creatorRole === 'Manager' ? '/manager/dashboard' : '/admin/dashboard');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Failed to create user.');
        res.redirect(req.session.user.role === 'Manager' ? '/manager/dashboard' : '/admin/dashboard');
    }
};

// @desc    Delete user
// @route   POST /users/delete/:id
exports.deleteUser = async (req, res) => {
    try {
        const target = await User.findById(req.params.id);
        if (!target) {
            req.flash('error_msg', 'User not found.');
            return res.redirect('back');
        }

        if (!target.isActive) {
            req.flash('error_msg', 'User is inactive.');
            return res.redirect('back');
        }

        if (!target.isActive) {
            req.flash('error_msg', 'User is already inactive.');
            return res.redirect('back');
        }

        const currentRole = req.session.user.role;
        const currentUserId = req.session.user.id;
        const currentCompanyId = req.session.user.companyId;

        if (String(target._id) === String(currentUserId)) {
            req.flash('error_msg', 'You cannot delete your own account.');
            return res.redirect('back');
        }

        if (target.role === 'Admin') {
            req.flash('error_msg', 'Admin accounts cannot be deleted.');
            return res.redirect('back');
        }

        if (currentRole === 'Manager') {
            const isTeamMember = target.role === 'Employee' && String(target.manager) === String(currentUserId);
            if (!isTeamMember) {
                req.flash('error_msg', 'Not authorized to delete this user.');
                return res.redirect('/manager/dashboard');
            }
        } else if (currentRole === 'Admin') {
            if (String(target.company) !== String(currentCompanyId)) {
                req.flash('error_msg', 'Not authorized to delete this user.');
                return res.redirect('/admin/dashboard');
            }

            if (target.role === 'Manager') {
                const managedEmployees = await User.countDocuments({ manager: target._id, isActive: true });
                if (managedEmployees > 0) {
                    const reassignTo = req.body.reassignTo;
                    if (!reassignTo) {
                        req.flash('error_msg', 'Reassign or delete the manager\'s employees first.');
                        return res.redirect('/admin/dashboard');
                    }

                    if (String(reassignTo) === String(target._id)) {
                        req.flash('error_msg', 'Reassignment target cannot be the same manager.');
                        return res.redirect('/admin/dashboard');
                    }

                    const newManager = await User.findOne({
                        _id: reassignTo,
                        company: currentCompanyId,
                        role: { $in: ['Manager', 'Admin'] },
                        isActive: true
                    });
                    if (!newManager) {
                        req.flash('error_msg', 'Reassignment target is invalid.');
                        return res.redirect('/admin/dashboard');
                    }

                    await User.updateMany(
                        { manager: target._id, isActive: true },
                        { $set: { manager: newManager._id } }
                    );
                }
            }
        } else {
            req.flash('error_msg', 'Not authorized.');
            return res.redirect('/');
        }

        target.isActive = false;
        target.statusUpdatedBy = req.session.user.id;
        target.statusUpdatedAt = new Date();
        await target.save();

        req.flash('success_msg', 'User deactivated successfully.');
        return res.redirect(currentRole === 'Manager' ? '/manager/dashboard' : '/admin/dashboard');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Failed to delete user.');
        return res.redirect('back');
    }
};

// @desc    Approve pending user
// @route   POST /users/approve/:id
exports.approveUser = async (req, res) => {
    try {
        const target = await User.findById(req.params.id);
        if (!target) {
            req.flash('error_msg', 'User not found.');
            return res.redirect('back');
        }

        if (!target.isActive) {
            req.flash('error_msg', 'User is inactive.');
            return res.redirect('back');
        }

        const currentRole = req.session.user.role;
        const currentUserId = req.session.user.id;
        const currentCompanyId = req.session.user.companyId;

        if (currentRole === 'Manager') {
            const isTeamMember = target.role === 'Employee' && String(target.manager) === String(currentUserId);
            if (!isTeamMember) {
                req.flash('error_msg', 'Not authorized to approve this user.');
                return res.redirect('/manager/dashboard');
            }
        } else if (currentRole === 'Admin') {
            const isCompanyManager = target.role === 'Manager' && String(target.company) === String(currentCompanyId);
            if (!isCompanyManager) {
                req.flash('error_msg', 'Not authorized to approve this user.');
                return res.redirect('/admin/dashboard');
            }
        } else {
            req.flash('error_msg', 'Not authorized.');
            return res.redirect('/');
        }

        target.status = 'Approved';
        target.statusUpdatedBy = req.session.user.id;
        target.statusUpdatedAt = new Date();
        await target.save();
        req.flash('success_msg', 'User approved.');
        return res.redirect(currentRole === 'Manager' ? '/manager/dashboard' : '/admin/dashboard');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Failed to approve user.');
        return res.redirect('back');
    }
};

// @desc    Reject pending user
// @route   POST /users/reject/:id
exports.rejectUser = async (req, res) => {
    try {
        const target = await User.findById(req.params.id);
        if (!target) {
            req.flash('error_msg', 'User not found.');
            return res.redirect('back');
        }

        const currentRole = req.session.user.role;
        const currentUserId = req.session.user.id;
        const currentCompanyId = req.session.user.companyId;

        if (currentRole === 'Manager') {
            const isTeamMember = target.role === 'Employee' && String(target.manager) === String(currentUserId);
            if (!isTeamMember) {
                req.flash('error_msg', 'Not authorized to reject this user.');
                return res.redirect('/manager/dashboard');
            }
        } else if (currentRole === 'Admin') {
            const isCompanyManager = target.role === 'Manager' && String(target.company) === String(currentCompanyId);
            if (!isCompanyManager) {
                req.flash('error_msg', 'Not authorized to reject this user.');
                return res.redirect('/admin/dashboard');
            }
        } else {
            req.flash('error_msg', 'Not authorized.');
            return res.redirect('/');
        }

        target.status = 'Rejected';
        target.statusUpdatedBy = req.session.user.id;
        target.statusUpdatedAt = new Date();
        await target.save();
        req.flash('success_msg', 'User rejected.');
        return res.redirect(currentRole === 'Manager' ? '/manager/dashboard' : '/admin/dashboard');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Failed to reject user.');
        return res.redirect('back');
    }
};

// @desc    Update company configuration
// @route   POST /admin/config
exports.updateCompanyConfig = async (req, res) => {
    try {
        const companyId = req.session.user.companyId;
        const autoApproveEnabled = req.body.autoApproveEnabled === 'on';
        const autoApproveUnderAmount = Number(req.body.autoApproveUnderAmount || 0);
        const requireReceiptEnabled = req.body.requireReceiptEnabled === 'on';
        const requireReceiptOverAmount = Number(req.body.requireReceiptOverAmount || 0);
        const defaultCurrency = (req.body.defaultCurrency || '').trim().toUpperCase();

        if (autoApproveEnabled && (!Number.isFinite(autoApproveUnderAmount) || autoApproveUnderAmount <= 0)) {
            req.flash('error_msg', 'Auto-approve threshold must be greater than 0.');
            return res.redirect('/admin/dashboard');
        }

        if (requireReceiptEnabled && (!Number.isFinite(requireReceiptOverAmount) || requireReceiptOverAmount < 0)) {
            req.flash('error_msg', 'Receipt threshold must be 0 or greater.');
            return res.redirect('/admin/dashboard');
        }

        if (!defaultCurrency) {
            req.flash('error_msg', 'Default currency is required.');
            return res.redirect('/admin/dashboard');
        }

        await Company.findByIdAndUpdate(companyId, {
            autoApproveEnabled,
            autoApproveUnderAmount: autoApproveEnabled ? autoApproveUnderAmount : 0,
            requireReceiptEnabled,
            requireReceiptOverAmount: requireReceiptEnabled ? requireReceiptOverAmount : 0,
            defaultCurrency
        });

        req.flash('success_msg', 'Configuration updated.');
        return res.redirect('/admin/dashboard');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Failed to update configuration.');
        return res.redirect('/admin/dashboard');
    }
};

// @desc    Update approval flow configuration
// @route   POST /admin/approval-flow
exports.updateApprovalFlow = async (req, res) => {
    try {
        const companyId = req.session.user.companyId;
        const rawConfig = (req.body.approvalFlow || '').trim();

        if (!rawConfig) {
            await Company.findByIdAndUpdate(companyId, { approvalFlow: { stages: [] } });
            req.flash('success_msg', 'Approval flow cleared. Single-manager approval will be used.');
            return res.redirect('/admin/dashboard');
        }

        let config;
        try {
            config = JSON.parse(rawConfig);
        } catch (error) {
            req.flash('error_msg', 'Invalid JSON format for approval flow.');
            return res.redirect('/admin/dashboard');
        }

        if (!config || !Array.isArray(config.stages) || config.stages.length === 0) {
            req.flash('error_msg', 'Approval flow must include a non-empty stages array.');
            return res.redirect('/admin/dashboard');
        }

        const allowedTypes = ['SEQUENTIAL', 'PERCENTAGE', 'SPECIFIC_OVERRIDE', 'HYBRID'];
        const sanitizedStages = [];
        const allUserIds = new Set();

        for (let i = 0; i < config.stages.length; i += 1) {
            const stage = config.stages[i] || {};
            const stageType = stage.type || 'SEQUENTIAL';
            if (!allowedTypes.includes(stageType)) {
                req.flash('error_msg', `Stage ${i + 1} has invalid type.`);
                return res.redirect('/admin/dashboard');
            }

            const approverUserIds = Array.isArray(stage.approverUserIds) ? stage.approverUserIds : [];
            const specificApproverIds = Array.isArray(stage.specificApproverIds) ? stage.specificApproverIds : [];
            const useManager = Boolean(stage.useManager);

            if ((stageType === 'PERCENTAGE' || stageType === 'HYBRID')) {
                const percentage = Number(stage.percentage);
                if (!Number.isFinite(percentage) || percentage < 1 || percentage > 100) {
                    req.flash('error_msg', `Stage ${i + 1} must include a percentage between 1 and 100.`);
                    return res.redirect('/admin/dashboard');
                }
            }

            if ((stageType === 'SPECIFIC_OVERRIDE' || stageType === 'HYBRID') && specificApproverIds.length === 0) {
                req.flash('error_msg', `Stage ${i + 1} requires specificApproverIds.`);
                return res.redirect('/admin/dashboard');
            }

            if (!useManager && approverUserIds.length === 0 && specificApproverIds.length === 0) {
                req.flash('error_msg', `Stage ${i + 1} must include approvers or useManager.`);
                return res.redirect('/admin/dashboard');
            }

            approverUserIds.forEach(id => allUserIds.add(String(id)));
            specificApproverIds.forEach(id => allUserIds.add(String(id)));

            sanitizedStages.push({
                name: stage.name || `Stage ${i + 1}`,
                type: stageType,
                percentage: stageType === 'PERCENTAGE' || stageType === 'HYBRID' ? Number(stage.percentage) : undefined,
                approverUserIds,
                specificApproverIds,
                useManager
            });
        }

        const uniqueIds = Array.from(allUserIds);
        if (uniqueIds.length > 0) {
            const matchedUsers = await User.find({
                _id: { $in: uniqueIds },
                company: companyId,
                isActive: true
            }).select('_id');
            if (matchedUsers.length !== uniqueIds.length) {
                req.flash('error_msg', 'Approval flow includes invalid or inactive users.');
                return res.redirect('/admin/dashboard');
            }
        }

        await Company.findByIdAndUpdate(companyId, {
            approvalFlow: { stages: sanitizedStages }
        });

        req.flash('success_msg', 'Approval flow updated.');
        return res.redirect('/admin/dashboard');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Failed to update approval flow.');
        return res.redirect('/admin/dashboard');
    }
};
