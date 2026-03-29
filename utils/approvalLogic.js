const Expense = require('../models/Expense');

const processNextApproval = async (expenseId) => {
    const expense = await Expense.findById(expenseId);
    
    // Check conditional approval rules (Percentage, Specific, Hybrid)
    // This part requires careful implementation of the rules defined in the Company model
    
    // For now, implement simple sequential approval
    const currentApprover = expense.approvers[expense.currentApproverIndex];
    if (currentApprover.status === 'Approved') {
        const nextIndex = expense.currentApproverIndex + 1;
        if (nextIndex < expense.approvers.length) {
            expense.currentApproverIndex = nextIndex;
            // The expense status remains 'Processing'
        } else {
            // All approvers have approved
            expense.status = 'Approved';
        }
        await expense.save();
    } else if (currentApprover.status === 'Rejected') {
        expense.status = 'Rejected';
        await expense.save();
    }
};


module.exports = { processNextApproval };