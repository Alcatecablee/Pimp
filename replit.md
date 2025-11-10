# VideoHub - Full-Stack Video Management Platform

## Migration Status
**Date:** November 10, 2025  
**Status:** ✅ Supabase Auth Migration Complete

Successfully migrated VideoHub authentication from Replit Auth to Supabase Auth. Users can now create accounts, log in, and access their profiles using Supabase authentication. Admin dashboard is fully protected with Supabase session management.

## Overview
VideoHub is a production-ready, full-stack React application for video content management and playback. It features React Router 6 in SPA mode, TypeScript, Vite, TailwindCSS, and an integrated Express server. The platform provides comprehensive video management with upload, tagging, and filtering, an advanced video player with custom controls and analytics, playlist management, and a full-featured admin dashboard with Supabase Auth authentication.

## Deployment Notes

### Required Environment Variables
- `SUPABASE_URL` - Your Supabase project URL (required for authentication)
- `SUPABASE_ANON_KEY` - Your Supabase anonymous key (required for client-side auth)
- `UPNSHARE_API_TOKEN` - Required for video fetching and uploads
- `DATABASE_URL` - Supabase PostgreSQL database connection string

**Note:** Client-side environment variables are automatically synced from Replit secrets to the `.env` file with `VITE_` prefix.

### Optional Environment Variables
- `ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins (default: localhost:5000, 127.0.0.1:5000, *.replit.dev)
  - **Format**: `https://example.com,https://another.com` (whitespace is automatically trimmed)
  - **Important**: For production deployments on custom domains or *.repl.co, you must set this variable
- `PING_MESSAGE` - Custom message for the ping endpoint (default: "pong")
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` - Optional Redis caching (fallback to in-memory)

### HTTPS Requirements
- Session cookies require HTTPS (secure: true flag)
- Local development: Use HTTPS tunnels or ngrok for testing authentication
- Production: Replit automatically provides HTTPS

### Known Limitations
- UPnShare realtime API (viewer count) returns errors - handled gracefully with fallback to 0 viewers
- This is a known third-party API limitation and does not affect core functionality

## User Preferences
I prefer detailed explanations.
I want iterative development.
Ask before making major changes.
Do not make changes to the folder `Z`.
Do not make changes to the file `Y`.

## System Architecture
The application is structured into three main parts: `client` (React SPA frontend), `server` (Express API backend), and `shared` (TypeScript types).

**UI/UX Decisions:**
- **Component Library**: Utilizes Radix UI primitives for headless components, styled with TailwindCSS 3.
- **Theming**: TailwindCSS 3 with custom theming and HSL color variables for a modern aesthetic.
- **Video Playback**: YouTube-inspired overlay controls with a red progress bar, gradient overlay, and smooth transitions.
- **Engagement Features**: Related videos sidebar, real-time viewer counter, and intuitive playlist management UI.
- **Upload Interface**: Drag-and-drop with visual feedback, multi-file queue, and real-time progress.

**Technical Implementations:**
- **Frontend**: React 18, React Router 6 (SPA), TypeScript, Vite, TailwindCSS 3, Lucide React icons.
- **Backend**: Express server integrated with Vite dev server, TypeScript, ES modules.
- **API Communication**: Shared types between client/server ensure type safety.
- **Development Setup**: Single port development (5000), hot reload for both client and server, API endpoints prefixed with `/api/`.
- **Authentication**: Supabase Auth with email/password authentication, user profile management, and protected admin routes. Client-side session management using `@supabase/supabase-js` with React Query integration.
- **Performance Optimizations**:
    - **Backend**: Global and adaptive timeouts, parallel folder fetching, per-folder video limits, graceful degradation for individual folder failures, 5-minute TTL caching with stale cache fallback.
    - **Frontend**: Automatic retry logic for network errors, 30-second API call timeout, loading state management, client-side pagination, `useMemo` for efficient filtering.
- **Video Player**: UPnShare Iframe API integration with `postMessage` for full control (play, pause, seek, volume, speed, PiP), keyboard shortcuts.
- **Playlist Management**: CRUD operations for playlists via REST API, integrated with React Query for optimistic updates.
- **Analytics Tracking**: Tracks total watch time, completion rate, pause/seek counts, unique viewers, and last watched position. Implemented with a `useAnalytics` hook for session management.
- **Video Upload**: TUS protocol resumable uploads via `tus-js-client` with features like drag-and-drop, multi-file queue, progress tracking, pause/resume, retries, and folder selection. Supports max 20GB files and common video formats.
- **Admin Dashboard**: Full-featured admin panel with video management, folder organization, analytics, settings, and upload manager. Protected by Supabase Auth with automatic redirect to login page for unauthenticated users.
- **CORS Security**: Configurable CORS with wildcard support for Replit domains, credentials enabled for trusted origins, automatic whitespace trimming for environment variable parsing.
- **Production Build**: Separate builds for client SPA, server, and serverless bundle for Vercel deployment. Serverless bundle pre-builds server code into a single CommonJS file for optimized cold starts.
- **Error Handling**: Comprehensive try-catch blocks and meaningful error messages across the application.

**Feature Specifications:**
- **Video Display**: 20 videos per page with pagination, automatic tag generation from folder names, tag filtering, and hover preview for thumbnails.
- **Public Routes**: `/` (home), `/video/:id` (video player), `/login` (authentication), `/profile` (user profile)
- **Admin Routes**: `/admin` (dashboard), `/admin/videos` (management), `/admin/folders` (organization), `/admin/uploads` (TUS upload manager), `/admin/analytics`, `/admin/settings`.
- **API Routes**: 
  - Public: `/api/ping`, `/api/demo`, `/api/videos`, `/api/playlists`, `/api/analytics`
  - Protected: `/api/admin/*`, `/api/upload/credentials` (requires Bearer token authentication)
- **Path Aliases**: `@/*` for client, `@shared/*` for shared.
- **Database**: PostgreSQL with Drizzle ORM for users, sessions, playlists, and analytics data storage. Proper schemas, indexing, and relationships.

## External Dependencies
- **Frontend Framework**: React 18
- **Routing**: React Router 6
- **Build Tool**: Vite
- **Styling**: TailwindCSS 3
- **UI Primitives**: Radix UI
- **Icons**: Lucide React
- **Backend Framework**: Express
- **Testing**: Vitest
- **Package Manager**: npm (originally pnpm)
- **Video Service API**: UPNshare (for video fetching, previews, and upload via TUS protocol)
- **Database**: PostgreSQL
- **Upload Library**: `tus-js-client` (for resumable uploads)