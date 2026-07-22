package com.felipenotari.lanchonete

import android.app.Activity
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone

private val Laranja = Color(0xFFE8590C)
private val Verde = Color(0xFF2B8A3E)
private val Vermelho = Color(0xFFC92A2A)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val store = EntryStore(applicationContext)
        setContent {
            MaterialTheme(colorScheme = lightColorScheme(primary = Laranja)) {
                App(store)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun App(store: EntryStore) {
    val context = LocalContext.current

    var entries by remember { mutableStateOf(store.loadAll().toMap()) }
    fun refresh() { entries = store.loadAll().toMap() }

    var tab by remember { mutableStateOf(0) }
    var editDate by remember { mutableStateOf(todayIso()) }

    val exportLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("application/json")
    ) { uri ->
        if (uri != null) {
            try {
                context.contentResolver.openOutputStream(uri)?.use {
                    it.write(store.exportJson().toByteArray())
                }
                Toast.makeText(context, "Backup salvo com sucesso!", Toast.LENGTH_LONG).show()
            } catch (e: Exception) {
                Toast.makeText(context, "Erro ao salvar o backup.", Toast.LENGTH_LONG).show()
            }
        }
    }

    val importLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri ->
        if (uri != null) {
            try {
                val text = context.contentResolver.openInputStream(uri)
                    ?.bufferedReader()?.use { it.readText() } ?: ""
                val n = store.importJson(text, replace = false)
                refresh()
                Toast.makeText(context, "$n lancamentos importados.", Toast.LENGTH_LONG).show()
            } catch (e: Exception) {
                Toast.makeText(context, "Arquivo invalido.", Toast.LENGTH_LONG).show()
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Lanchonete", fontWeight = FontWeight.Bold) },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Laranja,
                    titleContentColor = Color.White
                )
            )
        },
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    selected = tab == 0,
                    onClick = { tab = 0 },
                    icon = { Icon(Icons.Filled.AddCircle, null) },
                    label = { Text("Lancar") }
                )
                NavigationBarItem(
                    selected = tab == 1,
                    onClick = { tab = 1 },
                    icon = { Icon(Icons.Filled.BarChart, null) },
                    label = { Text("Resumo") }
                )
                NavigationBarItem(
                    selected = tab == 2,
                    onClick = { tab = 2 },
                    icon = { Icon(Icons.Filled.Save, null) },
                    label = { Text("Backup") }
                )
            }
        }
    ) { padding ->
        Box(Modifier.padding(padding)) {
            when (tab) {
                0 -> LancarScreen(
                    initialDate = editDate,
                    entries = entries,
                    onSaved = { date ->
                        editDate = date
                        refresh()
                        Toast.makeText(context, "Dia salvo!", Toast.LENGTH_SHORT).show()
                    }
                )
                1 -> ResumoScreen(
                    entries = entries,
                    onEditDay = { date ->
                        editDate = date
                        tab = 0
                    },
                    onDelete = { date ->
                        store.delete(date)
                        refresh()
                        Toast.makeText(context, "Dia apagado.", Toast.LENGTH_SHORT).show()
                    }
                )
                2 -> BackupScreen(
                    onExport = {
                        val nome = "backup-lanchonete-${todayIso()}.json"
                        exportLauncher.launch(nome)
                    },
                    onImport = { importLauncher.launch(arrayOf("application/json", "text/*")) }
                )
            }
        }
    }
}

/* ----------------------- Tela: Lancar o dia ----------------------- */

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LancarScreen(
    initialDate: String,
    entries: Map<String, DayEntry>,
    onSaved: (String) -> Unit
) {
    val context = LocalContext.current
    var date by remember(initialDate) { mutableStateOf(initialDate) }
    var sales by remember(initialDate) { mutableStateOf("") }
    var expenses by remember(initialDate) { mutableStateOf("") }
    var showPicker by remember { mutableStateOf(false) }

    // Carrega os valores do dia selecionado (se ja houver lancamento).
    LaunchedEffect(date, entries) {
        val e = entries[date]
        sales = e?.let { centsToEdit(it.salesCents) } ?: ""
        expenses = e?.let { centsToEdit(it.expensesCents) } ?: ""
    }

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp)
    ) {
        Text("Lancar o dia", fontSize = 22.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(16.dp))

        Text("Data", fontWeight = FontWeight.Medium)
        Spacer(Modifier.height(4.dp))
        OutlinedButton(
            onClick = { showPicker = true },
            modifier = Modifier.fillMaxWidth()
        ) {
            Icon(Icons.Filled.CalendarMonth, null)
            Spacer(Modifier.width(8.dp))
            Text(isoToBr(date), fontSize = 18.sp)
        }

        Spacer(Modifier.height(20.dp))
        MoneyField("Quanto vendeu hoje", sales, Verde) { sales = it }

        Spacer(Modifier.height(16.dp))
        MoneyField("Quanto gastou hoje", expenses, Vermelho) { expenses = it }

        Spacer(Modifier.height(12.dp))
        val previewSales = parseToCents(sales) ?: 0L
        val previewExpenses = parseToCents(expenses) ?: 0L
        val lucro = previewSales - previewExpenses
        Text(
            "Lucro do dia: ${formatCents(lucro)}",
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
            color = if (lucro >= 0) Verde else Vermelho
        )

        Spacer(Modifier.height(24.dp))
        Button(
            onClick = {
                val s = parseToCents(sales)
                val g = parseToCents(expenses)
                if ((sales.isNotBlank() && s == null) || (expenses.isNotBlank() && g == null)) {
                    Toast.makeText(context, "Digite um valor valido.", Toast.LENGTH_SHORT).show()
                    return@Button
                }
                store_put(context, DayEntry(date, s ?: 0L, g ?: 0L))
                onSaved(date)
            },
            modifier = Modifier.fillMaxWidth().height(56.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Laranja)
        ) {
            Icon(Icons.Filled.Check, null)
            Spacer(Modifier.width(8.dp))
            Text("Salvar", fontSize = 18.sp)
        }
    }

    if (showPicker) {
        val state = rememberDatePickerState(
            initialSelectedDateMillis = isoToUtcMillis(date)
        )
        DatePickerDialog(
            onDismissRequest = { showPicker = false },
            confirmButton = {
                TextButton(onClick = {
                    state.selectedDateMillis?.let { date = utcMillisToIso(it) }
                    showPicker = false
                }) { Text("OK") }
            },
            dismissButton = {
                TextButton(onClick = { showPicker = false }) { Text("Cancelar") }
            }
        ) {
            DatePicker(state = state)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MoneyField(label: String, value: String, accent: Color, onChange: (String) -> Unit) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label) },
        prefix = { Text("R$ ") },
        singleLine = true,
        textStyle = androidx.compose.ui.text.TextStyle(fontSize = 22.sp, fontWeight = FontWeight.Bold),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = accent,
            focusedLabelColor = accent
        ),
        modifier = Modifier.fillMaxWidth()
    )
}

/* ----------------------- Tela: Resumo do mes ----------------------- */

@Composable
fun ResumoScreen(
    entries: Map<String, DayEntry>,
    onEditDay: (String) -> Unit,
    onDelete: (String) -> Unit
) {
    val cal = remember { Calendar.getInstance() }
    var year by remember { mutableStateOf(cal.get(Calendar.YEAR)) }
    var month by remember { mutableStateOf(cal.get(Calendar.MONTH) + 1) }

    val key = monthKey(year, month)
    val monthEntries = entries.values
        .filter { monthKeyOf(it.date) == key }
        .sortedByDescending { it.date }

    val totalSales = monthEntries.sumOf { it.salesCents }
    val totalExpenses = monthEntries.sumOf { it.expensesCents }
    val lucro = totalSales - totalExpenses

    var confirmDelete by remember { mutableStateOf<String?>(null) }

    Column(Modifier.fillMaxSize().padding(16.dp)) {
        // Seletor de mes
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = {
                month--; if (month < 1) { month = 12; year-- }
            }) { Icon(Icons.Filled.ChevronLeft, "Mes anterior") }

            Text(
                "${monthName(month)} $year",
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold
            )

            IconButton(onClick = {
                month++; if (month > 12) { month = 1; year++ }
            }) { Icon(Icons.Filled.ChevronRight, "Proximo mes") }
        }

        Spacer(Modifier.height(12.dp))
        TotalCard("Vendas do mes", totalSales, Verde)
        Spacer(Modifier.height(8.dp))
        TotalCard("Gastos do mes", totalExpenses, Vermelho)
        Spacer(Modifier.height(8.dp))
        TotalCard(
            if (lucro >= 0) "Lucro do mes" else "Prejuizo do mes",
            lucro,
            if (lucro >= 0) Verde else Vermelho,
            big = true
        )

        Spacer(Modifier.height(16.dp))
        Text("Dias lancados", fontWeight = FontWeight.Bold, fontSize = 16.sp)
        Spacer(Modifier.height(8.dp))

        if (monthEntries.isEmpty()) {
            Text(
                "Nenhum lancamento neste mes.\nVa em \"Lancar\" para adicionar.",
                color = Color.Gray
            )
        } else {
            Column(Modifier.verticalScroll(rememberScrollState())) {
                monthEntries.forEach { e ->
                    DayRow(e, onClick = { onEditDay(e.date) }, onDelete = { confirmDelete = e.date })
                    HorizontalDivider()
                }
            }
        }
    }

    confirmDelete?.let { d ->
        AlertDialog(
            onDismissRequest = { confirmDelete = null },
            title = { Text("Apagar o dia ${isoToBr(d)}?") },
            text = { Text("Essa acao nao pode ser desfeita.") },
            confirmButton = {
                TextButton(onClick = { onDelete(d); confirmDelete = null }) {
                    Text("Apagar", color = Vermelho)
                }
            },
            dismissButton = {
                TextButton(onClick = { confirmDelete = null }) { Text("Cancelar") }
            }
        )
    }
}

@Composable
private fun TotalCard(label: String, cents: Long, color: Color, big: Boolean = false) {
    Card(
        Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = color.copy(alpha = 0.10f))
    ) {
        Column(Modifier.padding(16.dp)) {
            Text(label, color = Color.DarkGray, fontSize = 14.sp)
            Text(
                formatCents(cents),
                color = color,
                fontSize = if (big) 30.sp else 22.sp,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@Composable
private fun DayRow(e: DayEntry, onClick: () -> Unit, onDelete: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(Modifier.weight(1f)) {
            Text(isoToBr(e.date), fontWeight = FontWeight.Bold, fontSize = 16.sp)
            Text(
                "Vendas ${formatCents(e.salesCents)}  |  Gastos ${formatCents(e.expensesCents)}",
                fontSize = 13.sp,
                color = Color.DarkGray
            )
            Text(
                "Lucro ${formatCents(e.profitCents)}",
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = if (e.profitCents >= 0) Verde else Vermelho
            )
        }
        IconButton(onClick = onClick) { Icon(Icons.Filled.Edit, "Editar") }
        IconButton(onClick = onDelete) { Icon(Icons.Filled.Delete, "Apagar", tint = Vermelho) }
    }
}

/* ----------------------- Tela: Backup ----------------------- */

@Composable
fun BackupScreen(onExport: () -> Unit, onImport: () -> Unit) {
    Column(
        Modifier.fillMaxSize().padding(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("Backup dos dados", fontSize = 22.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Text(
            "Seus dados ficam guardados so neste celular. " +
                "Faca um backup de vez em quando para nao perder nada se trocar de aparelho.",
            textAlign = TextAlign.Center,
            color = Color.DarkGray
        )
        Spacer(Modifier.height(28.dp))

        Button(
            onClick = onExport,
            modifier = Modifier.fillMaxWidth().height(56.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Verde)
        ) {
            Icon(Icons.Filled.Upload, null)
            Spacer(Modifier.width(8.dp))
            Text("Exportar backup", fontSize = 18.sp)
        }

        Spacer(Modifier.height(16.dp))
        OutlinedButton(
            onClick = onImport,
            modifier = Modifier.fillMaxWidth().height(56.dp)
        ) {
            Icon(Icons.Filled.Download, null)
            Spacer(Modifier.width(8.dp))
            Text("Importar backup", fontSize = 18.sp)
        }

        Spacer(Modifier.height(24.dp))
        Text(
            "Ao exportar, escolha uma pasta segura (por exemplo o Google Drive ou Downloads). " +
                "Ao importar, os dias do backup sao somados aos que ja existem.",
            fontSize = 13.sp,
            textAlign = TextAlign.Center,
            color = Color.Gray
        )
    }
}

/* ----------------------- Utilidades ----------------------- */

private fun store_put(context: android.content.Context, entry: DayEntry) {
    EntryStore(context.applicationContext).put(entry)
}

/** Converte centavos para o texto de edicao "150,50". */
private fun centsToEdit(cents: Long): String {
    val reais = cents / 100
    val c = (cents % 100).let { if (it < 0) -it else it }
    return "$reais," + c.toString().padStart(2, '0')
}

private fun utcFormatter(): SimpleDateFormat {
    val f = SimpleDateFormat("yyyy-MM-dd", Locale("pt", "BR"))
    f.timeZone = TimeZone.getTimeZone("UTC")
    return f
}

private fun isoToUtcMillis(iso: String): Long =
    try { utcFormatter().parse(iso)?.time ?: System.currentTimeMillis() }
    catch (e: Exception) { System.currentTimeMillis() }

private fun utcMillisToIso(millis: Long): String = utcFormatter().format(java.util.Date(millis))
