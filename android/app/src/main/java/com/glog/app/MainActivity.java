package com.glog.app;

import android.os.Bundle;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Logger;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        try {
            super.onCreate(savedInstanceState);
            
            // Habilitando depuração para WebView
            WebView.setWebContentsDebuggingEnabled(true);
        } catch (Exception e) {
            Logger.error("Error initializing app", e);
        }
    }
}
