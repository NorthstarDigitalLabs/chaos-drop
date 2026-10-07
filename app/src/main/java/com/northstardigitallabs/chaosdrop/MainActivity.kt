package com.northstardigitallabs.chaosdrop

import android.app.Activity
import android.os.Bundle
import android.view.View
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient

class MainActivity : Activity() {
    private lateinit var game: WebView

    @Suppress("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.decorView.systemUiVisibility =
            View.SYSTEM_UI_FLAG_FULLSCREEN or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or View.SYSTEM_UI_FLAG_LAYOUT_STABLE

        game = WebView(this).apply {
            setBackgroundColor(android.graphics.Color.rgb(12, 17, 30))
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = true
            webViewClient = WebViewClient()
            webChromeClient = WebChromeClient()
            loadUrl("file:///android_asset/index.html")
        }
        setContentView(game)
    }

    @Deprecated("Deprecated in Android but still used for WebView back navigation")
    override fun onBackPressed() {
        if (::game.isInitialized && game.canGoBack()) game.goBack() else super.onBackPressed()
    }
}
