package ru.autoatelier.calendar

import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate

/**
 * Дела на сегодня — то же, что wBuildToday в widget-iphone.js (там же правила и тест).
 * Админ: просрочено, сдать, приём, задачи помощников, свои задачи студии, платежи, заметки.
 * Помощник: свои задачи и напоминание о приходе.
 */
object Today {
    private val PEOPLE = mapOf(
        "Александра" to listOf("aleksandraovcaruk37407@gmail.com", "admin@test.local"),
        "Егор" to listOf("egor.wtf38@gmail.com"),
        "Дауд" to listOf("daud_yt_play@yandex.ru", "helper@test.local")
    )
    private const val PHOTO_FROM = "2026-10-28"

    class Row(val icon: String, val text: String, val late: Boolean, val rank: Int)
    class Result(val rows: List<Row>, val counts: Map<String, Int>)

    /** Список из Firebase: массив или объект { "0": …, "1": … } */
    private fun arr(v: Any?): List<JSONObject> = when (v) {
        is JSONArray -> (0 until v.length()).mapNotNull { v.optJSONObject(it) }
        is JSONObject -> v.keys().asSequence().mapNotNull { v.optJSONObject(it) }.toList()
        else -> emptyList()
    }

    private fun str(o: JSONObject, key: String) = if (o.isNull(key)) "" else o.opt(key)?.toString() ?: ""
    private fun ddmm(s: String) = if (s.length >= 10) "${s.substring(8, 10)}.${s.substring(5, 7)}" else s
    private fun done(o: JSONObject) = when (val d = o.opt("done")) { is Boolean -> d; is Number -> d.toInt() == 1; is String -> d == "true"; else -> false }
    private fun person(email: String) = PEOPLE.entries.firstOrNull { it.value.contains(email.lowercase()) }?.key
    private fun money(v: Any?): String {
        val n = Math.round(v?.toString()?.toDoubleOrNull() ?: 0.0)
        return String.format("%,d", n).replace(',', ' ').replace(' ', ' ') + " ₽"
    }

    fun deadline(o: JSONObject): String {
        val days = str(o, "durationDays").toDoubleOrNull()?.toInt() ?: 0
        val date = str(o, "date").take(10)
        if (date.length < 10 || days <= 0) return ""
        return try { LocalDate.parse(date).plusDays(days.toLong()).toString() } catch (e: Exception) { "" }
    }

    /** План студии из js/studio-plan.js: строки вида {"id": …}, */
    fun parsePlan(text: String): List<JSONObject> =
        // Задачи студии выключены в программе (window.STUDIO_ENABLED = false) — метка вместо плана
        if (Regex("STUDIO_ENABLED\\s*=\\s*false").containsMatchIn(text)) listOf(JSONObject().put("__disabled", true))
        else text.lines().mapNotNull { line ->
        val m = line.trim().removeSuffix(",")
        if (m.startsWith("{") && m.endsWith("}")) try { JSONObject(m) } catch (e: Exception) { null } else null
    }

    private fun who(t: JSONObject): List<String> {
        val w = t.optJSONArray("who") ?: return emptyList()
        return (0 until w.length()).map { w.optString(it) }
    }

    fun build(data: JSONObject, plan: List<JSONObject>, email: String, role: String, today: String): Result {
        val rows = mutableListOf<Row>()
        val counts = mutableMapOf("late" to 0, "due" to 0, "start" to 0, "tasks" to 0, "pay" to 0)
        fun bump(k: String) { counts[k] = (counts[k] ?: 0) + 1 }
        val orders = arr(data.opt("ordersData"))
        val isAdmin = role == "admin"
        val me = email.lowercase()
        val myName = person(email)

        if (isAdmin) {
            orders.filter { !done(it) && deadline(it).isNotEmpty() && deadline(it) < today }.forEach {
                bump("late"); rows += Row("🔴", "Не сдан №${str(it, "orderNumber")} ${str(it, "client")} (срок ${ddmm(deadline(it))})", true, 0)
            }
            orders.filter { !done(it) && deadline(it) == today }.forEach {
                bump("due"); rows += Row("🏁", "Сдать №${str(it, "orderNumber")} ${str(it, "client")}", false, 1)
            }
            orders.filter { str(it, "date").take(10) == today }.forEach {
                bump("start"); rows += Row("📥", "Приём №${str(it, "orderNumber")} ${str(it, "client")}", false, 2)
            }
        }
        // Задачи помощникам по заказам: админ — все, помощник — свои
        orders.forEach { o -> arr(o.opt("services")).forEach { s -> arr(s.opt("tasks")).forEach { t ->
            val dl = str(t, "deadline")
            if (dl.isEmpty() || str(t, "status") == "completed") return@forEach
            val to = str(t, "assignedTo")
            if (!isAdmin && to.lowercase() != me) return@forEach
            val day = dl.substringBefore('T')
            if (day > today) return@forEach
            val whoText = if (isAdmin && to.isNotEmpty()) to.substringBefore('@') + ": " else ""
            val time = if (dl.contains('T')) " до " + dl.substringAfter('T').take(5) else ""
            val desc = str(t, "description").ifEmpty { "задача" }
            val late = day < today
            bump("tasks")
            rows += Row("👷", "$whoText$desc (№${str(o, "orderNumber")})${if (late) " — просрочено" else time}${if (str(t, "status") == "review") " — на проверке" else ""}", late, if (late) 0 else 3)
        } } }
        // Задачи студии: план + съёмка Егору по заказам + задачи, поставленные в программе
        val marks = arr(data.opt("studioTaskMarks"))
        val studio = plan.toMutableList()
        orders.forEach { o ->
            val id = str(o, "id"); val date = str(o, "date").take(10)
            if (id.isEmpty() || date.length < 10 || date < PHOTO_FROM) return@forEach
            val car = "№${str(o, "orderNumber")} ${str(o, "client")}".trim()
            studio += JSONObject().put("id", "photo-in-$id").put("date", date).put("who", JSONArray().put("Егор")).put("text", "📸 Снять машину при приёме: $car")
            val due = deadline(o)
            if (due.isNotEmpty() && due != date)
                studio += JSONObject().put("id", "photo-out-$id").put("date", due).put("who", JSONArray().put("Егор")).put("text", "📸 Снять машину при выдаче: $car")
        }
        marks.filter { it.optBoolean("custom") && str(it, "date").isNotEmpty() && str(it, "text").isNotEmpty() }.forEach { studio += it }
        fun status(t: JSONObject) = marks.firstOrNull { str(it, "id") == str(t, "id") }?.let { str(it, "status") }?.ifEmpty { null } ?: "todo"
        studio.filter { plan.none { p -> p.optBoolean("__disabled") } && myName != null && who(it).contains(myName) && str(it, "date") <= today && status(it) != "done" }.forEach {
            val d = str(it, "date"); val late = d < today
            bump("tasks"); rows += Row("📌", str(it, "text") + if (late) " (с ${ddmm(d)})" else "", late, if (late) 1 else 4)
        }
        if (isAdmin) {
            // Обязательные платежи этого месяца: до сегодня включительно, не оплаченные
            val mk = today.take(7)
            val dim = LocalDate.parse("$mk-01").lengthOfMonth()
            val cash = arr(data.opt("cashOps"))
            arr(data.opt("payments")).forEach { p ->
                val day = (str(p, "day").toDoubleOrNull()?.toInt() ?: 1).coerceIn(1, dim)
                val due = "$mk-${day.toString().padStart(2, '0')}"
                if (due > today || cash.any { str(it, "paymentId") == str(p, "id") && str(it, "month") == mk }) return@forEach
                val late = due < today
                bump("pay"); rows += Row("💳", "${str(p, "name")} ${money(p.opt("amount"))}${if (late) " — просрочен" else ""}", late, if (late) 1 else 5)
            }
        } else {
            val rec = arr(data.opt("attendance")).firstOrNull { str(it, "email").lowercase() == me && str(it, "date") == today }
            if (rec == null) rows += Row("🕘", "Не забудьте отметить приход", false, 0)
            else if (str(rec, "in").isNotEmpty() && str(rec, "out").isEmpty()) rows += Row("▶️", "Пришли в ${str(rec, "in")}", false, 9)
        }
        arr(data.opt("notes")).filter { str(it, "date") == today }.forEach {
            val time = str(it, "time")
            rows += Row("📝", (if (time.isNotEmpty()) "$time " else "") + str(it, "text"), false, 6)
        }
        return Result(rows.sortedBy { it.rank }, counts)
    }
}
