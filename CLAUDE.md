# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SMMP (Social Media Management Platform) is a Next.js 16 application for managing social media content with Threads integration and scheduled publishing capabilities.

## Development Commands

### Running the Application
- `npm run dev` - HTTP dev server (port 3000)
- `npm run dev:https` - HTTPS dev server (required for OAuth - uses mkcert)
- `npm run build` - Production build
- `npm run start` - Production server

### Code Quality
- `npm run type-check` - TypeScript type checking
- `npm run lint` - ESLint
- `npm run test` - Vitest tests
- `npm run test:ui` - Vitest with UI
- `npm run test:coverage` - Test coverage report

### Background Jobs
- `npm run cron:publish` - Manually trigger scheduled post publisher
- Use external cron for production (see package.json for options)

### Database
- PostgreSQL required with TypeORM
- Entities auto-generated from schema
- No database migrations in this version

## Architecture Overview

### Tech Stack
- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript 5 (strict mode)
- **Database**: PostgreSQL with TypeORM
- **Authentication**: JWT with httpOnly cookies
- **Styling**: Tailwind CSS 4
- **Testing**: Vitest + Testing Library + jsdom
- **Package Manager**: pnpm

### Key Architectural Patterns

1. **Clean Architecture Separation**
   - `src/app/api/` - REST API routes (40+ endpoints)
   - `src/lib/` - Business logic and services
   - `src/database/` - TypeORM entities and repositories
   - `src/components/` - Reusable React components

2. **Authentication Flow**
   - JWT tokens with refresh mechanism
   - httpOnly cookies for security
   - Role-based access (Admin, User, Viewer)
   - OAuth 2.0 for Threads integration

3. **Database Entities (10 total)**
   - User, SocialAccount, Post, PostPublication, Media, UploadedMedia
   - Analytics, RefreshToken, BaseEntity, Enums
   - Repositories in `src/database/repositories/`

4. **Social Media Integration**
   - Threads API with OAuth 2.0
   - Platform enum ready for Twitter/X, LinkedIn, etc.
   - Extensible content types (text, image, video, carousel)

### Important File Locations

- **Constants**: `src/lib/constants.ts` - Centralized magic numbers
- **Validation**: `src/lib/validators/` - Zod schemas
- **Services**: `src/lib/services/` - External API integrations
- **API Client**: `src/lib/api/` - Internal API functions
- **Types**: `src/lib/types/` - TypeScript definitions

### Development Constraints

- No Vietnamese in code or comments
- No `any` or `unknown` types (TypeScript strict)
- No deprecated APIs (e.g., `.substr()` → `.slice()`)
- No magic numbers without constants
- Modular, reusable code required
- Proper error handling with specific messages

### Threads OAuth Configuration

- Requires HTTPS for OAuth flow
- Uses `threads-sample.meta` for local development
- SSL certificates in `cert/` directory (mkcert)
- Automatic token refresh (60-day tokens)

### Testing Guidelines

- Use Vitest with Testing Library
- Test files in `tests/` directory
- Mock external APIs in tests
- Aim for comprehensive coverage
- Run tests before commits

### Package.json Scripts Available

- `pnpm dev` - Development server
- `pnpm build` - Build for production
- `pnpm test` - Run tests
- `pnpm type-check` - Check types
- `pnpm lint` - Lint code
- `pnpm cron:publish` - Run scheduled posts

### Recent Refactoring Notes (2025-01-08)

- Fixed all deprecated `.substr()` calls
- Removed all `any` types for better type safety
- Centralized magic numbers in constants
- Improved error messages and consistency
- Enhanced JSDoc documentation