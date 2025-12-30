import { NextRequest, NextResponse } from "next/server";

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY || "REDACTED";

interface NotificationPayload {
  fid: string;
  title: string;
  body: string;
  targetUrl?: string;
  token?: string;
  url?: string;
}

export async function POST(request: NextRequest) {
  try {
    const payload: NotificationPayload = await request.json();
    const { fid, title, body, targetUrl, token, url } = payload;

    if (!fid || !title || !body) {
      return NextResponse.json(
        { error: "Missing required fields: fid, title, body" },
        { status: 400 }
      );
    }

    // If token and url provided, send directly to Farcaster/Warpcast API
    if (token && url) {
      const isWarpcast = url.includes("api.farcaster.xyz");

      if (isWarpcast) {
        // Send to Warpcast notification API
        const warpcastResponse = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            notificationId: `vibefid-${Date.now()}`,
            title,
            body,
            targetUrl: targetUrl || "https://vibefid.xyz",
            tokens: [token],
          }),
        });

        const warpcastResult = await warpcastResponse.json();

        return NextResponse.json({
          success: warpcastResponse.ok,
          platform: "warpcast",
          result: warpcastResult,
        });
      } else {
        // Send to Neynar notification API
        const neynarResponse = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": NEYNAR_API_KEY,
          },
          body: JSON.stringify({
            notification_id: `vibefid-${Date.now()}`,
            title,
            body,
            target_url: targetUrl || "https://vibefid.xyz",
            tokens: [token],
          }),
        });

        const neynarResult = await neynarResponse.json();

        return NextResponse.json({
          success: neynarResponse.ok,
          platform: "neynar",
          result: neynarResult,
        });
      }
    }

    // Default: Use Neynar to send notification by FID
    const response = await fetch(
      `https://api.neynar.com/v2/farcaster/frame/notify`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": NEYNAR_API_KEY,
        },
        body: JSON.stringify({
          target_fids: [parseInt(fid)],
          notification: {
            title,
            body,
            target_url: targetUrl || "https://vibefid.xyz",
          },
        }),
      }
    );

    const result = await response.json();

    return NextResponse.json({
      success: response.ok,
      result,
    });
  } catch (error: any) {
    console.error("Error sending notification:", error);
    return NextResponse.json(
      { error: error.message || "Failed to send notification" },
      { status: 500 }
    );
  }
}
