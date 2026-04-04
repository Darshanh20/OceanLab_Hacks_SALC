declare global {
  interface Window {
    gapi: {
      load: (api: string, callback: () => void) => void;
      client: {
        init: (config: {
          apiKey: string;
          clientId: string;
          discoveryDocs: string[];
          scope: string;
        }) => Promise<void>;
        setToken: (token: { access_token: string }) => void;
        calendar: {
          events: {
            insert: (config: {
              calendarId: string;
              resource: {
                summary: string;
                description?: string;
                start: {
                  dateTime: string;
                  timeZone: string;
                };
                end: {
                  dateTime: string;
                  timeZone: string;
                };
              };
            }) => Promise<{ status: number }>;
          };
        };
      };
      auth2: {
        getAuthInstance: () => {
          isSignedIn: {
            get: () => boolean;
            listen: (callback: (isSignedIn: boolean) => void) => void;
          };
          currentUser: {
            get: () => {
              getAuthResponse: () => {
                access_token: string;
                id_token: string;
                scope: string;
                expires_in: number;
                expires_at: number;
              };
            };
          };
          signIn: (options?: { ux_mode?: 'page' | 'popup' }) => Promise<any>;
          signOut: () => Promise<void>;
        };
        init: (config: { client_id: string }) => Promise<any>;
      };
    };
  }
}

export {};
