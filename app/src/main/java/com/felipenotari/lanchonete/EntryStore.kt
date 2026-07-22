package com.felipenotari.lanchonete

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * Um lancamento de um dia. As vendas sao separadas por tipo de pagamento
 * (Pix, Dinheiro e Cartao) e os valores sao guardados em centavos (para
 * evitar erros de arredondamento com dinheiro).
 */
data class DayEntry(
    val date: String,            // formato "yyyy-MM-dd"
    val description: String,     // descricao/observacao do dia
    val salesPixCents: Long,     // vendas no Pix
    val salesCashCents: Long,    // vendas em Dinheiro
    val salesCardCents: Long,    // vendas no Cartao
    val expensesCents: Long      // gastos do dia
) {
    val salesTotalCents: Long get() = salesPixCents + salesCashCents + salesCardCents
    val profitCents: Long get() = salesTotalCents - expensesCents
}

/**
 * Guarda os lancamentos num arquivo JSON dentro do proprio aplicativo
 * (armazenamento interno). Tudo funciona offline, nada vai para a internet.
 */
class EntryStore(private val context: Context) {

    private val file: File
        get() = File(context.filesDir, "lancamentos.json")

    /** Le todos os lancamentos, indexados pela data. */
    fun loadAll(): MutableMap<String, DayEntry> {
        val map = LinkedHashMap<String, DayEntry>()
        if (!file.exists()) return map
        return try {
            val json = JSONObject(file.readText())
            val arr = json.optJSONArray("entries") ?: JSONArray()
            for (i in 0 until arr.length()) {
                val e = parseEntry(arr.getJSONObject(i))
                map[e.date] = e
            }
            map
        } catch (e: Exception) {
            map
        }
    }

    private fun saveAll(map: Map<String, DayEntry>) {
        file.writeText(mapToJson(map))
    }

    /** Cria ou atualiza o lancamento de um dia. */
    fun put(entry: DayEntry) {
        val map = loadAll()
        map[entry.date] = entry
        saveAll(map)
    }

    /** Remove o lancamento de um dia. */
    fun delete(date: String) {
        val map = loadAll()
        map.remove(date)
        saveAll(map)
    }

    /** Gera o texto JSON com todos os dados (usado no backup). */
    fun exportJson(): String = mapToJson(loadAll())

    /**
     * Importa um backup. Se [replace] for verdadeiro, substitui tudo;
     * senao, junta com o que ja existe (o backup vence em caso de mesma data).
     * Retorna quantos lancamentos foram importados.
     */
    fun importJson(text: String, replace: Boolean): Int {
        val incoming = LinkedHashMap<String, DayEntry>()
        val json = JSONObject(text)
        val arr = json.optJSONArray("entries") ?: JSONArray()
        for (i in 0 until arr.length()) {
            val e = parseEntry(arr.getJSONObject(i))
            incoming[e.date] = e
        }
        val result = if (replace) LinkedHashMap() else loadAll()
        result.putAll(incoming)
        saveAll(result)
        return incoming.size
    }

    /**
     * Le um lancamento do JSON. Mantem compatibilidade com o formato antigo,
     * em que havia apenas "salesCents" (esse valor vira venda em Dinheiro).
     */
    private fun parseEntry(o: JSONObject): DayEntry {
        val date = o.getString("date")
        val hasSplit = o.has("salesPixCents") ||
            o.has("salesCashCents") || o.has("salesCardCents")
        val cashLegacy = if (!hasSplit && o.has("salesCents")) o.getLong("salesCents") else 0L
        return DayEntry(
            date = date,
            description = o.optString("description", ""),
            salesPixCents = o.optLong("salesPixCents", 0L),
            salesCashCents = o.optLong("salesCashCents", cashLegacy),
            salesCardCents = o.optLong("salesCardCents", 0L),
            expensesCents = o.optLong("expensesCents", 0L)
        )
    }

    private fun mapToJson(map: Map<String, DayEntry>): String {
        val arr = JSONArray()
        map.values
            .sortedBy { it.date }
            .forEach { e ->
                val o = JSONObject()
                o.put("date", e.date)
                o.put("description", e.description)
                o.put("salesPixCents", e.salesPixCents)
                o.put("salesCashCents", e.salesCashCents)
                o.put("salesCardCents", e.salesCardCents)
                o.put("expensesCents", e.expensesCents)
                arr.put(o)
            }
        val root = JSONObject()
        root.put("app", "Lanchonete")
        root.put("version", 2)
        root.put("entries", arr)
        return root.toString(2)
    }
}
