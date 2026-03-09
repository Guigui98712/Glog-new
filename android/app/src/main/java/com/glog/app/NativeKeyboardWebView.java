package com.glog.app;

import android.content.Context;
import android.text.InputType;
import android.util.AttributeSet;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputConnection;

import com.getcapacitor.CapacitorWebView;

public class NativeKeyboardWebView extends CapacitorWebView {
    public NativeKeyboardWebView(Context context, AttributeSet attrs) {
        super(context, attrs);
    }

    @Override
    public InputConnection onCreateInputConnection(EditorInfo outAttrs) {
        InputConnection connection = super.onCreateInputConnection(outAttrs);
        if (outAttrs != null) {
            int inputType = outAttrs.inputType;
            if ((inputType & InputType.TYPE_CLASS_TEXT) != 0) {
                inputType &= ~InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS;
                inputType |= InputType.TYPE_TEXT_FLAG_AUTO_CORRECT;
                inputType |= InputType.TYPE_TEXT_FLAG_CAP_SENTENCES;
                outAttrs.inputType = inputType;
            }
        }
        return connection;
    }
}
