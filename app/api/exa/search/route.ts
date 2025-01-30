import { NextResponse } from 'next/server';

interface ExaApiResult {
  title: string;
  url: string;
  publishedDate: string | null;
  author: string | null;
  text: string;
  summary: string;
}

interface ExaApiResponse {
  results: ExaApiResult[];
}

export async function POST(request: Request) {
  try {
    const { name } = await request.json();
    const apiKey = process.env.EXA_API_KEY;

    if (!apiKey) {
      console.error('❌ Missing EXA_API_KEY environment variable');
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const searchQuery = `${name} professional background experience career`;
    console.log('\n🔍 Searching Exa for:', name);
    console.log('📤 Query:', searchQuery);
    console.log('🔑 API Key available:', !!apiKey);
    
    try {
      const requestBody = {
        query: searchQuery,
        numResults: 5,
        type: 'keyword',
        contents: {
          text: true,
          summary: {
            query: "Summarize this person's professional background and experience"
          }
        }
      };
      
      console.log('📦 Request body:', JSON.stringify(requestBody, null, 2));

      const response = await fetch('https://api.exa.ai/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify(requestBody)
      });

      console.log('📡 Exa API Status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Exa API Error Response:', errorText);
        return NextResponse.json({ error: `Exa API error: ${errorText}` }, { status: response.status });
      }

      const data: ExaApiResponse = await response.json();
      console.log('\n✅ Received results for:', name);
      console.log('\n📊 Full Response Data:');
      console.log(JSON.stringify(data, null, 2));
      console.log('\n🔍 First Result Sample:');
      if (data.results[0]) {
        console.log('Title:', data.results[0].title);
        console.log('URL:', data.results[0].url);
        console.log('Published:', data.results[0].publishedDate);
        console.log('Author:', data.results[0].author);
        console.log('Summary:', data.results[0].summary);
        console.log('\nText Preview:', data.results[0].text.substring(0, 500) + '...');
      }
      console.log('\n-------------------\n');
      
      return NextResponse.json({
        name,
        searchResults: data.results.map((result) => ({
          title: result.title,
          url: result.url,
          publishedDate: result.publishedDate,
          author: result.author,
          summary: result.summary,
          text: result.text
        }))
      });
    } catch (error) {
      console.error('❌ Error making Exa API request:', error);
      return NextResponse.json({ error: 'Failed to make Exa API request' }, { status: 500 });
    }
  } catch (error) {
    console.error('❌ Error processing request:', error);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
} 