import { NextResponse } from 'next/server';

const VIBEFID_CONTRACT = '0x60274A138d026E3cB337B40567100FdEC3127565';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ wallet: string }> }
) {
    const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
  try {
    if (!ALCHEMY_KEY) {
      return NextResponse.json({ verified: false });
    }

    const { wallet } = await params;

    if (!wallet || !wallet.match(/^0x[a-fA-F0-9]{40}$/i)) {
      return NextResponse.json({ verified: false });
    }

    const url = `https://base-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/isHolderOfContract?wallet=${wallet.toLowerCase()}&contractAddress=${VIBEFID_CONTRACT}`;

    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      if (data.isHolderOfContract) {
        return NextResponse.json({ verified: true });
      }
    }

    return NextResponse.json({ verified: false });
  } catch {
    return NextResponse.json({ verified: false });
  }
}
