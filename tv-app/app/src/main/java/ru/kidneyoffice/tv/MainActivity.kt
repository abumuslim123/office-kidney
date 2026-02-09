package ru.kidneyoffice.tv

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.graphics.RectF
import android.net.Uri
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.File
import java.util.UUID
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

class MainActivity : AppCompatActivity() {

    private val scope = CoroutineScope(Dispatchers.Main + Job())
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.MINUTES)
        .build()

    private var player: ExoPlayer? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var deviceId: String = ""
    private var currentVideoUrl: String? = null
    private var feedJob: Job? = null
    private var downloadJob: Job? = null
    private var slideshowJob: Job? = null
    private var currentMode: Mode = Mode.NONE
    private var currentPhotosKey: String = ""

    private lateinit var playerView: PlayerView
    private lateinit var imageView: ImageView
    private lateinit var loadingOverlay: View
    private lateinit var loadingProgressBar: ProgressBar
    private lateinit var loadingText: TextView
    private lateinit var debugText: TextView

    private val cacheFile: File by lazy { File(cacheDir, CACHE_VIDEO_NAME) }
    private val cacheFileTmp: File by lazy { File(cacheDir, CACHE_VIDEO_TMP) }

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

        playerView = PlayerView(this).apply {
            useController = false
        }
        imageView = ImageView(this).apply {
            scaleType = ImageView.ScaleType.MATRIX
            visibility = View.GONE
            setBackgroundColor(0xFF000000.toInt())
        }

        loadingProgressBar = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            isIndeterminate = true
            max = 100
            progress = 0
        }
        loadingText = TextView(this).apply {
            text = getString(R.string.loading_video)
            textSize = 18f
            setTextColor(0xFFFFFFFF.toInt())
            setPadding(0, 32, 0, 0)
        }
        loadingOverlay = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(0xFF000000.toInt())
            addView(loadingProgressBar, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                setMargins(96, 0, 96, 0)
            })
            addView(loadingText, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT))
        }.also { overlay ->
            overlay.visibility = View.GONE
        }

        debugText = TextView(this).apply {
            textSize = 12f
            setTextColor(0xAAFFFFFF.toInt())
            setPadding(16, 16, 16, 16)
            visibility = View.GONE
        }

        val container = FrameLayout(this).apply {
            addView(playerView, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
            addView(imageView, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
            addView(loadingOverlay, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
            addView(debugText, FrameLayout.LayoutParams(FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.TOP or Gravity.START))
        }
        setContentView(container)

        player = ExoPlayer.Builder(this).build().also { exo ->
            playerView.player = exo
            exo.repeatMode = Player.REPEAT_MODE_ONE
            exo.playWhenReady = true
        }

        startFeedPolling()
    }

    private fun debug(msg: String) {
        Log.d(TAG, msg)
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
                try {
                    fetchFeedAndPlay()
                } catch (e: Exception) {
                    Log.e(TAG, "Poll error", e)
                }
                delay(POLL_INTERVAL_MS)
            }
        }
    }

    private suspend fun fetchFeedAndPlay() {
        debug("Запрос feed...")
        val result = withContext(Dispatchers.IO) {
            try {
                val base = BuildConfig.API_BASE_URL.trimEnd('/')
                val url = "$base/public/screens/feed/$deviceId"
                Log.d(TAG, "Feed URL: $url")
                val req = Request.Builder()
                    .url(url)
                    .get()
                    .build()
                client.newCall(req).execute().use { r ->
                    if (!r.isSuccessful) {
                        Log.e(TAG, "Feed HTTP ${r.code}")
                        runOnUiThread { debug("Feed ошибка: HTTP ${r.code}") }
                        return@withContext null
                    }
                    val bodyStr = r.body?.string() ?: "{}"
                    Log.d(TAG, "Feed response: $bodyStr")
                    val json = JSONObject(bodyStr)
                    // Проверяем videoUrl - optString может вернуть "null" строку для JSON null
                    val rawVideo = if (json.isNull("videoUrl")) {
                        null
                    } else {
                        json.optString("videoUrl").takeIf { it.isNotBlank() && it != "null" }
                    }
                    Log.d(TAG, "rawVideo=$rawVideo, isNull=${json.isNull("videoUrl")}")
                    if (rawVideo != null) {
                        val videoUrl = if (rawVideo.startsWith("http")) rawVideo else base.trimEnd('/').removeSuffix("/api") + rawVideo
                        runOnUiThread { debug("Feed: видео") }
                        return@withContext FeedResult.Video(videoUrl)
                    }
                    val photosJson = json.optJSONArray("photos")
                    if (photosJson == null || photosJson.length() == 0) {
                        runOnUiThread { debug("Feed: нет контента") }
                        return@withContext FeedResult.Empty
                    }
                    val list = mutableListOf<PhotoItem>()
                    for (i in 0 until photosJson.length()) {
                        val item = photosJson.optJSONObject(i) ?: continue
                        val photoUrl = item.optString("url").ifBlank { null } ?: continue
                        val normalized = if (photoUrl.startsWith("http")) photoUrl else base.trimEnd('/').removeSuffix("/api") + photoUrl
                        val durationSeconds = item.optInt("durationSeconds", 15).coerceAtLeast(1)
                        val rotation = item.optInt("rotation", 0)
                        list.add(PhotoItem(normalized, durationSeconds, rotation))
                    }
                    if (list.isEmpty()) {
                        runOnUiThread { debug("Feed: photos array пуст") }
                        FeedResult.Empty
                    } else {
                        runOnUiThread { debug("Feed: ${list.size} фото") }
                        FeedResult.Photos(list)
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Feed error", e)
                runOnUiThread { debug("Feed исключение: ${e.message}") }
                null
            }
        }

        when (result) {
            is FeedResult.Video -> switchToVideo(result.url)
            is FeedResult.Photos -> switchToPhotos(result.items)
            is FeedResult.Empty -> switchToNone()
            null -> { /* Network error: keep current state, don't reset */ }
        }
    }

    private fun switchToNone() {
        if (currentMode == Mode.NONE) return
        debug("Mode: NONE")
        currentMode = Mode.NONE
        currentVideoUrl = null
        currentPhotosKey = ""
        slideshowJob?.cancel()
        downloadJob?.cancel()
        player?.clearMediaItems()
        imageView.setImageDrawable(null)
        imageView.visibility = View.GONE
        playerView.visibility = View.VISIBLE
        loadingOverlay.visibility = View.GONE
    }

    private fun switchToVideo(url: String) {
        if (currentMode == Mode.VIDEO && url == currentVideoUrl && cacheFile.exists()) return
        debug("Mode: VIDEO")
        currentMode = Mode.VIDEO
        currentPhotosKey = ""
        slideshowJob?.cancel()
        imageView.visibility = View.GONE
        imageView.setImageDrawable(null)
        playerView.visibility = View.VISIBLE
        currentVideoUrl = url
        cacheFileTmp.delete()
        showLoading(true, null, false, null)
        downloadJob?.cancel()
        downloadJob = scope.launch { downloadVideoAndPlay(url) }
    }

    private fun switchToPhotos(items: List<PhotoItem>) {
        val key = items.joinToString("|") { "${it.url}:${it.durationSeconds}:${it.rotation}" }
        if (currentMode == Mode.PHOTOS && key == currentPhotosKey) return
        debug("Mode: PHOTOS (${items.size} items)")
        currentMode = Mode.PHOTOS
        currentVideoUrl = null
        currentPhotosKey = key
        downloadJob?.cancel()
        player?.clearMediaItems()
        playerView.visibility = View.GONE
        imageView.visibility = View.VISIBLE
        slideshowJob?.cancel()
        // Launch caching and slideshow as separate steps
        scope.launch { cachePhotosAndStart(items) }
    }

    private suspend fun cachePhotosAndStart(items: List<PhotoItem>) {
        debug("Downloading ${items.size} photos...")
        showLoading(true, null, true, "0/${items.size}")
        withContext(Dispatchers.IO) {
            for (i in items.indices) {
                val item = items[i]
                val file = photoCacheFile(item.url)
                if (file.exists() && file.length() > 0) {
                    Log.d(TAG, "Photo ${i+1} cached: ${file.absolutePath} (${file.length()} bytes)")
                    continue
                }
                runOnUiThread { showLoading(true, null, true, "${i + 1}/${items.size}") }
                try {
                    val ok = downloadFile(item.url, file, true, "${i + 1}/${items.size}")
                    Log.d(TAG, "Photo ${i+1} download: ok=$ok, file=${file.absolutePath}, size=${file.length()}")
                } catch (e: Exception) {
                    Log.e(TAG, "Photo ${i+1} download error", e)
                }
            }
        }
        val available = items.filter {
            val f = photoCacheFile(it.url)
            f.exists() && f.length() > 0
        }
        debug("Photos ready: ${available.size}/${items.size}")
        if (available.isEmpty()) {
            showStatus("Фото: скачано 0 из ${items.size}")
            return
        }
        showLoading(false, null, true, null)
        launchSlideshow(available)
    }

    private fun launchSlideshow(items: List<PhotoItem>) {
        slideshowJob?.cancel()
        slideshowJob = scope.launch {
            debug("Slideshow: ${items.size} фото")
            var photoIndex = 0
            var loopCount = 0
            while (isActive) {
                loopCount++
                for ((idx, item) in items.withIndex()) {
                    if (!isActive || currentMode != Mode.PHOTOS) {
                        debug("Slideshow stopped: active=$isActive, mode=$currentMode")
                        return@launch
                    }
                    photoIndex++
                    val file = photoCacheFile(item.url)
                    debug("Фото ${idx+1}/${items.size} (loop $loopCount): ${file.name}, ${file.length()} bytes")
                    if (!file.exists() || file.length() == 0L) {
                        Log.e(TAG, "Skip missing photo: ${file.absolutePath}")
                        debug("SKIP: файл не найден")
                        delay(1000)
                        continue
                    }
                    try {
                        val bitmap = withContext(Dispatchers.IO) {
                            BitmapFactory.decodeFile(file.absolutePath)
                        }
                        if (bitmap == null) {
                            Log.e(TAG, "Decode failed: ${file.absolutePath} (${file.length()} bytes)")
                            debug("ОШИБКА: не удалось декодировать ${file.name}")
                            delay(2000)
                            continue
                        }
                        debug("Показ ${idx+1}/${items.size}: ${bitmap.width}x${bitmap.height}")
                        imageView.alpha = 0f
                        imageView.setImageBitmap(bitmap)
                        applyImageMatrix(bitmap, item.rotation.toFloat())
                        imageView.animate().alpha(1f).setDuration(FADE_MS).start()
                        // Скрыть debug через 3 секунды
                        delay(3000)
                        debugText.visibility = View.GONE
                        delay((item.durationSeconds * 1000L) - 3000)
                    } catch (e: Exception) {
                        Log.e(TAG, "Slideshow item error", e)
                        debug("ОШИБКА: ${e.message}")
                        delay(2000)
                    }
                }
            }
        }
    }

    private suspend fun downloadVideoAndPlay(url: String) {
        withContext(Dispatchers.IO) {
            try {
                val ok = downloadFile(url, cacheFileTmp, false, null)
                if (!ok) return@withContext
                cacheFile.delete()
                cacheFileTmp.renameTo(cacheFile)
                runOnUiThread {
                    showLoading(false, null, false, null)
                    playFromCache()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Download error", e)
                runOnUiThread { showLoading(false, null, false, null) }
            }
        }
    }

    private fun downloadFile(url: String, outFile: File, isPhoto: Boolean, extra: String?): Boolean {
        val req = Request.Builder().url(url).get().build()
        client.newCall(req).execute().use { response ->
            if (!response.isSuccessful) {
                Log.e(TAG, "Download failed: ${response.code} for $url")
                return false
            }
            val body = response.body ?: run {
                Log.e(TAG, "Download: no body for $url")
                return false
            }
            val total = body.contentLength()
            val lastPct = AtomicInteger(-1)
            outFile.parentFile?.mkdirs()
            if (outFile.exists()) outFile.delete()
            outFile.outputStream().use { out ->
                body.byteStream().use { input ->
                    val buf = ByteArray(64 * 1024)
                    var written = 0L
                    var read: Int
                    while (input.read(buf).also { read = it } != -1) {
                        out.write(buf, 0, read)
                        written += read
                        if (total > 0) {
                            val pct = (100 * written / total).toInt().coerceIn(0, 100)
                            if (pct != lastPct.getAndSet(pct)) {
                                runOnUiThread {
                                    loadingProgressBar.isIndeterminate = false
                                    loadingProgressBar.progress = pct
                                    loadingText.text = if (isPhoto) {
                                        getString(R.string.loading_photo_percent, pct)
                                    } else {
                                        getString(R.string.loading_video_percent, pct)
                                    }
                                }
                            }
                        }
                    }
                }
            }
            Log.d(TAG, "Downloaded $url -> ${outFile.absolutePath} (${outFile.length()} bytes)")
            return outFile.length() > 0
        }
    }

    private fun playFromCache() {
        if (!cacheFile.exists()) return
        val uri = Uri.fromFile(cacheFile)
        player?.setMediaItem(MediaItem.fromUri(uri))
        player?.prepare()
        player?.play()
    }

    private fun applyImageMatrix(bitmap: Bitmap, rotation: Float) {
        val viewW = imageView.width.toFloat()
        val viewH = imageView.height.toFloat()
        if (viewW <= 0f || viewH <= 0f) {
            imageView.post { applyImageMatrix(bitmap, rotation) }
            return
        }
        val bw = bitmap.width.toFloat()
        val bh = bitmap.height.toFloat()
        val matrix = Matrix()
        matrix.postRotate(rotation, bw / 2f, bh / 2f)
        val rotatedRect = RectF(0f, 0f, bw, bh)
        matrix.mapRect(rotatedRect)
        val rotatedW = rotatedRect.width()
        val rotatedH = rotatedRect.height()
        if (rotatedW <= 0f || rotatedH <= 0f) return
        val scale = maxOf(viewW / rotatedW, viewH / rotatedH)
        matrix.postScale(scale, scale, bw / 2f, bh / 2f)
        val finalRect = RectF(0f, 0f, bw, bh)
        matrix.mapRect(finalRect)
        val dx = (viewW - finalRect.width()) / 2f - finalRect.left
        val dy = (viewH - finalRect.height()) / 2f - finalRect.top
        matrix.postTranslate(dx, dy)
        imageView.imageMatrix = matrix
    }

    private fun showLoading(show: Boolean, percent: Int?, isPhoto: Boolean, extra: String?) {
        loadingOverlay.visibility = if (show) View.VISIBLE else View.GONE
        loadingProgressBar.visibility = View.VISIBLE
        loadingProgressBar.isIndeterminate = (percent == null)
        if (percent != null) {
            loadingProgressBar.progress = percent
            loadingText.text = if (isPhoto) {
                getString(R.string.loading_photo_percent, percent)
            } else {
                getString(R.string.loading_video_percent, percent)
            }
        } else {
            val base = if (isPhoto) getString(R.string.loading_photo) else getString(R.string.loading_video)
            loadingText.text = if (!extra.isNullOrBlank()) "$base ($extra)" else base
        }
    }

    private fun showStatus(message: String) {
        loadingOverlay.visibility = View.VISIBLE
        loadingProgressBar.visibility = View.GONE
        loadingText.text = message
    }

    private fun photoCacheFile(url: String): File {
        val hash = url.hashCode().and(0x7FFFFFFF).toString()
        return File(cacheDir, "photo_$hash.img")
    }

    override fun onDestroy() {
        feedJob?.cancel()
        downloadJob?.cancel()
        slideshowJob?.cancel()
        player?.release()
        player = null
        wakeLock?.let { if (it.isHeld) it.release() }
        wakeLock = null
        super.onDestroy()
    }

    private data class PhotoItem(val url: String, val durationSeconds: Int, val rotation: Int)

    private sealed class FeedResult {
        data class Video(val url: String) : FeedResult()
        data class Photos(val items: List<PhotoItem>) : FeedResult()
        data object Empty : FeedResult()
    }

    private enum class Mode { NONE, VIDEO, PHOTOS }

    companion object {
        private const val TAG = "KidneyOfficeTV"
        private const val PREFS_NAME = "kidney_tv"
        private const val KEY_DEVICE_ID = "deviceId"
        private const val POLL_INTERVAL_MS = 30_000L
        private const val CACHE_VIDEO_NAME = "current_video.mp4"
        private const val CACHE_VIDEO_TMP = "current_video.mp4.tmp"
        private const val FADE_MS = 500L
    }
}
