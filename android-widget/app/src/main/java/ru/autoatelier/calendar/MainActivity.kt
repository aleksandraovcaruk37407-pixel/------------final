package ru.autoatelier.calendar

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.net.Uri
import android.os.Bundle
import android.text.InputType
import android.view.Gravity
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

/**
 * Экран приложения: вход (почта и пароль от программы) и подсказка, как добавить виджет.
 * Экран собран кодом — без отдельных файлов разметки.
 */
class MainActivity : Activity() {

    private lateinit var box: LinearLayout

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        box = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(20), dp(28), dp(20), dp(20)) }
        setContentView(ScrollView(this).apply { setBackgroundColor(Color.parseColor("#F0F2F5")); addView(box) })
        show()
    }

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    private fun text(s: String, size: Float = 15f, bold: Boolean = false, color: String = "#222222") = TextView(this).apply {
        text = s; textSize = size; setTextColor(Color.parseColor(color))
        if (bold) typeface = Typeface.DEFAULT_BOLD
        setPadding(0, dp(6), 0, dp(6))
    }

    private fun button(s: String, primary: Boolean = true, onClick: () -> Unit) = Button(this).apply {
        text = s; isAllCaps = false; textSize = 16f
        setTextColor(if (primary) Color.WHITE else Color.parseColor("#185FA5"))
        setBackgroundColor(Color.parseColor(if (primary) "#185FA5" else "#FFFFFF"))
        layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(10) }
        setOnClickListener { onClick() }
    }

    private fun show() {
        box.removeAllViews()
        box.addView(text("📅 Календарь ателье", 24f, true, "#1A3C5E"))
        if (Api.isLoggedIn(this)) showMain() else showLogin()
    }

    private fun showLogin() {
        box.addView(text("Войдите тем же логином, что и в программе. Пароль не сохраняется — на телефоне остаётся только ключ входа.", 14f, color = "#6C757D"))
        val email = EditText(this).apply { hint = "Почта"; inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS }
        val password = EditText(this).apply { hint = "Пароль"; inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD }
        val status = text("", 14f, color = "#DC3545")
        box.addView(email); box.addView(password)
        val login = button("Войти") {}
        login.setOnClickListener {
            login.isEnabled = false
            status.setTextColor(Color.parseColor("#6C757D")); status.text = "Вхожу…"
            val e = email.text.toString(); val p = password.text.toString()
            Thread {
                val error = try { Api.login(this, e, p); null } catch (ex: Api.LoginError) { ex.message } catch (ex: Exception) { "Нет связи, попробуйте ещё раз" }
                runOnUiThread {
                    login.isEnabled = true
                    if (error == null) { CalendarWidget.refreshAll(this); show() }
                    else { status.setTextColor(Color.parseColor("#DC3545")); status.text = error }
                }
            }.start()
        }
        box.addView(login); box.addView(status)
    }

    private fun showMain() {
        box.addView(text("Вы вошли: ${Api.email(this)}", 14f, color = "#6C757D"))
        box.addView(text("Как добавить виджет", 17f, true, "#1A3C5E"))
        box.addView(text("1. Удерживайте палец на пустом месте рабочего стола.\n2. «Виджеты» → найдите «Календарь ателье».\n3. Перетащите на экран. Размер можно растянуть.\n\nВиджет обновляется сам раз в 30 минут, кнопка ⟳ — сразу. Нажатие на виджет открывает календарь программы.", 15f))
        box.addView(button("📅 Открыть календарь") { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(Api.CALENDAR_URL))) })
        box.addView(button("⟳ Обновить виджет", primary = false) { CalendarWidget.refreshAll(this) })
        box.addView(button("Выйти (сменить пользователя)", primary = false) { Api.logout(this); CalendarWidget.refreshAll(this); show() })
        box.gravity = Gravity.TOP
    }
}
