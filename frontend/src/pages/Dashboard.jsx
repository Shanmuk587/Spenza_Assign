import { useState, useEffect } from 'react';
import { getSubscriptions, getWebhookEvents } from '../services/webhookService';
import { useAuth } from '../context/AuthContext';

const Dashboard = () => {
  const [subscriptions, setSubscriptions] = useState([]);
  const [recentEvents, setRecentEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [subscriptionsData, eventsData] = await Promise.all([
          getSubscriptions(),
          getWebhookEvents({ limit: 5 })
        ]);
        setSubscriptions(subscriptionsData);
        setRecentEvents(eventsData.events);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDashboardData();
  }, []);

  if (loading) {
    return <div className="loading">Loading dashboard data...</div>;
  }

  return (
    <div className="dashboard">
      <h1>Welcome {user?.username}!</h1>
      
      <div className="dashboard-stats">
        <div className="stat-card">
          <h3>Active Subscriptions</h3>
          <p className="stat-value">{subscriptions?.length}</p>
        </div>
        
        <div className="stat-card">
          <h3>Recent Events</h3>
          <p className="stat-value">{recentEvents?.length}</p>
        </div>
      </div>
      
      <div className="dashboard-section">
        <h2>Recent Webhook Events</h2>
        {recentEvents?.length > 0 ? (
          <div className="event-list">
            {recentEvents.map(event => (
              <div key={event._id} className="event-card">
                <div className="event-header">
                  <span className={`status ${event.status}`}>{event.status}</span>
                  <span className="timestamp">{new Date(event.createdAt).toLocaleString()}</span>
                </div>
                <div className="source">Source: {event.source}</div>
                <div className="source">CallbackUrl: {event.subscriptionId.callbackUrl}</div>
                <div className="source">Error: {event.errorMessage}</div>
              </div>
            ))}
          </div>
        ) : (
          <p>No recent webhook events</p>
        )}
      </div>
    </div>
  );
};

export default Dashboard;