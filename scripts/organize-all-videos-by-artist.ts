import "dotenv/config";

const UPNSHARE_API_BASE = "https://upnshare.com/api/v1";
const API_TOKEN = process.env.UPNSHARE_API_TOKEN;

if (!API_TOKEN) {
  console.error("❌ UPNSHARE_API_TOKEN not found in environment");
  process.exit(1);
}

interface Video {
  id: string;
  title: string;
  folder_id?: string;
}

interface Folder {
  id: string;
  name: string;
}

// Known artist names - these will be used to consolidate variations
const KNOWN_ARTISTS = [
  "Xoli Mfeka",
  "Simplypiiper", 
  "Pipipiper",
  "Hailee Starr",
  "Premlly Prem",
  "Premly Prem",
  "Kira",
  "Nynylew",
  "Charlotte Lavish",
];

// Common artist name patterns and aliases
const ARTIST_ALIASES: Record<string, string> = {
  "xolisile": "Xoli Mfeka",
  "xoli m": "Xoli Mfeka",
  "xoli": "Xoli Mfeka",
  "simplypiper": "Simplypiiper",
  "pipipiper13": "Pipipiper",
  "pipipiper": "Pipipiper",
  "premlly prem": "Premly Prem",
};

async function fetchWithAuth(url: string, retries = 5) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          "api-token": API_TOKEN!,
          "Content-Type": "application/json",
        },
      });

      if (response.status === 429) {
        // Rate limit - exponential backoff
        const waitTime = Math.min(attempt * 5000, 30000); // Max 30 seconds
        console.log(`  ⏳ Rate limit hit, waiting ${waitTime/1000}s... (attempt ${attempt}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`API error: ${response.status} ${error}`);
      }

      return response.json();
    } catch (error) {
      if (attempt === retries) throw error;
      const waitTime = attempt * 2000;
      console.log(`  ⚠️ Fetch error, retrying in ${waitTime/1000}s...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw new Error(`Failed to fetch after ${retries} attempts`);
}

async function getAllFolders(): Promise<Folder[]> {
  console.log("📂 Fetching all folders...");
  const data = await fetchWithAuth(`${UPNSHARE_API_BASE}/video/folder`);
  const folders = Array.isArray(data) ? data : data.data || [];
  console.log(`  Found ${folders.length} existing folders`);
  return folders;
}

async function getAllVideosFromFolder(folderId: string): Promise<any[]> {
  const folderVideos: any[] = [];
  let page = 1;
  const perPage = 100;
  
  while (true) {
    const url = `${UPNSHARE_API_BASE}/video/folder/${folderId}?page=${page}&perPage=${perPage}`;
    const response = await fetchWithAuth(url);
    const videos = Array.isArray(response) ? response : response.data || [];
    
    if (videos.length === 0) break;
    
    folderVideos.push(...videos);
    
    if (videos.length < perPage) break; // Last page
    page++;
    
    // Add delay between pages to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return folderVideos;
}

async function getAllVideos(): Promise<Video[]> {
  console.log("🎬 Fetching all videos with pagination...");
  const folders = await getAllFolders();
  const allVideos: Video[] = [];
  let totalCount = 0;

  for (const folder of folders) {
    try {
      const videos = await getAllVideosFromFolder(folder.id);
      
      for (const video of videos) {
        allVideos.push({
          id: video.id,
          title: video.title || video.name || `Video ${video.id}`,
          folder_id: folder.id,
        });
      }
      
      totalCount += videos.length;
      console.log(`  ✓ Fetched ${videos.length} videos from "${folder.name}"`);
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`  ✗ Error fetching videos from folder ${folder.id}:`, error);
    }
  }

  console.log(`\n✅ Total videos found: ${allVideos.length}\n`);
  return allVideos;
}

function extractAllArtistNames(title: string): string[] {
  const artists: string[] = [];
  const normalized = title.trim();
  
  // Check for known artists in the title (case-insensitive)
  for (const knownArtist of KNOWN_ARTISTS) {
    const regex = new RegExp(`\\b${knownArtist.replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (regex.test(normalized)) {
      artists.push(knownArtist);
    }
  }
  
  // If we found known artists, return them
  if (artists.length > 0) {
    return artists;
  }
  
  // Otherwise, try to extract artist names using patterns
  const patterns = [
    // Pattern 1: "Artist Name - Title" or "Artist Name: Title"
    /^([^-:]+?)[\s]*[-:]/,
    // Pattern 2: "Artist1 & Artist2"
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:&|and)\s+/i,
    // Pattern 3: "Artist1 Vs Artist2" or "Artist1 x Artist2"
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Vs|vs|VS|x|X)\s+/i,
    // Pattern 4: "Artist1/Artist2"
    /^([^/]+)\//,
  ];
  
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match && match[1]) {
      const candidate = match[1].trim();
      if (candidate.length > 2 && candidate.length < 50) {
        const artist = normalizeArtistName(candidate);
        if (artist && !artists.includes(artist)) {
          artists.push(artist);
        }
      }
    }
  }
  
  return artists;
}

function isUnrenamedVideo(title: string): boolean {
  const trimmed = title.trim();
  
  // Check for short names (less than 15 characters, likely codes)
  if (trimmed.length < 15) {
    return true;
  }
  
  // Check for hexadecimal or UUID-like patterns (with or without hyphens)
  // Examples: 
  // - 0_ee52c60e2a7d7563a71c776d946336c0.mp4
  // - 1d081c64-a764-4418-a14c-076a666b6c61
  // - BrjMntK.mp4
  // - f21d8946-ccca-4e94-b89c-13a6aa83ce17
  const codePatterns = [
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i,  // UUID pattern (8-4-4-...)
    /^[0-9]+_[0-9a-f]{10,}/i,                  // Pattern like 0_ee52c60e...
    /^[a-z]{5,10}\.mp4$/i,                     // Short random letters like BrjMntK.mp4
    /^[A-Z]{5,10}\.mp4$/,                      // Short uppercase random letters
    /^[0-9a-f]{8}[^a-z\s]/i,                   // Starts with 8 hex chars followed by non-letter
  ];
  
  for (const pattern of codePatterns) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }
  
  // Check if it's mostly hex characters (likely a code/hash)
  const alphanumericOnly = trimmed.replace(/[^a-z0-9]/gi, '');
  const hexCharCount = (alphanumericOnly.match(/[0-9a-f]/gi) || []).length;
  const hexRatio = hexCharCount / alphanumericOnly.length;
  
  // If more than 70% hex characters, it's likely a code
  if (alphanumericOnly.length > 8 && hexRatio > 0.7) {
    return true;
  }
  
  return false;
}

function extractArtistName(title: string): string | null {
  // First check if this is an unrenamed video
  if (isUnrenamedVideo(title)) {
    return null; // Send to manual review
  }
  
  const artists = extractAllArtistNames(title);
  return artists.length > 0 ? artists[0] : null;
}

function normalizeArtistName(name: string): string | null {
  const normalized = name.trim().toLowerCase();
  
  // Check if we have an alias mapping
  if (ARTIST_ALIASES[normalized]) {
    return ARTIST_ALIASES[normalized];
  }
  
  // Check if this name contains any known artist
  for (const knownArtist of KNOWN_ARTISTS) {
    if (normalized.includes(knownArtist.toLowerCase())) {
      return knownArtist;
    }
  }
  
  // Filter out generic/common words that aren't artist names
  const genericWords = /^(watch|new|hot|sexy|leaked|exclusive|best|top|big|booty|mzansi|sandton|based|showing|masturbating|nudes|webcam|porn|video|onlyfans|shower|tease)$/i;
  const words = name.trim().split(/\s+/);
  const filteredWords = words.filter(word => !genericWords.test(word));
  
  if (filteredWords.length === 0) {
    return null;
  }

  // Return title-cased version
  return filteredWords
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

async function createFolder(name: string, retries = 3): Promise<Folder> {
  console.log(`  📁 Creating folder: "${name}"`);
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`${UPNSHARE_API_BASE}/video/folder`, {
        method: "POST",
        headers: {
          "api-token": API_TOKEN!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });

      if (response.status === 429) {
        // Rate limit hit - wait longer before retry
        const waitTime = attempt * 5000; // 5s, 10s, 15s
        console.log(`  ⏳ Rate limit hit, waiting ${waitTime/1000}s before retry ${attempt}/${retries}...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create folder: ${response.status} ${error}`);
      }

      const data = await response.json();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Increased delay
      return data;
    } catch (error) {
      if (attempt === retries) throw error;
      console.log(`  ⚠️ Attempt ${attempt} failed, retrying...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  throw new Error(`Failed to create folder after ${retries} attempts`);
}

async function moveVideoToFolder(videoId: string, folderId: string, retries = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(
        `${UPNSHARE_API_BASE}/video/folder/${folderId}/link`,
        {
          method: "POST",
          headers: {
            "api-token": API_TOKEN!,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ videoId }),
        }
      );

      if (response.status === 429) {
        // Rate limit hit - wait before retry
        const waitTime = attempt * 3000; // 3s, 6s, 9s
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      await new Promise(resolve => setTimeout(resolve, 500)); // Increased delay
      return response.ok;
    } catch (error) {
      if (attempt === retries) return false;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  return false;
}

async function main() {
  console.log("🎯 Starting video organization by artist...\n");

  // Fetch all videos
  const allVideos = await getAllVideos();

  // Group videos by artist
  const videosByArtist = new Map<string, Video[]>();
  const uncategorizedVideos: Video[] = [];

  console.log("🔍 Analyzing video titles to identify artists...\n");
  
  for (const video of allVideos) {
    const artistName = extractArtistName(video.title);
    
    if (artistName) {
      if (!videosByArtist.has(artistName)) {
        videosByArtist.set(artistName, []);
      }
      videosByArtist.get(artistName)!.push(video);
    } else {
      uncategorizedVideos.push(video);
    }
  }

  // Display summary
  console.log("📊 Analysis Summary:");
  console.log(`  Total videos: ${allVideos.length}`);
  console.log(`  Unique artists identified: ${videosByArtist.size}`);
  console.log(`  Uncategorized videos: ${uncategorizedVideos.length}\n`);

  console.log("👥 Artists identified:");
  const sortedArtists = Array.from(videosByArtist.entries()).sort((a, b) => b[1].length - a[1].length);
  for (const [artist, videos] of sortedArtists) {
    console.log(`  - ${artist}: ${videos.length} videos`);
  }
  console.log();

  // Get existing folders
  const existingFolders = await getAllFolders();
  const folderMap = new Map<string, string>();
  for (const folder of existingFolders) {
    folderMap.set(folder.name.toLowerCase(), folder.id);
  }

  // Create folders for artists and organize videos
  console.log("📁 Creating folders and organizing videos...\n");
  console.log(`⏳ This will take a while due to API rate limits. Processing ${videosByArtist.size} artists...\n`);
  
  let foldersCreated = 0;
  let videosMovedSuccess = 0;
  let videosMovedFailed = 0;
  let artistsProcessed = 0;

  for (const [artistName, videos] of videosByArtist) {
    artistsProcessed++;
    console.log(`[${artistsProcessed}/${videosByArtist.size}] Processing "${artistName}"...`);
    
    const folderKey = artistName.toLowerCase();
    let folderId: string;

    if (folderMap.has(folderKey)) {
      folderId = folderMap.get(folderKey)!;
      console.log(`  ✓ Using existing folder (${videos.length} videos)`);
    } else {
      const newFolder = await createFolder(artistName);
      folderId = newFolder.id;
      folderMap.set(folderKey, folderId);
      foldersCreated++;
      console.log(`  ✓ Created folder`);
    }

    // Move videos to this folder with progress updates
    let movedCount = 0;
    for (const video of videos) {
      const success = await moveVideoToFolder(video.id, folderId);
      if (success) {
        videosMovedSuccess++;
        movedCount++;
      } else {
        videosMovedFailed++;
      }
    }
    console.log(`  ✓ Moved ${movedCount}/${videos.length} videos successfully\n`);
    
    // Add delay between processing artists to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Handle uncategorized videos
  if (uncategorizedVideos.length > 0) {
    console.log(`\n📦 Handling ${uncategorizedVideos.length} uncategorized videos...`);
    
    const uncategorizedFolderName = "Needs Manual Review";
    let uncategorizedFolderId: string;

    if (folderMap.has(uncategorizedFolderName.toLowerCase())) {
      uncategorizedFolderId = folderMap.get(uncategorizedFolderName.toLowerCase())!;
      console.log(`✓ Using existing folder: "${uncategorizedFolderName}"`);
    } else {
      const newFolder = await createFolder(uncategorizedFolderName);
      uncategorizedFolderId = newFolder.id;
      foldersCreated++;
      console.log(`  ✓ Created folder: "${uncategorizedFolderName}"`);
    }

    for (const video of uncategorizedVideos) {
      const success = await moveVideoToFolder(video.id, uncategorizedFolderId);
      if (success) {
        videosMovedSuccess++;
      } else {
        videosMovedFailed++;
      }
    }
    console.log(`  ✓ Moved ${uncategorizedVideos.length} videos to "${uncategorizedFolderName}"`);
  }

  // Final summary
  console.log("\n" + "=".repeat(60));
  console.log("✨ Organization Complete!\n");
  console.log(`📊 Final Summary:`);
  console.log(`  - Total videos processed: ${allVideos.length}`);
  console.log(`  - Artists identified: ${videosByArtist.size}`);
  console.log(`  - Folders created: ${foldersCreated}`);
  console.log(`  - Videos moved successfully: ${videosMovedSuccess}`);
  console.log(`  - Videos failed to move: ${videosMovedFailed}`);
  console.log(`  - Videos needing manual review: ${uncategorizedVideos.length}`);
  console.log("=".repeat(60) + "\n");
}

main().catch((error) => {
  console.error("❌ Error:", error.message);
  process.exit(1);
});
