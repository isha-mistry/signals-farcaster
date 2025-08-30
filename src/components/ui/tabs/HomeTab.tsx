"use client";

import SignalsFeed from "~/components/SignalsFeed";

/**
 * HomeTab component displays the main landing content for the mini app.
 * 
 * This is the default tab that users see when they first open the mini app.
 * It provides a simple welcome message and placeholder content that can be
 * customized for specific use cases.
 * 
 * @example
 * ```tsx
 * <HomeTab />
 * ```
 */
export function HomeTab() {
  return (
    <div className="py-2">
      <div className="max-w-md mx-auto">
        <SignalsFeed />
      </div>
    </div>
  );
} 