# SMMP - Social Media Management Platform

A social media management platform built with Next.js, featuring Threads integration and multi-platform publishing capabilities.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with TypeORM
- **Authentication**: JWT with Passport
- **Styling**: Tailwind CSS 4
- **Testing**: Vitest + Testing Library

## Features

- **User Authentication**: Register, login, and JWT-based session management
- **Channel Management**: Connect and manage Threads accounts
- **Post Publishing**: Create and publish posts to Threads
- **OAuth Integration**: Secure OAuth 2.0 flow for Threads API
- **Token Management**: Automatic refresh token handling

## Prerequisites

- Node.js 20+
- PostgreSQL database
- Threads App credentials ([Meta Developer Portal](https://developers.facebook.com))

## Environment Variables

Create a `.env` file in the project root:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/smmp

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# Threads API
THREADS_APP_ID=your-app-id
THREADS_APP_SECRET=your-app-secret
THREADS_REDIRECT_URI=https://threads-sample.meta:8000/api/channels/threads/callback

# API
NEXT_PUBLIC_API_URL=https://threads-sample.meta:8000

# Hostname (for HTTPS dev server)
HOSTNAME=threads-sample.meta
PORT=8000
```

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup SSL Certificates (for HTTPS)

This project uses HTTPS for local development to support OAuth callbacks.

#### Install mkcert

```bash
# macOS
brew install mkcert
brew install nss  # Firefox support

# Generate local CA
mkcert -install
```

#### Generate Certificates

```bash
cd cert
mkcert threads-sample.meta localhost 127.0.0.1
```

#### Update /etc/hosts

Add the local domain to your hosts file:

```bash
# macOS/Linux
sudo sh -c 'echo "127.0.0.1 threads-sample.meta" >> /etc/hosts'
```

### 3. Initialize Database

```bash
npm run build
# TypeORM will auto-create tables on first run
```

### 4. Start Development Server

```bash
# HTTPS server (recommended for OAuth)
npm run dev:https

# Or HTTP server
npm run dev
```

Visit [https://threads-sample.meta:8000](https://threads-sample.meta:8000)

## API Routes

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get JWT token
- `GET /api/auth/me` - Get current user info

### Channels
- `GET /api/channels` - List connected channels
- `GET /api/channels/threads/connect` - Get Threads OAuth URL
- `GET /api/channels/threads/callback` - OAuth callback handler
- `DELETE /api/channels/:id` - Disconnect a channel
- `POST /api/channels/:id` - Refresh channel token

### Posts
- `POST /api/posts/:id/publish/threads` - Publish post to Threads

## Project Structure

```
src/
├── app/
│   ├── api/           # API routes
│   ├── channels/      # Channel management pages
│   ├── login/         # Login page
│   ├── posts/         # Post creation pages
│   └── register/      # Registration page
├── contexts/          # React contexts
├── database/          # Database entities
├── lib/
│   ├── api/          # API client functions
│   ├── services/     # Business logic
│   └── types/        # TypeScript types
└── middleware/       # Auth middleware
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start HTTP dev server |
| `npm run dev:https` | Start HTTPS dev server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run type-check` | Check TypeScript types |
| `npm run test` | Run tests |

## Threads API Integration

### Supported Features

- Text posts
- Image posts (coming soon)
- Video posts (coming soon)
- Container-based publishing
- Token refresh

### OAuth Flow

1. User clicks "Connect Threads"
2. Redirects to Threads authorization URL
3. User grants permissions
4. Callback exchanges code for access token
5. Long-lived token (60 days) stored in database
6. Refresh token stored for automatic renewal

## Troubleshooting

### SSL Certificate Warnings

When first accessing `https://threads-sample.meta:8000`, your browser may show a warning. This is expected for self-signed certificates. Click "Advanced" → "Proceed to site".

### Port Already in Use

If port 8000 is in use, you can change it:

```bash
PORT=3001 npm run dev:https
```

### Database Connection Issues

Ensure PostgreSQL is running and the `DATABASE_URL` is correct.

## License

MIT
