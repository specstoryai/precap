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

export async function generatePersonSummary(personInfo: ExaPersonInfo): Promise<PersonSummary> {
  try {
    console.log(`🤖 Requesting summary for ${personInfo.name}`);
    
    const response = await fetch('/api/summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ personInfo })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(
        errorData?.error || 
        `API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    console.log(`✅ Received summary for ${personInfo.name}`);
    return data;
  } catch (error) {
    console.error('❌ Error generating summary:', error);
    return {
      name: personInfo.name,
      summary: '',
      error: error instanceof Error ? error.message : 'Failed to generate summary'
    };
  }
}

export async function generateAllSummaries(
  people: ExaPersonInfo[]
): Promise<PersonSummary[]> {
  return Promise.all(
    people.map(person => generatePersonSummary(person))
  );
} 