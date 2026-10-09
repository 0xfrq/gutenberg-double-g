declare module "epubjs" {
  // The reader narrows this to the small slice of the API it uses.
  const ePub: (input: ArrayBuffer | string, options?: Record<string, unknown>) => unknown;
  export default ePub;
}
