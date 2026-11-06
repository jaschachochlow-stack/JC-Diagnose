package de.jc.diagnose;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(JCLinkPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
