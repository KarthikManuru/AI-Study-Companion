import { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireAuth, apiSuccess, apiError } from '@/lib/auth/helpers';
import { assertProjectOwnership } from '@/lib/db/ownership';
import { addJob } from '@/lib/jobs/queue';

// POST /api/materials/upload — upload a PDF file
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const projectId = formData.get('projectId') as string | null;

    if (!file || !projectId) {
      return apiError('File and projectId are required', 400);
    }

    // Validate ownership
    await assertProjectOwnership(user.id, projectId);

    // Validate file type
    if (file.type !== 'application/pdf') {
      return apiError('Only PDF files are supported', 400);
    }

    // Validate file size (50MB)
    if (file.size > 50 * 1024 * 1024) {
      return apiError('File must be under 50MB', 400);
    }

    // Read file and store as base64 in DB for prototype
    // (In production, this would go to Supabase Storage / S3)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    const storageUrl = `data:application/pdf;base64,stored`; // We'll store the actual data in processing

    // Create material record
    const material = await prisma.material.create({
      data: {
        projectId,
        fileName: file.name,
        storageUrl,
        status: 'QUEUED',
        fileSize: file.size,
        mimeType: file.type,
      },
    });

    // Store the file content temporarily for the worker
    // In production: upload to object storage and pass the URL
    // For prototype: store as a temp file or pass via job data
    await addJob('process-material', {
      materialId: material.id,
      projectId,
      userId: user.id,
      fileName: file.name,
      fileContent: base64, // Pass base64 content to worker
    });

    // Emit learning event
    await prisma.learningEvent.create({
      data: {
        userId: user.id,
        projectId,
        type: 'material.uploaded',
        payload: { materialId: material.id, fileName: file.name },
        idempotencyKey: `material.uploaded:${material.id}`,
      },
    });

    return apiSuccess({
      id: material.id,
      fileName: material.fileName,
      status: material.status,
    }, 201);
  } catch (error: any) {
    if (error.message === 'Unauthorized') return apiError('Unauthorized', 401);
    if (error.message?.includes('not found')) return apiError('Project not found', 404);
    console.error('POST /api/materials/upload error:', error);
    return apiError('Failed to upload material', 500);
  }
}
