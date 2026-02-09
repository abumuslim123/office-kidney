package ru.kidneyoffice.tv

import android.content.Context
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import android.view.WindowManager
import androidx.appcompat.app.AppCompatActivity
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.TimeUnit

class MainActivity : AppCompatActivity() {

    private val scope = CoroutineScope(Dispatchers.Main + Job())
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    private var player: ExoPlayer? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var deviceId: String = ""
    private var currentVideoUrl: String? = null
    private var feedJob: Job? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        try {
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            acquireWakeLock()
        } catch (e: Exception) {
            Log.e(TAG, "Wake lock / KEEP_SCREEN_ON", e)
        }

        deviceId = getOrCreateDeviceId()
        registerDevice()

        val playerView = PlayerView(this).apply {
            useController = false
        }
        setContentView(playerView)

        player = ExoPlayer.Builder(this).build().also { exo ->
            playerView.player = exo
            exo.repeatMode = Player.REPEAT_MODE_ONE
            exo.playWhenReady = true
        }

        startFeedPolling()
    }

    private fun getOrCreateDeviceId(): String {
        return try {
            val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            var id = prefs.getString(KEY_DEVICE_ID, null)
            if (id.isNullOrBlank()) {
                id = Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID)
                    ?: UUID.randomUUID().toString()
                prefs.edit().putString(KEY_DEVICE_ID, id).apply()
            }
            id
        } catch (e: Exception) {
            Log.e(TAG, "getOrCreateDeviceId", e)
            UUID.randomUUID().toString()
        }
    }

    private fun acquireWakeLock() {
        try {
            val pm = getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return
            @Suppress("DEPRECATION")
            wakeLock = pm.newWakeLock(
                PowerManager.SCREEN_BRIGHT_WAKE_LOCK or PowerManager.ON_AFTER_RELEASE,
                "KidneyOfficeTV::Screen"
            ).apply { acquire(10*60*60*1000L) }
        } catch (e: Exception) {
            Log.e(TAG, "acquireWakeLock", e)
        }
    }

    private fun registerDevice() {
        scope.launch {
            withContext(Dispatchers.IO) {
                try {
                    val base = BuildConfig.API_BASE_URL.trimEnd('/')
                    val body = JSONObject().apply {
                        put("deviceId", deviceId)
                    }.toString().toRequestBody("application/json".toMediaType())
                    val req = Request.Builder()
                        .url("$base/public/screens/register")
                        .post(body)
                        .build()
                    client.newCall(req).execute().use { r ->
                        if (r.isSuccessful) Log.d(TAG, "Registered: $deviceId") else Log.e(TAG, "Register failed: ${r.code}")
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Register error", e)
                }
            }
        }
    }

    private fun startFeedPolling() {
        feedJob?.cancel()
        feedJob = scope.launch {
            while (true) {
                fetchFeedAndPlay()
                delay(POLL_INTERVAL_MS)
            }
        }
    }

    private suspend fun fetchFeedAndPlay() {
        val url = withContext(Dispatchers.IO) {
            try {
                val base = BuildConfig.API_BASE_URL.trimEnd('/')
                val req = Request.Builder()
                    .url("$base/public/screens/feed/$deviceId")
                    .get()
                    .build()
                client.newCall(req).execute().use { r ->
                    if (!r.isSuccessful) return@withContext null
                    val json = JSONObject(r.body?.string() ?: "{}")
                    val raw = json.optString("videoUrl").ifBlank { null } ?: return@withContext null
                    // Сервер может вернуть относительный путь — делаем абсолютный URL для ExoPlayer
                    if (raw.startsWith("http")) raw else base.trimEnd('/').removeSuffix("/api") + raw
                }
            } catch (e: Exception) {
                Log.e(TAG, "Feed error", e)
                null
            }
        }
        if (url == null) {
            if (currentVideoUrl != null) {
                currentVideoUrl = null
                player?.clearMediaItems()
            }
            return
        }
        if (url == currentVideoUrl) return
        currentVideoUrl = url
        player?.setMediaItem(MediaItem.fromUri(url))
        player?.prepare()
        player?.play()
    }

    override fun onDestroy() {
        feedJob?.cancel()
        player?.release()
        player = null
        wakeLock?.let { if (it.isHeld) it.release() }
        wakeLock = null
        super.onDestroy()
    }

    companion object {
        private const val TAG = "KidneyOfficeTV"
        private const val PREFS_NAME = "kidney_tv"
        private const val KEY_DEVICE_ID = "deviceId"
        private const val POLL_INTERVAL_MS = 30_000L
    }
}
