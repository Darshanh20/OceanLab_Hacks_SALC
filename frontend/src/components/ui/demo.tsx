'use client';

import { useState, useEffect, useMemo } from 'react';
import { HiMiniCalendarDays } from 'react-icons/hi2';

// Google API Configuration - update these with your values
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || '';
const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'];
const SCOPES = 'https://www.googleapis.com/auth/calendar.events';

interface CalendarEvent {
  title: string
  description?: string
  date: string
  time?: string
}

export default function InlineActionDemo() {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'adding' | 'success' | 'error' | 'no-future-events'>('idle');
  const [addedCount, setAddedCount] = useState(0);
  const [totalEvents, setTotalEvents] = useState(0);
  const [gapiLoaded, setGapiLoaded] = useState(false);

  // Generate sample events with future dates
  const allEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const events: CalendarEvent[] = [];
    for (let i = 1; i <= 5; i++) {
      const eventDate = new Date(today);
      eventDate.setDate(eventDate.getDate() + (i * 5));
      const dateStr = eventDate.toISOString().split('T')[0];
      
      events.push({
        title: `Meeting ${i}`,
        description: `Team meeting scheduled for future planning`,
        date: dateStr,
        time: `${9 + i}:00`,
      });
    }
    return events;
  }, []);

  // Filter to only include future events
  const futureEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return allEvents.filter(event => {
      const eventDate = new Date(event.date);
      return eventDate > today;
    });
  }, [allEvents]);

  // Load and initialize gapi on mount
  useEffect(() => {
    const loadGapi = async () => {
      try {
        console.log('Starting gapi initialization...');
        
        // Dynamically load gapi script
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://apis.google.com/js/api.js';
          script.async = true;
          script.defer = true;
          script.onload = () => {
            console.log('gapi script loaded');
            resolve();
          };
          script.onerror = () => reject(new Error('Failed to load gapi'));
          document.head.appendChild(script);
        });

        // Wait for gapi to be globally available
        await new Promise<void>((resolve) => {
          let attempts = 0;
          const checkGapi = setInterval(() => {
            attempts++;
            if (window.gapi) {
              console.log('gapi object available, loading client:auth2...');
              clearInterval(checkGapi);
              resolve();
            }
            if (attempts > 100) {
              clearInterval(checkGapi);
              resolve();
            }
          }, 100);
        });

        // Load client and auth2
        await new Promise<void>((resolve) => {
          window.gapi.load('client:auth2', () => {
            console.log('client:auth2 loaded');
            resolve();
          });
        });

        // Initialize gapi client
        console.log('Initializing gapi.client.init...');
        await window.gapi.client.init({
          apiKey: GOOGLE_API_KEY,
          clientId: GOOGLE_CLIENT_ID,
          discoveryDocs: DISCOVERY_DOCS,
          scope: SCOPES,
        });

        setGapiLoaded(true);
        console.log('✓ gapi initialized successfully');
      } catch (error) {
        console.error('✗ Failed to initialize gapi:', error);
        setStatus('error');
      }
    };

    loadGapi();
  }, []);

  const handleAddToCalendar = async () => {
    if (!gapiLoaded) {
      console.error('gapi not loaded');
      setStatus('error');
      return;
    }

    if (futureEvents.length === 0) {
      console.warn('No future events to add');
      setStatus('no-future-events');
      setTotalEvents(0);
      return;
    }

    setStatus('connecting');
    setTotalEvents(futureEvents.length);
    
    try {
      const auth2 = window.gapi.auth2.getAuthInstance();
      
      console.log('Current sign-in status:', auth2.isSignedIn.get());
      
      if (!auth2.isSignedIn.get()) {
        console.log('User not signed in, requesting sign-in with POPUP mode...');
        // Sign in with POPUP mode to prevent page redirect
        const googleUser = await auth2.signIn({ ux_mode: 'popup' });
        console.log('✓ User signed in successfully');
      }

      // Get current user and access token
      const currentUser = auth2.currentUser.get();
      const authResponse = currentUser.getAuthResponse();
      const accessToken = authResponse.access_token;

      if (!accessToken) {
        throw new Error('Failed to get access token from auth response');
      }

      console.log('✓ Access token obtained, setting on gapi.client...');
      // Set the token on gapi client for all subsequent calls
      window.gapi.client.setToken({ access_token: accessToken });

      // Proceed to add events
      console.log('Starting event insertion...');
      await addEventsToCalendar();
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('✗ Sign-in or token error:', errorMsg);
      setStatus('error');
    }
  };

  const addEventsToCalendar = async () => {
    setStatus('adding');
    let successCount = 0;
    const errors: string[] = [];

    console.log(`Inserting ${futureEvents.length} future events...`);

    for (const event of futureEvents) {
      try {
        const startDateTime = event.time
          ? `${event.date}T${event.time}:00`
          : `${event.date}T00:00:00`;
        
        // Calculate end time (1 hour later)
        const [hours, minutes] = (event.time || '00:00').split(':').map(Number);
        const endHours = (hours + 1) % 24;
        const endTime = `${String(endHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        const endDateTime = event.time
          ? `${event.date}T${endTime}:00`
          : `${event.date}T01:00:00`;

        console.log(`Inserting: ${event.title} from ${startDateTime} to ${endDateTime}`);

        const response = await window.gapi.client.calendar.events.insert({
          calendarId: 'primary',
          resource: {
            summary: event.title,
            description: event.description || '',
            start: {
              dateTime: startDateTime,
              timeZone: 'Asia/Kolkata',
            },
            end: {
              dateTime: endDateTime,
              timeZone: 'Asia/Kolkata',
            },
          },
        });

        if (response.status === 200) {
          successCount++;
          console.log(`✓ Successfully added: ${event.title}`);
        } else {
          const msg = `Unexpected status ${response.status}`;
          errors.push(`${event.title}: ${msg}`);
          console.error(`✗ Failed to add ${event.title}:`, msg);
        }
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`${event.title}: ${errorMsg}`);
        console.error(`✗ Error inserting event ${event.title}:`, error);
      }
    }

    setAddedCount(successCount);

    console.log(`Insertion complete: ${successCount}/${futureEvents.length} events added`);
    
    if (successCount > 0) {
      setStatus('success');
      if (errors.length > 0) {
        console.warn(`⚠️ ${errors.length} events failed:`, errors);
      }
    } else {
      console.error('✗ Failed to add any events');
      setStatus('error');
    }
  };

  const getButtonText = () => {
    switch (status) {
      case 'idle':
        return 'Add to Google Calendar';
      case 'connecting':
        return 'Connecting to Google...';
      case 'adding':
        return 'Adding Events...';
      case 'success':
        return `✅ ${addedCount}/${totalEvents} Events Added!`;
      case 'no-future-events':
        return '⚠️ No future events to add';
      case 'error':
        return 'Something went wrong. Try again';
    }
  };

  const getButtonStyle = () => {
    switch (status) {
      case 'idle':
        return { background: '#3b82f6', color: 'white' };
      case 'connecting':
      case 'adding':
        return { background: '#9ca3af', color: 'white', cursor: 'not-allowed', opacity: 0.7 };
      case 'success':
        return { background: '#10b981', color: 'white', cursor: 'not-allowed', opacity: 0.8 };
      case 'no-future-events':
        return { background: '#f59e0b', color: 'white', cursor: 'not-allowed', opacity: 0.8 };
      case 'error':
        return { background: '#ef4444', color: 'white' };
    }
  };

  if (!gapiLoaded) {
    return (
      <div style={{ padding: '10px 16px', fontSize: '12px', color: '#999' }}>
        Loading Google Calendar...
      </div>
    );
  }

  return (
    <div className="theme-injected w-full max-w-xs sm:max-w-md">
      <button
        onClick={handleAddToCalendar}
        disabled={status === 'connecting' || status === 'adding' || status === 'success' || status === 'no-future-events'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 16px',
          borderRadius: '8px',
          border: 'none',
          fontSize: '14px',
          fontWeight: '500',
          cursor: status === 'idle' || status === 'error' ? 'pointer' : 'not-allowed',
          transition: 'all 0.3s ease',
          ...getButtonStyle(),
        }}
      >
        {status === 'adding' && (
          <span
            style={{
              display: 'inline-block',
              width: '14px',
              height: '14px',
              border: '2px solid rgba(255,255,255,0.3)',
              borderTop: '2px solid white',
              borderRadius: '50%',
              animation: 'spin 0.6s linear infinite',
            }}
          />
        )}
        {status !== 'adding' && <HiMiniCalendarDays size={18} />}
        {getButtonText()}
      </button>
    </div>
  );
}

