export interface StorageUpload {
  pathname: string;
  buffer: Buffer;
  contentType: string;
}

/**
 * Storage de arquivos públicos. Serve também de token de injeção, para que o
 * restante da API (e os testes) não dependa do provedor.
 */
export abstract class StorageService {
  /** Envia o arquivo e devolve a URL pública. */
  abstract upload(file: StorageUpload): Promise<string>;

  /** Apaga o arquivo. URLs que não são deste storage são ignoradas. */
  abstract delete(url: string): Promise<void>;
}
