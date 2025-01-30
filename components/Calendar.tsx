'use client';

import React, { useState, useEffect } from 'react';
import ApiCalendar from 'react-google-calendar-api';
import { format, addMonths, subMonths, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';
import { EventCard } from './EventCard';
import { CalendarGrid } from './CalendarGrid';
import { searchPerson } from '../services/exaService';
import { generatePersonSummary } from '../services/summaryService';
import { ExaResults } from './ExaResults';

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

export interface CalendarEvent {
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

interface GooglePerson {
  resourceName: string;
  names?: Array<{
    givenName?: string;
    familyName?: string;
    displayName?: string;
  }>;
  photos?: Array<{
    url?: string;
  }>;
  organizations?: Array<{
    name?: string;
    title?: string;
  }>;
  emailAddresses?: Array<{
    value?: string;
    type?: string;
  }>;
  nicknames?: Array<{
    value?: string;
  }>;
  biographies?: Array<{
    value?: string;
  }>;
}

interface SearchResponse {
  result: {
    results?: Array<{
      person: GooglePerson;
    }>;
  };
}

interface ProfileResponse {
  result: GooglePerson;
}

interface BatchUpdateResponse {
  result: {
    documentId: string;
    replies: unknown[];
  };
}

declare global {
  interface Window {
    ENV: {
      NEXT_PUBLIC_GOOGLE_CLIENT_ID: string;
    }
    gapi: {
      auth: {
        getToken: () => {
          access_token: string;
        } | null;
      };
      client: {
        load: (api: string, version: string) => Promise<void>;
        people: {
          people: {
            searchContacts: (params: { query: string; readMask: string }) => Promise<SearchResponse>;
            get: (params: { resourceName: string; personFields: string }) => Promise<ProfileResponse>;
          };
        };
        docs: {
          documents: {
            create: (params: { requestBody: { title: string } }) => Promise<{ result: { documentId: string } }>;
            batchUpdate: (params: { 
              documentId: string;
              requestBody: {
                requests: Array<{
                  insertText?: {
                    location: { index: number };
                    text: string;
                  };
                  updateParagraphStyle?: {
                    range: { startIndex: number; endIndex: number };
                    paragraphStyle: {
                      namedStyleType: string;
                    };
                    fields: string;
                  };
                }>;
              };
            }) => Promise<BatchUpdateResponse>;
          };
        };
      };
    };
  }
}

const config = {
  clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
  apiKey: '',
  scope: "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/contacts.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive.file",
  discoveryDocs: [
    "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest",
    "https://www.googleapis.com/discovery/v1/apis/people/v1/rest",
    "https://www.googleapis.com/discovery/v1/apis/docs/v1/rest",
    "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"
  ],
};

interface EnhancedAttendee extends Attendee {
  firstName?: string;
  lastName?: string;
  profilePhotoUrl?: string;
  company?: string;
  title?: string;
}

interface EnhancedAttendeesMap {
  [email: string]: EnhancedAttendee;
}

interface ExaSearchResult {
  title: string;
  url: string;
  publishedDate: string | null;
  author: string | null;
  summary: string;
  text: string;
}

interface ExaPersonInfo {
  name: string;
  searchResults: ExaSearchResult[];
  error?: string;
}

interface PersonSummary {
  name: string;
  summary: string;
  error?: string;
}

interface LoadingState {
  stage: 'searching' | 'analyzing' | 'summarizing';
  person?: string;
  progress: number;
  total: number;
}

export const Calendar = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [apiCalendar, setApiCalendar] = useState<ApiCalendar | null>(null);
  const [selectedAttendees, setSelectedAttendees] = useState<Set<string>>(new Set());
  const [selectedAttendeesDetails, setSelectedAttendeesDetails] = useState<Map<string, { eventId: string; attendee: Attendee }>>(new Map());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedWeek, setSelectedWeek] = useState<Date | null>(null);
  const [selectedDayEvents, setSelectedDayEvents] = useState<CalendarEvent[]>([]);
  const [selectedWeekEvents, setSelectedWeekEvents] = useState<CalendarEvent[]>([]);
  const [isCalendarCollapsed, setIsCalendarCollapsed] = useState(false);
  const [enhancedAttendees, setEnhancedAttendees] = useState<EnhancedAttendeesMap>({});
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ExaPersonInfo[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [summaries, setSummaries] = useState<PersonSummary[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState | undefined>();

  useEffect(() => {
    const calendar = new ApiCalendar(config);
    setApiCalendar(calendar);
  }, []);

  const handleSignIn = () => {
    if (!apiCalendar) return;
    
    apiCalendar.handleAuthClick()
      .then(() => {
        setIsSignedIn(true);
        fetchEvents();
      })
      .catch(console.error);
  };

  const fetchEvents = async () => {
    if (!apiCalendar) return;

    try {
      const response = await apiCalendar.listUpcomingEvents(100); // Increased to show more events
      setEvents(response.result.items);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const fetchContactDetails = async (email: string) => {
    if (!apiCalendar?.sign) return null;
    
    try {
      console.log('Fetching contact details for:', email);
      
      // Wait for gapi client to be loaded with timeout
      const gapiLoaded = await Promise.race([
        new Promise((resolve) => {
          if (window.gapi?.client) {
            resolve(true);
          } else {
            const checkGapi = setInterval(() => {
              if (window.gapi?.client) {
                clearInterval(checkGapi);
                resolve(true);
              }
            }, 100);
          }
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for gapi')), 5000))
      ]).catch(error => {
        console.error('Error waiting for gapi:', error);
        return false;
      });

      if (!gapiLoaded) {
        console.error('Failed to load gapi client');
        return null;
      }

      // Load the People API if not already loaded
      if (!window.gapi.client.people) {
        console.log('Loading People API...');
        await window.gapi.client.load('people', 'v1');
      }

      // Try multiple search strategies
      let person = null;
      let searchResponse;

      // 1. First try exact email match
      console.log('Strategy 1: Searching by exact email:', email);
      searchResponse = await window.gapi.client.people.people.searchContacts({
        query: email,
        readMask: 'names,emailAddresses,photos,organizations'
      });
      
      if (searchResponse.result.results?.[0]?.person) {
        person = searchResponse.result.results[0].person;
        console.log('Found person by exact email match:', person);
      }

      // 2. If no match, try searching by email without domain
      if (!person && email.includes('@')) {
        const emailWithoutDomain = email.split('@')[0];
        console.log('Strategy 2: Searching by email without domain:', emailWithoutDomain);
        searchResponse = await window.gapi.client.people.people.searchContacts({
          query: emailWithoutDomain,
          readMask: 'names,emailAddresses,photos,organizations'
        });
        
        // Find exact match in results
        const matchingPerson = searchResponse.result.results?.find(result => 
          result.person.emailAddresses?.some((e: { value?: string }) => 
            e.value?.toLowerCase() === email.toLowerCase()
          )
        );
        
        if (matchingPerson) {
          person = matchingPerson.person;
          console.log('Found person by email without domain:', person);
        }
      }

      // 3. Try name-based search if we have a display name
      if (!person && email.includes('@')) {
        const nameFromEmail = email.split('@')[0].replace(/[.+]/g, ' ');
        console.log('Strategy 3: Searching by name from email:', nameFromEmail);
        searchResponse = await window.gapi.client.people.people.searchContacts({
          query: nameFromEmail,
          readMask: 'names,emailAddresses,photos,organizations'
        });
        
        // Find best match in results
        const matchingPerson = searchResponse.result.results?.find(result => {
          const fullName = result.person.names?.[0]?.displayName?.toLowerCase() || '';
          const normalizedNameFromEmail = nameFromEmail.toLowerCase();
          return fullName.includes(normalizedNameFromEmail) || normalizedNameFromEmail.includes(fullName);
        });
        
        if (matchingPerson) {
          person = matchingPerson.person;
          console.log('Found person by name search:', person);
        }
      }

      if (person?.resourceName) {
        console.log('Getting detailed profile for person:', person);
        const profileResponse = await window.gapi.client.people.people.get({
          resourceName: person.resourceName,
          personFields: 'names,emailAddresses,photos,organizations,nicknames,biographies'
        });

        console.log('Full profile response:', profileResponse);

        if (profileResponse.result) {
          const names = profileResponse.result.names?.[0] || {};
          const photo = profileResponse.result.photos?.[0]?.url;
          const org = profileResponse.result.organizations?.[0] || {};
          const nickname = profileResponse.result.nicknames?.[0]?.value;
          const bio = profileResponse.result.biographies?.[0]?.value;

          const firstName = names.givenName || nickname?.split(' ')[0] || email.split('@')[0].split('.')[0];
          const lastName = names.familyName || 
                         nickname?.split(' ').slice(1).join(' ') || 
                         email.split('@')[0].split('.').slice(1).join(' ');

          const details = {
            firstName: firstName.charAt(0).toUpperCase() + firstName.slice(1),
            lastName: lastName ? lastName.charAt(0).toUpperCase() + lastName.slice(1) : '',
            profilePhotoUrl: photo,
            company: org.name,
            title: org.title,
            bio: bio
          };

          console.log('Enhanced details for', email, ':', details);
          return details;
        }
      }
    } catch (error) {
      console.error('Error fetching contact details for', email, ':', error);
    }
    
    // Fallback: Create basic details from email
    if (email.includes('@')) {
      const [namePart] = email.split('@');
      const names = namePart.split(/[.+]/);
      return {
        firstName: names[0].charAt(0).toUpperCase() + names[0].slice(1),
        lastName: names[1] ? names[1].charAt(0).toUpperCase() + names[1].slice(1) : '',
        profilePhotoUrl: undefined,
        company: undefined,
        title: undefined,
      };
    }
    
    return null;
  };

  const handleAttendeeSelect = async (eventId: string, attendee: Attendee) => {
    const attendeeKey = `${eventId}-${attendee.email}`;
    const newSelectedAttendees = new Set(selectedAttendees);
    const newSelectedAttendeesDetails = new Map(selectedAttendeesDetails);

    if (newSelectedAttendees.has(attendeeKey)) {
      newSelectedAttendees.delete(attendeeKey);
      newSelectedAttendeesDetails.delete(attendeeKey);
    } else {
      newSelectedAttendees.add(attendeeKey);
      newSelectedAttendeesDetails.set(attendeeKey, { eventId, attendee });

      // Fetch enhanced details if not already cached
      if (!enhancedAttendees[attendee.email]) {
        const details = await fetchContactDetails(attendee.email);
        if (details) {
          setEnhancedAttendees(prev => ({
            ...prev,
            [attendee.email]: {
              ...attendee,
              ...details,
            },
          }));
        }
      }
    }

    setSelectedAttendees(newSelectedAttendees);
    setSelectedAttendeesDetails(newSelectedAttendeesDetails);
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setSelectedWeek(null);
    const dayEvents = events.filter(event => {
      const eventDate = new Date(event.start.dateTime);
      return isSameDay(eventDate, date);
    });
    setSelectedDayEvents(dayEvents);
    setSelectedWeekEvents([]);
    setIsCalendarCollapsed(true);
  };

  const handleWeekSelect = (date: Date) => {
    const weekStart = startOfWeek(date);
    setSelectedWeek(weekStart);
    setSelectedDate(date);
    
    const weekDays = eachDayOfInterval({
      start: weekStart,
      end: endOfWeek(date)
    });

    const weekEvents = events.filter(event => {
      const eventDate = new Date(event.start.dateTime);
      return weekDays.some(day => isSameDay(eventDate, day));
    });

    setSelectedWeekEvents(weekEvents);
    setSelectedDayEvents([]);
    setIsCalendarCollapsed(true);
  };

  const handleMonthChange = (increment: boolean) => {
    setSelectedDate(current => increment ? addMonths(current, 1) : subMonths(current, 1));
  };

  const getDisplayedEvents = () => {
    if (selectedWeekEvents.length > 0) {
      return selectedWeekEvents;
    }
    return selectedDayEvents;
  };

  const getEventsTitle = () => {
    if (selectedWeekEvents.length > 0) {
      const weekStart = startOfWeek(selectedDate);
      const weekEnd = endOfWeek(selectedDate);
      return `Events for week of ${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
    }
    return `Events for ${format(selectedDate, 'MMMM d, yyyy')}`;
  };

  const toggleCalendarView = () => {
    setIsCalendarCollapsed(!isCalendarCollapsed);
  };

  const renderAttendeeDetails = (attendee: Attendee) => {
    const enhanced = enhancedAttendees[attendee.email];
    if (enhanced?.firstName || enhanced?.lastName) {
      return (
        <div className="flex items-center gap-2">
          {enhanced.profilePhotoUrl && (
            <div className="relative w-6 h-6">
              <img 
                src={enhanced.profilePhotoUrl} 
                alt={enhanced.firstName || 'Profile photo'}
                className="w-6 h-6 rounded-full object-cover"
                onError={(e) => {
                  // Hide the image on error
                  e.currentTarget.style.display = 'none';
                  // Optionally show initials or placeholder
                  const parent = e.currentTarget.parentElement;
                  if (parent) {
                    parent.innerHTML = `<div class="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-medium text-blue-600 dark:text-blue-400">
                      ${enhanced.firstName?.[0] || '?'}
                    </div>`;
                  }
                }}
              />
            </div>
          )}
          <div>
            <div className="font-medium text-gray-900 dark:text-white">
              {enhanced.firstName} {enhanced.lastName}
            </div>
            {(enhanced.title || enhanced.company) && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {enhanced.title}{enhanced.title && enhanced.company ? ' at ' : ''}{enhanced.company}
              </div>
            )}
          </div>
        </div>
      );
    }
    return attendee.displayName || attendee.email;
  };

  const handleContinue = async () => {
    if (selectedAttendeesDetails.size === 0) return;

    setIsSearching(true);
    setShowResults(true);

    const attendees = Array.from(selectedAttendeesDetails.values()).map(({ attendee }) => ({
      name: enhancedAttendees[attendee.email]?.firstName && enhancedAttendees[attendee.email]?.lastName
        ? `${enhancedAttendees[attendee.email]?.firstName} ${enhancedAttendees[attendee.email]?.lastName}`
        : attendee.displayName || attendee.email.split('@')[0],
      email: attendee.email
    }));

    try {
      // Initialize search phase
      setLoadingState({
        stage: 'searching',
        person: attendees[0].name,
        progress: 0,
        total: attendees.length
      });

      const results: ExaPersonInfo[] = [];
      for (let i = 0; i < attendees.length; i++) {
        // Update progress before starting each search
        setLoadingState({
          stage: 'searching',
          person: attendees[i].name,
          progress: i,
          total: attendees.length
        });

        // Add a small delay to ensure state updates are visible
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const result = await searchPerson(attendees[i].name);
        results.push(result);
      }

      // Update to show completion of search phase
      setLoadingState({
        stage: 'searching',
        person: attendees[attendees.length - 1].name,
        progress: attendees.length,
        total: attendees.length
      });

      await new Promise(resolve => setTimeout(resolve, 500));
      setSearchResults(results);

      // Initialize summary phase
      setLoadingState({
        stage: 'summarizing',
        person: results[0].name,
        progress: 0,
        total: results.length
      });

      const summariesResults: PersonSummary[] = [];
      for (let i = 0; i < results.length; i++) {
        // Update progress before starting each summary
        setLoadingState({
          stage: 'summarizing',
          person: results[i].name,
          progress: i,
          total: results.length
        });

        // Add a small delay to ensure state updates are visible
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const summary = await generatePersonSummary(results[i]);
        summariesResults.push(summary);
      }

      // Update to show completion of summary phase
      setLoadingState({
        stage: 'summarizing',
        person: results[results.length - 1].name,
        progress: results.length,
        total: results.length
      });

      await new Promise(resolve => setTimeout(resolve, 500));
      setSummaries(summariesResults);
    } catch (error) {
      console.error('Error processing attendees:', error);
    } finally {
      // Add a small delay before clearing loading state
      await new Promise(resolve => setTimeout(resolve, 500));
      setIsSearching(false);
      setLoadingState(undefined);
    }
  };

  const renderSelectedAttendees = () => (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Selected Attendees ({selectedAttendeesDetails.size})
          </h3>
        </div>
        <div className="flex items-center gap-4">
          {selectedAttendeesDetails.size > 0 && (
            <>
              <button
                onClick={handleContinue}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                disabled={isSearching}
              >
                Continue
              </button>
              <button
                className="text-sm text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300"
                onClick={() => {
                  setSelectedAttendees(new Set());
                  setSelectedAttendeesDetails(new Map());
                  setShowResults(false);
                  setSearchResults([]);
                }}
              >
                Clear All
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mb-4">
        <form onSubmit={(e) => {
          e.preventDefault();
          const input = e.currentTarget.elements.namedItem('manualAttendee') as HTMLInputElement;
          if (input.value.trim()) {
            const name = input.value.trim();
            const fakeEventId = `manual-${Date.now()}`;
            const attendee: Attendee = {
              email: `${name.toLowerCase().replace(/\s+/g, '.')}@manual.entry`,
              displayName: name
            };
            handleAttendeeSelect(fakeEventId, attendee);
            input.value = '';
          }
        }}>
          <div className="flex gap-2">
            <input
              type="text"
              name="manualAttendee"
              placeholder="Add attendee by name..."
              className="flex-1 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors"
            >
              Add
            </button>
          </div>
        </form>
      </div>

      {selectedAttendeesDetails.size === 0 ? (
        <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          Select attendees from meetings below or add them manually above
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {Array.from(selectedAttendeesDetails.values()).map(({ eventId, attendee }) => {
            const event = events.find(e => e.id === eventId);
            return (
              <div 
                key={`${eventId}-${attendee.email}`}
                className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800 text-sm"
              >
                <div className="flex flex-col">
                  {renderAttendeeDetails(attendee)}
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {event?.summary}
                  </span>
                </div>
                <button
                  onClick={() => handleAttendeeSelect(eventId, attendee)}
                  className="text-gray-400 hover:text-red-500 transition-colors ml-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {!isSignedIn ? (
        <div className="relative overflow-hidden">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800" />
          
          {/* Content */}
          <div className="relative max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
            <div className="text-center space-y-12">
              {/* Wordmark Logo */}
              <div className="space-y-6">
                <h1 className="text-6xl font-black text-gray-900 dark:text-white tracking-tight">
                  pre<span className="text-blue-600 dark:text-blue-400">cap</span>
                </h1>
                <p className="max-w-2xl mx-auto text-xl text-gray-600 dark:text-gray-300">
                  Transform your meeting preparation with AI-powered research and insights
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 transform transition-all duration-200 hover:scale-105">
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                      <span className="text-2xl">🔍</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Comprehensive Research</h3>
                      <p className="text-gray-600 dark:text-gray-400">Automatically gather and analyze public information</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 transform transition-all duration-200 hover:scale-105">
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                      <span className="text-2xl">📊</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Smart Summaries</h3>
                      <p className="text-gray-600 dark:text-gray-400">AI-generated insights and key information</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 transform transition-all duration-200 hover:scale-105">
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                      <span className="text-2xl">⚡</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Time Saving</h3>
                      <p className="text-gray-600 dark:text-gray-400">Save hours of manual research work</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 transform transition-all duration-200 hover:scale-105">
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                      <span className="text-2xl">🎯</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Meeting Ready</h3>
                      <p className="text-gray-600 dark:text-gray-400">Get key talking points and insights</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-16 flex flex-col items-center">
              <button 
                onClick={handleSignIn}
                className="group relative inline-flex items-center gap-3 px-8 py-4 bg-blue-600 text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
              >
                <div className="w-6 h-6 text-blue-200 group-hover:text-white transition-colors">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.383 0 0 5.383 0 12s5.383 12 12 12c6.616 0 12-5.383 12-12S18.616 0 12 0zm0 2c5.535 0 10 4.465 10 10s-4.465 10-10 10S2 17.535 2 12 6.465 2 12 2zm0 4a6 6 0 100 12 6 6 0 000-12zm0 2a4 4 0 110 8 4 4 0 010-8z"/>
                  </svg>
                </div>
                <span className="text-lg font-medium">Connect Google Calendar</span>
              </button>
              
              <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                Securely connect your calendar to start preparing for your meetings
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Simple wordmark in top right */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-end py-4">
              <div className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                pre<span className="text-blue-600 dark:text-blue-400">cap</span>
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-8">
            {renderSelectedAttendees()}

            {showResults ? (
              <ExaResults 
                results={searchResults}
                summaries={summaries}
                isLoading={isSearching}
                loadingState={loadingState}
              />
            ) : (
              <div className="space-y-6">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                      <div className="flex items-center gap-4">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Calendar</h2>
                        {getDisplayedEvents().length > 0 && (
                          <button
                            onClick={toggleCalendarView}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors"
                          >
                            {isCalendarCollapsed ? (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                                <span>Show Calendar</span>
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                </svg>
                                <span>Hide Calendar</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-700 rounded-lg p-2">
                        <button
                          onClick={() => handleMonthChange(false)}
                          className="p-2 hover:bg-white dark:hover:bg-gray-600 rounded-lg transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <span className="text-lg font-medium min-w-[140px] text-center">
                          {format(selectedDate, 'MMMM yyyy')}
                        </span>
                        <button
                          onClick={() => handleMonthChange(true)}
                          className="p-2 hover:bg-white dark:hover:bg-gray-600 rounded-lg transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {!isCalendarCollapsed && (
                    <div className="p-6">
                      <CalendarGrid
                        events={events}
                        selectedDate={selectedDate}
                        selectedWeek={selectedWeek}
                        onDateSelect={handleDateSelect}
                        onWeekSelect={handleWeekSelect}
                      />
                    </div>
                  )}
                </div>

                {getDisplayedEvents().length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                        </svg>
                        {getEventsTitle()}
                      </h3>
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                      {getDisplayedEvents()
                        .sort((a, b) => new Date(a.start.dateTime).getTime() - new Date(b.start.dateTime).getTime())
                        .map((event) => (
                          <div key={event.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                            <EventCard
                              event={event}
                              onAttendeeSelect={handleAttendeeSelect}
                              selectedAttendees={selectedAttendees}
                            />
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}; 