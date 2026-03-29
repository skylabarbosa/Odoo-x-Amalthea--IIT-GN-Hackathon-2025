const mongoose = require('mongoose');

const ApprovalSchema = new mongoose.Schema({
    approver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending'
    },
    comment: String,
    approvedAt: Date
}, { _id: false });

const StageApproverSchema = new mongoose.Schema({
    approver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending'
    },
    comment: String,
    actedAt: Date
}, { _id: false });

const ApprovalStageSchema = new mongoose.Schema({
    name: {
        type: String,
        trim: true
    },
    type: {
        type: String,
        enum: ['SEQUENTIAL', 'PERCENTAGE', 'SPECIFIC_OVERRIDE', 'HYBRID'],
        default: 'SEQUENTIAL'
    },
    percentage: {
        type: Number,
        min: 1,
        max: 100
    },
    approvers: [StageApproverSchema],
    specificApproverIds: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    ],
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending'
    },
    completedAt: Date
}, { _id: false });

const AuditTrailSchema = new mongoose.Schema({
    approver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    action: {
        type: String,
        enum: ['Approved', 'Rejected', 'AutoApproved'],
        required: true
    },
    comment: String,
    timestamp: {
        type: Date,
        default: Date.now
    },
    stageIndex: Number,
    stageName: String
}, { _id: false });


const ExpenseSchema = new mongoose.Schema({
    employee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        required: true,
        uppercase: true
    },
    originalAmount: {
        type: Number
    },
    originalCurrency: {
        type: String,
        uppercase: true
    },
    conversionRateUsed: {
        type: Number
    },
    amountInCompanyCurrency: {
        type: Number,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    description: {
        type: String
    },
    otherCategoryDetails: {
        type: String
    },
    date: {
        type: Date,
        required: true
    },
    receiptUrl: {
        type: String
    },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected', 'Processing'],
        default: 'Pending'
    },
    statusUpdatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    statusUpdatedAt: {
        type: Date
    },
    currentApproverIndex: {
        type: Number,
        default: 0
    },
    approvers: [ApprovalSchema],
    approvalStages: [ApprovalStageSchema],
    currentStageIndex: {
        type: Number,
        default: 0
    },
    auditTrail: [AuditTrailSchema]
}, {
    timestamps: true
});

module.exports = mongoose.model('Expense', ExpenseSchema);
