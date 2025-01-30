# Precap

Precap is an AI-powered meeting preparation tool that automatically researches attendees and generates comprehensive briefing materials before your meetings. It seamlessly integrates with Google Calendar to transform how you prepare for important meetings.

The intent for this app and Cursor responses is stored in: https://share.specstory.com/stories/bdd54f16-06ef-4230-851d-fc1da61ba2fc

## Core Features

- 🔄 **Google Calendar Integration**: Seamlessly connects with your calendar to fetch upcoming meetings and attendees
- 🔍 **Automated Research**: Uses Exa.ai to gather comprehensive, up-to-date information about meeting participants
- 🤖 **AI-Powered Summaries**: Leverages GPT-4o to generate concise, professional summaries about each attendee
- 📊 **Rich Attendee Profiles**: Displays enhanced contact information including profile photos, job titles, and company info
- 📝 **Source Attribution**: All research includes linked citations to original sources
- 📄 **Google Docs Integration**: Generate and save meeting briefs directly to Google Docs

## Integrated Services

Precap integrates with several external services:

- **Google Calendar API**: For fetching calendar events and attendee information
- **Google People API**: For enhanced contact details and profile information
- **Google Drive API**: For creating and managing meeting brief documents
- **Google Docs API**: For generating formatted meeting briefs
- **Exa.ai**: For comprehensive web research about attendees (get key at https://exa.ai)
- **OpenAI GPT-4**: For generating intelligent summaries of research findings

## Installation

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Google Cloud Platform account with the following APIs enabled:
  - Google Calendar API
  - Google People API
  - Google Drive API
  - Google Docs API
- OpenAI API key (for GPT-4 summaries)
- Exa.ai API key (for research)

### Setup Instructions

1. Clone the repository:
   ```bash
   git clone https://github.com/specstoryai/precap.git
   cd precap
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Create a `.env` file in the root directory:
   ```env
   # Google API credentials
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
   OPENAI_API_KEY=your_openai_api_key
   EXA_API_KEY=your_exa_api_key
   ```

4. Set up Google Cloud Platform:
   - Create a new project in Google Cloud Console
   - Enable the following APIs:
     - Google Calendar API
     - Google People API
     - Google Drive API
     - Google Docs API
   - Create OAuth 2.0 credentials and note the Client ID and API Key
   - Configure the OAuth consent screen with the following scopes:
     - `https://www.googleapis.com/auth/calendar.readonly`
     - `https://www.googleapis.com/auth/contacts.readonly`
     - `https://www.googleapis.com/auth/userinfo.profile`
     - `https://www.googleapis.com/auth/documents`
     - `https://www.googleapis.com/auth/drive.file`

5. Run the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. Click "Connect Google Calendar" to authenticate with your Google account
2. Browse your calendar and select meeting attendees you want to research
3. Click "Continue" to start the research process
4. View comprehensive profiles and AI-generated summaries for each attendee
5. All information includes source links for verification

## Development

The project is built with:

- Next.js for the framework
- React for the UI
- Tailwind CSS for styling
- TypeScript for type safety

### Project Structure

```
precap/
├── src/
│   ├── components/     # React components
│   ├── services/       # API integration services
│   ├── styles/         # Global styles
│   └── pages/         # Next.js pages
├── public/            # Static assets
└── package.json       # Dependencies and scripts
```

### Key Components

- `Calendar.tsx`: Main calendar interface and attendee selection
- `ExaResults.tsx`: Displays research results and summaries
- `summaryService.ts`: Handles GPT-4 summary generation
- `exaService.ts`: Manages Exa.ai research integration

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details. 