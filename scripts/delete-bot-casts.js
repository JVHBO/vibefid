// Script to delete all casts from the @vibefid bot
// Run with: node scripts/delete-bot-casts.js

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const BOT_SIGNER_UUID = process.env.BOT_SIGNER_UUID;

// Get bot FID from command line or lookup
const BOT_USERNAME = 'vibefid';

async function getBotFid() {
  const response = await fetch(
    `https://api.neynar.com/v2/farcaster/user/by_username?username=${BOT_USERNAME}`,
    { headers: { api_key: NEYNAR_API_KEY } }
  );
  if (response.ok) {
    const data = await response.json();
    return data.user?.fid;
  }
  throw new Error('Could not find bot FID');
}

async function getBotCasts(fid, cursor = null) {
  let url = `https://api.neynar.com/v2/farcaster/feed/user/casts?fid=${fid}&limit=150`;
  if (cursor) {
    url += `&cursor=${cursor}`;
  }

  const response = await fetch(url, {
    headers: { api_key: NEYNAR_API_KEY }
  });

  if (response.ok) {
    return await response.json();
  }
  throw new Error('Failed to fetch casts');
}

async function deleteCast(hash) {
  const response = await fetch('https://api.neynar.com/v2/farcaster/cast', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'api_key': NEYNAR_API_KEY,
    },
    body: JSON.stringify({
      signer_uuid: BOT_SIGNER_UUID,
      target_hash: hash,
    }),
  });

  return response.ok;
}

async function main() {
  if (!NEYNAR_API_KEY || !BOT_SIGNER_UUID) {
    console.error('Missing NEYNAR_API_KEY or BOT_SIGNER_UUID environment variables');
    console.log('Run with: NEYNAR_API_KEY=xxx BOT_SIGNER_UUID=xxx node scripts/delete-bot-casts.js');
    process.exit(1);
  }

  console.log('Getting bot FID...');
  const botFid = await getBotFid();
  console.log(`Bot FID: ${botFid}`);

  let cursor = null;
  let totalDeleted = 0;
  let totalFailed = 0;

  while (true) {
    console.log(`\nFetching casts... (cursor: ${cursor || 'start'})`);
    const data = await getBotCasts(botFid, cursor);
    const casts = data.casts || [];

    if (casts.length === 0) {
      console.log('No more casts to delete.');
      break;
    }

    console.log(`Found ${casts.length} casts to delete`);

    for (const cast of casts) {
      const hash = cast.hash;
      const text = cast.text?.substring(0, 50) || '';

      process.stdout.write(`Deleting ${hash.substring(0, 10)}... "${text}..." `);

      const success = await deleteCast(hash);
      if (success) {
        console.log('✓');
        totalDeleted++;
      } else {
        console.log('✗ FAILED');
        totalFailed++;
      }

      // Rate limit: wait 100ms between deletes
      await new Promise(r => setTimeout(r, 100));
    }

    cursor = data.next?.cursor;
    if (!cursor) {
      break;
    }
  }

  console.log(`\n========================================`);
  console.log(`Total deleted: ${totalDeleted}`);
  console.log(`Total failed: ${totalFailed}`);
  console.log(`========================================`);
}

main().catch(console.error);
