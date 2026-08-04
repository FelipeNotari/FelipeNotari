package com.igrejameta.escalaapoio;

import android.app.Activity;
import android.content.res.AssetManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewParent;
import android.webkit.ValueCallback;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Collections;

/**
 * Mostra a Escala do Apoio dentro de uma WebView, servindo os arquivos que vao
 * empacotados dentro do APK. O app funciona 100% offline: nao existe permissao
 * de internet no manifesto e nenhum dado sai do aparelho.
 */
public class MainActivity extends Activity {

    /** Origem virtual servida a partir de assets/ (contexto seguro para a WebView). */
    private static final String HOST = "appassets.androidplatform.net";
    private static final String PREFIXO = "/assets/";
    private static final String ORIGEM = "https://" + HOST + PREFIXO + "index.html";
    private static final String ARQUIVO = "file:///android_asset/index.html";

    private WebView web;
    private boolean tentouArquivo = false;

    @Override
    protected void onCreate(Bundle estado) {
        super.onCreate(estado);

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0E1726"));
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(false);
        s.setMediaPlaybackRequiresUserGesture(true);
        // mantem o layout exatamente como foi desenhado, mesmo que o aparelho
        // esteja com a fonte do sistema aumentada ou diminuida
        s.setTextZoom(100);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        web.addJavascriptInterface(new PonteArmazenamento(this), "AndroidStore");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest pedido) {
                return servir(pedido.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest pedido) {
                // o app e uma tela so: nada de navegar para fora
                return true;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest pedido, WebResourceError erro) {
                // rede de seguranca: se a origem virtual falhar por qualquer
                // motivo, abre os mesmos arquivos direto do APK
                if (pedido != null && pedido.isForMainFrame() && !tentouArquivo) {
                    tentouArquivo = true;
                    view.loadUrl(ARQUIVO);
                }
            }
        });

        setContentView(web);

        if (estado == null || web.restoreState(estado) == null) {
            web.loadUrl(ORIGEM);
        }
    }

    /** Entrega um arquivo de assets/ para a origem virtual do app. */
    private WebResourceResponse servir(Uri uri) {
        if (uri == null || !HOST.equals(uri.getHost())) {
            return null;
        }
        String caminho = uri.getPath();
        if (caminho == null || !caminho.startsWith(PREFIXO)) {
            return naoEncontrado();
        }
        String relativo = caminho.substring(PREFIXO.length());
        // nada de subir de diretorio
        if (relativo.isEmpty() || relativo.contains("..")) {
            return naoEncontrado();
        }
        try {
            AssetManager assets = getAssets();
            InputStream entrada = assets.open(relativo);
            String tipo = tipoDe(relativo);
            String codificacao = tipo.startsWith("text/")
                    || tipo.equals("application/javascript")
                    || tipo.equals("image/svg+xml") ? "utf-8" : null;
            WebResourceResponse r = new WebResourceResponse(tipo, codificacao, entrada);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                r.setResponseHeaders(Collections.singletonMap("Cache-Control", "no-store"));
            }
            return r;
        } catch (IOException e) {
            return naoEncontrado();
        }
    }

    private WebResourceResponse naoEncontrado() {
        WebResourceResponse r = new WebResourceResponse(
                "text/plain", "utf-8", new ByteArrayInputStream(new byte[0]));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            r.setStatusCodeAndReasonPhrase(404, "Not Found");
        }
        return r;
    }

    private static String tipoDe(String nome) {
        String n = nome.toLowerCase();
        if (n.endsWith(".html") || n.endsWith(".htm")) return "text/html";
        if (n.endsWith(".js")) return "application/javascript";
        if (n.endsWith(".css")) return "text/css";
        if (n.endsWith(".woff2")) return "font/woff2";
        if (n.endsWith(".woff")) return "font/woff";
        if (n.endsWith(".ttf")) return "font/ttf";
        if (n.endsWith(".svg")) return "image/svg+xml";
        if (n.endsWith(".png")) return "image/png";
        if (n.endsWith(".json")) return "application/json";
        return "application/octet-stream";
    }

    @Override
    protected void onSaveInstanceState(Bundle estado) {
        super.onSaveInstanceState(estado);
        if (web != null) {
            web.saveState(estado);
        }
    }

    /** Voltar fecha o painel aberto; sem painel aberto, sai do app. */
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (web == null) {
            super.onBackPressed();
            return;
        }
        web.evaluateJavascript(
                "(function(){var p=document.getElementById('painel');"
                        + "if(p&&p.classList.contains('aberto')){"
                        + "var f=document.getElementById('fundo');if(f)f.click();return 'fechou';}"
                        + "return 'sair';})()",
                new ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String valor) {
                        if (valor == null || !valor.contains("fechou")) {
                            finish();
                        }
                    }
                });
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.removeJavascriptInterface("AndroidStore");
            ViewParent pai = web.getParent();
            if (pai instanceof ViewGroup) {
                ((ViewGroup) pai).removeView(web);
            }
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
