import "@/styles/globals.css";
import Script from 'next/script';
import { useEffect } from 'react';
import { useRouter } from 'next/router';

// Facebook Pixel helper
export const FB_PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID;
export const FB_PAGE_ID = process.env.NEXT_PUBLIC_FB_PAGE_ID;

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
        <>
          <Script
            id="fb-pixel"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                !function(f,b,e,v,n,t,s)
                {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                n.queue=[];t=b.createElement(e);t.async=!0;
                t.src=v;s=b.getElementsByTagName(e)[0];
                s.parentNode.insertBefore(t,s)}(window, document,'script',
                'https://connect.facebook.net/en_US/fbevents.js');
                fbq('init', '${FB_PIXEL_ID}');
                fbq('track', 'PageView');
              `,
            }}
          />
          <noscript>
            <img
              height="1"
              width="1"
              style={{ display: 'none' }}
              src={`https://www.facebook.com/tr?id=${FB_PIXEL_ID}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        </>
      )}

      {/* Facebook SDK for Messenger Chat Plugin */}
      {FB_PAGE_ID && (
        <>
          <div id="fb-root"></div>
          <div id="fb-customer-chat" className="fb-customerchat"></div>
          <Script
            id="fb-sdk"
            strategy="lazyOnload"
            dangerouslySetInnerHTML={{
              __html: `
                var chatbox = document.getElementById('fb-customer-chat');
                chatbox.setAttribute("page_id", "${FB_PAGE_ID}");
                chatbox.setAttribute("attribution", "biz_inbox");

                window.fbAsyncInit = function() {
                  FB.init({
                    xfbml: true,
                    version: 'v18.0'
                  });
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
