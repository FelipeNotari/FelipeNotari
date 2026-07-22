package com.felipenotari.lanchonete

import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

private val BR = Locale("pt", "BR")

private val MESES = arrayOf(
    "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
)

/** Formata centavos como "R$ 1.234,56". */
fun formatCents(cents: Long): String {
    val sign = if (cents < 0) "-" else ""
    val abs = kotlin.math.abs(cents)
    val reais = abs / 100
    val cent = abs % 100
    val reaisStr = groupThousands(reais)
    return "$sign" + "R$ " + reaisStr + "," + cent.toString().padStart(2, '0')
}

private fun groupThousands(value: Long): String {
    val s = value.toString()
    val sb = StringBuilder()
    var count = 0
    for (i in s.length - 1 downTo 0) {
        sb.append(s[i])
        count++
        if (count % 3 == 0 && i != 0) sb.append('.')
    }
    return sb.reverse().toString()
}

/**
 * Converte o texto digitado pelo usuario em centavos.
 * Aceita "150", "150,50", "1.500,50" e tambem "150.50".
 * Retorna null se nao for um numero valido.
 */
fun parseToCents(input: String): Long? {
    var t = input.trim().replace("R$", "").replace(" ", "")
    if (t.isEmpty()) return null
    t = if (t.contains(",")) {
        // Padrao brasileiro: ponto e separador de milhar, virgula e decimal.
        t.replace(".", "").replace(",", ".")
    } else {
        t
    }
    val value = t.toDoubleOrNull() ?: return null
    return Math.round(value * 100)
}

/** Data de hoje no formato "yyyy-MM-dd". */
fun todayIso(): String {
    val fmt = SimpleDateFormat("yyyy-MM-dd", BR)
    return fmt.format(Calendar.getInstance().time)
}

/** Recebe "yyyy-MM-dd" e devolve "22/07/2026". */
fun isoToBr(iso: String): String {
    val parts = iso.split("-")
    if (parts.size != 3) return iso
    return "${parts[2]}/${parts[1]}/${parts[0]}"
}

/** Nome do mes por numero 1..12. */
fun monthName(month1to12: Int): String = MESES[(month1to12 - 1).coerceIn(0, 11)]

/** Extrai o "yyyy-MM" de uma data "yyyy-MM-dd". */
fun monthKeyOf(iso: String): String = iso.substring(0, 7)

/** Monta "yyyy-MM" a partir de ano e mes. */
fun monthKey(year: Int, month1to12: Int): String =
    "%04d-%02d".format(year, month1to12)
