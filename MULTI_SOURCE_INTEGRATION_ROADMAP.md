# Multi-Source Video Integration Roadmap

**Project:** Add FileMoon & Coomer to VideoHub  
**Strategy:** FileMoon (Auto-Fetch All) + Coomer (Curated Selection)  
**Estimated Time:** 8-12 hours  
**Difficulty:** Intermediate-Advanced  

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Prerequisites](#prerequisites)
3. [Phase 1: FileMoon Integration](#phase-1-filemoon-integration)
4. [Phase 2: Coomer Integration](#phase-2-coomer-integration)
5. [Phase 3: Unified Video System](#phase-3-unified-video-system)
6. [Phase 4: Admin Panel](#phase-4-admin-panel)
7. [Phase 5: Frontend Updates](#phase-5-frontend-updates)
8. [Testing & Verification](#testing--verification)
9. [Deployment Guide](#deployment-guide)
10. [Troubleshooting](#troubleshooting)

---

## Project Overview

### Current State
- ✅ UPnShare integration (auto-fetches all videos)
- ✅ Background refresh every 5 minutes
- ✅ ~1700 videos from 2 folders

### Target State
- ✅ **UPnShare** - Keep as-is (auto-fetch)
- ✅ **FileMoon** - Auto-fetch ALL videos (like UPnShare)
- ✅ **Coomer** - Curated creator selection (admin-controlled)

### Architecture Approach

```
┌─────────────────────────────────────────────────┐
│           VideoHub Application                  │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌────────┐│
│  │  UPnShare    │  │  FileMoon    │  │ Coomer ││
│  │  (Auto-All)  │  │  (Auto-All)  │  │(Curated)││
│  └──────┬───────┘  └──────┬───────┘  └───┬────┘│
│         │                 │               │     │
│         └─────────┬───────┴───────────────┘     │
│                   ▼                             │
│         ┌─────────────────────┐                 │
│         │  Unified Video API  │                 │
│         └─────────────────────┘                 │
│                   │                             │
│         ┌─────────▼─────────┐                   │
│         │  Frontend Display │                   │
│         │  (Source Filters) │                   │
│         └───────────────────┘                   │
└─────────────────────────────────────────────────┘
```

---

## Prerequisites

### ✅ Required Before Starting

- [ ] FileMoon API account and API token
- [ ] Understand Coomer API structure (no token needed)
- [ ] PostgreSQL database access (for creator management)
- [ ] Current VideoHub working correctly
- [ ] Basic understanding of TypeScript/React

### 📦 Dependencies to Install

```bash
# No new dependencies needed - uses existing stack:
# - express
# - drizzle-orm
# - @tanstack/react-query
```

### 🔑 API Credentials Needed

**FileMoon:**
- Sign up at: https://filemoon.sx
- Get API token from dashboard
- Note your folder IDs

**Coomer:**
- No authentication required
- Public API at: https://coomer.su/api/v1
- Identify creators you want to add

---

## Phase 1: FileMoon Integration

**Duration:** 2-3 hours  
**Difficulty:** ⭐⭐ Easy  
**Strategy:** Copy UPnShare pattern, adapt to FileMoon API

### Step 1.1: Research FileMoon API Structure

**Time:** 20 minutes

**Get API documentation:**

1. Login to FileMoon dashboard
2. Navigate to API documentation
3. Identify these endpoints:
   - List folders endpoint
   - List videos in folder endpoint
   - Get video details endpoint
   - Get stream URL endpoint

**Document the response structure:**

```typescript
// Example FileMoon API response (adjust based on actual API)
interface FileMoonFolder {
  id: string;
  name: string;
  video_count: number;
}

interface FileMoonVideo {
  id: string;
  title: string;
  thumbnail: string;
  duration: number;
  file_url: string;
  // ... other fields
}
```

---

### Step 1.2: Create FileMoon API Utility

**Time:** 30 minutes

**Create new file:**

```bash
# Create the FileMoon utility file
touch server/utils/filemoon.ts
```

**Implementation:**

```typescript
// server/utils/filemoon.ts

import { appLogger } from './logger';

const FILEMOON_API_BASE = process.env.FILEMOON_API_BASE || 'https://filemoon.sx/api';
const FILEMOON_API_TOKEN = process.env.FILEMOON_API_TOKEN || '';

export interface FileMoonVideo {
  id: string;
  folderId: string;
  title: string;
  thumbnail: string;
  duration: number;
  fileUrl: string;
  size?: number;
  createdAt?: string;
}

export interface FileMoonFolder {
  id: string;
  name: string;
  videoCount: number;
}

/**
 * Fetch with authentication and timeout
 */
async function fetchWithAuth(
  endpoint: string,
  timeoutMs: number = 10000
): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    appLogger.info(`[FileMoon] Fetching: ${FILEMOON_API_BASE}${endpoint}`);

    const response = await fetch(`${FILEMOON_API_BASE}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${FILEMOON_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      signal: controller.abort,
    });

    if (!response.ok) {
      throw new Error(`FileMoon API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch all folders from FileMoon
 */
export async function fetchFileMoonFolders(): Promise<FileMoonFolder[]> {
  try {
    const data = await fetchWithAuth('/folders', 5000);
    
    // Adapt based on actual API response structure
    const folders = Array.isArray(data) ? data : data.folders || [];
    
    return folders.map((folder: any) => ({
      id: folder.id,
      name: folder.name || 'Unnamed Folder',
      videoCount: folder.video_count || 0,
    }));
  } catch (error) {
    appLogger.error('[FileMoon] Failed to fetch folders', error);
    return [];
  }
}

/**
 * Fetch all videos from a specific folder
 */
export async function fetchFileMoonVideosFromFolder(
  folderId: string
): Promise<FileMoonVideo[]> {
  const allVideos: FileMoonVideo[] = [];
  let page = 1;
  const perPage = 100;
  let hasMore = true;

  try {
    while (hasMore) {
      const data = await fetchWithAuth(
        `/folder/${folderId}/videos?page=${page}&per_page=${perPage}`,
        8000
      );

      const videos = Array.isArray(data) ? data : data.videos || [];
      
      if (videos.length === 0) {
        hasMore = false;
        break;
      }

      videos.forEach((video: any) => {
        allVideos.push({
          id: video.id,
          folderId: folderId,
          title: video.title || video.name || 'Untitled',
          thumbnail: video.thumbnail || video.poster,
          duration: video.duration || 0,
          fileUrl: video.file_url || video.url,
          size: video.size,
          createdAt: video.created_at,
        });
      });

      if (videos.length < perPage) {
        hasMore = false;
      } else {
        page++;
      }

      // Rate limiting: small delay between pages
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    appLogger.info(`[FileMoon] Fetched ${allVideos.length} videos from folder ${folderId}`);
    return allVideos;
  } catch (error) {
    appLogger.error(`[FileMoon] Failed to fetch videos from folder ${folderId}`, error);
    return allVideos; // Return what we got so far
  }
}

/**
 * Fetch ALL videos from ALL folders
 */
export async function fetchAllFileMoonVideos(): Promise<{
  videos: FileMoonVideo[];
  folders: FileMoonFolder[];
}> {
  const startTime = Date.now();
  
  try {
    appLogger.info('[FileMoon] Starting full video fetch');

    // Get all folders
    const folders = await fetchFileMoonFolders();
    
    if (folders.length === 0) {
      appLogger.warn('[FileMoon] No folders found');
      return { videos: [], folders: [] };
    }

    // Fetch videos from all folders (with concurrency limit)
    const MAX_CONCURRENT = 2;
    const allVideos: FileMoonVideo[] = [];

    for (let i = 0; i < folders.length; i += MAX_CONCURRENT) {
      const batch = folders.slice(i, i + MAX_CONCURRENT);
      
      const batchResults = await Promise.all(
        batch.map(folder => fetchFileMoonVideosFromFolder(folder.id))
      );

      batchResults.forEach(videos => allVideos.push(...videos));
      
      // Small delay between batches
      if (i + MAX_CONCURRENT < folders.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    const duration = Date.now() - startTime;
    appLogger.info(
      `[FileMoon] Fetch completed: ${allVideos.length} videos from ${folders.length} folders in ${duration}ms`
    );

    return {
      videos: allVideos,
      folders: folders,
    };
  } catch (error) {
    appLogger.error('[FileMoon] Full fetch failed', error);
    return { videos: [], folders: [] };
  }
}
```

**Verification:**

```bash
# Test the FileMoon fetcher in isolation
# Create a test script: server/test-filemoon.ts

import { fetchAllFileMoonVideos } from './utils/filemoon';

async function test() {
  const result = await fetchAllFileMoonVideos();
  console.log('Folders:', result.folders.length);
  console.log('Videos:', result.videos.length);
  console.log('Sample video:', result.videos[0]);
}

test();
```

---

### Step 1.3: Add FileMoon Environment Variables

**Time:** 5 minutes

**Update `.env` file:**

```bash
# FileMoon API Configuration
FILEMOON_API_BASE=https://filemoon.sx/api
FILEMOON_API_TOKEN=your_filemoon_api_token_here
```

**Security check:**

```bash
# Ensure .env is in .gitignore
grep "\.env" .gitignore
# Should return: .env
```

---

### Step 1.4: Integrate into Background Refresh

**Time:** 30 minutes

**Update `server/utils/background-refresh.ts`:**

```typescript
// Add FileMoon import
import { fetchAllFileMoonVideos } from './filemoon';

// Update refreshVideoCache function
export async function refreshVideoCache(): Promise<{
  success: boolean;
  message: string;
  videosCount?: number;
}> {
  // ... existing UPnShare code ...

  try {
    console.log("🔄 Background refresh: Starting...");

    const allVideos: Video[] = [];
    const allFolders: VideoFolder[] = [];

    // ========== UPNSHARE (existing) ==========
    const upnshareData = await fetchUpnShareVideos();
    allVideos.push(...normalizeUpnShareVideos(upnshareData.videos));
    allFolders.push(...normalizeUpnShareFolders(upnshareData.folders));

    // ========== FILEMOON (new) ==========
    const filemoonData = await fetchAllFileMoonVideos();
    allVideos.push(...normalizeFileMoonVideos(filemoonData.videos));
    allFolders.push(...normalizeFileMoonFolders(filemoonData.folders));

    console.log(`✅ Total: ${allVideos.length} videos from ${allFolders.length} folders`);

    // Update shared cache
    sharedCache = {
      data: {
        videos: allVideos,
        folders: allFolders,
      },
      timestamp: Date.now(),
    };

    return {
      success: true,
      message: 'Cache refreshed successfully',
      videosCount: allVideos.length,
    };
  } catch (error) {
    // ... error handling ...
  }
}

// Normalization functions
function normalizeFileMoonVideos(videos: FileMoonVideo[]): Video[] {
  return videos.map(video => ({
    id: `filemoon_${video.id}`,
    source: 'filemoon',
    folder_id: `filemoon_${video.folderId}`,
    title: video.title,
    description: '',
    thumbnail: video.thumbnail,
    poster: video.thumbnail,
    duration: video.duration,
    views: 0,
    tags: ['filemoon'],
    created_at: video.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    streamUrl: video.fileUrl,
  }));
}

function normalizeFileMoonFolders(folders: FileMoonFolder[]): VideoFolder[] {
  return folders.map(folder => ({
    id: `filemoon_${folder.id}`,
    source: 'filemoon',
    name: `[FileMoon] ${folder.name}`,
    video_count: folder.videoCount,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));
}
```

---

### Step 1.5: Update Video Type Definitions

**Time:** 10 minutes

**Update `shared/types.ts`:**

```typescript
export interface Video {
  id: string;
  source: 'upnshare' | 'filemoon' | 'coomer'; // Add sources
  folder_id?: string;
  title: string;
  description?: string;
  thumbnail?: string;
  poster?: string;
  duration?: number;
  views: number;
  tags?: string[];
  created_at: string;
  updated_at: string;
  streamUrl?: string;
  
  // Coomer-specific fields (for later)
  creator_id?: string;
  creator_name?: string;
  service?: string;
  attachments?: any[];
}

export interface VideoFolder {
  id: string;
  source: 'upnshare' | 'filemoon' | 'coomer';
  name: string;
  description?: string;
  video_count: number;
  created_at: string;
  updated_at: string;
}
```

---

### Step 1.6: Test FileMoon Integration

**Time:** 15 minutes

```bash
# Restart the development server
npm run dev

# Watch the logs for FileMoon fetch
# Should see:
# [FileMoon] Starting full video fetch
# [FileMoon] Fetched X videos from folder Y
# ✅ Total: XXXX videos from XX folders
```

**Test endpoints:**

```bash
# Test videos endpoint
curl http://localhost:5000/api/videos | jq '.videos | map(select(.source == "filemoon")) | length'

# Should return number of FileMoon videos
```

---

## Phase 2: Coomer Integration

**Duration:** 4-6 hours  
**Difficulty:** ⭐⭐⭐⭐ Advanced  
**Strategy:** Curated creator selection with admin management

### Step 2.1: Create Database Schema

**Time:** 20 minutes

**Create migration file:**

```bash
# Create new migration
touch server/migrations/002_coomer_creators.sql
```

**Migration content:**

```sql
-- server/migrations/002_coomer_creators.sql

-- Curated Coomer creators table
CREATE TABLE IF NOT EXISTS coomer_creators (
  id SERIAL PRIMARY KEY,
  creator_id VARCHAR(255) NOT NULL,
  service VARCHAR(50) NOT NULL, -- 'patreon', 'onlyfans', 'fanbox', etc.
  creator_name VARCHAR(255),
  enabled BOOLEAN DEFAULT true,
  added_by VARCHAR(255),
  added_at TIMESTAMP DEFAULT NOW(),
  last_sync TIMESTAMP,
  post_count INTEGER DEFAULT 0,
  avatar_url TEXT,
  CONSTRAINT unique_creator UNIQUE(service, creator_id)
);

-- Cached Coomer posts table
CREATE TABLE IF NOT EXISTS coomer_posts (
  id SERIAL PRIMARY KEY,
  post_id VARCHAR(255) NOT NULL,
  creator_id INTEGER REFERENCES coomer_creators(id) ON DELETE CASCADE,
  service VARCHAR(50) NOT NULL,
  title TEXT,
  content TEXT,
  published_at TIMESTAMP,
  file_url TEXT,
  thumbnail_url TEXT,
  attachments JSONB,
  cached_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_post UNIQUE(service, post_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_coomer_creators_enabled ON coomer_creators(enabled);
CREATE INDEX IF NOT EXISTS idx_coomer_posts_creator ON coomer_posts(creator_id);
CREATE INDEX IF NOT EXISTS idx_coomer_posts_published ON coomer_posts(published_at DESC);
```

**Create Drizzle schema:**

```typescript
// server/db/schema.ts - Add to existing schema

import { pgTable, serial, varchar, boolean, timestamp, integer, text, jsonb } from 'drizzle-orm/pg-core';

export const coomerCreators = pgTable('coomer_creators', {
  id: serial('id').primaryKey(),
  creatorId: varchar('creator_id', { length: 255 }).notNull(),
  service: varchar('service', { length: 50 }).notNull(),
  creatorName: varchar('creator_name', { length: 255 }),
  enabled: boolean('enabled').default(true),
  addedBy: varchar('added_by', { length: 255 }),
  addedAt: timestamp('added_at').defaultNow(),
  lastSync: timestamp('last_sync'),
  postCount: integer('post_count').default(0),
  avatarUrl: text('avatar_url'),
});

export const coomerPosts = pgTable('coomer_posts', {
  id: serial('id').primaryKey(),
  postId: varchar('post_id', { length: 255 }).notNull(),
  creatorId: integer('creator_id').references(() => coomerCreators.id, { onDelete: 'cascade' }),
  service: varchar('service', { length: 50 }).notNull(),
  title: text('title'),
  content: text('content'),
  publishedAt: timestamp('published_at'),
  fileUrl: text('file_url'),
  thumbnailUrl: text('thumbnail_url'),
  attachments: jsonb('attachments'),
  cachedAt: timestamp('cached_at').defaultNow(),
});
```

**Run migration:**

```bash
# Apply migration to database
psql $DATABASE_URL -f server/migrations/002_coomer_creators.sql

# Or if using Drizzle Kit:
npx drizzle-kit push:pg
```

---

### Step 2.2: Create Coomer API Utility

**Time:** 45 minutes

**Create file:**

```bash
touch server/utils/coomer.ts
```

**Implementation:**

```typescript
// server/utils/coomer.ts

import { db } from '../db';
import { coomerCreators, coomerPosts } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { appLogger } from './logger';

const COOMER_API_BASE = 'https://coomer.su/api/v1';

export interface CoomerPost {
  id: string;
  service: string;
  user: string;
  title: string;
  content: string;
  published: string;
  file?: {
    name: string;
    path: string;
  };
  attachments?: Array<{
    name: string;
    path: string;
  }>;
}

export interface CoomerCreator {
  id: string;
  service: string;
  name: string;
  favorited: number;
}

/**
 * Fetch creator profile from Coomer
 */
export async function fetchCoomerCreator(
  service: string,
  creatorId: string
): Promise<CoomerCreator | null> {
  try {
    const url = `${COOMER_API_BASE}/${service}/user/${creatorId}/profile`;
    appLogger.info(`[Coomer] Fetching creator: ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'VideoHub/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    appLogger.error(`[Coomer] Failed to fetch creator ${service}/${creatorId}`, error);
    return null;
  }
}

/**
 * Fetch posts from a specific creator
 */
export async function fetchCoomerPosts(
  service: string,
  creatorId: string,
  limit: number = 50
): Promise<CoomerPost[]> {
  try {
    const url = `${COOMER_API_BASE}/${service}/user/${creatorId}/posts`;
    appLogger.info(`[Coomer] Fetching posts: ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'VideoHub/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const posts = await response.json();
    
    // Limit to most recent posts
    return Array.isArray(posts) ? posts.slice(0, limit) : [];
  } catch (error) {
    appLogger.error(`[Coomer] Failed to fetch posts from ${service}/${creatorId}`, error);
    return [];
  }
}

/**
 * Sync a creator's posts to database
 */
export async function syncCreatorPosts(creatorDbId: number): Promise<number> {
  try {
    // Get creator from database
    const creator = await db
      .select()
      .from(coomerCreators)
      .where(eq(coomerCreators.id, creatorDbId))
      .limit(1);

    if (!creator || creator.length === 0) {
      throw new Error(`Creator ${creatorDbId} not found in database`);
    }

    const { creatorId, service } = creator[0];

    // Fetch posts from API
    const posts = await fetchCoomerPosts(service, creatorId);

    if (posts.length === 0) {
      appLogger.warn(`[Coomer] No posts found for ${service}/${creatorId}`);
      return 0;
    }

    let syncedCount = 0;

    // Insert/update posts in database
    for (const post of posts) {
      try {
        // Check if post already exists
        const existing = await db
          .select()
          .from(coomerPosts)
          .where(
            and(
              eq(coomerPosts.service, service),
              eq(coomerPosts.postId, post.id)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          // Update existing post
          await db
            .update(coomerPosts)
            .set({
              title: post.title,
              content: post.content,
              publishedAt: new Date(post.published),
              fileUrl: post.file?.path,
              thumbnailUrl: post.attachments?.[0]?.path,
              attachments: post.attachments,
              cachedAt: new Date(),
            })
            .where(eq(coomerPosts.id, existing[0].id));
        } else {
          // Insert new post
          await db.insert(coomerPosts).values({
            postId: post.id,
            creatorId: creatorDbId,
            service: service,
            title: post.title,
            content: post.content,
            publishedAt: new Date(post.published),
            fileUrl: post.file?.path,
            thumbnailUrl: post.attachments?.[0]?.path,
            attachments: post.attachments,
          });
          syncedCount++;
        }
      } catch (error) {
        appLogger.error(`[Coomer] Failed to sync post ${post.id}`, error);
      }
    }

    // Update creator's last sync time and post count
    await db
      .update(coomerCreators)
      .set({
        lastSync: new Date(),
        postCount: posts.length,
      })
      .where(eq(coomerCreators.id, creatorDbId));

    appLogger.info(`[Coomer] Synced ${syncedCount} new posts for creator ${creatorDbId}`);
    return syncedCount;
  } catch (error) {
    appLogger.error(`[Coomer] Failed to sync creator ${creatorDbId}`, error);
    return 0;
  }
}

/**
 * Sync all enabled creators
 */
export async function syncAllCoomerCreators(): Promise<{
  success: boolean;
  creatorsProcessed: number;
  postsSynced: number;
}> {
  try {
    appLogger.info('[Coomer] Starting sync for all enabled creators');

    // Get all enabled creators
    const creators = await db
      .select()
      .from(coomerCreators)
      .where(eq(coomerCreators.enabled, true));

    if (creators.length === 0) {
      appLogger.info('[Coomer] No enabled creators to sync');
      return { success: true, creatorsProcessed: 0, postsSynced: 0 };
    }

    let totalPostsSynced = 0;

    // Sync each creator
    for (const creator of creators) {
      const synced = await syncCreatorPosts(creator.id);
      totalPostsSynced += synced;

      // Rate limiting: wait between creators
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    appLogger.info(
      `[Coomer] Sync completed: ${creators.length} creators, ${totalPostsSynced} new posts`
    );

    return {
      success: true,
      creatorsProcessed: creators.length,
      postsSynced: totalPostsSynced,
    };
  } catch (error) {
    appLogger.error('[Coomer] Sync failed', error);
    return { success: false, creatorsProcessed: 0, postsSynced: 0 };
  }
}

/**
 * Get all cached Coomer posts for display
 */
export async function getAllCoomerPosts(): Promise<CoomerPost[]> {
  try {
    const posts = await db
      .select()
      .from(coomerPosts)
      .orderBy(coomerPosts.publishedAt);

    return posts.map(post => ({
      id: post.postId!,
      service: post.service!,
      user: post.creatorId!.toString(),
      title: post.title || '',
      content: post.content || '',
      published: post.publishedAt?.toISOString() || '',
      file: post.fileUrl ? { name: '', path: post.fileUrl } : undefined,
      attachments: post.attachments as any,
    }));
  } catch (error) {
    appLogger.error('[Coomer] Failed to get cached posts', error);
    return [];
  }
}
```

---

### Step 2.3: Add Coomer Background Sync

**Time:** 30 minutes

**Create background sync file:**

```bash
touch server/utils/coomer-sync.ts
```

**Implementation:**

```typescript
// server/utils/coomer-sync.ts

import { syncAllCoomerCreators } from './coomer';
import { appLogger } from './logger';

const SYNC_INTERVAL = parseInt(process.env.COOMER_SYNC_INTERVAL || '1800000', 10); // 30 minutes default

let syncTimer: NodeJS.Timeout | null = null;
let isSyncing = false;

export async function performCoomerSync(): Promise<void> {
  if (isSyncing) {
    appLogger.warn('[Coomer Sync] Sync already in progress, skipping');
    return;
  }

  isSyncing = true;

  try {
    const result = await syncAllCoomerCreators();
    
    if (result.success) {
      appLogger.info(
        `[Coomer Sync] ✅ Completed: ${result.creatorsProcessed} creators, ${result.postsSynced} new posts`
      );
    } else {
      appLogger.error('[Coomer Sync] ❌ Failed');
    }
  } catch (error) {
    appLogger.error('[Coomer Sync] Error during sync', error);
  } finally {
    isSyncing = false;
  }
}

export function startCoomerSync(): void {
  if (syncTimer) {
    appLogger.warn('[Coomer Sync] Already running');
    return;
  }

  appLogger.info(`[Coomer Sync] Starting (interval: ${SYNC_INTERVAL / 1000}s)`);

  // Run immediately on start
  performCoomerSync();

  // Schedule recurring sync
  syncTimer = setInterval(() => {
    performCoomerSync();
  }, SYNC_INTERVAL);
}

export function stopCoomerSync(): void {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
    appLogger.info('[Coomer Sync] Stopped');
  }
}
```

**Update `server/index.ts`:**

```typescript
// Add import
import { startCoomerSync } from './utils/coomer-sync';

// In createServer function, add after other background tasks
if (!isServerless) {
  console.log("🔄 Starting background tasks (traditional server mode)");
  
  setTimeout(() => startBackgroundRefresh(), 1000);
  setTimeout(() => startLogRetentionCleanup(), 2000);
  setTimeout(() => startScheduledBackup(), 3000);
  
  // Add Coomer sync
  setTimeout(() => startCoomerSync(), 4000);
}
```

---

### Step 2.4: Create Admin API Endpoints

**Time:** 45 minutes

**Create routes file:**

```bash
touch server/routes/coomer-admin.ts
```

**Implementation:**

```typescript
// server/routes/coomer-admin.ts

import { RequestHandler } from 'express';
import { db } from '../db';
import { coomerCreators, coomerPosts } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { fetchCoomerCreator, syncCreatorPosts } from '../utils/coomer';
import { appLogger } from '../utils/logger';

/**
 * GET /api/admin/coomer/creators
 * List all curated creators
 */
export const listCreators: RequestHandler = async (req, res) => {
  try {
    const creators = await db
      .select()
      .from(coomerCreators)
      .orderBy(desc(coomerCreators.addedAt));

    res.json({ creators });
  } catch (error) {
    appLogger.error('[Coomer Admin] Failed to list creators', error);
    res.status(500).json({ error: 'Failed to fetch creators' });
  }
};

/**
 * POST /api/admin/coomer/creators
 * Add a new creator to curated list
 */
export const addCreator: RequestHandler = async (req, res) => {
  try {
    const { service, creatorId } = req.body;

    if (!service || !creatorId) {
      return res.status(400).json({ error: 'Service and creatorId required' });
    }

    // Validate service
    const validServices = ['patreon', 'onlyfans', 'fanbox', 'subscribestar', 'gumroad'];
    if (!validServices.includes(service)) {
      return res.status(400).json({ 
        error: `Invalid service. Must be one of: ${validServices.join(', ')}` 
      });
    }

    // Check if creator already exists
    const existing = await db
      .select()
      .from(coomerCreators)
      .where(
        and(
          eq(coomerCreators.service, service),
          eq(coomerCreators.creatorId, creatorId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Creator already added' });
    }

    // Fetch creator profile from Coomer API
    const profile = await fetchCoomerCreator(service, creatorId);

    if (!profile) {
      return res.status(404).json({ error: 'Creator not found on Coomer' });
    }

    // Insert into database
    const [newCreator] = await db
      .insert(coomerCreators)
      .values({
        creatorId: creatorId,
        service: service,
        creatorName: profile.name || creatorId,
        enabled: true,
        addedBy: (req as any).user?.claims?.sub || 'admin',
      })
      .returning();

    // Trigger initial sync
    syncCreatorPosts(newCreator.id).catch(error => {
      appLogger.error(`[Coomer Admin] Failed to sync new creator ${newCreator.id}`, error);
    });

    res.json({ 
      message: 'Creator added successfully',
      creator: newCreator 
    });
  } catch (error) {
    appLogger.error('[Coomer Admin] Failed to add creator', error);
    res.status(500).json({ error: 'Failed to add creator' });
  }
};

/**
 * PATCH /api/admin/coomer/creators/:id
 * Update creator (enable/disable, rename)
 */
export const updateCreator: RequestHandler = async (req, res) => {
  try {
    const creatorId = parseInt(req.params.id);
    const { enabled, creatorName } = req.body;

    if (isNaN(creatorId)) {
      return res.status(400).json({ error: 'Invalid creator ID' });
    }

    const updates: any = {};
    if (typeof enabled === 'boolean') updates.enabled = enabled;
    if (creatorName) updates.creatorName = creatorName;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid updates provided' });
    }

    const [updated] = await db
      .update(coomerCreators)
      .set(updates)
      .where(eq(coomerCreators.id, creatorId))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Creator not found' });
    }

    res.json({ 
      message: 'Creator updated successfully',
      creator: updated 
    });
  } catch (error) {
    appLogger.error('[Coomer Admin] Failed to update creator', error);
    res.status(500).json({ error: 'Failed to update creator' });
  }
};

/**
 * DELETE /api/admin/coomer/creators/:id
 * Remove creator from curated list
 */
export const deleteCreator: RequestHandler = async (req, res) => {
  try {
    const creatorId = parseInt(req.params.id);

    if (isNaN(creatorId)) {
      return res.status(400).json({ error: 'Invalid creator ID' });
    }

    // Delete creator (cascades to posts)
    const [deleted] = await db
      .delete(coomerCreators)
      .where(eq(coomerCreators.id, creatorId))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: 'Creator not found' });
    }

    res.json({ 
      message: 'Creator removed successfully',
      creator: deleted 
    });
  } catch (error) {
    appLogger.error('[Coomer Admin] Failed to delete creator', error);
    res.status(500).json({ error: 'Failed to delete creator' });
  }
};

/**
 * POST /api/admin/coomer/creators/:id/sync
 * Manually trigger sync for a specific creator
 */
export const syncCreator: RequestHandler = async (req, res) => {
  try {
    const creatorId = parseInt(req.params.id);

    if (isNaN(creatorId)) {
      return res.status(400).json({ error: 'Invalid creator ID' });
    }

    const postsSynced = await syncCreatorPosts(creatorId);

    res.json({ 
      message: 'Sync completed',
      postsSynced 
    });
  } catch (error) {
    appLogger.error('[Coomer Admin] Failed to sync creator', error);
    res.status(500).json({ error: 'Failed to sync creator' });
  }
};
```

**Register routes in `server/index.ts`:**

```typescript
// Import routes
import {
  listCreators,
  addCreator,
  updateCreator,
  deleteCreator,
  syncCreator,
} from './routes/coomer-admin';

// Add routes (after other admin routes)
app.get('/api/admin/coomer/creators', isAuthenticated, listCreators);
app.post('/api/admin/coomer/creators', isAuthenticated, addCreator);
app.patch('/api/admin/coomer/creators/:id', isAuthenticated, updateCreator);
app.delete('/api/admin/coomer/creators/:id', isAuthenticated, deleteCreator);
app.post('/api/admin/coomer/creators/:id/sync', isAuthenticated, syncCreator);
```

---

## Phase 3: Unified Video System

**Duration:** 1-2 hours  
**Difficulty:** ⭐⭐⭐ Medium

### Step 3.1: Update Video Routes

**Time:** 30 minutes

**Update `server/routes/videos.ts`:**

```typescript
// Add Coomer import
import { getAllCoomerPosts } from '../utils/coomer';

export const handleGetVideos: RequestHandler = async (req, res) => {
  try {
    // ... existing cache checks ...

    const allVideos: Video[] = [];
    const allFolders: VideoFolder[] = [];

    // ========== UPNSHARE ==========
    const upnshareData = await fetchUpnShareData();
    allVideos.push(...normalizeUpnShareVideos(upnshareData.videos));
    allFolders.push(...normalizeUpnShareFolders(upnshareData.folders));

    // ========== FILEMOON ==========
    const filemoonData = await fetchAllFileMoonVideos();
    allVideos.push(...normalizeFileMoonVideos(filemoonData.videos));
    allFolders.push(...normalizeFileMoonFolders(filemoonData.folders));

    // ========== COOMER ==========
    const coomerPosts = await getAllCoomerPosts();
    allVideos.push(...normalizeCoomerPosts(coomerPosts));
    // Coomer uses creators as "folders"

    res.json({
      videos: allVideos,
      folders: allFolders,
    });
  } catch (error) {
    // ... error handling ...
  }
};

// Normalization function for Coomer
function normalizeCoomerPosts(posts: CoomerPost[]): Video[] {
  return posts.map(post => ({
    id: `coomer_${post.service}_${post.id}`,
    source: 'coomer',
    creator_id: post.user,
    service: post.service,
    title: post.title || 'Untitled Post',
    description: post.content?.substring(0, 200),
    thumbnail: post.attachments?.[0]?.path || post.file?.path,
    poster: post.attachments?.[0]?.path || post.file?.path,
    duration: 0,
    views: 0,
    tags: ['coomer', post.service],
    created_at: post.published,
    updated_at: post.published,
    streamUrl: post.file?.path,
    attachments: post.attachments,
  }));
}
```

---

## Phase 4: Admin Panel

**Duration:** 2-3 hours  
**Difficulty:** ⭐⭐⭐ Medium

### Step 4.1: Create Coomer Management UI

**Time:** 90 minutes

**Create component:**

```bash
touch client/components/admin/CoomerCreatorManagement.tsx
```

**Implementation:**

```typescript
// client/components/admin/CoomerCreatorManagement.tsx

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

interface CoomerCreator {
  id: number;
  creatorId: string;
  service: string;
  creatorName: string;
  enabled: boolean;
  postCount: number;
  lastSync: string | null;
}

export function CoomerCreatorManagement() {
  const queryClient = useQueryClient();
  const [service, setService] = useState('onlyfans');
  const [creatorId, setCreatorId] = useState('');

  // Fetch creators
  const { data: creators, isLoading } = useQuery<{ creators: CoomerCreator[] }>({
    queryKey: ['/api/admin/coomer/creators'],
  });

  // Add creator mutation
  const addMutation = useMutation({
    mutationFn: async (data: { service: string; creatorId: string }) => {
      const res = await fetch('/api/admin/coomer/creators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/coomer/creators'] });
      toast.success('Creator added successfully');
      setCreatorId('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add creator');
    },
  });

  // Toggle enabled mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: number; enabled: boolean }) => {
      const res = await fetch(`/api/admin/coomer/creators/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/coomer/creators'] });
      toast.success('Creator updated');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/coomer/creators/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/coomer/creators'] });
      toast.success('Creator removed');
    },
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/coomer/creators/${id}/sync`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/coomer/creators'] });
      toast.success(`Synced ${data.postsSynced} posts`);
    },
  });

  const handleAdd = () => {
    if (!creatorId.trim()) {
      toast.error('Please enter a creator ID');
      return;
    }
    addMutation.mutate({ service, creatorId: creatorId.trim() });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add Coomer Creator</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <select
              value={service}
              onChange={(e) => setService(e.target.value)}
              className="px-3 py-2 border rounded"
            >
              <option value="onlyfans">OnlyFans</option>
              <option value="patreon">Patreon</option>
              <option value="fanbox">Fanbox</option>
              <option value="subscribestar">SubscribeStar</option>
              <option value="gumroad">Gumroad</option>
            </select>
            
            <Input
              placeholder="Creator ID"
              value={creatorId}
              onChange={(e) => setCreatorId(e.target.value)}
              className="flex-1"
            />
            
            <Button 
              onClick={handleAdd} 
              disabled={addMutation.isPending}
            >
              {addMutation.isPending ? 'Adding...' : 'Add Creator'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Curated Creators ({creators?.creators.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading...</p>
          ) : creators?.creators.length === 0 ? (
            <p className="text-gray-500">No creators added yet</p>
          ) : (
            <div className="space-y-2">
              {creators?.creators.map((creator) => (
                <div 
                  key={creator.id}
                  className="flex items-center justify-between p-4 border rounded"
                >
                  <div className="flex-1">
                    <h4 className="font-medium">{creator.creatorName}</h4>
                    <p className="text-sm text-gray-500">
                      {creator.service} • ID: {creator.creatorId}
                    </p>
                    <p className="text-xs text-gray-400">
                      {creator.postCount} posts
                      {creator.lastSync && ` • Last sync: ${new Date(creator.lastSync).toLocaleString()}`}
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={creator.enabled ? 'default' : 'outline'}
                      onClick={() => toggleMutation.mutate({ id: creator.id, enabled: !creator.enabled })}
                      disabled={toggleMutation.isPending}
                    >
                      {creator.enabled ? 'Enabled' : 'Disabled'}
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => syncMutation.mutate(creator.id)}
                      disabled={syncMutation.isPending}
                    >
                      Sync
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        if (confirm(`Remove ${creator.creatorName}?`)) {
                          deleteMutation.mutate(creator.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

**Add to admin dashboard:**

```typescript
// client/pages/Admin.tsx

import { CoomerCreatorManagement } from '@/components/admin/CoomerCreatorManagement';

// Add a new tab or section:
<Tabs defaultValue="overview">
  <TabsList>
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="videos">Videos</TabsTrigger>
    <TabsTrigger value="coomer">Coomer Creators</TabsTrigger> {/* NEW */}
  </TabsList>
  
  {/* ... other tabs ... */}
  
  <TabsContent value="coomer">
    <CoomerCreatorManagement />
  </TabsContent>
</Tabs>
```

---

## Phase 5: Frontend Updates

**Duration:** 1 hour  
**Difficulty:** ⭐⭐ Easy

### Step 5.1: Add Source Badges

**Time:** 20 minutes

**Create badge component:**

```typescript
// client/components/SourceBadge.tsx

interface SourceBadgeProps {
  source: 'upnshare' | 'filemoon' | 'coomer';
}

export function SourceBadge({ source }: SourceBadgeProps) {
  const badges = {
    upnshare: { label: 'UPnShare', color: 'bg-blue-500' },
    filemoon: { label: 'FileMoon', color: 'bg-purple-500' },
    coomer: { label: 'Coomer', color: 'bg-pink-500' },
  };

  const badge = badges[source];

  return (
    <span className={`${badge.color} text-white text-xs px-2 py-1 rounded`}>
      {badge.label}
    </span>
  );
}
```

**Use in video cards:**

```typescript
// client/components/VideoCard.tsx

import { SourceBadge } from './SourceBadge';

<div className="video-card">
  <SourceBadge source={video.source} />
  {/* ... rest of card ... */}
</div>
```

---

### Step 5.2: Add Source Filter

**Time:** 30 minutes

**Update homepage:**

```typescript
// client/pages/Index.tsx

const [sourceFilter, setSourceFilter] = useState<string[]>(['all']);

const filteredVideos = videos.filter(video => {
  if (sourceFilter.includes('all')) return true;
  return sourceFilter.includes(video.source);
});

// UI:
<div className="flex gap-2 mb-4">
  <Button
    variant={sourceFilter.includes('all') ? 'default' : 'outline'}
    onClick={() => setSourceFilter(['all'])}
  >
    All Sources
  </Button>
  <Button
    variant={sourceFilter.includes('upnshare') ? 'default' : 'outline'}
    onClick={() => setSourceFilter(['upnshare'])}
  >
    UPnShare
  </Button>
  <Button
    variant={sourceFilter.includes('filemoon') ? 'default' : 'outline'}
    onClick={() => setSourceFilter(['filemoon'])}
  >
    FileMoon
  </Button>
  <Button
    variant={sourceFilter.includes('coomer') ? 'default' : 'outline'}
    onClick={() => setSourceFilter(['coomer'])}
  >
    Coomer
  </Button>
</div>
```

---

## Testing & Verification

### Test FileMoon Integration

```bash
# Check logs for FileMoon fetch
pm2 logs | grep FileMoon

# Test API endpoint
curl http://localhost:5000/api/videos | jq '.videos | map(select(.source == "filemoon")) | length'

# Verify in frontend
# Should see FileMoon badge on videos
```

### Test Coomer Integration

```bash
# Add a test creator via API
curl -X POST http://localhost:5000/api/admin/coomer/creators \
  -H "Content-Type: application/json" \
  -d '{"service":"onlyfans","creatorId":"test123"}' \
  --cookie "session=your_session"

# Check sync logs
pm2 logs | grep "Coomer Sync"

# Verify posts appear
curl http://localhost:5000/api/videos | jq '.videos | map(select(.source == "coomer")) | length'
```

---

## Deployment Guide

### Update Environment Variables

```bash
# On VPS (.env file)
FILEMOON_API_BASE=https://filemoon.sx/api
FILEMOON_API_TOKEN=your_token_here
COOMER_SYNC_INTERVAL=1800000  # 30 minutes
```

### Database Migration

```bash
# Run migrations on production
psql $DATABASE_URL -f server/migrations/002_coomer_creators.sql
```

### Deploy Code

```bash
# Pull latest code
git pull origin main

# Install dependencies
npm install

# Restart PM2
pm2 restart videohub-api

# Check logs
pm2 logs videohub-api
```

---

## Troubleshooting

### FileMoon Issues

**Problem:** No videos appearing from FileMoon

**Solutions:**
1. Check API token is valid
2. Verify API endpoint URLs
3. Check logs: `pm2 logs | grep FileMoon`
4. Test API manually with curl

### Coomer Issues

**Problem:** Posts not syncing

**Solutions:**
1. Check creator ID is correct
2. Verify service name (onlyfans, patreon, etc.)
3. Check Coomer API status: https://coomer.su
4. Review sync logs: `pm2 logs | grep "Coomer Sync"`

**Problem:** Cannot add creator

**Solutions:**
1. Ensure creator exists on Coomer
2. Check database connection
3. Verify migrations ran successfully

---

## Success Criteria

✅ FileMoon videos appear in homepage  
✅ Coomer creators can be added via admin panel  
✅ Coomer posts sync automatically every 30 minutes  
✅ Source badges display correctly  
✅ Source filters work  
✅ All three sources work simultaneously  
✅ Background tasks run without errors  
✅ No performance degradation  

---

## Performance Benchmarks

**Expected Results:**

- Initial FileMoon fetch: 15-30 seconds
- Initial Coomer sync (per creator): 2-5 seconds
- API response time: < 1 second (cached)
- Memory usage increase: ~100-200MB
- Background tasks: No timeout errors

---

## Maintenance

### Daily
- Monitor background sync logs
- Check for failed API calls

### Weekly
- Review curated Coomer creators
- Add/remove creators as needed
- Check database size

### Monthly
- Update API credentials if needed
- Review and optimize slow queries
- Clean up old cached posts

---

**Total Implementation Time:** 8-12 hours  
**Maintenance Time:** 30 minutes/week  

**Good luck with your multi-source integration! 🚀**

*Last updated: 2025-11-11*
