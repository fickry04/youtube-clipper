import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { getQueue, QUEUE_NAMES } from '@/lib/queue';

interface RouteContext {
    params: Promise<{
        clipId: string;
    }>;
}

export async function POST(
    request: NextRequest,
    { params }: RouteContext,
) {
    try {
        const { clipId } = await params;

        const session = await auth.api.getSession({
            headers: request.headers,
        });

        if (!session?.user) {
            return Response.json(
                {
                    success: false,
                    error: 'Unauthorized',
                },
                { status: 401 },
            );
        }

        const body = await request.json();

        const {
            platform,
            accountId,
            caption,
            videoVariant = 'VERTICAL_SUBTITLED',
        } = body;

        if (!platform) {
            return Response.json(
                {
                    success: false,
                    error: 'Platform wajib diisi.',
                },
                { status: 400 },
            );
        }

        if (!accountId) {
            return Response.json(
                {
                    success: false,
                    error: 'Account ID wajib diisi.',
                },
                { status: 400 },
            );
        }

        // Pastikan clip milik user
        const clip = await prisma.clip.findFirst({
            where: {
                id: clipId,

                viralAnalysis: {
                    video: {
                        project: {
                            userId: session.user.id,
                        }
                    }
                },
            },
        });

        if (!clip) {
            return Response.json(
                {
                    success: false,
                    error: 'Clip tidak ditemukan.',
                },
                { status: 404 },
            );
        }

        if (clip.processingStatus !== 'COMPLETED') {
            return Response.json(
                {
                    success: false,
                    error: 'Video belum selesai diproses.',
                },
                { status: 400 },
            );
        }

        // Pastikan account milik user
        const account = await prisma.socialAccount.findFirst({
            where: {
                id: accountId,
                userId: session.user.id,
                platform,
            },
        });

        if (!account) {
            return Response.json(
                {
                    success: false,
                    error: 'Social account tidak ditemukan.',
                },
                { status: 404 },
            );
        }

        // Buat database job
        const job = await prisma.job.create({
            data: {
                userId: session.user.id,
                type: 'PUBLISH_SOCIAL',
                status: 'QUEUED',

                payload: {
                    clipId,
                    accountId,
                    platform,
                    caption,
                    videoVariant,
                },
            },
        });

        // Masukkan ke BullMQ
        await getQueue(QUEUE_NAMES.SUBTITLE).add(
            'publish-social',
            {
                jobId: job.id,
            },
            {
                jobId: job.id,
                attempts: job.maxAttempts,
                backoff: {
                    type: 'exponential',
                    delay: 5000,
                },
                removeOnComplete: false,
                removeOnFail: false,
            },
        );

        return Response.json(
            {
                success: true,
                jobId: job.id,
                status: 'QUEUED',
            },
            { status: 202 },
        );
    } catch (error) {
        console.error(
            'Create social publish job error:',
            error,
        );

        return Response.json(
            {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : 'Gagal membuat publish job.',
            },
            { status: 500 },
        );
    }
}