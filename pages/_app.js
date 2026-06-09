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
          <div id="fb-customer-chat" className="fb-customerchat"></div>
          <Script
            id="fb-sdk"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                var chatbox = document.getElementById('fb-customer-chat');
                if (chatbox) {
                  chatbox.setAttribute('page_id', '${FB_PAGE_ID}');
                  chatbox.setAttribute('attribution', 'biz_inbox');
                }
                window.fbAsyncInit = function() {
                  FB.init({ xfbml: true, version: 'v18.0' });
                };
                (function(d, s, id) {
                  var js, fjs = d.getElementsByTagName(s)[0];
                  if (d.getElementById(id)) return;
                  js = d.createElement(s); js.id = id;
                  js.src = 'https://connect.facebook.net/en_US/sdk/xfbml.customerchat.js';
                  fjs.parentNode.insertBefore(js, fjs);
                }(document, 'script', 'facebook-jssdk'));
              `,
            }}
          />
        </>
      )}

      <Component {...pageProps} />
    </>
  );
}
