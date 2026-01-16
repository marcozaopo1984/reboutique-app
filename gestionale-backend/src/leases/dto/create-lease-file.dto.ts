export class CreateLeaseFileDto {
  fileName: string;
  storagePath: string;
  downloadUrl: string;
  mimeType?: string;
  sizeBytes?: number;
  notes?: string;
}
