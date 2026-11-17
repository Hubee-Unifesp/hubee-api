import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { VercelBlobStorageService } from './vercel-blob-storage.service';

@Module({
  providers: [{ provide: StorageService, useClass: VercelBlobStorageService }],
  exports: [StorageService],
})
export class StorageModule {}
