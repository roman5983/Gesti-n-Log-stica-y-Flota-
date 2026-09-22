import { beforeEach, describe, expect, it, vi } from 'vitest';
import { documentsService } from './documents.service';
import { ForbiddenError, NotFoundError } from '../../shared/errors/app-error';

/**
 * Files live in the database (hosting disks are ephemeral): the upload must
 * store the bytes in the same transaction as the metadata and the audit
 * entry, and the download must serve them from there — or say clearly that
 * a file uploaded before the change is gone.
 */

const m = vi.hoisted(() => {
  const TX = { __tx: true };
  return {
    TX,
    documentsRepository: {
      activeTypeExists: vi.fn(),
      create: vi.fn(),
      findContent: vi.fn(),
    },
    driversRepository: { findById: vi.fn() },
    record: vi.fn(),
  };
});

vi.mock('../../database/prisma-client', () => ({
  prisma: { $transaction: (fn: (tx: unknown) => unknown) => fn(m.TX) },
}));
vi.mock('./documents.repository', () => ({ documentsRepository: m.documentsRepository }));
vi.mock('../drivers/drivers.repository', () => ({ driversRepository: m.driversRepository }));
vi.mock('../audit-logs/audit-logs.service', () => ({ auditLogsService: { record: m.record } }));

const ADMIN = { id: 1, role: 'ADMIN' as const };
const PDF = Buffer.from('%PDF-1.4 sample');

beforeEach(() => {
  vi.clearAllMocks();
  m.driversRepository.findById.mockResolvedValue({ userId: 5 });
  m.documentsRepository.activeTypeExists.mockResolvedValue(false);
  m.documentsRepository.create.mockImplementation(async (data: Record<string, unknown>) => ({
    id: 10,
    ...data,
    uploadedAt: new Date(),
    deletedAt: null,
  }));
});

describe('documentsService — files stored in the database', () => {
  it('stores the bytes with the metadata and the audit entry, in one transaction', async () => {
    const file = { originalname: 'licencia.pdf', mimetype: 'application/pdf', size: PDF.length, buffer: PDF };
    const expiryDate = new Date('2027-01-01T00:00:00Z');

    const doc = await documentsService.create(
      5,
      { documentType: 'LICENSE', expiryDate },
      file as Express.Multer.File,
      ADMIN,
    );

    const [data, db] = m.documentsRepository.create.mock.calls[0]!;
    expect(db).toBe(m.TX);
    expect(Buffer.from(data.content)).toEqual(PDF);
    expect(data).toMatchObject({ fileName: 'licencia.pdf', mimeType: 'application/pdf', fileSize: PDF.length });
    expect(m.record.mock.calls[0]![1]).toBe(m.TX);
    // Neither the response nor the audit snapshot carries the file.
    expect(doc).not.toHaveProperty('content');
    expect(JSON.stringify(m.record.mock.calls[0]![0])).not.toContain('PDF');
  });

  it('serves the stored bytes on download', async () => {
    m.documentsRepository.findContent.mockResolvedValue({
      driverId: 5,
      fileName: 'licencia.pdf',
      mimeType: 'application/pdf',
      content: new Uint8Array(PDF),
    });

    const file = await documentsService.getForDownload(5, 10, ADMIN);

    expect(file.fileName).toBe('licencia.pdf');
    expect(Buffer.from(file.content)).toEqual(PDF);
  });

  it('reports a file uploaded before the change (no bytes in the DB) as unavailable', async () => {
    m.documentsRepository.findContent.mockResolvedValue({
      driverId: 5,
      fileName: 'viejo.pdf',
      mimeType: 'application/pdf',
      content: null,
    });

    await expect(documentsService.getForDownload(5, 10, ADMIN)).rejects.toThrow(
      new NotFoundError('El archivo ya no está disponible'),
    );
  });

  it('does not serve a document through another driver, nor to another driver', async () => {
    m.documentsRepository.findContent.mockResolvedValue({
      driverId: 6,
      fileName: 'ajeno.pdf',
      mimeType: 'application/pdf',
      content: new Uint8Array(PDF),
    });

    await expect(documentsService.getForDownload(5, 10, ADMIN)).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      documentsService.getForDownload(6, 10, { id: 5, role: 'DRIVER' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
