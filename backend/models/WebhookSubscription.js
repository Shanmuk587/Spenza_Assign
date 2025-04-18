const mongoose = require('mongoose');

const WebhookSubscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  source: {
    type: String,
    required: true,
    trim: true
  },
  callbackUrl: {
    type: String,
    required: true,
    trim: true
  },
  active: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create a compound index for efficient lookups
WebhookSubscriptionSchema.index({ source: 1, active: 1 });

module.exports = mongoose.model('WebhookSubscription', WebhookSubscriptionSchema);