// Test script to generate card for FID 1
async function testGenerateFID1() {
  console.log('Testing card generation for FID 1...\n');

  // 1. First, fetch user data from Neynar
  console.log('1. Fetching FID 1 data from Neynar...');
  const neynarRes = await fetch('https://api.neynar.com/v2/farcaster/user/bulk?fids=1', {
    headers: {
      'api_key': '1EE80DC1-45E3-4324-91E1-9FD44E8D5E4E'
    }
  });

  const neynarData = await neynarRes.json();
  const user = neynarData.users && neynarData.users[0];

  if (!user) {
    console.log('Failed to fetch user');
    return;
  }

  console.log('   Found: ' + user.display_name + ' (@' + user.username + ')');
  console.log('   FID: ' + user.fid);
  console.log('   Followers: ' + user.follower_count);
  console.log('   PFP: ' + (user.pfp_url ? user.pfp_url.substring(0, 50) + '...' : 'none'));

  // 2. Test card image generation API
  console.log('\n2. Testing card image generation API...');
  try {
    const cardImageRes = await fetch('http://localhost:3001/api/card-image/' + user.fid);

    if (cardImageRes.ok) {
      const contentType = cardImageRes.headers.get('content-type');
      console.log('   Card image API works! Content-Type: ' + contentType);
    } else {
      console.log('   Card image API failed: ' + cardImageRes.status);
      const text = await cardImageRes.text();
      console.log('   Error: ' + text.substring(0, 200));
    }
  } catch (err) {
    console.log('   Card image API error: ' + err.message);
  }

  // 3. Test OG image generation
  console.log('\n3. Testing OG image generation API...');
  try {
    const ogRes = await fetch('http://localhost:3001/api/og-fid/' + user.fid);

    if (ogRes.ok) {
      const contentType = ogRes.headers.get('content-type');
      console.log('   OG image API works! Content-Type: ' + contentType);
    } else {
      console.log('   OG image API failed: ' + ogRes.status);
      const text = await ogRes.text();
      console.log('   Error: ' + text.substring(0, 200));
    }
  } catch (err) {
    console.log('   OG image API error: ' + err.message);
  }

  console.log('\nTest completed!');
}

testGenerateFID1().catch(console.error);
