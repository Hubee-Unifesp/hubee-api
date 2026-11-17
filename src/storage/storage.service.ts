export interface StorageUpload {
  pathname: string;
  buffer: Buffer;
  contentType: string;
}

export abstract class StorageService {
  abstract upload(file: StorageUpload): Promise<string>;

  abstract delete(url: string): Promise<void>;
}
