import { NextResponse } from 'next/server';

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

const SUMMARY_PROMPT = `Please analyze the following text about a person and provide a professional summary. For each key point in your summary, reference the source by including a [Source X] tag, where X corresponds to the numbered source in the list below.

Focus on:
1. Their current role and company
2. Key previous experience and roles
3. Notable achievements and expertise
4. Educational background (if mentioned)
5. Any relevant projects or initiatives they're working on
6. Any interesting facts that will help in a meeting with this person

Format your response with inline source references like this example:
"John is currently the CEO of TechCorp [Source 1]. Previously, he worked at Google as a Senior Engineer [Source 2], where he led the development of..."

Here are the sources:
{{SOURCES}}

Text to analyze:
{{TEXT}}`;

export async function POST(request: Request) {
  try {
    const { personInfo }: { personInfo: PersonInfo } = await request.json();
    
    // Format sources list
    const sourcesList = personInfo.searchResults
      .map((result: SearchResult, index: number) => `[Source ${index + 1}] ${result.title} (${result.url})`)
      .join('\n');
    
    // Combine all text with source markers
    const combinedText = personInfo.searchResults
      .map((result: SearchResult, index: number) => `[Source ${index + 1}]\n${result.text}`)
      .join('\n\n');
    
    // Replace placeholders in prompt
    const finalPrompt = SUMMARY_PROMPT
      .replace('{{SOURCES}}', sourcesList)
      .replace('{{TEXT}}', combinedText);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a professional business analyst creating detailed summaries about people for meeting preparation. Include source references for all key information.'
          },
          {
            role: 'user',
            content: finalPrompt
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error('OpenAI API Error Response:', errorData);
      throw new Error(
        errorData?.error?.message || 
        `OpenAI API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    
    return NextResponse.json({
      name: personInfo.name,
      summary: data.choices[0].message.content,
      sources: personInfo.searchResults.map((result: SearchResult) => ({
        title: result.title,
        url: result.url
      }))
    });
  } catch (error) {
    console.error('Error in summary generation:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate summary' },
      { status: 500 }
    );
  }
} 