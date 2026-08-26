// Byte length of a local file. `uri` is an object URL on web, so fetching it is
// a local read rather than a network round trip.
// SOT-KEYWORDS: file size web blob upload presign
export const fileSize = async (uri: string): Promise<number> => {
  const res = await fetch(uri);
  return (await res.blob()).size;
};
