'use client';

import { useEffect } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';

/**
 * Component to register Farcaster notification token
 * Runs automatically when user opens the app in Farcaster
 */
export function FarcasterNotificationRegistration() {
  const saveToken = useMutation(api.notifications.saveToken);

  useEffect(() => {
    async function registerNotificationToken() {
      try {
        const { sdk } = await import('@farcaster/miniapp-sdk');
        const context = await sdk.context;

        if (!context?.user?.fid) {
          return;
        }

        const fid = context.user.fid.toString();

        // 1. Check if token exists in context (user already has notifications enabled)
        const contextDetails = (context.client as any)?.notificationDetails;
        if (contextDetails?.token && contextDetails?.url) {
          await saveToken({ fid, token: contextDetails.token, url: contextDetails.url, app: "vibefid" });
          console.log('[VibeFID] ✅ Token from context for FID:', fid);
          return;
        }

        // 2. Otherwise try addMiniApp (prompts user to add/enable notifications)
        const result = await sdk.actions.addMiniApp();
        console.log('[VibeFID] addMiniApp result:', result);

        if (result?.notificationDetails) {
          const { token, url } = result.notificationDetails;
          await saveToken({ fid, token, url, app: "vibefid" });
          console.log('[VibeFID] ✅ Token from addMiniApp for FID:', fid);
        }
      } catch (error) {
        console.error('[VibeFID] Notification error:', error);
      }
    }

    registerNotificationToken();
  }, [saveToken]);

  return null;
}
