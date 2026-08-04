/* Ponte de armazenamento local do app Android.
 *
 * A página usa window.storage.get(chave) / window.storage.set(chave, valor).
 * Aqui esses métodos são ligados ao SharedPreferences do Android (interface
 * nativa "AndroidStore"), então a escala fica salva no próprio celular —
 * sem internet, sem conta, sem servidor.
 *
 * Fora do app (navegador comum, testes) cai automaticamente no localStorage,
 * mantendo exatamente o mesmo comportamento.
 */
(function () {
  "use strict";

  var nativo = window.AndroidStore;
  var temNativo = !!(nativo && typeof nativo.get === "function" && typeof nativo.set === "function");

  function resolvido(v) {
    return new Promise(function (res) { res(v); });
  }

  var loja;

  if (temNativo) {
    loja = {
      get: function (chave) {
        var v = null;
        try { v = nativo.get(String(chave)); } catch (e) { v = null; }
        return resolvido(v === null || v === undefined ? null : { value: v });
      },
      set: function (chave, valor) {
        try { nativo.set(String(chave), String(valor)); } catch (e) {
          return new Promise(function (_, rej) { rej(e); });
        }
        return resolvido(true);
      },
      remove: function (chave) {
        try { nativo.remove(String(chave)); } catch (e) {}
        return resolvido(true);
      }
    };
  } else {
    loja = {
      get: function (chave) {
        var v = null;
        try { v = window.localStorage.getItem(String(chave)); } catch (e) { v = null; }
        return resolvido(v === null || v === undefined ? null : { value: v });
      },
      set: function (chave, valor) {
        try { window.localStorage.setItem(String(chave), String(valor)); } catch (e) {
          return new Promise(function (_, rej) { rej(e); });
        }
        return resolvido(true);
      },
      remove: function (chave) {
        try { window.localStorage.removeItem(String(chave)); } catch (e) {}
        return resolvido(true);
      }
    };
  }

  /* aliases usados por outras versões da API */
  loja.getItem = loja.get;
  loja.setItem = loja.set;
  loja.delete = loja.remove;

  window.storage = loja;

  /* "Copiar para o WhatsApp": usa a área de transferência nativa do Android,
     que funciona sempre — inclusive quando a API do navegador está bloqueada. */
  if (temNativo && typeof nativo.copy === "function") {
    var area = {
      writeText: function (texto) {
        try {
          nativo.copy(String(texto));
          return resolvido(undefined);
        } catch (e) {
          return new Promise(function (_, rej) { rej(e); });
        }
      },
      readText: function () { return resolvido(""); }
    };
    try {
      Object.defineProperty(window.navigator, "clipboard", {
        value: area, configurable: true, enumerable: true, writable: false
      });
    } catch (e) {
      try { window.navigator.clipboard = area; } catch (e2) {}
    }
  }
})();
