package com.agrishield.croppathology;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.AssetManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.webkit.WebResourceErrorCompat;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;

import java.io.InputStream;
import java.net.URLConnection;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends AppCompatActivity {

    private WebView mWebView;
    private ValueCallback<Uri[]> mUploadMessage;
    private static final int FILECHOOSER_RESULTCODE = 1001;
    private static final int PERMISSION_REQUEST_CODE = 2001;
    private static final String APP_ASSETS_DOMAIN = "appassets.androidplatform.net";
    private static final String FALLBACK_PRODUCTION_URL = "https://agrishield-crop-system.onrender.com";

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Hardware acceleration & system bar appearance
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
            WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED
        );

        mWebView = new WebView(this);
        // Set dark slate background matching #0f172a theme to prevent white flash during boot
        mWebView.setBackgroundColor(0xFF0F172A);
        setContentView(mWebView);

        configureWebSettings();
        requestAppPermissions();

        // 1. Build WebViewAssetLoader for secure local HTTPS asset serving (bypasses Chromium file:// CORS blocks)
        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
            .setDomain(APP_ASSETS_DOMAIN)
            .addPathHandler("/", new WebViewAssetLoader.PathHandler() {
                @Nullable
                @Override
                public WebResourceResponse handle(@NonNull String path) {
                    try {
                        AssetManager am = getAssets();
                        String assetPath;
                        if (path.isEmpty() || path.equals("/") || path.equals("index.html")) {
                            assetPath = "public/index.html";
                        } else {
                            assetPath = "public/" + path;
                        }

                        // Try direct asset stream
                        try {
                            InputStream is = am.open(assetPath);
                            String mimeType = getMimeType(assetPath);
                            String encoding = isTextMime(mimeType) ? "UTF-8" : null;
                            WebResourceResponse response = new WebResourceResponse(mimeType, encoding, is);
                            Map<String, String> headers = new HashMap<>();
                            headers.put("Access-Control-Allow-Origin", "*");
                            headers.put("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
                            headers.put("Access-Control-Allow-Headers", "*");
                            response.setResponseHeaders(headers);
                            return response;
                        } catch (Exception notDirectAsset) {
                            // Single Page Application (SPA) client-side route fallback:
                            // If the path does not have a static file extension (e.g. /dashboard, /farm, /upload, /market)
                            // return index.html so React Router renders the route client-side without 404!
                            if (!path.contains(".") || path.endsWith(".html")) {
                                InputStream is = am.open("public/index.html");
                                WebResourceResponse response = new WebResourceResponse("text/html", "UTF-8", is);
                                Map<String, String> headers = new HashMap<>();
                                headers.put("Access-Control-Allow-Origin", "*");
                                response.setResponseHeaders(headers);
                                return response;
                            }
                            return null;
                        }
                    } catch (Exception e) {
                        return null;
                    }
                }
            })
            .build();

        // 2. Configure WebChromeClient (Console diagnostics, WebRTC camera permission, File uploads)
        mWebView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(android.webkit.ConsoleMessage consoleMessage) {
                android.util.Log.d("AgriShieldJS", "[" + consoleMessage.messageLevel() + "] " +
                    consoleMessage.message() + " (" + consoleMessage.sourceId() + ":" + consoleMessage.lineNumber() + ")");
                return true;
            }

            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                MainActivity.this.runOnUiThread(() -> {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                        request.grant(request.getResources());
                    }
                });
            }

            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (mUploadMessage != null) {
                    mUploadMessage.onReceiveValue(null);
                    mUploadMessage = null;
                }
                mUploadMessage = filePathCallback;

                Intent intent = null;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    intent = fileChooserParams.createIntent();
                } else {
                    intent = new Intent(Intent.ACTION_GET_CONTENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("image/*");
                }

                try {
                    startActivityForResult(intent, FILECHOOSER_RESULTCODE);
                } catch (Exception e) {
                    mUploadMessage = null;
                    return false;
                }
                return true;
            }
        });

        // 3. Configure WebViewClientCompat with request interception
        mWebView.setWebViewClient(new WebViewClientCompat() {
            @Nullable
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.startsWith("https://" + APP_ASSETS_DOMAIN) ||
                    url.startsWith("https://agrishield-crop-system.onrender.com") ||
                    url.startsWith("https://agrishield-ai-worker")) {
                    return false; // Load inside WebView
                }
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    startActivity(intent);
                    return true;
                } catch (Exception e) {
                    return false;
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceErrorCompat error) {
                super.onReceivedError(view, request, error);
                if (request.isForMainFrame()) {
                    android.util.Log.e("AgriShield", "WebView Main Frame Error: " + error.getDescription());
                }
            }
        });

        // 4. Setup OnBackPressedDispatcher for Android 13+ (API 33+)
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (mWebView != null && mWebView.canGoBack()) {
                    mWebView.goBack();
                } else {
                    finish();
                }
            }
        });

        // 5. Load bundled offline assets or live cloud cluster
        loadApplication();
    }

    private void configureWebSettings() {
        WebSettings settings = mWebView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);

        // Custom User Agent identifier for on-device mobile optimization
        String defaultUA = settings.getUserAgentString();
        settings.setUserAgentString(defaultUA + " AgriShieldAI/1.0 NativeContainer");
    }

    private void loadApplication() {
        boolean hasLocalAssets = false;
        try (InputStream is = getAssets().open("public/index.html")) {
            if (is != null) {
                hasLocalAssets = true;
            }
        } catch (Exception ignored) {
        }

        if (hasLocalAssets) {
            // Load through secure appassets virtual domain (solves file:// CORS block on ES modules)
            mWebView.loadUrl("https://" + APP_ASSETS_DOMAIN + "/index.html");
        } else {
            // Fallback to active Render cloud cluster
            mWebView.loadUrl(FALLBACK_PRODUCTION_URL);
        }
    }

    private boolean isTextMime(String mimeType) {
        if (mimeType == null) return false;
        return mimeType.startsWith("text/") ||
               mimeType.equals("application/json") ||
               mimeType.equals("application/javascript") ||
               mimeType.equals("image/svg+xml");
    }

    private String getMimeType(String path) {
        String lower = path.toLowerCase();
        if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
        if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "text/javascript";
        if (lower.endsWith(".css")) return "text/css";
        if (lower.endsWith(".json")) return "application/json";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".gif")) return "image/gif";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".ico")) return "image/x-icon";
        if (lower.endsWith(".woff")) return "font/woff";
        if (lower.endsWith(".woff2")) return "font/woff2";
        if (lower.endsWith(".ttf")) return "font/ttf";
        if (lower.endsWith(".otf")) return "font/otf";
        if (lower.endsWith(".wasm")) return "application/wasm";
        if (lower.endsWith(".onnx") || lower.endsWith(".bin")) return "application/octet-stream";

        String guessed = URLConnection.guessContentTypeFromName(path);
        return guessed != null ? guessed : "application/octet-stream";
    }

    private void requestAppPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(
                    this,
                    new String[]{
                        Manifest.permission.CAMERA,
                        Manifest.permission.ACCESS_NETWORK_STATE
                    },
                    PERMISSION_REQUEST_CODE
                );
            }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILECHOOSER_RESULTCODE) {
            if (mUploadMessage == null) return;
            Uri[] results = null;
            if (resultCode == Activity.RESULT_OK && data != null) {
                String dataString = data.getDataString();
                if (dataString != null) {
                    results = new Uri[]{Uri.parse(dataString)};
                } else if (data.getClipData() != null) {
                    int count = data.getClipData().getItemCount();
                    results = new Uri[count];
                    for (int i = 0; i < count; i++) {
                        results[i] = data.getClipData().getItemAt(i).getUri();
                    }
                }
            }
            mUploadMessage.onReceiveValue(results);
            mUploadMessage = null;
        } else {
            super.onActivityResult(requestCode, resultCode, data);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (mWebView != null) {
            mWebView.onResume();
        }
    }

    @Override
    protected void onPause() {
        if (mWebView != null) {
            mWebView.onPause();
        }
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (mWebView != null) {
            mWebView.destroy();
        }
        super.onDestroy();
    }
}
