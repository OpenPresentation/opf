/** CRC-32 of the bytes, as an unsigned integer. */
export declare function crc32(bytes: Uint8Array): number;
/** A ZIP archive of `[{ name, bytes }]` (deflated when the platform can, stored otherwise; fixed timestamps so equal input gives equal bytes). */
export declare function createZip(entries: Array<{ name: string; bytes: Uint8Array }>, options?: { compress?: boolean; signal?: AbortSignal }): Promise<Uint8Array>;
