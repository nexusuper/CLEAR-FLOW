import "@/styles/globals.css";
import Script from 'next/script';
import { useEffect } from 'react';
import { useRouter } from 'next/router';

// Facebook Pixel helper
export const FB_PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID;
export const FB_PAGE_ID = process.env.NEXT_PUBLIC_FB_PAGE_ID || '1210958972092166';

export const pageview = () => {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', 'PageView');
  }
};

export const trackPurchase = (value, currency = 'PHP') => {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', 'Purchase', { value, currency });
  }
};

export const trackLead = () => {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', 'Lead');
  }
};

export default function App({ Component, pageProps }) {
  const router = useRouter();

  useEffect(() => {
    // Track page views on route change
    const handleRouteChange = () => pageview();
    router.events.on('routeChangeComplete', handleRouteChange);
    return () => router.events.off('routeChangeComplete', handleRouteChange);
  }, [router.events]);

  // Initialize Facebook Messenger Chat Plugin
  useEffect(() => {
    if (!FB_PAGE_ID) return;

    // Set up chatbox attributes
    const chatbox = document.getElementById('fb-customer-chat');
    if (chatbox) {
      chatbox.setAttribute('page_id', FB_PAGE_ID);
      chatbox.setAttribute('attribution', 'biz_inbox');
    }

    // Initialize FB SDK when loaded
    window.fbAsyncInit = function() {
      if (window.FB) {
        window.FB.init({
          xfbml: true,
          version: 'v18.0'
        });
      }
    };

    // Load FB SDK if not already loaded
    if (!document.getElementById('facebook-jssdk')) {
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/en_US/sdk/xfbml.customerchat.js';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
  }, []);

  return (
    <>
      {/* Meta Pixel */}
      {FB_PIXEL_ID && (
        <Script
          id="fb-pixel"
          strategy="afterInteractive"
          src="https://connect.facebook.net/en_US/fbevents.js"
          onLoad={() => {
            window.fbq('init', FB_PIXEL_ID);
            window.fbq('track', 'PageView');
          }}
        />
      )}

      {/* Facebook Messenger Chat Plugin */}
      {FB_PAGE_ID && (
        <>
          <div id="fb-root"></div>
          <div 
            id="fb-customer-chat" 
            className="fb-customerchat"
            data-page_id={FB_PAGE_ID}
            data-attribution="biz_inbox"
          ></div>
        </>
      )}

      <Component {...pageProps} />
    </>
  );
}
