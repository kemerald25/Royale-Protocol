// Type declarations for Node.js Buffer in browser environment
declare module "buffer" {
  export const Buffer: {
    from(data: string | Uint8Array, encoding?: string): Buffer;
    concat(buffers: Buffer[]): Buffer;
    alloc(size: number): Buffer;
  };
}

