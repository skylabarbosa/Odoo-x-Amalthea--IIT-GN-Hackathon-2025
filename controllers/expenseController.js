const Expense = require('../models/expense');
const User = require('../models/user');
const Company = require('../models/company');
const currencyConverter = require('../utils/currencyConverter');

// @desc    Get employee dashboard with their expenses
// @route   GET /employee/dashboard
exports.getEmployeeDashboard = async (req, res) => {
    try {
        const expenses = await Expense.find({ employee: req.session.user.id }).sort({ date: -1 });
        res.render('employee-dashboard', { expenses });
    } catch (error) {
        // ...
    }
};

// @desc    Get manager dashboard with expenses to approve
// @route   GET /manager/dashboard
exports.getManagerDashboard = async (req, res) => {
    try {
        // Find expenses where the current user is an approver and status is pending for them
        const expenses = await Expense.find({
            'approvers.approver': req.session.user.id,
            'approvers.status': 'Pending',
             status: 'Processing'
        }).populate('employee').populate('company');
        res.render('manager-dashboard', { expenses });
    } catch (error) {
        // ...
    }
};


// @desc    Submit a new expense
// @route   POST /expenses/submit
exports.submitExpense = async (req, res) => {
    const { amount, currency, category, description, date } = req.body;
    const employeeId = req.session.user.id;

    try {
        const employee = await User.findById(employeeId);
        const company = await Company.findById(employee.company);

        const amountInCompanyCurrency = await currencyConverter.convert(
            currency,
            company.defaultCurrency,
            amount
        );

        let approvers = [];
        // Simple logic: First approver is the manager
        if (employee.manager) {
            approvers.push({ approver: employee.manager });
        }
        // Add more logic based on company rules later

        const expense = new Expense({
            employee: employeeId,
            company: employee.company,
            amount,
            currency: currency.toUpperCase(),
            amountInCompanyCurrency,
            category,
            description,
            date,
            receiptUrl: req.file ? req.file.path : null,
            status: approvers.length > 0 ? 'Processing' : 'Approved', // Auto-approve if no approvers
            approvers
        });

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
            //...
        }
        // Find the approver in the array and update their status
        // Check if there are more approvers
        // Update overall expense status
        req.flash('success_msg', 'Expense approved.');
        res.redirect('/manager/dashboard');
    } catch (err) {
        //...
    }
};

// @desc    Reject an expense
// @route   POST /expenses/reject/:id
exports.rejectExpense = async (req, res) => {
    try {
        await Expense.findByIdAndUpdate(req.params.id, { status: 'Rejected' });
        // Add logic to store rejection reason
        req.flash('success_msg', 'Expense rejected.');
        res.redirect('/manager/dashboard');
    } catch(err) {
        //...
    }
};