# SMMP - Social Media Management Platform

A social media management platform built with Next.js, featuring Threads integration, scheduled posting, and analytics tracking.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with TypeORM
- **Authentication**: JWT with Passport (httpOnly cookies)
- **Styling**: Tailwind CSS 4
- **Testing**: Vitest + Testing Library

## Features

### Core Features
- **User Authentication**: Register, login with "Remember Me", JWT-based session management
- **Channel Management**: Connect and manage Threads accounts
- **Post Creation**: Create and publish text posts to Threads
- **Scheduled Posts**: Schedule posts for future automatic publishing
- **Analytics Dashboard**: Track performance metrics across platforms
- **Token Management**: Automatic access token refresh for Threads API

### Threads Integration
- OAuth 2.0 flow with state parameter validation
- Container-based publishing workflow
- Long-lived access token (60 days) with automatic refresh
- Support for text, image, and video posts
- Account insights and post analytics

## Prerequisites

- Node.js 20+
- PostgreSQL database
- Threads App credentials ([Meta Developer Portal](https://developers.facebook.com))
- mkcert for local SSL certificates (for OAuth)

## Environment Variables

Create a `.env` file in the project root:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/smmp

# JWT Authentication
JWT_SECRET=your-secret-key-change-this
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d

# Threads API
THREADS_APP_ID=your-threads-app-id
THREADS_APP_SECRET=your-threads-app-secret
THREADS_REDIRECT_URI=https://threads-sample.meta:8000/api/channels/threads/callback

# Allowed origins for Next.js dev server
ALLOWED_DEV_ORIGINS=threads-sample.meta,localhost,127.0.0.1

# Server configuration
HOSTNAME=threads-sample.meta
PORT=8000

# Cron job secret (optional, for scheduled post publisher)
CRON_SECRET=your-cron-secret-key-here
```

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup SSL Certificates (for HTTPS OAuth)

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
mkdir -p cert
cd cert
mkcert threads-sample.meta localhost 127.0.0.1
```

#### Update /etc/hosts

Add the local domain to your hosts file:

```bash
# macOS/Linux
sudo sh -c 'echo "127.0.0.1 threads-sample.meta" >> /etc/hosts'

# Windows (run as Administrator)
echo "127.0.0.1 threads-sample.meta" >> C:\Windows\System32\drivers\etc\hosts
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

## Scheduled Posts

### Setup Cron Job

**Option 1: Using npm script**
```bash
npm run cron:publish
```

**Option 2: Using crontab**

```bash
crontab -e
```

Add this line to run every 5 minutes:
```cron
*/5 * * * * cd /Users/nhamcotdo/mmo/smmp && npm run cron:publish >> logs/cron.log 2>&1
```

**Option 3: Using systemd (Linux)**

Create `/etc/systemd/system/smmp-publisher.service`:
```ini
[Unit]
Description=SMMP Scheduled Posts Publisher
After=network.target

[Service]
Type=oneshot
User=your-user
WorkingDirectory=/Users/nhamcotdo/mmo/smmp
ExecStart=/usr/bin/npx tsx scripts/publish-scheduled-posts.ts

[Install]
WantedBy=multi-user.target
```

Create `/etc/systemd/system/smmp-publisher.timer`:
```ini
[Unit]
Description=Run SMMP publisher every 5 minutes

[Timer]
OnBootSec=1min
OnUnitActiveSec=5min

[Install]
WantedBy=timers.target
```

Enable and start:
```bash
sudo systemctl enable smmp-publisher.timer
sudo systemctl start smmp-publisher.timer
```

**Option 4: Using external cron service**

Services like [cron-job.org](https://cron-job.org) can call:
```
POST https://threads-sample.meta:8000/api/jobs/publish-scheduled
Authorization: Bearer YOUR_CRON_SECRET
```

## API Routes

### Authentication
| Route | Method | Description |
|-------|--------|-------------|
| `/api/auth/register` | POST | Register new user |
| `/api/auth/login` | POST | Login with email/password |
| `/api/auth/logout` | POST | Logout and clear cookies |
| `/api/auth/refresh` | POST | Refresh access token |
| `/api/auth/me` | GET | Get current user info |

### Channels
| Route | Method | Description |
|-------|--------|-------------|
| `/api/channels` | GET | List connected channels |
| `/api/channels/threads/connect` | GET | Get Threads OAuth URL |
| `/api/channels/threads/callback` | GET | OAuth callback handler |
| `/api/channels/:id` | DELETE | Disconnect a channel |
| `/api/channels/:id` | POST | Refresh channel token |

### Posts
| Route | Method | Description |
|-------|--------|-------------|
| `/api/posts` | GET | List posts (query: `?scheduled=true`, `?status=draft`) |
| `/api/posts` | POST | Create new post (with `scheduledFor` date) |
| `/api/posts/:id` | GET | Get single post |
| `/api/posts/:id` | PUT | Update post content or schedule |
| `/api/posts/:id` | DELETE | Delete post |
| `/api/publish/threads` | POST | Create and publish immediately |
| `/api/posts/:id/publish/threads` | POST | Publish existing post |

### Analytics
| Route | Method | Description |
|-------|--------|-------------|
| `/api/analytics?type=overview` | GET | Get overall analytics |
| `/api/analytics` | GET | Get posts with analytics |

### Jobs
| Route | Method | Description |
|-------|--------|-------------|
| `/api/jobs/publish-scheduled` | POST | Run scheduled post publisher |

## Pages

| Route | Description |
|-------|-------------|
| `/` | Home dashboard with quick actions |
| `/login` | User login |
| `/register` | User registration |
| `/channels` | Manage connected social accounts |
| `/posts/new` | Create post (now or scheduled) |
| `/posts/scheduled` | View and manage scheduled posts |
| `/analytics` | Performance analytics dashboard |

## Project Structure

```
src/
├── app/
│   ├── api/                    # API routes
│   │   ├── auth/              # Authentication endpoints
│   │   ├── channels/          # Channel management & OAuth
│   │   ├── posts/              # Post CRUD & publishing
│   │   ├── publish/           # Direct publish endpoint
│   │   ├── analytics/          # Analytics data
│   │   └── jobs/               # Background job endpoints
│   ├── channels/              # Channel management pages
│   ├── login/                 # Login page
│   ├── posts/                 # Post creation & scheduled posts
│   ├── analytics/             # Analytics dashboard
│   └── register/              # Registration page
├── contexts/                  # React contexts (Auth)
├── database/                  # TypeORM entities
│   └── entities/             # User, Post, SocialAccount, etc.
├── lib/
│   ├── api/                   # API client functions
│   ├── auth/                  # Authentication logic
│   ├── db/                    # Database connection
│   ├── services/              # Business logic
│   │   └── threads.*         # Threads API integration
│   ├── jobs/                  # Background jobs
│   │   └── publish-scheduled-posts.ts
│   ├── types/                 # TypeScript types
│   └── validators/            # Zod schemas
└── middleware/                # Express middleware
scripts/
└── publish-scheduled-posts.ts # Cron job script
```

## Threads API Notes

### Token Refresh Behavior
Threads API uses a unique token refresh pattern:
1. `th_exchange_token` returns long-lived access token (60 days)
2. No separate `refresh_token` is returned
3. The access token itself is used as the `refresh_token` parameter when calling the refresh endpoint
4. We store the same value in both `accessToken` and `refreshToken` fields

### Publishing Flow
1. Create container with post content
2. Wait 2-3 seconds for container to be ready
3. Publish container with `creation_id` parameter (NOT `container_id`)
4. Returns Threads post ID and permalink

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
| `npm run cron:publish` | Run scheduled post publisher manually |

## Troubleshooting

### SSL Certificate Warnings

When first accessing `https://threads-sample.meta:8000`, your browser may show a warning. This is expected for self-signed certificates. Click "Advanced" → "Proceed to site".

### Port Already in Use

```bash
PORT=3001 npm run dev:https
```

### Database Connection Issues

Ensure PostgreSQL is running and `DATABASE_URL` is correct.

### Scheduled Posts Not Publishing

Check the cron logs:
```bash
tail -f logs/cron.log
# or for systemd
journalctl -u smmp-publisher -n 50
```

Common issues:
- Cron job not running (check crontab with `crontab -l`)
- Database connection failed
- No active Threads account connected

## License

MIT
