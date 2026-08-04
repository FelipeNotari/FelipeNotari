package com.igrejameta.escalaapoio;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;

/**
 * Guarda a escala no proprio aparelho, usando SharedPreferences, e cuida da
 * copia para a area de transferencia. E a implementacao nativa por tras de
 * window.storage (ver assets/bridge.js).
 */
public class PonteArmazenamento {

    private static final String ARQUIVO = "escala-apoio";

    private final Context ctx;
    private final Handler principal = new Handler(Looper.getMainLooper());

    PonteArmazenamento(Context contexto) {
        this.ctx = contexto.getApplicationContext();
    }

    private SharedPreferences prefs() {
        return ctx.getSharedPreferences(ARQUIVO, Context.MODE_PRIVATE);
    }

    @JavascriptInterface
    public String get(String chave) {
        if (chave == null) {
            return null;
        }
        return prefs().getString(chave, null);
    }

    @JavascriptInterface
    public void set(String chave, String valor) {
        if (chave == null) {
            return;
        }
        // commit() em vez de apply(): a escala fica gravada em disco na hora,
        // entao nada se perde se o app for fechado logo depois de uma edicao
        prefs().edit().putString(chave, valor).commit();
    }

    @JavascriptInterface
    public void remove(String chave) {
        if (chave == null) {
            return;
        }
        prefs().edit().remove(chave).commit();
    }

    @JavascriptInterface
    public void copy(final String texto) {
        if (texto == null) {
            return;
        }
        principal.post(new Runnable() {
            @Override
            public void run() {
                ClipboardManager cb = (ClipboardManager) ctx.getSystemService(Context.CLIPBOARD_SERVICE);
                if (cb != null) {
                    cb.setPrimaryClip(ClipData.newPlainText("Escala do Apoio", texto));
                }
            }
        });
    }
}
