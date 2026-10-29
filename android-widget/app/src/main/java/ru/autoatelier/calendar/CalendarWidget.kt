package ru.autoatelier.calendar

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.style.ForegroundColorSpan
import android.widget.RemoteViews
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Виджет «Календарь ателье»: дела на сегодня. Нажатие — календарь программы, ⟳ — обновить.
 * Android обновляет его сам раз в 30 минут; сеть — в фоне (goAsync), не в главном потоке.
 */
class CalendarWidget : AppWidgetProvider() {

    companion object {
        const val ACTION_REFRESH = "ru.autoatelier.calendar.REFRESH"
        private const val MAX_ROWS = 12

        /** Перерисовать все виджеты (из приложения после входа / выхода) */
        fun refreshAll(ctx: Context) {
            ctx.sendBroadcast(Intent(ctx, CalendarWidget::class.java).setAction(ACTION_REFRESH))
        }
    }

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) = update(context)

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_REFRESH) update(context)
    }

    private fun update(context: Context) {
        val manager = AppWidgetManager.getInstance(context)
        val ids = manager.getAppWidgetIds(ComponentName(context, CalendarWidget::class.java))
        if (ids.isEmpty()) return
        val pending = goAsync()
        Thread {
            val views = try {
                render(context, Api.load(context), null)
            } catch (e: Api.LoginError) {
                render(context, null, e.message)
            } catch (e: Exception) {
                render(context, null, "Нет связи — нажмите ⟳")
            }
            ids.forEach { manager.updateAppWidget(it, views) }
            pending.finish()
        }.start()
    }

    private fun render(context: Context, data: Api.Loaded?, error: String?): RemoteViews {
        val v = RemoteViews(context.packageName, R.layout.widget)
        val today = LocalDate.now()
        v.setTextViewText(R.id.title, "📅 Сегодня, " + today.format(DateTimeFormatter.ofPattern("d MMMM", Locale("ru"))))

        val text = SpannableStringBuilder()
        when {
            error != null -> text.append(error)
            data == null || data.today.rows.isEmpty() -> text.append("На сегодня дел нет 👍")
            else -> {
                val rows = data.today.rows
                rows.take(MAX_ROWS).forEachIndexed { i, r ->
                    if (i > 0) text.append("\n")
                    val start = text.length
                    text.append("${r.icon} ${r.text}")
                    if (r.late) text.setSpan(ForegroundColorSpan(Color.parseColor("#DC3545")), start, text.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                }
                if (rows.size > MAX_ROWS) text.append("\nи ещё ${rows.size - MAX_ROWS}…")
            }
        }
        v.setTextViewText(R.id.body, text)
        v.setTextViewText(R.id.updated, "обновлено " + LocalTime.now().format(DateTimeFormatter.ofPattern("HH:mm")))

        val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        // Без входа — открываем приложение (вход), иначе — календарь программы в браузере
        val open = if (Api.isLoggedIn(context)) Intent(Intent.ACTION_VIEW, Uri.parse(Api.CALENDAR_URL))
                   else Intent(context, MainActivity::class.java)
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        v.setOnClickPendingIntent(R.id.root, PendingIntent.getActivity(context, 1, open, flags))
        val refresh = Intent(context, CalendarWidget::class.java).setAction(ACTION_REFRESH)
        v.setOnClickPendingIntent(R.id.refresh, PendingIntent.getBroadcast(context, 2, refresh, flags))
        return v
    }
}
