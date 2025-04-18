const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');
const auth = require('../middleware/auth');

// Protected routes (require authentication)
router.post('/subscribe', auth, webhookController.subscribe);
router.get('/subscriptions', auth, webhookController.getSubscriptions);
router.delete('/unsubscribe/:id', auth, webhookController.unsubscribe);
router.delete('/subscription/:id', auth, webhookController.deleteSubscription);
// router.get('/subscription/:id/events', auth, webhookController.getSubscriptionEvents);
router.get('/events', auth, webhookController.getUserWebhookEvents);
// Public route to receive webhooks from external sources
router.post('/incoming/:source', webhookController.handleWebhookEvent);

module.exports = router;