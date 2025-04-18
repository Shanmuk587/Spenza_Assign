import { useState, useEffect, useRef } from 'react';
import { getWebhookEvents } from '../services/webhookService';

const EventLogs = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sourceName, setSourceName] = useState('');
  const [status, setStatus] = useState(''); // Added status state
  // Polling configuration
  const [pollingInterval, setPollingInterval] = useState(5000);
  const [isPolling, setIsPolling] = useState(true);
  const pollingTimerRef = useRef(null);

  const fetchEvents = async (isPollingUpdate = false) => {
    if (isPollingUpdate && page !== 1) return; // Only poll for the first page
    
    try {
      if (!isPollingUpdate) {
        setLoading(true);
      }
      
      const params = {
        page,
        limit: 10,
        status: status.trim() || undefined, // Filter by status if provided
      };
      
      // Add source parameter if sourceName is provided
      if (sourceName.trim()) {
        params.source = sourceName.trim();
      }
      
      const data = await getWebhookEvents(params);
      if (isPollingUpdate && page === 1) {
        // For polling updates, merge with existing events to avoid flickering
        const existingIds = new Set(events.map(e => e._id));
        const newEvents = data.events.filter(e => !existingIds.has(e._id));
        console.log(data)
        if (newEvents.length > 0) {
          // If new events found, prepend them to the current list
          setEvents(prevEvents => {
            // Keep only what fits on the page
            const combinedEvents = [...newEvents, ...prevEvents];
            return combinedEvents.slice(0, 10);
          });
        }
      } else {
        // For manual refresh or page change, replace events
        setEvents(data.events);
      }
      
      setTotalPages(Math.ceil(data.pagination.totalPages / 10));
    } catch (err) {
      console.error('Error fetching webhook events:', err);
    } finally {
      if (!isPollingUpdate) {
        setLoading(false);
      }
    }
  };

  // Initial load
  useEffect(() => {
    fetchEvents();
  }, [page, sourceName, status]);

  // Setup polling
  useEffect(() => {
    // Clear any existing interval when polling settings change
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
    }
    
    if (isPolling) {
      pollingTimerRef.current = setInterval(() => {
        fetchEvents(true); // true indicates this is a polling update
      }, pollingInterval);
    }
    
    // Cleanup on unmount
    return () => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
      }
    };
  }, [isPolling, pollingInterval, page, events, sourceName]);

  // Toggle polling on/off
  const togglePolling = () => {
    setIsPolling(prev => !prev);
  };

  // Handle source name change
  const handleSourceChange = (e) => {
    setSourceName(e.target.value);
    setPage(1); // Reset to first page when filter changes
  };

  const handleStatusChange = (e) => {
    setStatus(e.target.value);
  };

  // Helper function to safely render object values
  const renderValue = (value) => {
    if (value === null || value === undefined) {
      return "N/A";
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return value.toString();
  };

  // Format date for nextRetryAt
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="event-logs-page">
      {/* <h1>Webhook Event Logs</h1> */}
      
      <h2 style={{ fontSize: '1.75rem', marginBottom: '1rem' }}>Real-time Logs</h2>

<div style={{
  display: 'flex',
  flexWrap: 'wrap',
  gap: '1rem',
  marginBottom: '1.5rem',
  alignItems: 'center'
}}>
  <div style={{ flex: '1 1 250px' }}>
    <label htmlFor="source-filter" style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
      Source Name:
    </label>
    <input
      id="source-filter"
      type="text"
      value={sourceName}
      onChange={handleSourceChange}
      placeholder="Enter source name"
      style={{
        width: '100%',
        padding: '0.6rem 0.8rem',
        fontSize: '1rem',
        borderRadius: '8px',
        border: '1px solid #ccc'
      }}
    />
  </div>
  <div style={{ flex: '1 1 250px' }}>
    <label htmlFor="status-filter" style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
      Status:
    </label>
    <input
      id="status-filter"
      type="text"
      value={status}
      onChange={handleStatusChange}
      placeholder="Status (e.g., success, failed)"
      style={{
        width: '100%',
        padding: '0.6rem 0.8rem',
        fontSize: '1rem',
        borderRadius: '8px',
        border: '1px solid #ccc'
      }}
    />
  </div>
</div>

      {loading ? (
        <div className="loading">Loading event logs...</div>
      ) : (
        <>
          {events.length > 0 ? (
            <div className="events-list">
              {events.map(event => (
                <div key={event._id} className="event-card">
                  <div className="event-header">
                    <span className={`status ${event.status || 'unknown'}`}>
                      {event.status || 'Unknown'}
                    </span>
                    <span className="timestamp">
                      {event.createdAt ? new Date(event.createdAt).toLocaleString() : 'No timestamp'}
                    </span>
                  </div>
                  <div className="event-details">
                    {/* Always show source and subscriptionId */}
                    <div className="detail-row">
                      <span className="detail-label">Source:</span>
                      <span className="detail-value">{renderValue(event.source)}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Event ID:</span>
                      <span className="detail-value">{renderValue(event._id)}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">callbackUrl:</span>
                      <span className="detail-value">{renderValue(event.subscriptionId.callbackUrl)}</span>
                    </div>
                    {/* Show additional information only for failed events */}
                    {event.status === 'failed' && (
                      <>
                      <div className="detail-row">
                          <span className="detail-label">Error: </span>
                          <span className="detail-value">{event.errorMessage}</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Retry Count:</span>
                          <span className="detail-value">{event.retryCount || 0}</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Next Retry At:</span>
                          <span className="detail-value">{formatDate(event.nextRetryAt)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
              
              <div className="pagination">
                <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="page-btn"
                >
                  Previous
                </button>
                <span className="page-info">Page {page} of {totalPages}</span>
                <button 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="page-btn"
                >
                  Next
                </button>
              </div>
            </div>
          ) : (
            <p className="no-events">No webhook events found.</p>
          )}
        </>
      )}
    </div>
  );
};

export default EventLogs;