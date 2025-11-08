# Fusion Starter - Full-Stack React Application

## Overview
A production-ready full-stack React application template with integrated Express server. This project provides a modern development experience with React Router 6 SPA mode, TypeScript, Vite, and comprehensive UI components.

## Tech Stack
- **Frontend**: React 18, React Router 6 (SPA), TypeScript, Vite, TailwindCSS 3
- **Backend**: Express server integrated with Vite dev server
- **UI Components**: Radix UI + TailwindCSS 3 + Lucide React icons
- **Testing**: Vitest
- **Package Manager**: npm (note: original project used pnpm)

## Project Structure
```
client/                   # React SPA frontend
├── pages/                # Route components (Index.tsx = home)
├── components/ui/        # Pre-built UI component library
├── App.tsx              # App entry point with SPA routing setup
└── global.css           # TailwindCSS 3 theming and global styles

server/                   # Express API backend
├── index.ts             # Main server setup (express config + routes)
└── routes/              # API handlers
    ├── demo.ts          # Demo endpoint
    └── videos.ts        # UPNshare API integration

shared/                   # Types used by both client & server
└── api.ts               # Shared API interfaces
```

## Key Features

### Development Setup
- **Single Port Development**: Both frontend and backend run on port 5000 in development
- **Hot Reload**: Both client and server code with automatic refresh
- **API Endpoints**: Prefixed with `/api/`
- **Configured for Replit**: Host set to 0.0.0.0:5000 with HMR over WSS

### Available API Routes
- `GET /api/ping` - Simple ping API (uses PING_MESSAGE env var)
- `GET /api/demo` - Demo endpoint
- `GET /api/videos` - Fetch videos from UPNshare (requires UPNSHARE_API_TOKEN)

### Environment Variables
- `PING_MESSAGE` - Custom message for ping endpoint (optional)
- `UPNSHARE_API_TOKEN` - API token for UPNshare video service (optional)

## Development Commands
- `npm run dev` - Start development server (port 5000)
- `npm run build` - Build for production
- `npm run start` - Run production server
- `npm test` - Run tests
- `npm run typecheck` - Type check the codebase

## Path Aliases
- `@/*` - Client folder
- `@shared/*` - Shared folder

## Recent Changes (Replit Setup - Nov 8, 2025)
- Configured Vite to run on 0.0.0.0:5000 for Replit environment
- Added HMR configuration for Replit proxy (WSS over port 443)
- Fixed TypeScript config for ES modules (__dirname support)
- Updated .gitignore to properly exclude .env files
- Set up dev workflow for automatic server restart

## Architecture Notes
- Uses ES modules throughout (type: "module" in package.json)
- Express server integrated directly into Vite dev server via plugin
- Shared types between client/server ensure type safety
- Comprehensive UI component library based on Radix UI primitives
- TailwindCSS with custom theme and HSL color variables
