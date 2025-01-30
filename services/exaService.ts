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

export async function searchPerson(name: string): Promise<ExaPersonInfo> {
  try {
    console.log('🔍 Searching for:', name);
    const response = await fetch('http://localhost:3000/api/exa/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name })
    });

    console.log('📡 API Response Status:', response.status, response.statusText);

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ API Error Response:', errorData);
      try {
        const jsonError = JSON.parse(errorData);
        throw new Error(jsonError.error || `API error: ${response.statusText}`);
      } catch {
        throw new Error(`API error: ${errorData}`);
      }
    }

    const data = await response.json();
    console.log('✅ Received data for:', name);
    return data;
  } catch (error) {
    console.error('❌ Error searching person:', error);
    return {
      name,
      searchResults: [],
      error: error instanceof Error ? error.message : 'Failed to search for person'
    };
  }
}

export async function searchAllAttendees(
  attendees: Array<{ name: string; email: string }>,
): Promise<ExaPersonInfo[]> {
  return Promise.all(
    attendees.map(({ name }) => searchPerson(name))
  );
} 