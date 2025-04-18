import api from './api';

export const getSubscriptions = async () => {
  const response = await api.get('/webhooks/subscriptions');
  return response.data.subscriptions;
};

export const createSubscription = async (data) => {
  const response = await api.post('/webhooks/subscribe', data);
  return response.data;
};

export const deleteSubscription = async (id) => {
  const response = await api.delete(`/webhooks/unsubscribe/${id}`);
  return response.data;
};

export const getWebhookEvents = async (params) => {
  const response = await api.get(`/webhooks/events`, {
    params: {
      limit: params.limit || 5, // fallback to 5 if not provided
      source: params.source,
      status: params.status
    },
  });
  return response.data;
};
