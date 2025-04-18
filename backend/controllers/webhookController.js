const WebhookSubscription = require('../models/WebhookSubscription');
const WebhookEvent = require('../models/WebhookEvent');
const axios = require('axios');
const redisService = require('../services/redisService');

// Subscribe to a webhook source
exports.subscribe = async (req, res) => {
  try {
    const { source, callbackUrl } = req.body;
    
    if (!source || !callbackUrl) {
      return res.status(400).json({ 
        success: false, 
        message: 'Source and callback URL are required' 
      });
    }
    // Check if subscription already exists
    const existingSubscription = await WebhookSubscription.findOne({
      userId: req.user.id,
      source,
      callbackUrl
    });

    if (existingSubscription) {
      // If exists but inactive, reactivate it
      if (!existingSubscription.active) {
        existingSubscription.active = true;
        await existingSubscription.save();
        return res.status(200).json({
          success: true,
          message: 'Subscription reactivated',
          subscription: existingSubscription
        });
      }
      
      return res.status(400).json({
        success: false,
        message: 'Subscription already exists'
      });
    }

    // Create new subscription
    const subscription = new WebhookSubscription({
      userId: req.user.id,
      source,
      callbackUrl
    });

    await subscription.save();

    res.status(201).json({
      success: true,
      message: 'Successfully subscribed to webhook',
      subscription
    });
  } catch (error) {
    console.error('Error in subscribe controller:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Get all subscriptions for current user
exports.getSubscriptions = async (req, res) => {
  try {
    const subscriptions = await WebhookSubscription.find({
      userId: req.user.id,
      active:true
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: subscriptions.length,
      subscriptions
    });
  } catch (error) {
    console.error('Error getting subscriptions:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Unsubscribe (deactivate subscription)
exports.unsubscribe = async (req, res) => {
  try {
    const subscription = await WebhookSubscription.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    // Mark as inactive instead of deleting
    subscription.active = false;
    await subscription.save();

    res.status(200).json({
      success: true,
      message: 'Subscription deactivated successfully'
    });
  } catch (error) {
    console.error('Error unsubscribing:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Delete subscription permanently
exports.deleteSubscription = async (req, res) => {
  try {
    const result = await WebhookSubscription.deleteOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Subscription deleted permanently'
    });
  } catch (error) {
    console.error('Error deleting subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// // Get subscription events
// exports.getSubscriptionEvents = async (req, res) => {
//   try {
//     const subscription = await WebhookSubscription.findOne({
//       _id: req.params.id,
//       userId: req.user.id
//     });

//     if (!subscription) {
//       return res.status(404).json({
//         success: false,
//         message: 'Subscription not found'
//       });
//     }

//     const page = parseInt(req.query.page, 10) || 1;
//     const limit = parseInt(req.query.limit, 10) || 10;
//     const skip = (page - 1) * limit;

//     const events = await WebhookEvent.find({
//       subscriptionId: subscription._id
//     })
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(limit);

//     const totalEvents = await WebhookEvent.countDocuments({
//       subscriptionId: subscription._id
//     });

//     res.status(200).json({
//       success: true,
//       count: events.length,
//       totalEvents,
//       pagination: {
//         currentPage: page,
//         totalPages: Math.ceil(totalEvents / limit)
//       },
//       events
//     });
//   } catch (error) {
//     console.error('Error getting subscription events:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Server error'
//     });
//   }
// };


// GET /api/webhooks/events?page=2&limit=5&status=success&source=github
exports.getUserWebhookEvents = async (req, res) => {
  try {
    // Find all subscriptions of the current user
    const userSubscriptions = await WebhookSubscription.find({
      userId: req.user.id,
      active: true
    });

    // If user has no subscriptions, return empty array
    if (userSubscriptions.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        totalEvents: 0,
        pagination: {
          currentPage: 1,
          totalPages: 0
        },
        events: []
      });
    }

    // Extract subscription IDs
    const subscriptionIds = userSubscriptions.map(sub => sub._id);

    // Setup pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    // Query events with filters
    let query = { subscriptionId: { $in: subscriptionIds } };
    
    // Optional filter by status
    if (req.query.status && ['pending', 'success', 'failed', 'retrying'].includes(req.query.status)) {
      query.status = req.query.status;
    }
    
    // Optional filter by source
    if (req.query.source) {
      query.source = req.query.source;
    }

    // Get events with pagination
    const events = await WebhookEvent.find(query)
      .populate({
        path: 'subscriptionId',
        select: 'source callbackUrl'
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Count total events matching the query
    const totalEvents = await WebhookEvent.countDocuments(query);

    // Return response
    res.status(200).json({
      success: true,
      count: events.length,
      totalEvents,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalEvents / limit)
      },
      events
    });
  } catch (error) {
    console.error('Error retrieving user webhook events:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// router.post('/incoming/:source', webhookController.handleWebhookEvent);
exports.handleWebhookEvent = async (req, res) => {
  try {
    const { source } = req.params;
    
    if (!source) {
      return res.status(400).json({
        success: false,
        message: 'Source is required'
      });
    }

    // Always respond quickly to the webhook source
    res.status(202).json({
      success: true,
      message: 'Webhook received and being processed'
    });

    // Find all active subscriptions for this source
    const subscriptions = await WebhookSubscription.find({
      source,
      active: true
    });

    if (subscriptions.length === 0) {
      console.log(`No active subscriptions found for source: ${source}`);
      return;
    }

    console.log(`Processing webhook from ${source} for ${subscriptions.length} subscribers`);
    
    const payload = req.body;
    
    // For each subscription, create event and queue for processing
    for (const subscription of subscriptions) {
      try {
        // Create an event record first
        const event = new WebhookEvent({
          subscriptionId: subscription._id,
          source,
          payload,
          status: 'pending'
        });
        
        await event.save();
        console.log(`Created webhook event: ${event._id} for subscription: ${subscription._id}`);
        
        // Add to Redis processing queue - this is the critical step
        const added = await redisService.addWebhookToQueue(event._id.toString());
        
        if (added) {
          console.log(`Added webhook event ${event._id} to Redis queue`);
        } else {
          console.error(`Failed to add webhook event ${event._id} to Redis queue`);
        }
      } catch (error) {
        console.error(`Error creating webhook event for subscription ${subscription._id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error handling webhook event:', error);
    // Note: We've already sent a response, so just log the error
  }
};


// // Handle webhook event from a source
// exports.handleWebhookEvent = async (req, res) => {
//   try {
//     const { source } = req.params;
    
//     if (!source) {
//       return res.status(400).json({
//         success: false,
//         message: 'Source is required'
//       });
//     }

//     // Always respond quickly to the webhook source
//     res.status(202).json({
//       success: true,
//       message: 'Webhook received and being processed'
//     });

//     // Find all active subscriptions for this source
//     const subscriptions = await WebhookSubscription.find({
//       source,
//       active: true
//     });

//     if (subscriptions.length === 0) {
//       console.log(`No active subscriptions found for source: ${source}`);
//       return;
//     }

//     console.log(`Processing webhook from ${source} for ${subscriptions.length} subscribers`);
    
//     // Process each subscription asynchronously
//     const payload = req.body;
    
//     // For each subscription, deliver the webhook payload
//     const deliveryPromises = subscriptions.map(async (subscription) => {
//       // Create an event record first
//       const event = new WebhookEvent({
//         subscriptionId: subscription._id,
//         source,
//         payload,
//         status: 'pending'
//       });
      
//       await event.save();
      
//       // Process the delivery
//       try {
//         const response = await axios.post(subscription.callbackUrl, {
//           source,
//           payload,
//           timestamp: new Date(),
//           eventId: event._id
//         }, {
//           headers: {
//             'Content-Type': 'application/json',
//             'User-Agent': 'Webhook-Server'
//           },
//           timeout: 5000 // 5 second timeout
//         });

//         // Update event with success status
//         event.status = 'success';
//         event.statusCode = response.status;
//         event.processedAt = new Date();
//         await event.save();
        
//         console.log(`Webhook delivered to ${subscription.callbackUrl}, status: ${response.status}`);
//       } catch (error) {
//         // Handle delivery failure
//         event.status = 'failed';
//         event.statusCode = error.response?.status || 0;
//         event.errorMessage = error.message;
//         event.nextRetryAt = new Date(Date.now() + 5 * 60 * 1000); // Retry in 5 minutes
//         await event.save();
        
//         console.error(`Failed to deliver webhook to ${subscription.callbackUrl}:`, error.message);
//       }
//     });

//     // Wait for all deliveries to complete (this happens after response is sent)
//     await Promise.all(deliveryPromises);
    
//   } catch (error) {
//     console.error('Error handling webhook event:', error);
//     // Note: We've already sent a response, so just log the error
//   }
// };