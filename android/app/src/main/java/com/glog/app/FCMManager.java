package com.glog.app;

import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;

import com.google.firebase.messaging.FirebaseMessaging;
import org.json.JSONObject;

import java.io.IOException;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.Instant;

public class FCMManager {
    private static final String TAG = "FCMManager";
    private static final String SUPABASE_URL = "https://ionichwiclbqlfcsmhhy.supabase.co";
    private static final String SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlvbmljaHdpY2xicWxmY3NtaGh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA0MTQ0NDYsImV4cCI6MjA1NTk5MDQ0Nn0.wBvaB6D8LODmLjFQi_ZvJnAi0OaesSboEaeYINJb41w";

    public static void getToken(TokenCallback callback) {
        FirebaseMessaging.getInstance().getToken()
            .addOnCompleteListener(task -> {
                if (!task.isSuccessful()) {
                    Log.w(TAG, "Fetching FCM registration token failed", task.getException());
                    callback.onError(task.getException());
                    return;
                }

                String token = task.getResult();
                Log.d(TAG, "FCM Token: " + token);
                callback.onSuccess(token);
            });
    }

    public static void saveTokenToSupabase(String userId, String token) {
        new Thread(() -> {
            try {
                HttpURLConnection conn = getHttpURLConnection();

                JSONObject data = new JSONObject();
                data.put("user_id", userId);
                data.put("fcm_token", token);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    data.put("updated_at", Instant.now().toString());
                }

                try (OutputStream os = conn.getOutputStream()) {
                    byte[] input = data.toString().getBytes(StandardCharsets.UTF_8);
                    os.write(input, 0, input.length);
                }

                int responseCode = conn.getResponseCode();
                Log.d(TAG, "Supabase response code: " + responseCode);
            } catch (Exception e) {
                Log.e(TAG, "Error saving token to Supabase", e);
            }
        }).start();
    }

    @NonNull
    private static HttpURLConnection getHttpURLConnection() throws IOException {
        URL url = new URL(SUPABASE_URL + "/rest/v1/user_tokens");
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("apikey", SUPABASE_KEY);
        conn.setRequestProperty("Authorization", "Bearer " + SUPABASE_KEY);
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setRequestProperty("Prefer", "return=minimal");
        conn.setDoOutput(true);
        return conn;
    }

    public interface TokenCallback {
        void onSuccess(String token);
        void onError(Exception e);
    }
} 