import React, { useState } from 'react';
import { format } from 'date-fns';

interface ConferenceData {
  conferenceId: string;
  conferenceSolution: {
    key: {
      type: string;
    };
    name: string;
    iconUri: string;
  };
  entryPoints: Array<{
    entryPointType: string;
    uri: string;
    label?: string;
  }>;
}

interface Attendee {
  email: string;
  displayName?: string;
  responseStatus?: 'accepted' | 'tentative' | 'declined' | 'needsAction';
  organizer?: boolean;
  optional?: boolean;
  selected?: boolean;
}

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime: string };
  end: { dateTime: string };
  attendees?: Attendee[];
  hangoutLink?: string;
  conferenceData?: ConferenceData;
  visibility?: 'default' | 'public' | 'private';
}

interface EventCardProps {
  event: CalendarEvent;
  onAttendeeSelect: (eventId: string, attendee: Attendee) => void;
  selectedAttendees: Set<string>;
}

export const EventCard: React.FC<EventCardProps> = ({ 
  event, 
  onAttendeeSelect,
  selectedAttendees 
}) => {
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const startTime = new Date(event.start.dateTime);
  const endTime = new Date(event.end.dateTime);
  const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60);

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'accepted': return 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300 ring-1 ring-green-600/20 dark:ring-green-300/20';
      case 'tentative': return 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 ring-1 ring-yellow-600/20 dark:ring-yellow-300/20';
      case 'declined': return 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 ring-1 ring-red-600/20 dark:ring-red-300/20';
      default: return 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-300 ring-1 ring-gray-500/20 dark:ring-gray-400/20';
    }
  };

  const renderDescription = () => {
    if (!event.description) return null;

    return (
      <div 
        className={`mt-4 text-sm text-gray-600 dark:text-gray-400 space-y-2 ${!isDescriptionExpanded ? 'line-clamp-2' : ''}`}
        dangerouslySetInnerHTML={{ __html: event.description }}
      />
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-900/5 dark:ring-white/10">
      <div className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white truncate">
              {event.summary}
            </h3>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
              <span className="inline-flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {format(startTime, 'h:mm a')} - {format(endTime, 'h:mm a')}
              </span>
              <span>•</span>
              <span>{duration} min</span>
            </div>
          </div>
          {event.conferenceData && (
            <a
              href={event.conferenceData.entryPoints[0]?.uri}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:hover:bg-blue-800/30 dark:text-blue-300 rounded-lg transition-colors text-sm font-medium group"
            >
              <svg className="w-4 h-4 transition-transform group-hover:scale-110" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm12.553 1.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
              </svg>
              Join Meeting
            </a>
          )}
        </div>

        {event.description && (
          <div className="mt-4">
            {renderDescription()}
            <button
              onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
              className="mt-2 text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
            >
              {isDescriptionExpanded ? 'Show less' : 'Show more'}
            </button>
          </div>
        )}

        {event.location && (
          <div className="mt-4 flex items-center text-sm text-gray-600 dark:text-gray-400">
            <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="truncate">{event.location}</span>
          </div>
        )}
      </div>

      {event.attendees && event.attendees.length > 0 && (
        <div className="border-t border-gray-100 dark:border-gray-700/50 px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
              Attendees ({event.attendees.length})
            </h4>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Click to select for pre-cap
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {event.attendees.map((attendee, index) => (
              <div
                key={index}
                onClick={() => onAttendeeSelect(event.id, attendee)}
                className="group flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center min-w-0">
                  <input
                    type="checkbox"
                    checked={selectedAttendees.has(`${event.id}-${attendee.email}`)}
                    onChange={() => onAttendeeSelect(event.id, attendee)}
                    className="w-4 h-4 text-blue-500 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-offset-gray-800"
                  />
                  <div className="ml-3 truncate">
                    {attendee.displayName && (
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {attendee.displayName}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {attendee.email}
                    </p>
                  </div>
                </div>
                <span className={`ml-2 text-xs px-2 py-1 rounded-full ${getStatusColor(attendee.responseStatus)}`}>
                  {attendee.responseStatus || 'pending'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}; 