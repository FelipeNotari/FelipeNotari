package com.felipenotari.lanchonete

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * Um lancamento de um dia: vendas e gastos guardados em centavos (para evitar
 * erros de arredondamento com valores em dinheiro).
 */
data class DayEntry(
    val date: String,        // formato "yyyy-MM-dd"
    val salesCents: Long,    // valor vendido no dia, em centavos
    val expensesCents: Long  // valor gasto no dia, em centavos
) {
    val profitCents: Long get() = salesCents - expensesCents
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
                val o = arr.getJSONObject(i)
                val date = o.getString("date")
                map[date] = DayEntry(
                    date = date,
                    salesCents = o.getLong("salesCents"),
                    expensesCents = o.getLong("expensesCents")
                )
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
            val o = arr.getJSONObject(i)
            val date = o.getString("date")
            incoming[date] = DayEntry(
                date = date,
                salesCents = o.getLong("salesCents"),
                expensesCents = o.getLong("expensesCents")
            )
        }
        val result = if (replace) LinkedHashMap() else loadAll()
        result.putAll(incoming)
        saveAll(result)
        return incoming.size
    }

    private fun mapToJson(map: Map<String, DayEntry>): String {
        val arr = JSONArray()
        map.values
            .sortedBy { it.date }
            .forEach { e ->
                val o = JSONObject()
                o.put("date", e.date)
                o.put("salesCents", e.salesCents)
                o.put("expensesCents", e.expensesCents)
                arr.put(o)
            }
        val root = JSONObject()
        root.put("app", "Lanchonete")
        root.put("version", 1)
        root.put("entries", arr)
        return root.toString(2)
    }
}
