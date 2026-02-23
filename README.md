# DepGuard AI

DepGuard AI is a dependency management platform designed for modern development teams. It helps you track, manage, and analyze your project's dependencies with AI-powered changelog summaries, ensuring you understand the impact of every update. The application is built with Next.js and Supabase, providing a robust and scalable solution for dependency intelligence.

## Features

- **Automated Dependency Scanning**: Scan dependencies from public GitHub repositories or by uploading a `package.json` file.
- **AI-Powered Analysis**: Leverage OpenAI to generate concise, human-readable summaries of what has changed between dependency versions, focusing on breaking changes, new features, and security fixes.
- **Team Collaboration**: A multi-tenant architecture allows you to create a company, invite team members via email, and assign roles (`owner`, `project_lead`, `developer`, `tester`).
- **Project Management**: Organize your work into distinct projects. Assign members to specific projects with appropriate roles (`project_lead`, `developer`).
- **Comprehensive Dashboard**: Get an at-a-glance overview of your organization's dependency health, including statistics for outdated packages, security vulnerabilities, and recent project activities.
- **Update Classification**: Automatically classifies available updates as `major`, `minor`, or `patch` based on semantic versioning to help prioritize updates.
- **Secure by Design**: Utilizes Supabase's Row Level Security (RLS) to ensure users can only access data belonging to their company and assigned projects.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI**: [shadcn/ui](https://ui.shadcn.com/)
- **Backend & Database**: [Supabase](https://supabase.io/) (Auth, Postgres, Storage)
- **AI**: [OpenAI API](https://openai.com/) or [Google AI Studio](https://aistudio.google.com/)
- **Email**: [Resend](https://resend.com/) for sending invitations.

## Getting Started

Follow these instructions to set up and run the project locally.

### Prerequisites

- Node.js (v20.9.0 or later)
- pnpm (or your preferred package manager)
- A Supabase account
- An OpenAI API key
- A Resend API key (optional, for sending email invitations)

### 1. Clone the Repository

```bash
git clone https://github.com/jellev00/depguardai.git
cd depguardai
```

### 2. Install Dependencies

```bash
npm install --legacy-peer-deps
```

### 3. Set Up Environment Variables

Create a `.env` file in the root of the project and add the following environment variables. You can get the Supabase URL and anon key from your project's API settings.

```bash
# Email (Optional - invitations can be accepted via a direct link)
RESEND_API_KEY=YOUR_RESEND_API_KEY

# Supabase
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

#### 3.1 AI Model Configuration (Required)

DepGuard AI supports two AI providers:

OpenAI

Google (via Google Generative AI)

In your `.env` file, you must configure only one of the following:

```bash
# Option 1: OpenAI
OPENAI_API_KEY=YOUR_OPENAI_API_KEY

# Option 2: Google Generative AI
GOOGLE_GENERATIVE_AI_API_KEY=YOUR_GOOGLE_GENERATIVE_AI_API_KEY
```

⚠️ Only configure the provider you intend to use.

### 4. Configure the AI Model in the Codebase

In addition to setting your API key, you must also configure which model is used in the code.

Open the following file:

src/mastra/agents/dependency-agent.ts

Inside this file, locate the MODEL constant. You will see two options defined.

Depending on which API key you configured in .env.local, you must comment out one of the MODEL definitions.

Example:

```javascript
// For OpenAI
const MODEL = "openai:gpt-4o-mini";

// For Google Generative AI
// const MODEL = "google:gemini-1.5-pro"
```

If you are using Google instead:

```javascript
// For OpenAI
// const MODEL = "openai:gpt-4o-mini"

// For Google Generative AI
const MODEL = "google:gemini-1.5-pro";
```

<aside>
✅ Make sure that:

- Your `.env.local` API key matches the selected provider.
- Only one `MODEL` constant is active (the other must be commented out).
</aside>

### 5. Set Up Supabase Database

1.  Navigate to your Supabase project dashboard.
2.  Go to the **SQL Editor**.
3.  Click on **New query**.
4.  Copy the entire content of `scripts/001_create_schema.sql` and paste it into the editor.
5.  Click **Run** to execute the script. This will create all the necessary tables, roles, policies, and triggers.

### 6. Run the Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`. You can now sign up, create a company, and start managing your projects.

## Project Structure

- `src/app/api/`: Contains all API routes for server-side logic, such as scanning projects, analyzing dependencies, and handling invitations.
- `src/app/dashboard/`: The main application views after a user is logged in, including the overview, projects, and team management pages.
- `src/app/(auth|onboarding|invite)/`: Pages for authentication, user onboarding (company creation), and accepting invitations.
- `src/components/`:
  - `dashboard/`: High-level components that compose the dashboard pages.
  - `ui/`: Reusable UI components from shadcn/ui.
- `src/lib/`:
  - `supabase/`: Supabase client, server, and middleware configurations.
  - `utils.ts`: Utility functions like `cn` for combining class names.
- `scripts/`: Contains SQL scripts for database schema setup.
