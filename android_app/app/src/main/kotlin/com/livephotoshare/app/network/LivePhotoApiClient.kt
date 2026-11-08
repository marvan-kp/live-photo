package com.livephotoshare.app.network

import android.content.Context
import android.content.SharedPreferences
import com.livephotoshare.app.model.Event
import com.livephotoshare.app.model.Photo
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class LivePhotoApiClient(context: Context) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("live_photo_prefs", Context.MODE_PRIVATE)

    var serverUrl: String
        get() {
            val saved = prefs.getString("server_url", null)
            if (saved.isNullOrBlank() || saved.contains("10.0.2.2")) {
                return "http://192.168.0.103:3000"
            }
            return saved
        }
        set(value) {
            val clean = value.trim().removeSuffix("/")
            prefs.edit().putString("server_url", clean).apply()
        }

    var guestName: String
        get() = prefs.getString("guest_name", "") ?: ""
        set(value) = prefs.edit().putString("guest_name", value.trim()).apply()

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    fun resolvePhotoUrl(rawUrl: String): String {
        return when {
            rawUrl.startsWith("http://") || rawUrl.startsWith("https://") -> rawUrl
            rawUrl.startsWith("/") -> "$serverUrl$rawUrl"
            else -> "$serverUrl/$rawUrl"
        }
    }

    suspend fun fetchEvents(): Result<List<Event>> = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder()
                .url("$serverUrl/api/events")
                .get()
                .build()

            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    return@withContext Result.failure(Exception("HTTP ${response.code}"))
                }
                val body = response.body?.string().orEmpty()
                val json = JSONObject(body)
                val array = json.optJSONArray("events") ?: JSONArray()
                val list = mutableListOf<Event>()
                for (i in 0 until array.length()) {
                    val obj = array.getJSONObject(i)
                    list.add(
                        Event(
                            id = obj.optString("id"),
                            code = obj.optString("code"),
                            name = obj.optString("name"),
                            description = obj.optString("description"),
                            date = obj.optString("date"),
                            location = obj.optString("location"),
                            coverUrl = resolvePhotoUrl(obj.optString("coverUrl")),
                            photosCount = obj.optInt("photosCount", 0),
                            guestsCount = obj.optInt("guestsCount", 0)
                        )
                    )
                }
                Result.success(list)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun fetchEvent(idOrCode: String): Result<Event> = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder()
                .url("$serverUrl/api/events/${idOrCode.trim()}")
                .get()
                .build()

            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    return@withContext Result.failure(Exception("Event not found (HTTP ${response.code})"))
                }
                val body = response.body?.string().orEmpty()
                val json = JSONObject(body)
                val obj = json.getJSONObject("event")
                val event = Event(
                    id = obj.optString("id"),
                    code = obj.optString("code"),
                    name = obj.optString("name"),
                    description = obj.optString("description"),
                    date = obj.optString("date"),
                    location = obj.optString("location"),
                    coverUrl = resolvePhotoUrl(obj.optString("coverUrl")),
                    photosCount = obj.optInt("photosCount", 0),
                    guestsCount = obj.optInt("guestsCount", 0)
                )
                Result.success(event)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun fetchPhotos(eventId: String): Result<List<Photo>> = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder()
                .url("$serverUrl/api/photos?eventId=${eventId.trim()}")
                .get()
                .build()

            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    return@withContext Result.failure(Exception("HTTP ${response.code}"))
                }
                val body = response.body?.string().orEmpty()
                val json = JSONObject(body)
                val array = json.optJSONArray("files") ?: JSONArray()
                val list = mutableListOf<Photo>()
                for (i in 0 until array.length()) {
                    val obj = array.getJSONObject(i)
                    list.add(
                        Photo(
                            id = obj.optString("id"),
                            name = obj.optString("name"),
                            url = resolvePhotoUrl(obj.optString("url")),
                            guestName = obj.optString("guestName", "Guest"),
                            caption = obj.optString("caption", ""),
                            likes = obj.optInt("likes", 0),
                            createdAt = obj.optString("createdAt")
                        )
                    )
                }
                Result.success(list)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun uploadPhoto(
        bytes: ByteArray,
        fileName: String,
        eventId: String,
        guestName: String,
        caption: String
    ): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            val mediaType = "image/jpeg".toMediaTypeOrNull()
            val fileBody = bytes.toRequestBody(mediaType)

            val multipart = MultipartBody.Builder()
                .setType(MultipartBody.FORM)
                .addFormDataPart("files", fileName, fileBody)
                .addFormDataPart("eventId", eventId)
                .addFormDataPart("guestName", guestName)
                .addFormDataPart("caption", caption)
                .build()

            val request = Request.Builder()
                .url("$serverUrl/api/photos")
                .post(multipart)
                .build()

            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    Result.success(true)
                } else {
                    Result.failure(Exception("Upload failed with HTTP ${response.code}"))
                }
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun createEvent(
        name: String,
        date: String,
        location: String,
        description: String,
        code: String,
        coverUrl: String = ""
    ): Result<Event> = withContext(Dispatchers.IO) {
        try {
            val payload = JSONObject().apply {
                put("name", name)
                put("date", date)
                put("location", location)
                put("description", description)
                if (code.isNotBlank()) put("code", code)
                if (coverUrl.isNotBlank()) put("coverUrl", coverUrl)
            }

            val body = payload.toString().toRequestBody("application/json".toMediaTypeOrNull())
            val request = Request.Builder()
                .url("$serverUrl/api/events")
                .post(body)
                .build()

            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    return@withContext Result.failure(Exception("Failed to create event (HTTP ${response.code})"))
                }
                val resBody = response.body?.string().orEmpty()
                val json = JSONObject(resBody)
                val obj = json.getJSONObject("event")
                val event = Event(
                    id = obj.optString("id"),
                    code = obj.optString("code"),
                    name = obj.optString("name"),
                    description = obj.optString("description"),
                    date = obj.optString("date"),
                    location = obj.optString("location"),
                    coverUrl = resolvePhotoUrl(obj.optString("coverUrl")),
                    photosCount = obj.optInt("photosCount", 0),
                    guestsCount = obj.optInt("guestsCount", 0)
                )
                Result.success(event)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun uploadEventCover(bytes: ByteArray, fileName: String): Result<String> = withContext(Dispatchers.IO) {
        try {
            // Downscale to lower thumbnail size (max 800px width, 80% JPEG quality) for fast loading
            val compressedBytes = try {
                val bitmap = android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                if (bitmap != null) {
                    val maxDim = 800
                    val scale = minOf(1f, maxDim.toFloat() / maxOf(bitmap.width, bitmap.height))
                    val targetW = (bitmap.width * scale).toInt()
                    val targetH = (bitmap.height * scale).toInt()
                    val scaled = android.graphics.Bitmap.createScaledBitmap(bitmap, targetW, targetH, true)
                    val stream = java.io.ByteArrayOutputStream()
                    scaled.compress(android.graphics.Bitmap.CompressFormat.JPEG, 80, stream)
                    stream.toByteArray()
                } else {
                    bytes
                }
            } catch (_: Exception) {
                bytes
            }

            val mediaType = "image/jpeg".toMediaTypeOrNull()
            val fileBody = compressedBytes.toRequestBody(mediaType)
            val multipart = MultipartBody.Builder()
                .setType(MultipartBody.FORM)
                .addFormDataPart("files", fileName, fileBody)
                .addFormDataPart("guestName", "Event Cover")
                .addFormDataPart("caption", "cover")
                .build()

            val request = Request.Builder()
                .url("$serverUrl/api/photos")
                .post(multipart)
                .build()

            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    return@withContext Result.failure(Exception("Cover upload failed HTTP ${response.code}"))
                }
                val body = response.body?.string().orEmpty()
                val json = JSONObject(body)
                val files = json.optJSONArray("files")
                if (files != null && files.length() > 0) {
                    val url = files.getJSONObject(0).optString("url")
                    Result.success(resolvePhotoUrl(url))
                } else {
                    Result.failure(Exception("No photo returned"))
                }
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateEvent(
        id: String,
        name: String,
        date: String,
        location: String,
        description: String,
        coverUrl: String = ""
    ): Result<Event> = withContext(Dispatchers.IO) {
        try {
            val payload = JSONObject().apply {
                put("name", name)
                put("date", date)
                put("location", location)
                put("description", description)
                if (coverUrl.isNotBlank()) put("coverUrl", coverUrl)
            }
            val body = payload.toString().toRequestBody("application/json".toMediaTypeOrNull())
            val request = Request.Builder()
                .url("$serverUrl/api/events/$id")
                .put(body)
                .build()

            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    return@withContext Result.failure(Exception("Failed to update event (HTTP ${response.code})"))
                }
                val resBody = response.body?.string().orEmpty()
                val json = JSONObject(resBody)
                val obj = json.getJSONObject("event")
                val event = Event(
                    id = obj.optString("id"),
                    code = obj.optString("code"),
                    name = obj.optString("name"),
                    description = obj.optString("description"),
                    date = obj.optString("date"),
                    location = obj.optString("location"),
                    coverUrl = resolvePhotoUrl(obj.optString("coverUrl")),
                    photosCount = obj.optInt("photosCount", 0),
                    guestsCount = obj.optInt("guestsCount", 0)
                )
                Result.success(event)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun deleteEvent(id: String): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder()
                .url("$serverUrl/api/events/$id")
                .delete()
                .build()

            client.newCall(request).execute().use { response ->
                Result.success(response.isSuccessful)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun deletePhoto(photoId: String): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder()
                .url("$serverUrl/api/photos?photoId=$photoId")
                .delete()
                .build()

            client.newCall(request).execute().use { response ->
                Result.success(response.isSuccessful)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun likePhoto(photoId: String): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            val payload = JSONObject().apply {
                put("action", "like")
                put("photoId", photoId)
            }
            val body = payload.toString().toRequestBody("application/json".toMediaTypeOrNull())
            val request = Request.Builder()
                .url("$serverUrl/api/photos")
                .put(body)
                .build()

            client.newCall(request).execute().use { response ->
                Result.success(response.isSuccessful)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun searchPhotosBySelfie(
        selfieBytes: ByteArray,
        eventId: String
    ): Result<List<com.livephotoshare.app.model.FaceMatch>> = withContext(Dispatchers.IO) {
        try {
            val mediaType = "image/jpeg".toMediaTypeOrNull()
            val fileBody = selfieBytes.toRequestBody(mediaType)

            val multipart = MultipartBody.Builder()
                .setType(MultipartBody.FORM)
                .addFormDataPart("action", "match-selfie")
                .addFormDataPart("selfie", "selfie.jpg", fileBody)
                .addFormDataPart("eventId", eventId)
                .build()

            val request = Request.Builder()
                .url("$serverUrl/api/ai")
                .post(multipart)
                .build()

            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    return@withContext Result.failure(Exception("AI Match HTTP ${response.code}"))
                }
                val body = response.body?.string().orEmpty()
                val json = JSONObject(body)
                val array = json.optJSONArray("matches") ?: JSONArray()
                val list = mutableListOf<com.livephotoshare.app.model.FaceMatch>()

                for (i in 0 until array.length()) {
                    val item = array.getJSONObject(i)
                    val pObj = item.getJSONObject("photo")
                    val tagsArray = item.optJSONArray("tags") ?: JSONArray()
                    val tagList = mutableListOf<String>()
                    for (t in 0 until tagsArray.length()) {
                        tagList.add(tagsArray.getString(t))
                    }

                    val photo = Photo(
                        id = pObj.optString("id"),
                        name = pObj.optString("name"),
                        url = resolvePhotoUrl(pObj.optString("url")),
                        guestName = pObj.optString("guestName", "Guest"),
                        caption = pObj.optString("caption", ""),
                        likes = pObj.optInt("likes", 0),
                        createdAt = pObj.optString("createdAt")
                    )

                    val score = item.optInt("matchScore", 0)
                    // Strict filter: only include genuine face matches
                    if (score >= 80) {
                        list.add(
                            com.livephotoshare.app.model.FaceMatch(
                                photo = photo,
                                matchScore = score,
                                confidence = item.optString("confidence", "High"),
                                tags = tagList
                            )
                        )
                    }
                }
                Result.success(list)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

