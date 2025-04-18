import { useState, useEffect } from 'react';
import { getSubscriptions, createSubscription, deleteSubscription } from '../services/webhookService';

const Subscriptions = () => {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState('');
  const [callbackUrl, setCallbackUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState('');

  const fetchSubscriptions = async () => {
    try {
      const data = await getSubscriptions();
      setSubscriptions(data);
    } catch (err) {
      console.error('Error fetching subscriptions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!source || !callbackUrl) {
      setError('Both source and callback URL are required');
      return;
    }
    
    try {
      setIsAdding(true);
      await createSubscription({ source, callbackUrl });
      setSource('');
      setCallbackUrl('');
      fetchSubscriptions();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create subscription');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this subscription?')) {
      try {
        await deleteSubscription(id);
        fetchSubscriptions();
      } catch (err) {
        console.error('Error deleting subscription:', err);
      }
    }
  };

  if (loading) {
    return <div className="loading">Loading subscriptions...</div>;
  }

  return (
    <div className="subscriptions-page">
      <h1>Webhook Subscriptions</h1>
      
      <div className="subscription-form-container">
        <h2>Add New Subscription</h2>
        <form onSubmit={handleSubmit} className="subscription-form">
          {error && <div className="error-message">{error}</div>}
          
          <div className="form-group">
            <label htmlFor="source">Source Name/URL</label>
            <input
              type="text"
              id="source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="github, stripe, sensor_updates, etc."
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="callbackUrl">Callback URL</label>
            <input
              type="url"
              id="callbackUrl"
              value={callbackUrl}
              onChange={(e) => setCallbackUrl(e.target.value)}
              placeholder="https://your-server.com/webhook-callback"
              required
            />
          </div>
          
          <button type="submit" disabled={isAdding} className="btn-primary">
            {isAdding ? 'Adding...' : 'Add Subscription'}
          </button>
        </form>
      </div>
      
      <div className="subscriptions-list">
        <h2>Your Subscriptions</h2>
        {subscriptions.length > 0 ? (
          <table className="subscriptions-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Callback URL</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map(sub => (
                <tr key={sub._id}>
                  <td>{sub.source}</td>
                  <td className="callback-url">{sub.callbackUrl}</td>
                  <td>{new Date(sub.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button 
                      onClick={() => handleDelete(sub._id)} 
                      className="btn-delete"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No subscriptions found. Add your first webhook subscription above.</p>
        )}
      </div>
    </div>
  );
};

export default Subscriptions;