const mongoose = require('mongoose');

const WebhookEventSchema = new mongoose.Schema({
  subscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WebhookSubscription',
    required: true
  },
  source: {
    type: String,
    required: true
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'success', 'failed', 'retrying'],
    default: 'pending'
  },
  statusCode: {
    type: Number
  },
  errorMessage: {
    type: String
  },
  retryCount: {
    type: Number,
    default: 0
  },
  nextRetryAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  processedAt: {
    type: Date
  }
});

// Create indexes for efficient queries
WebhookEventSchema.index({ status: 1, nextRetryAt: 1 });
WebhookEventSchema.index({ subscriptionId: 1, createdAt: -1 });

module.exports = mongoose.model('WebhookEvent', WebhookEventSchema);