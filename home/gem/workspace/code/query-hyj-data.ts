import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { agentCountryCoopCountStat, logisticsRoute } from './server/database/schema';
import { ilike } from 'drizzle-orm';

async function main() {
  const connectionString = process.env.DATABASE_URL || '';
  const pg = postgres(connectionString, { max: 1 });
  const db = drizzle(pg);

  console.log('=== 示例货代B在 agentCountryCoopCountStat 表中的所有记录 ===');
  const coopRecords = await db.select().from(agentCountryCoopCountStat).where(ilike(agentCountryCoopCountStat.appFreightForwarderName, '%示例货代B%'));
  console.log(JSON.stringify(coopRecords, null, 2));

  console.log('\n=== 示例货代B在 logisticsRoute 表中的所有线路 ===');
  const routeRecords = await db.select().from(logisticsRoute).where(ilike(logisticsRoute.name, '%示例货代B%'));
  console.log(JSON.stringify(routeRecords, null, 2));

  await pg.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
