interface PersonSummary {
  name: string;
  summary: string;
  sources?: Array<{ title: string; url: string }>;
  error?: string;
}

interface GoogleApiError {
  result: {
    error: {
      code: number;
      message: string;
      status: string;
    };
  };
}

interface GoogleApiErrorResponse {
  status: number;
  result: {
    error: {
      code: number;
      message: string;
      status: string;
    };
  };
}

function isGoogleApiError(error: unknown): error is GoogleApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'result' in (error as Record<string, unknown>) &&
    typeof (error as Record<string, unknown>).result === 'object' &&
    'error' in ((error as Record<string, unknown>).result as Record<string, unknown>)
  );
}

async function loadDocsApi(): Promise<void> {
  try {
    // Wait for gapi client to be loaded
    await new Promise<void>((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 50;
      
      if (window.gapi?.client) {
        resolve();
      } else {
        const checkGapi = setInterval(() => {
          attempts++;
          if (window.gapi?.client) {
            clearInterval(checkGapi);
            resolve();
          } else if (attempts >= maxAttempts) {
            clearInterval(checkGapi);
            reject(new Error('Timeout waiting for Google API client to load'));
          }
        }, 100);
      }
    });

    // Check if we have a valid token
    const token = window.gapi.auth.getToken();
    if (!token) {
      throw new Error('Not authenticated with Google');
    }
    console.log('🔑 Auth token found:', token.access_token.substring(0, 10) + '...');

    // Load the Docs API if not already loaded
    if (!window.gapi.client.docs) {
      console.log('📚 Loading Google Docs API...');
      try {
        await window.gapi.client.load('docs', 'v1');
        console.log('✅ Google Docs API loaded successfully');
        
        // Verify API is accessible
        try {
          const response = await fetch('https://docs.googleapis.com/v1/documents/test', {
            headers: {
              'Authorization': `Bearer ${token.access_token}`
            }
          });
          
          if (response.status === 403) {
            const errorData = await response.json() as GoogleApiErrorResponse;
            throw new Error(`Google Docs API access denied: ${errorData.result.error.message}`);
          }
          // 404 is expected since we're testing with a non-existent document
          if (response.status !== 404) {
            const errorData = await response.json() as GoogleApiErrorResponse;
            throw new Error(`Unexpected API response: ${errorData.result.error.message}`);
          }
        } catch (error) {
          if (isGoogleApiError(error)) {
            throw new Error(`Google API Error: ${error.result.error.message}`);
          }
          if (error instanceof Error) {
            throw error;
          }
          throw new Error('Unknown error occurred while accessing Google Docs API');
        }
      } catch (loadError) {
        console.error('❌ Error loading Google Docs API:', loadError);
        throw new Error('Failed to load Google Docs API. Please ensure the API is enabled in your Google Cloud Console.');
      }
    } else {
      console.log('✅ Google Docs API already loaded');
    }
  } catch (error) {
    console.error('❌ Error in loadDocsApi:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to load Google Docs API');
  }
}

// Add type definitions for Google Docs API requests
interface InsertTextRequest {
  insertText: {
    location: { index: number };
    text: string;
  };
}

interface UpdateParagraphStyleRequest {
  updateParagraphStyle: {
    range: { 
      startIndex: number;
      endIndex: number;
    };
    paragraphStyle: {
      namedStyleType: string;
      spaceBelow?: { 
        magnitude: number;
        unit: string;
      };
    };
    fields: string;
  };
}

interface UpdateTextStyleRequest {
  updateTextStyle: {
    range: {
      startIndex: number;
      endIndex: number;
    };
    textStyle: {
      link?: { url: string };
      fontSize?: { magnitude: number; unit: string };
      foregroundColor?: {
        color: {
          rgbColor: {
            blue: number;
            red: number;
            green: number;
          };
        };
      };
    };
    fields: string;
  };
}

type DocumentRequest = InsertTextRequest | UpdateParagraphStyleRequest | UpdateTextStyleRequest;

export async function createMeetingDoc(personSummary: PersonSummary): Promise<string> {
  try {
    console.log('🚀 Starting document creation for:', personSummary.name);
    await loadDocsApi();

    const token = window.gapi.auth.getToken();
    if (!token) {
      throw new Error('Not authenticated with Google');
    }

    // Create a new document using fetch
    console.log('📄 Creating new document...');
    const createResponse = await fetch('https://docs.googleapis.com/v1/documents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: `Meeting Notes - ${personSummary.name}`
      })
    });

    if (!createResponse.ok) {
      const errorData = await createResponse.json();
      console.error('Create document error:', errorData);
      throw new Error(`Failed to create document: ${errorData.error?.message || createResponse.statusText}`);
    }

    const doc = await createResponse.json();
    console.log('📝 Document created with ID:', doc.documentId);
    const documentId = doc.documentId;

    // Format the sources list with proper formatting
    const sourcesList = personSummary.sources
      ?.map((source, index) => ({
        bullet: `${index + 1}.`,
        text: `${source.title}`,
        url: source.url
      })) || [];

    // Calculate the title text first to get accurate length
    const titleText = `${personSummary.name} ${new Date().toLocaleDateString()} - Meeting Notes\n`;
    const titleLength = titleText.length;
    
    // Initialize currentIndex to track position
    let currentIndex = 1;  // Start at 1 since Google Docs indices start at 1
    
    // Prepare the document content with professional formatting
    const requests: DocumentRequest[] = [
      // Title
      {
        insertText: {
          location: { index: currentIndex },
          text: titleText
        }
      },
      {
        updateParagraphStyle: {
          range: { 
            startIndex: currentIndex, 
            endIndex: currentIndex + titleLength
          },
          paragraphStyle: {
            namedStyleType: 'HEADING_1',
            spaceBelow: { magnitude: 10, unit: 'PT' }
          },
          fields: 'namedStyleType,spaceBelow'
        }
      }
    ];

    currentIndex += titleLength;

    // Key Takeaways Section
    const keyTakeawaysText = 'Key Takeaways\n\n';
    requests.push(
      {
        insertText: {
          location: { index: currentIndex },
          text: keyTakeawaysText
        }
      },
      {
        updateParagraphStyle: {
          range: { 
            startIndex: currentIndex,
            endIndex: currentIndex + keyTakeawaysText.length - 1  // -1 to not include the extra newline in styling
          },
          paragraphStyle: {
            namedStyleType: 'HEADING_2',
            spaceBelow: { magnitude: 10, unit: 'PT' }
          },
          fields: 'namedStyleType,spaceBelow'
        }
      }
    );

    currentIndex += keyTakeawaysText.length;

    // Bullet points for key takeaways
    const bulletPoints = '• \n• \n• \n\n';
    requests.push({
      insertText: {
        location: { index: currentIndex },
        text: bulletPoints
      }
    });

    currentIndex += bulletPoints.length;

    // Action Items Section
    const actionItemsText = 'Action Items\n\n';
    requests.push(
      {
        insertText: {
          location: { index: currentIndex },
          text: actionItemsText
        }
      },
      {
        updateParagraphStyle: {
          range: { 
            startIndex: currentIndex,
            endIndex: currentIndex + actionItemsText.length - 1
          },
          paragraphStyle: {
            namedStyleType: 'HEADING_2',
            spaceBelow: { magnitude: 10, unit: 'PT' }
          },
          fields: 'namedStyleType,spaceBelow'
        }
      }
    );

    currentIndex += actionItemsText.length;

    // Bullet points for action items
    const actionBullets = '• \n• \n\n';
    requests.push({
      insertText: {
        location: { index: currentIndex },
        text: actionBullets
      }
    });

    currentIndex += actionBullets.length;

    // Professional Summary Section
    const summaryHeaderText = 'Professional Summary\n\n';
    requests.push(
      {
        insertText: {
          location: { index: currentIndex },
          text: summaryHeaderText
        }
      },
      {
        updateParagraphStyle: {
          range: { 
            startIndex: currentIndex,
            endIndex: currentIndex + summaryHeaderText.length - 1
          },
          paragraphStyle: {
            namedStyleType: 'HEADING_2',
            spaceBelow: { magnitude: 10, unit: 'PT' }
          },
          fields: 'namedStyleType,spaceBelow'
        }
      }
    );

    currentIndex += summaryHeaderText.length;

    // Add the summary text
    const summaryText = personSummary.summary + '\n\n';
    requests.push(
      {
        insertText: {
          location: { index: currentIndex },
          text: summaryText
        }
      },
      {
        updateParagraphStyle: {
          range: { 
            startIndex: currentIndex,
            endIndex: currentIndex + summaryText.length
          },
          paragraphStyle: {
            namedStyleType: 'NORMAL_TEXT',
            spaceBelow: { magnitude: 10, unit: 'PT' }
          },
          fields: 'namedStyleType,spaceBelow'
        }
      }
    );

    currentIndex += summaryText.length;

    // Sources Section
    const sourcesHeaderText = 'Sources\n\n';
    requests.push(
      {
        insertText: {
          location: { index: currentIndex },
          text: sourcesHeaderText
        }
      },
      {
        updateParagraphStyle: {
          range: { 
            startIndex: currentIndex,
            endIndex: currentIndex + sourcesHeaderText.length - 1
          },
          paragraphStyle: {
            namedStyleType: 'HEADING_2',
            spaceBelow: { magnitude: 10, unit: 'PT' }
          },
          fields: 'namedStyleType,spaceBelow'
        }
      }
    );

    currentIndex += sourcesHeaderText.length;

    // Add sources with links
    sourcesList.forEach(source => {
      const bulletText = `${source.bullet} `;
      const sourceText = `${source.text}\n`;
      
      requests.push(
        {
          insertText: {
            location: { index: currentIndex },
            text: bulletText
          }
        }
      );
      
      currentIndex += bulletText.length;
      
      requests.push(
        {
          insertText: {
            location: { index: currentIndex },
            text: sourceText
          }
        },
        {
          updateTextStyle: {
            range: { 
              startIndex: currentIndex,
              endIndex: currentIndex + source.text.length
            },
            textStyle: {
              link: { url: source.url },
              fontSize: { magnitude: 12, unit: 'PT' },
              foregroundColor: { color: { rgbColor: { blue: 0.8, red: 0.13, green: 0.13 } } }
            },
            fields: 'link,fontSize,foregroundColor'
          }
        }
      );
      
      currentIndex += sourceText.length;
    });

    // Update the document content using fetch
    console.log('📝 Updating document content...');
    const updateResponse = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests })
    });

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json();
      console.error('Update document error:', errorData);
      throw new Error(`Failed to update document: ${errorData.error?.message || updateResponse.statusText}`);
    }

    console.log('✅ Document updated successfully');
    const docUrl = `https://docs.google.com/document/d/${documentId}/edit`;
    console.log('🔗 Document URL:', docUrl);
    return docUrl;
  } catch (error) {
    console.error('❌ Error creating Google Doc:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('Not authenticated')) {
        throw new Error('Please ensure you are signed in to Google and have granted the necessary permissions');
      }
      throw error;
    }
    
    throw new Error('Failed to create meeting notes document');
  }
} 