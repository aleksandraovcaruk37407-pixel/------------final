package ru.autoatelier.calendar

import android.content.Context
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/**
 * Вход и чтение данных программы (Firebase), как в виджете для iPhone (widget-iphone.js).
 * Пароль не хранится: после входа на телефоне остаётся только ключ входа (refresh token).
 */
object Api {
    private const val API_KEY = "AIzaSyDGsjB5bhSL2keL0xTIOJib3ZB9HEqGyMs"
    private const val DB = "https://auto-atelier-1486d-default-rtdb.firebaseio.com"
    const val SITE = "https://aleksandraovcaruk37407-pixel.github.io/------------final/"
    const val CALENDAR_URL = SITE + "index.html?widget=1"
    private const val PREFS = "atelier"
    private const val KEY_REFRESH = "refresh"
    private const val KEY_EMAIL = "email"

    class LoginError(message: String) : Exception(message)

    private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    fun isLoggedIn(ctx: Context) = prefs(ctx).getString(KEY_REFRESH, null) != null
    fun email(ctx: Context): String = prefs(ctx).getString(KEY_EMAIL, "") ?: ""
    fun logout(ctx: Context) = prefs(ctx).edit().clear().apply()

    private fun request(url: String, method: String = "GET", body: String? = null, contentType: String = "application/json"): Pair<Int, String> {
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.requestMethod = method
        conn.connectTimeout = 15000
        conn.readTimeout = 20000
        if (body != null) {
            conn.doOutput = true
            conn.setRequestProperty("Content-Type", contentType)
            conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
        }
        val code = conn.responseCode
        val stream = if (code in 200..299) conn.inputStream else conn.errorStream
        val text = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: ""
        conn.disconnect()
        return code to text
    }

    /** Вход почтой и паролем. Сохраняется только ключ входа. */
    fun login(ctx: Context, email: String, password: String) {
        val body = JSONObject().put("email", email.trim()).put("password", password).put("returnSecureToken", true).toString()
        val (_, text) = request("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$API_KEY", "POST", body)
        val json = JSONObject(text)
        val refresh = json.optString("refreshToken", "")
        if (refresh.isEmpty()) {
            val code = json.optJSONObject("error")?.optString("message", "") ?: ""
            throw LoginError(when {
                code.contains("TOO_MANY") -> "Слишком много попыток, подождите пару минут"
                code.contains("INVALID") || code.contains("PASSWORD") || code.contains("EMAIL") -> "Неверная почта или пароль"
                else -> "Нет связи, попробуйте ещё раз"
            })
        }
        prefs(ctx).edit().putString(KEY_REFRESH, refresh).putString(KEY_EMAIL, json.optString("email", email.trim())).apply()
    }

    /** Свежий ключ доступа: (idToken, uid) или null, если нужно войти заново. */
    private fun session(ctx: Context): Pair<String, String>? {
        val refresh = prefs(ctx).getString(KEY_REFRESH, null) ?: return null
        val body = "grant_type=refresh_token&refresh_token=" + URLEncoder.encode(refresh, "UTF-8")
        val (code, text) = request("https://securetoken.googleapis.com/v1/token?key=$API_KEY", "POST", body, "application/x-www-form-urlencoded")
        if (code !in 200..299) return null
        val json = JSONObject(text)
        val token = json.optString("id_token", "")
        if (token.isEmpty()) return null
        json.optString("refresh_token", "").takeIf { it.isNotEmpty() }?.let { prefs(ctx).edit().putString(KEY_REFRESH, it).apply() }
        return token to json.optString("user_id", "")
    }

    class Loaded(val role: String, val email: String, val today: Today.Result)

    /** Данные для виджета: роль, почта, дела на сегодня. Бросает LoginError, если нужно войти. */
    fun load(ctx: Context): Loaded {
        val (token, uid) = session(ctx) ?: throw LoginError("Откройте приложение «Календарь ателье» и войдите")
        val auth = "?auth=" + URLEncoder.encode(token, "UTF-8")
        val (uc, userText) = request("$DB/users/$uid.json$auth")
        val user = if (uc in 200..299 && userText.trim().startsWith("{")) JSONObject(userText) else JSONObject()
        val (dc, dataText) = request("$DB/atelier_data.json$auth")
        if (dc !in 200..299) throw LoginError("Нет доступа к данным программы")
        val data = if (dataText.trim().startsWith("{")) JSONObject(dataText) else JSONObject()
        val plan = try { Today.parsePlan(request(SITE + "js/studio-plan.js").second) } catch (e: Exception) { emptyList() }
        val role = user.optString("role", "helper").ifEmpty { "helper" }
        val saved = email(ctx)
        val userEmail = user.optString("email", saved).ifEmpty { saved }
        return Loaded(role, userEmail, Today.build(data, plan, userEmail, role, java.time.LocalDate.now().toString()))
    }
}
