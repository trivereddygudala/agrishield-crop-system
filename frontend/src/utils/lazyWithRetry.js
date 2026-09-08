import { lazy } from 'react';

/**
 * Enhanced React.lazy wrapper that automatically catches chunk loading / dynamic import errors
 * (e.g. "Failed to fetch dynamically imported module" caused by new Vercel deployments replacing old asset hashes)
 * and automatically triggers a clean page reload to load the latest build assets without crashing.
 */
export const lazyWithRetry = (componentImport) =>
  lazy(async () => {
    const pageHasAlreadyBeenForceRefreshed = JSON.parse(
      window.sessionStorage.getItem('chunk_retry_refreshed') || 'false'
    );

    try {
      const component = await componentImport();
      window.sessionStorage.setItem('chunk_retry_refreshed', 'false');
      return component;
    } catch (error) {
      console.warn('[Vite Dynamic Import] Chunk loading failed. Deploy version updated:', error);

      if (!pageHasAlreadyBeenForceRefreshed) {
        // Mark that we are refreshing once so we avoid infinite reload loops
        window.sessionStorage.setItem('chunk_retry_refreshed', 'true');
        window.location.reload();
        return new Promise(() => {}); // Suspend until reload takes effect
      }

      // If already reloaded and still failed, re-throw error for ErrorBoundary
      throw error;
    }
  });

export default lazyWithRetry;
