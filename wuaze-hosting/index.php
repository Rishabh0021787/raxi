<?php
// =======================================================================
// RAXI.WIN - Main Domain Host (Masked Viewport)
// Domain: https://raxiwin5.wuaze.com/
// Keeps user on https://raxiwin5.wuaze.com without redirecting to Render
// =======================================================================
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <meta name="theme-color" content="#2C0001">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="mobile-web-app-capable" content="yes">
  <link rel="icon" type="image/png" href="https://raxi-win.onrender.com/logo.png">
  <title>RAXI.WIN - #1 Premium Entertainment &amp; Gaming Platform</title>

  <style>
    *, *::before, *::after {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      -webkit-tap-highlight-color: transparent;
    }

    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: #2C0001;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }

    #appFrame {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      height: 100dvh;
      border: none;
      outline: none;
      display: block;
      z-index: 10;
      background-color: #2C0001;
    }

    #loadingScreen {
      position: fixed;
      inset: 0;
      background: radial-gradient(circle at center, #552122 0%, #2C0001 70%, #150000 100%);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      transition: opacity 0.4s ease, visibility 0.4s ease;
    }

    #loadingScreen.hidden {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }

    .loader-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
    }

    .loader-logo-img {
      width: 50px;
      height: 50px;
      object-fit: contain;
      filter: drop-shadow(0 4px 14px rgba(250,72,76,0.6));
    }

    .loader-title {
      font-size: 32px;
      font-weight: 900;
      letter-spacing: 1.5px;
      color: #fff;
      text-transform: uppercase;
    }

    .loader-title span {
      color: #FA484C;
    }

    .spinner-ring {
      width: 44px;
      height: 44px;
      border: 3.5px solid rgba(250, 72, 76, 0.2);
      border-top-color: #FA484C;
      border-right-color: #F5E5A0;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .loader-text {
      margin-top: 14px;
      font-size: 13px;
      font-weight: 600;
      color: #D09B9B;
      letter-spacing: 0.5px;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>

  <!-- Instant Branded Loading Screen -->
  <div id="loadingScreen">
    <div class="loader-brand">
      <img src="https://raxi-win.onrender.com/logo.png" alt="RAXI" class="loader-logo-img" onerror="this.style.display='none'">
      <div class="loader-title">RAXI<span>.WIN</span></div>
    </div>
    <div class="spinner-ring"></div>
    <div class="loader-text">Loading platform...</div>
  </div>

  <!-- Full-Screen Native-Like Viewport Iframe -->
  <iframe
    id="appFrame"
    src="about:blank"
    frameborder="0"
    scrolling="yes"
    allowfullscreen
    allow="autoplay *; fullscreen *; clipboard-read *; clipboard-write *; camera *; microphone *; geolocation *"
    loading="eager"
  ></iframe>

  <script>
    (function() {
      var BACKEND_ORIGIN = 'https://raxi-win.onrender.com';
      var frame = document.getElementById('appFrame');
      var loader = document.getElementById('loadingScreen');

      // 1. Resolve sub-path, query parameters and hash from raxiwin5.wuaze.com
      var path = window.location.pathname || '';
      if (path === '/' || path === '/index.php' || path === '/index.html') {
        path = '';
      }

      var fullTarget = BACKEND_ORIGIN + path + window.location.search + window.location.hash;
      frame.src = fullTarget;

      // 2. Hide loader once iframe document is ready
      var hideLoader = function() {
        if (!loader) return;
        loader.classList.add('hidden');
        setTimeout(function() {
          loader.style.display = 'none';
        }, 450);
      };

      frame.addEventListener('load', function() {
        setTimeout(hideLoader, 250);
      });

      // 3. Fallback: hide loader after 5s max in case of network lag
      setTimeout(hideLoader, 5000);

      // 4. Synchronize hash changes back and forth
      window.addEventListener('hashchange', function() {
        try {
          if (frame.contentWindow && frame.contentWindow.location.hash !== window.location.hash) {
            frame.contentWindow.location.hash = window.location.hash;
          }
        } catch(e) {}
      });

      window.addEventListener('message', function(event) {
        if (!event || !event.data) return;
        if (event.data.type === 'RAXI_URL_CHANGE' && event.data.hash) {
          if (window.location.hash !== event.data.hash) {
            history.replaceState(null, '', event.data.hash);
          }
        }
      });
    })();
  </script>

</body>
</html>
