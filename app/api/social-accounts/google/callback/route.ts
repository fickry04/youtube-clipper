import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { encryptJson } from '@/lib/crypto';
import { getSession } from '@/lib/auth/session';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(new URL('/dashboard/accounts?error=oauth_failed', req.url));
  }

  try {
    // 1. Tukar code dengan tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) throw new Error('Failed to fetch tokens');
    const tokens = await tokenRes.json();

    // 2. Ambil profil channel YouTube
    const ytRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!ytRes.ok) throw new Error('Failed to fetch YouTube channel');
    const ytData = await ytRes.json();
    const channel = ytData.items?.[0];

    if (!channel) throw new Error('No YouTube channel found for this account');

    // 3. Dapatkan user session
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    // 4. Encrypt credentials sebelum disimpan
    const encryptedCredential = await encryptJson({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: Date.now() + (tokens.expires_in * 1000),
    });

    // 5. Simpan / Update ke database
    const youtubeAccount = await prisma.socialAccount.findFirst({
      where: {
        userId: session.user.id,
        platform: 'YOUTUBE'
      },
      select: {
        id: true
      }
    })

    if (youtubeAccount) {
      await prisma.socialAccount.update({
        where: {
          id: youtubeAccount.id,
        },
        data: {
          encryptedCredential,
          displayName: channel.snippet.title,
          username: channel.snippet.customUrl || channel.id,
          profileUrl: `https://www.youtube.com/channel/${channel.id}`,
          isActive: true,
        }
      });
    } else {
      await prisma.socialAccount.create({
        data: {
          userId: session.user.id,
          platform: 'YOUTUBE',
          encryptedCredential,
          displayName: channel.snippet.title,
          username: channel.snippet.customUrl || channel.id,
          profileUrl: `https://www.youtube.com/channel/${channel.id}`,
          isActive: true,
        }
      });
    }
    return NextResponse.redirect(new URL('/dashboard/accounts?success=youtube_connected', req.url));
  } catch (error) {
    console.error('OAuth Callback Error:', error);
    return NextResponse.redirect(new URL('/dashboard/accounts?error=oauth_callback_failed', req.url));
  }
}