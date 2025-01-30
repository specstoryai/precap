import React, { useState, useEffect } from 'react';
import { createMeetingDoc } from '../services/docsService';

interface SearchResult {
  title: string;
  url: string;
  publishedDate: string | null;
  author: string | null;
  summary: string;
  text: string;
}

interface PersonInfo {
  name: string;
  searchResults: SearchResult[];
  error?: string;
}

interface PersonSummary {
  name: string;
  summary: string;
  sources?: Array<{ title: string; url: string }>;
  error?: string;
}

interface LoadingState {
  stage: 'searching' | 'analyzing' | 'summarizing';
  person?: string;
  progress: number;
  total: number;
}

interface ExaResultsProps {
  results: PersonInfo[];
  summaries: PersonSummary[];
  isLoading: boolean;
  loadingState?: LoadingState;
}

export const ExaResults: React.FC<ExaResultsProps> = ({ results, summaries, isLoading, loadingState }) => {
  const [creatingDocs, setCreatingDocs] = useState<{ [key: string]: boolean }>({});
  const [docUrls, setDocUrls] = useState<{ [key: string]: string }>({});
  const [progressWidth, setProgressWidth] = useState(0);

  useEffect(() => {
    if (loadingState) {
      const targetWidth = (loadingState.progress / loadingState.total) * 100;
      setProgressWidth(prev => {
        return targetWidth > prev ? targetWidth : prev;
      });
    } else {
      setProgressWidth(0);
    }
  }, [loadingState]);

  const handleCreateDoc = async (personSummary: PersonSummary) => {
    try {
      setCreatingDocs(prev => ({ ...prev, [personSummary.name]: true }));
      const docUrl = await createMeetingDoc(personSummary);
      setDocUrls(prev => ({ ...prev, [personSummary.name]: docUrl }));
      window.open(docUrl, '_blank');
    } catch (error) {
      console.error('Error creating doc:', error);
    } finally {
      setCreatingDocs(prev => ({ ...prev, [personSummary.name]: false }));
    }
  };

  const renderSummaryWithLinks = (summary: string, sources?: Array<{ title: string; url: string }>) => {
    if (!sources) return summary;

    // Split the summary by source tags and create an array of text and links
    let parts: React.ReactNode[] = [summary];
    
    sources.forEach((source, index) => {
      const sourceTag = `[Source ${index + 1}]`;
      parts = parts.flatMap((part, partIndex) => {
        if (typeof part !== 'string') return [part];
        
        const split = part.split(sourceTag);
        if (split.length === 1) return [split[0]];
        
        return split.reduce((acc: React.ReactNode[], text, i) => {
          if (i === 0) return [text];
          return [
            ...acc,
            <a
              key={`source-${index}-${partIndex}-${i}`}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
              title={source.title}
            >
              {sourceTag}
            </a>,
            text
          ];
        }, []);
      });
    });

    return (
      <div className="prose dark:prose-invert max-w-none">
        {parts}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8">
        <div className="flex flex-col items-center space-y-6">
          <div className="flex items-center gap-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <div className="text-lg font-medium text-gray-900 dark:text-white">
              {loadingState?.stage === 'searching' && (
                <div className="flex items-center gap-2">
                  <span>Searching for information about</span>
                  <span className="text-blue-600 dark:text-blue-400">{loadingState.person}</span>
                </div>
              )}
              {loadingState?.stage === 'analyzing' && (
                <div className="flex items-center gap-2">
                  <span>Analyzing search results for</span>
                  <span className="text-blue-600 dark:text-blue-400">{loadingState.person}</span>
                </div>
              )}
              {loadingState?.stage === 'summarizing' && (
                <div className="flex items-center gap-2">
                  <span>Generating professional summary for</span>
                  <span className="text-blue-600 dark:text-blue-400">{loadingState.person}</span>
                </div>
              )}
            </div>
          </div>

          <div className="w-full max-w-md">
            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
              <span>Progress</span>
              <span>{loadingState ? `${loadingState.progress} of ${loadingState.total}` : ''}</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
              <div 
                className="bg-blue-500 h-2.5 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressWidth}%` }}
              ></div>
            </div>
          </div>

          <div className="text-sm text-gray-600 dark:text-gray-400 text-center max-w-md">
            {loadingState?.stage === 'searching' && (
              <div className="space-y-1">
                <p className="font-medium">Phase 1: Information Gathering</p>
                <p>Searching through professional networks, news articles, and public databases...</p>
              </div>
            )}
            {loadingState?.stage === 'analyzing' && (
              <div className="space-y-1">
                <p className="font-medium">Phase 2: Content Analysis</p>
                <p>Processing search results to identify key professional details and achievements...</p>
              </div>
            )}
            {loadingState?.stage === 'summarizing' && (
              <div className="space-y-1">
                <p className="font-medium">Phase 3: Summary Generation</p>
                <p>Using AI to create a comprehensive professional background summary...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {results.map((person) => {
          const personSummary = summaries.find(s => s.name === person.name);
          
          return (
            <div 
              key={person.name}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden flex flex-col h-full"
            >
              <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {person.name}
                  </h3>
                  {personSummary && !personSummary.error && (
                    <button
                      onClick={() => handleCreateDoc(personSummary)}
                      disabled={creatingDocs[person.name]}
                      className="inline-flex items-center gap-2 px-3 py-1 text-sm bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg transition-colors"
                    >
                      {creatingDocs[person.name] ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                          Creating...
                        </>
                      ) : docUrls[person.name] ? (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          View Notes
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Create Notes
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              <div className="p-4 flex-1 overflow-auto">
                {personSummary?.error ? (
                  <div className="text-red-500 dark:text-red-400 mb-4">
                    Error generating summary: {personSummary.error}
                  </div>
                ) : personSummary?.summary ? (
                  <div className="prose dark:prose-invert max-w-none mb-6">
                    <div className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                      {renderSummaryWithLinks(personSummary.summary, personSummary.sources)}
                    </div>
                  </div>
                ) : null}

                <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
                    Source Materials
                  </h4>
                  
                  {person.error ? (
                    <div className="text-red-500 dark:text-red-400">
                      Error: {person.error}
                    </div>
                  ) : person.searchResults.length === 0 ? (
                    <div className="text-gray-500 dark:text-gray-400">
                      No results found
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {person.searchResults.map((result, index) => (
                        <div 
                          key={index}
                          className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-2"
                        >
                          <a 
                            href={result.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-base font-medium text-blue-600 dark:text-blue-400 hover:underline line-clamp-2"
                          >
                            {result.title}
                          </a>
                          
                          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                            {result.publishedDate && (
                              <span>{new Date(result.publishedDate).toLocaleDateString()}</span>
                            )}
                            {result.author && (
                              <>
                                <span>•</span>
                                <span>{result.author}</span>
                              </>
                            )}
                          </div>

                          <div className="text-sm text-gray-600 dark:text-gray-300">
                            <p className="line-clamp-3">{result.summary}</p>
                          </div>

                          <button
                            onClick={() => {
                              const el = document.createElement('textarea');
                              el.value = result.text;
                              document.body.appendChild(el);
                              el.select();
                              document.execCommand('copy');
                              document.body.removeChild(el);
                            }}
                            className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            Copy full text
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}; 