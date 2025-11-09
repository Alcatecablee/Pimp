import { Request, Response } from 'express';
import { fetchWithAuth } from '../utils/upnshare';

export async function handleGetRealtime(req: Request, res: Response) {
  try {
    console.log('[handleGetRealtime] Starting request');
    
    const API_TOKEN = process.env.UPNSHARE_API_TOKEN;
    if (!API_TOKEN) {
      console.error('[handleGetRealtime] No API token found');
      return res.status(500).json({ error: 'API token not configured' });
    }

    const response = await fetchWithAuth(
      'https://upnshare.com/api/v1/video/realtime',
      5000
    );

    if (!response.ok) {
      throw new Error(`UPnShare API error: ${response.status}`);
    }

    const data = await response.json();
    
    console.log('[handleGetRealtime] Success:', {
      totalVideos: data.data?.length || 0
    });

    return res.json(data);
  } catch (error) {
    console.error('[handleGetRealtime] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch realtime stats',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
