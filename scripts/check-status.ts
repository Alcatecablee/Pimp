import "dotenv/config";

const API_TOKEN = process.env.UPNSHARE_API_TOKEN;

async function main() {
  const response = await fetch('https://upnshare.com/api/v1/video/folder', {
    headers: { 'api-token': API_TOKEN! }
  });
  const data = await response.json();
  const folders = Array.isArray(data) ? data : data.data || [];
  
  console.log('Total folders:', folders.length);
  let totalVideos = 0;
  for (const folder of folders) {
    const count = folder.video_count || 0;
    console.log(`- ${folder.name}: ${count} videos`);
    totalVideos += count;
  }
  console.log('\nTotal videos across all folders:', totalVideos);
}

main();
