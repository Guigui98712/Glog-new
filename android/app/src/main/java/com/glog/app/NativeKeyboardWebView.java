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
                int variation = inputType & InputType.TYPE_MASK_VARIATION;

                boolean isEmail = variation == InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
                        || variation == InputType.TYPE_TEXT_VARIATION_WEB_EMAIL_ADDRESS;

                boolean isPassword = variation == InputType.TYPE_TEXT_VARIATION_PASSWORD
                        || variation == InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD
                        || variation == InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD;

                if (!isEmail && !isPassword) {
                    inputType &= ~InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS;
                    inputType |= InputType.TYPE_TEXT_FLAG_AUTO_CORRECT;
                    inputType |= InputType.TYPE_TEXT_FLAG_CAP_SENTENCES;
                }

                outAttrs.inputType = inputType;
            }
        }
        return connection;
    }
}
