// Temporary B6 helper, deleted after use: boots Payload once with push on so
// drizzle creates the base `payload` schema on the scratch database.
const { getPayload } = await import('payload');
const { default: config } = await import('@payload-config');
const payload = await getPayload({ config });
const r = await payload.db.drizzle.execute(`select count(*)::int as n from information_schema.tables where table_schema='payload'`);
console.log('payload tables after push:', JSON.stringify(r.rows ?? r));
process.exit(0);
