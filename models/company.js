const mongoose = require('mongoose');

const CompanySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    defaultCurrency: {
        type: String,
        required: true,
        uppercase: true,
        trim: true
    },
    approvalRules: {
        type: {
            type: String,
            enum: ['Percentage', 'Specific', 'Hybrid', 'Sequential'],
            default: 'Sequential'
        },
        percentage: { // For 'Percentage' rule
            type: Number,
            min: 1,
            max: 100
        },
        specificApprover: { // For 'Specific' rule
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        sequentialApprovers: [{ // For 'Sequential' flow
             type: mongoose.Schema.Types.ObjectId,
             ref: 'User'
        }]
    },
    approvalFlow: {
        stages: [
            {
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
                approverUserIds: [
                    {
                        type: mongoose.Schema.Types.ObjectId,
                        ref: 'User'
                    }
                ],
                specificApproverIds: [
                    {
                        type: mongoose.Schema.Types.ObjectId,
                        ref: 'User'
                    }
                ],
                useManager: {
                    type: Boolean,
                    default: false
                }
            }
        ]
    },
    autoApproveEnabled: {
        type: Boolean,
        default: false
    },
    autoApproveUnderAmount: {
        type: Number,
        default: 0
    },
    requireReceiptEnabled: {
        type: Boolean,
        default: true
    },
    requireReceiptOverAmount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Company', CompanySchema);
