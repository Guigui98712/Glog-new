package io.ionic.starter;

import android.content.Context;
import android.os.Build;
import android.os.Bundle;
import android.view.textservice.SentenceSuggestionsInfo;
import android.view.textservice.SpellCheckerSession;
import android.view.textservice.SpellCheckerSession.SpellCheckerSessionListener;
import android.view.textservice.SuggestionsInfo;
import android.view.textservice.TextInfo;
import android.view.textservice.TextServicesManager;
import android.util.Log;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Locale;
import org.json.JSONException;
import java.util.concurrent.CountDownLatch;
import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "SpellChecker")
public class SpellCheckerPlugin extends Plugin implements SpellCheckerSessionListener {
    private static final String TAG = "SpellCheckerPlugin";
    private SpellCheckerSession mSpellCheckerSession;
    private PluginCall pendingCall;
    private List<String> mSuggestions = new ArrayList<>();
    private CountDownLatch mLatch;

    @Override
    public void load() {
        Log.e(TAG, "LOAD METHOD CALLED - INICIO DO METODO LOAD");
        // Inicializar o serviço de verificação ortográfica quando o plugin for carregado
        Context context = getContext();
        final TextServicesManager tsm = (TextServicesManager) 
            context.getSystemService(Context.TEXT_SERVICES_MANAGER_SERVICE);
        
        if (tsm != null) {
            // Obter a sessão do verificador ortográfico
            try {
                mSpellCheckerSession = tsm.newSpellCheckerSession(
                    null, Locale.getDefault(), this, true);
                Log.d(TAG, "SpellCheckerSession initialized successfully");
            } catch (Exception e) {
                Log.e(TAG, "Error initializing SpellCheckerSession: " + e.getMessage());
            }
        } else {
            Log.e(TAG, "TextServicesManager not available");
        }
    }

    @PluginMethod
    public void getSuggestions(PluginCall call) {
        String text = call.getString("text");
        if (text == null || text.isEmpty()) {
            call.reject("Text is required");
            return;
        }

        // Checar se o serviço está disponível
        if (mSpellCheckerSession == null) {
            JSObject ret = new JSObject();
            ret.put("suggestions", new JSArray());
            ret.put("available", false);
            ret.put("error", "Spell checker service not available");
            call.resolve(ret);
            return;
        }

        pendingCall = call;
        mSuggestions.clear();
        mLatch = new CountDownLatch(1);

        try {
            // Enviar texto para verificação
            TextInfo textInfo = new TextInfo(text);
            mSpellCheckerSession.getSuggestions(textInfo, 5);
            
            // Aguardar por até 2 segundos pelas sugestões
            Thread t = new Thread(() -> {
                try {
                    if (!mLatch.await(2000, java.util.concurrent.TimeUnit.MILLISECONDS)) {
                        Log.w(TAG, "Timeout waiting for spell checker suggestions");
                        resolveWithCurrentSuggestions();
                    }
                } catch (InterruptedException e) {
                    Log.e(TAG, "Interrupted while waiting for suggestions", e);
                    resolveWithCurrentSuggestions();
                }
            });
            t.start();
        } catch (Exception e) {
            Log.e(TAG, "Error getting suggestions: " + e.getMessage());
            call.reject("Error getting suggestions: " + e.getMessage());
        }
    }

    @PluginMethod
    public void checkAvailability(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", mSpellCheckerSession != null);
        call.resolve(ret);
    }

    private void resolveWithCurrentSuggestions() {
        if (pendingCall != null) {
            JSObject ret = new JSObject();
            JSArray suggestionsArray = new JSArray();
            
            for (String suggestion : mSuggestions) {
                suggestionsArray.put(suggestion);
            }
            
            ret.put("suggestions", suggestionsArray);
            ret.put("available", true);
            pendingCall.resolve(ret);
            pendingCall = null;
        }
    }

    @Override
    public void onGetSuggestions(SuggestionsInfo[] suggestionsInfos) {
        if (suggestionsInfos == null || suggestionsInfos.length == 0) {
            mLatch.countDown();
            return;
        }

        // Processar as sugestões recebidas
        for (SuggestionsInfo info : suggestionsInfos) {
            if (info == null) continue;
            
            int suggestionsCount = info.getSuggestionsCount();
            if (suggestionsCount > 0) {
                for (int i = 0; i < suggestionsCount; i++) {
                    mSuggestions.add(info.getSuggestionAt(i));
                }
            }
        }
        
        mLatch.countDown();
        resolveWithCurrentSuggestions();
    }

    @Override
    public void onGetSentenceSuggestions(SentenceSuggestionsInfo[] sentenceSuggestionsInfos) {
        if (sentenceSuggestionsInfos == null || sentenceSuggestionsInfos.length == 0) {
            mLatch.countDown();
            return;
        }

        // Processar as sugestões de sentenças
        for (SentenceSuggestionsInfo sentenceInfo : sentenceSuggestionsInfos) {
            if (sentenceInfo == null) continue;
            
            int suggestionsInfosCount = sentenceInfo.getSuggestionsCount();
            for (int i = 0; i < suggestionsInfosCount; i++) {
                SuggestionsInfo info = sentenceInfo.getSuggestionsInfoAt(i);
                if (info == null) continue;
                
                int suggestionsCount = info.getSuggestionsCount();
                if (suggestionsCount > 0) {
                    for (int j = 0; j < suggestionsCount; j++) {
                        mSuggestions.add(info.getSuggestionAt(j));
                    }
                }
            }
        }
        
        mLatch.countDown();
        resolveWithCurrentSuggestions();
    }
} 