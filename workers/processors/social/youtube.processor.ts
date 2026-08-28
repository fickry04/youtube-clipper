import { google } from 'googleapis';
import { decryptJson } from '@/lib/crypto';
import fs from 'node:fs';

// | ID | Category              |
// | -: | --------------------- |
// |  1 | Film & Animation      |
// |  2 | Autos & Vehicles      |
// | 10 | Music                 |
// | 15 | Pets & Animals        |
// | 17 | Sports                |
// | 19 | Travel & Events       |
// | 20 | Gaming                |
// | 22 | People & Blogs        |
// | 23 | Comedy                |
// | 24 | Entertainment         |
// | 25 | News & Politics       |
// | 26 | Howto & Style         |
// | 27 | Education             |
// | 28 | Science & Technology  |
// | 29 | Nonprofits & Activism |


export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expiry_date: number;
}

async function refreshAccessToken(
  refreshToken: string
): Promise<GoogleTokens> {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  const { credentials } = await oauth2Client.refreshAccessToken();

  return {
    access_token: credentials.access_token!,
    refresh_token: refreshToken,
    expiry_date: credentials.expiry_date!,
  };
}

export async function getValidYoutubeCredentials(
  encryptedCredential: string
) {
  let tokens = await decryptJson<GoogleTokens>(encryptedCredential);

  // Refresh jika token expired atau akan expired dalam 5 menit
  if (tokens.expiry_date <= Date.now() + 300000) {
    if (!tokens.refresh_token) {
      throw new Error('No refresh token available');
    }

    tokens = await refreshAccessToken(tokens.refresh_token);

    // TODO:
    // Persist tokens baru ke database jika diperlukan.
  }

  return tokens;
}

export async function uploadVideoToYouTube(
  tokens: GoogleTokens,
  videoPath: string,
  title: string,
  description: string
) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
  });

  const youtube = google.youtube({
    version: 'v3',
    auth: oauth2Client,
  });

  const response = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title,
        description,
        tags: ['shorts'],
        categoryId: '22',
      },
      status: {
        privacyStatus: 'public',
        selfDeclaredMadeForKids: false,
      }
    },
    media: {
      body: fs.createReadStream(videoPath),
    },
  });

  if (!response.data.id) {
    throw new Error('YouTube video ID was not returned');
  }

  return response.data.id;
}