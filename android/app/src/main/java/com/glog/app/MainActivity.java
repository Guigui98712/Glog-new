package com.glog.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import io.ionic.starter.SpellCheckerPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // O Capacitor irá gerenciar as permissões automaticamente
        // quando os plugins forem utilizados
        
        // Registrar plugins personalizados
        registerPlugin(SpellCheckerPlugin.class);
    }
}
