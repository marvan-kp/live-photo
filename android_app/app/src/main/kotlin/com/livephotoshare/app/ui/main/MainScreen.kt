package com.livephotoshare.app.ui.main

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Environment
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.foundation.Image
import androidx.compose.ui.res.painterResource
import com.livephotoshare.app.R
import coil.compose.AsyncImage
import com.livephotoshare.app.model.Event
import com.livephotoshare.app.model.FaceMatch
import com.livephotoshare.app.model.Photo
import com.livephotoshare.app.network.LivePhotoApiClient
import com.livephotoshare.app.ui.theme.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import kotlinx.coroutines.Dispatchers
import java.io.ByteArrayOutputStream

val AI_APP_TAGS = listOf("All", "⭐ Top Liked", "🕒 Recent", "👤 My Uploads", "💃 Dance", "🥂 Toast", "💍 Romance", "✨ Candid")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    client: LivePhotoApiClient
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var events by remember { mutableStateOf<List<Event>>(emptyList()) }
    var selectedEvent by remember { mutableStateOf<Event?>(null) }
    var photos by remember { mutableStateOf<List<Photo>>(emptyList()) }
    var activeTag by remember { mutableStateOf("All") }
    var isLoading by remember { mutableStateOf(true) }
    var statusMessage by remember { mutableStateOf<String?>(null) }

    // Admin & Dialog states
    var isAdmin by remember { mutableStateOf(false) }
    var showAdminDialog by remember { mutableStateOf(false) }
    var qrEventForModal by remember { mutableStateOf<Event?>(null) }
    var showSettingsDialog by remember { mutableStateOf(false) }
    var showJoinDialog by remember { mutableStateOf(false) }
    var showCreateDialog by remember { mutableStateOf(false) }
    var showAiSelfieDialog by remember { mutableStateOf(false) }
    var selectedPhotoForViewer by remember { mutableStateOf<Photo?>(null) }
    var editingEventForModal by remember { mutableStateOf<Event?>(null) }
    var eventToDelete by remember { mutableStateOf<Event?>(null) }
    var photoToDelete by remember { mutableStateOf<Photo?>(null) }

    // Live Auto-Upload Mode states
    var isAutoUploadMode by remember { mutableStateOf(false) }
    var autoUploadStatus by remember { mutableStateOf<String?>(null) }

    // AI Selfie Matching states
    var selfieMatches by remember { mutableStateOf<List<FaceMatch>>(emptyList()) }
    var isAiScanning by remember { mutableStateOf(false) }

    // Upload staging state
    var stagingImageBytes by remember { mutableStateOf<ByteArray?>(null) }
    var stagingCaption by remember { mutableStateOf("") }
    var isUploading by remember { mutableStateOf(false) }

    // Refresh data
    fun refresh(targetEventId: String? = null) {
        scope.launch {
            isLoading = true
            val resEvents = client.fetchEvents()
            resEvents.onSuccess { list ->
                events = list
                val active = if (targetEventId != null) {
                    list.find { it.id == targetEventId || it.code.equals(targetEventId, ignoreCase = true) }
                } else {
                    selectedEvent ?: list.firstOrNull()
                }
                selectedEvent = active
                if (active != null) {
                    val resPhotos = client.fetchPhotos(active.id)
                    resPhotos.onSuccess { photos = it }
                }
            }.onFailure {
                statusMessage = "Could not connect: ${it.message}"
            }
            isLoading = false
        }
    }

    // Real-time live auto-refresh ticker
    LaunchedEffect(selectedEvent?.id) {
        refresh(selectedEvent?.id)
        while (true) {
            delay(8000L)
            val active = selectedEvent
            if (active != null && !isUploading && autoUploadStatus == null) {
                val resPhotos = client.fetchPhotos(active.id)
                resPhotos.onSuccess { latest ->
                    if (latest.size != photos.size || latest.sumOf { it.likes } != photos.sumOf { it.likes }) {
                        photos = latest
                    }
                }
            }
        }
    }

    // Camera Capture Launcher for photo upload
    val cameraLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.TakePicturePreview()
    ) { bitmap: Bitmap? ->
        if (bitmap != null) {
            val stream = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.JPEG, 92, stream)
            val bytes = stream.toByteArray()
            if (isAutoUploadMode) {
                val activeEvent = selectedEvent
                if (activeEvent == null) {
                    Toast.makeText(context, "⚠️ Please select an event first for Auto-Upload", Toast.LENGTH_SHORT).show()
                    stagingImageBytes = bytes
                } else {
                    autoUploadStatus = "⚡ Auto-uploading camera shot to ${activeEvent.name}..."
                    Toast.makeText(context, "⚡ Auto-uploading to ${activeEvent.name}...", Toast.LENGTH_SHORT).show()
                    scope.launch(Dispatchers.IO) {
                        val fileName = "camera_${System.currentTimeMillis()}.jpg"
                        val resolvedName = if (client.guestName.isNotBlank() && client.guestName != "Guest") client.guestName else "Photographer"
                        val res = client.uploadPhoto(
                            bytes = bytes,
                            fileName = fileName,
                            eventId = activeEvent.id,
                            guestName = resolvedName,
                            caption = "Live camera shot 📸"
                        )
                        withContext(Dispatchers.Main) {
                            res.onSuccess {
                                autoUploadStatus = "✓ Live photo auto-uploaded!"
                                Toast.makeText(context, "✓ Live photo auto-uploaded to ${activeEvent.name}!", Toast.LENGTH_SHORT).show()
                                refresh(activeEvent.id)
                                scope.launch {
                                    delay(3500L)
                                    autoUploadStatus = null
                                }
                            }.onFailure { err ->
                                autoUploadStatus = "✕ Auto-upload failed: ${err.message}"
                                Toast.makeText(context, "Upload failed: ${err.message}", Toast.LENGTH_LONG).show()
                            }
                        }
                    }
                }
            } else {
                stagingImageBytes = bytes
            }
        }
    }

    // Camera Capture Launcher for AI Selfie Face Finder
    val selfieLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.TakePicturePreview()
    ) { bitmap: Bitmap? ->
        if (bitmap != null) {
            val stream = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.JPEG, 85, stream)
            val bytes = stream.toByteArray()
            val eventId = selectedEvent?.id ?: ""
            isAiScanning = true
            showAiSelfieDialog = true
            scope.launch {
                val res = client.searchPhotosBySelfie(bytes, eventId)
                isAiScanning = false
                res.onSuccess { selfieMatches = it }
                    .onFailure { statusMessage = "AI Face Search error: ${it.message}" }
            }
        }
    }

    // Gallery Picker Launcher
    val galleryLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) {
            try {
                context.contentResolver.openInputStream(uri)?.use { inputStream ->
                    val bytes = inputStream.readBytes()
                    if (isAutoUploadMode) {
                        val activeEvent = selectedEvent
                        if (activeEvent == null) {
                            Toast.makeText(context, "⚠️ Please select an event first for Auto-Upload", Toast.LENGTH_SHORT).show()
                            stagingImageBytes = bytes
                        } else {
                            autoUploadStatus = "⚡ Auto-uploading gallery photo to ${activeEvent.name}..."
                            Toast.makeText(context, "⚡ Auto-uploading to ${activeEvent.name}...", Toast.LENGTH_SHORT).show()
                            scope.launch(Dispatchers.IO) {
                                val fileName = "gallery_${System.currentTimeMillis()}.jpg"
                                val resolvedName = if (client.guestName.isNotBlank() && client.guestName != "Guest") client.guestName else "Photographer"
                                val res = client.uploadPhoto(
                                    bytes = bytes,
                                    fileName = fileName,
                                    eventId = activeEvent.id,
                                    guestName = resolvedName,
                                    caption = "Live gallery upload 📸"
                                )
                                withContext(Dispatchers.Main) {
                                    res.onSuccess {
                                        autoUploadStatus = "✓ Live photo auto-uploaded!"
                                        Toast.makeText(context, "✓ Live photo auto-uploaded to ${activeEvent.name}!", Toast.LENGTH_SHORT).show()
                                        refresh(activeEvent.id)
                                        scope.launch {
                                            delay(3500L)
                                            autoUploadStatus = null
                                        }
                                    }.onFailure { err ->
                                        autoUploadStatus = "✕ Auto-upload failed: ${err.message}"
                                        Toast.makeText(context, "Upload failed: ${err.message}", Toast.LENGTH_LONG).show()
                                    }
                                }
                            }
                        }
                    } else {
                        stagingImageBytes = bytes
                    }
                }
            } catch (e: Exception) {
                statusMessage = "Failed to load selected photo"
            }
        }
    }

    var sortMode by remember { mutableStateOf("live") }
    var onCoverPicked: ((ByteArray) -> Unit)? by remember { mutableStateOf(null) }

    val coverPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) {
            try {
                context.contentResolver.openInputStream(uri)?.use { inputStream ->
                    val bytes = inputStream.readBytes()
                    onCoverPicked?.invoke(bytes)
                }
            } catch (e: Exception) {
                statusMessage = "Failed to load cover image"
            }
        }
    }

    // Filtered photos based on smart category tags & AI catalog sorting
    val displayedPhotos = remember(photos, activeTag, client.guestName, sortMode) {
        val base = when (activeTag) {
            "All" -> photos
            "⭐ Top Liked" -> photos.sortedByDescending { it.likes }
            "🕒 Recent" -> photos.sortedByDescending { it.createdAt }
            "👤 My Uploads" -> {
                val current = client.guestName.trim().lowercase()
                photos.filter { p ->
                    val gn = p.guestName.trim().lowercase()
                    (current.isNotBlank() && current != "guest" && gn == current) ||
                    gn.contains("android") ||
                    gn == "guest"
                }
            }
            else -> {
                val keywords = when (activeTag) {
                    "💃 Dance" -> listOf("dance", "dancing", "party", "fun", "dj", "pose")
                    "🥂 Toast" -> listOf("toast", "cheers", "glass", "celebrat", "drink", "table")
                    "💍 Romance" -> listOf("romance", "couple", "love", "bride", "groom", "woman", "ring")
                    "✨ Candid" -> listOf("candid", "moment", "portrait", "smile", "photo", "signature")
                    else -> listOf(activeTag.replace("^[\\W\\s]+".toRegex(), "").trim().lowercase())
                }
                val matched = photos.filter { p ->
                    val combinedText = "${p.name} ${p.caption} ${p.guestName}".lowercase()
                    keywords.any { kw -> combinedText.contains(kw) }
                }
                if (matched.isNotEmpty()) matched else photos
            }
        }

        when (sortMode) {
            "popular" -> base.sortedByDescending { it.likes }
            "highlights" -> base.filter { it.likes > 0 }.sortedByDescending { it.likes }.ifEmpty { base }
            else -> base
        }
    }

    Scaffold(
        containerColor = DarkBackground,
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Image(
                            painter = painterResource(id = R.drawable.app_logo),
                            contentDescription = "Signature by Marvan",
                            modifier = Modifier
                                .height(26.dp)
                                .width(70.dp),
                            contentScale = ContentScale.Fit
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "Signature by Marvan",
                            fontWeight = FontWeight.Bold,
                            color = GoldAccent,
                            fontSize = 16.sp
                        )
                    }
                },
                actions = {
                    Surface(
                        color = if (isAdmin) GoldAccent.copy(alpha = 0.25f) else GraphiteCard,
                        shape = RoundedCornerShape(12.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, if (isAdmin) GoldAccent else GlassBorder),
                        modifier = Modifier.clickable { showAdminDialog = true }
                    ) {
                        Text(
                            text = if (isAdmin) "👑 Admin" else "Login",
                            color = if (isAdmin) GoldAccent else TextSecondary,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                        )
                    }

                    Spacer(modifier = Modifier.width(4.dp))

                    Surface(
                        color = if (events.isNotEmpty()) GreenSuccess.copy(alpha = 0.2f) else RedLike.copy(alpha = 0.2f),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.clickable { showSettingsDialog = true }
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(8.dp)
                                    .clip(CircleShape)
                                    .background(if (events.isNotEmpty()) GreenSuccess else RedLike)
                            )
                            Spacer(modifier = Modifier.width(5.dp))
                            Text(
                                text = if (events.isNotEmpty()) "Synced" else "Offline",
                                color = if (events.isNotEmpty()) GreenSuccess else RedLike,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                    IconButton(onClick = { refresh(selectedEvent?.id) }) {
                        Text("↻", color = TextPrimary, fontSize = 20.sp)
                    }
                    IconButton(onClick = { showSettingsDialog = true }) {
                        Text("⚙", color = TextPrimary, fontSize = 18.sp)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MidnightSurface
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // Connection alert if offline
            if (events.isEmpty() && !isLoading) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF261D0F)),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable {
                            // Instant 1-tap switch to live Vercel Cloud
                            client.serverUrl = LivePhotoApiClient.DEFAULT_CLOUD_URL
                            refresh()
                        }
                        .border(1.dp, GoldAccent.copy(alpha = 0.6f), RoundedCornerShape(14.dp))
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("🌐", fontSize = 20.sp)
                        Spacer(modifier = Modifier.width(10.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Cannot reach: ${client.serverUrl}",
                                color = Color(0xFFFFCC66),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "Tap here to connect to live Cloud (web-rho-sage-25.vercel.app)",
                                color = GoldAccent,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }
                }
            }


            // Live Events Carousel Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "ACTIVE EVENTS (${events.size})",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = GoldAccent,
                    letterSpacing = 1.sp
                )
                if (isAdmin) {
                    Surface(
                        color = GoldAccent.copy(alpha = 0.15f),
                        shape = RoundedCornerShape(8.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, GoldAccent.copy(alpha = 0.3f)),
                        modifier = Modifier.clickable { showCreateDialog = true }
                    ) {
                        Text(
                            text = "+ New Event",
                            color = GoldAccent,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                        )
                    }
                }
            }


            // Active Events Horizontal Sliding Cards
            if (events.isNotEmpty()) {
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    items(events) { ev ->
                        val isSelected = selectedEvent?.id == ev.id
                        Card(
                            colors = CardDefaults.cardColors(containerColor = GraphiteCard),
                            shape = RoundedCornerShape(18.dp),
                            modifier = Modifier
                                .width(260.dp)
                                .height(150.dp)
                                .border(
                                    width = if (isSelected) 2.dp else 1.dp,
                                    color = if (isSelected) GoldAccent else GlassBorder,
                                    shape = RoundedCornerShape(18.dp)
                                )
                                .clickable {
                                    selectedEvent = ev
                                    refresh(ev.id)
                                }
                        ) {
                            Box(modifier = Modifier.fillMaxSize()) {
                                AsyncImage(
                                    model = ev.coverUrl,
                                    contentDescription = ev.name,
                                    contentScale = ContentScale.Crop,
                                    modifier = Modifier.fillMaxSize()
                                )
                                Box(
                                    modifier = Modifier
                                        .fillMaxSize()
                                        .background(
                                            androidx.compose.ui.graphics.Brush.verticalGradient(
                                                colors = listOf(
                                                    Color.Black.copy(alpha = 0.35f),
                                                    Color.Black.copy(alpha = 0.88f)
                                                )
                                            )
                                        )
                                    )

                                Column(
                                    modifier = Modifier
                                        .fillMaxSize()
                                        .padding(12.dp),
                                    verticalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Surface(
                                            color = GreenSuccess.copy(alpha = 0.25f),
                                            shape = RoundedCornerShape(6.dp),
                                            border = androidx.compose.foundation.BorderStroke(1.dp, GreenSuccess.copy(alpha = 0.4f))
                                        ) {
                                            Text(
                                                text = "● LIVE",
                                                color = GreenSuccess,
                                                fontSize = 9.sp,
                                                fontWeight = FontWeight.Bold,
                                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                            )
                                        }

                                        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                            Surface(
                                                color = MidnightSurface.copy(alpha = 0.9f),
                                                shape = RoundedCornerShape(6.dp),
                                                border = androidx.compose.foundation.BorderStroke(1.dp, GoldAccent.copy(alpha = 0.4f))
                                            ) {
                                                Text(
                                                    text = ev.code,
                                                    color = GoldAccent,
                                                    fontSize = 10.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                                )
                                            }

                                            Surface(
                                                color = MidnightSurface.copy(alpha = 0.9f),
                                                shape = RoundedCornerShape(6.dp),
                                                border = androidx.compose.foundation.BorderStroke(1.dp, GlassBorder),
                                                modifier = Modifier.clickable { qrEventForModal = ev }
                                            ) {
                                                Text(
                                                    text = "QR",
                                                    color = TextPrimary,
                                                    fontSize = 10.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                                )
                                            }

                                            if (isAdmin) {
                                                Surface(
                                                    color = MidnightSurface.copy(alpha = 0.9f),
                                                    shape = RoundedCornerShape(6.dp),
                                                    border = androidx.compose.foundation.BorderStroke(1.dp, GoldAccent.copy(alpha = 0.4f)),
                                                    modifier = Modifier.clickable { editingEventForModal = ev }
                                                ) {
                                                    Text(
                                                        text = "✏️",
                                                        fontSize = 10.sp,
                                                        modifier = Modifier.padding(horizontal = 5.dp, vertical = 2.dp)
                                                    )
                                                }

                                                Surface(
                                                    color = Color(0xFF4A1E1E).copy(alpha = 0.9f),
                                                    shape = RoundedCornerShape(6.dp),
                                                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFFF5555).copy(alpha = 0.5f)),
                                                    modifier = Modifier.clickable { eventToDelete = ev }
                                                ) {
                                                    Text(
                                                        text = "🗑️",
                                                        fontSize = 10.sp,
                                                        modifier = Modifier.padding(horizontal = 5.dp, vertical = 2.dp)
                                                    )
                                                }
                                            }
                                        }
                                    }

                                    Column {
                                        Text(
                                            text = ev.name,
                                            color = TextPrimary,
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 14.sp,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                        Text(
                                            text = "${ev.photosCount} photos • ${ev.location}",
                                            color = TextSecondary,
                                            fontSize = 11.sp,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }


            // Quick Join & QR Actions
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = { showJoinDialog = true },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = MidnightSurface),
                    border = androidx.compose.foundation.BorderStroke(1.dp, GlassBorder)
                ) {
                    Text("Join Code / QR", color = TextPrimary, fontSize = 12.sp)
                }

                if (selectedEvent != null) {
                    Button(
                        onClick = { qrEventForModal = selectedEvent },
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = MidnightSurface),
                        border = androidx.compose.foundation.BorderStroke(1.dp, GoldAccent.copy(alpha = 0.4f))
                    ) {
                        Text("Show QR", color = GoldAccent, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }

                    Button(
                        onClick = {
                            val ev = selectedEvent!!
                            try {
                                val dm = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                                val zipUrl = "${client.serverUrl}/api/events/${ev.id}/download"
                                val req = DownloadManager.Request(Uri.parse(zipUrl)).apply {
                                    setTitle("${ev.name}_all_photos.zip")
                                    setDescription("Downloading all photos for ${ev.name}")
                                    setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                                    setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "${ev.name}_photos.zip")
                                }
                                dm.enqueue(req)
                                Toast.makeText(context, "📦 Downloading all full-size photos (.ZIP)...", Toast.LENGTH_LONG).show()
                            } catch (e: Exception) {
                                Toast.makeText(context, "ZIP download error: ${e.message}", Toast.LENGTH_SHORT).show()
                            }
                        },
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = MidnightSurface),
                        border = androidx.compose.foundation.BorderStroke(1.dp, GoldAccent.copy(alpha = 0.4f))
                    ) {
                        Text("📦 ZIP", color = GoldAccent, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }

            // Admin Event Management Controls for Selected Event
            if (isAdmin && selectedEvent != null) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        onClick = { editingEventForModal = selectedEvent },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = GraphiteCard),
                        border = androidx.compose.foundation.BorderStroke(1.dp, GoldAccent.copy(alpha = 0.5f))
                    ) {
                        Text("✏️ Edit Event", color = GoldAccent, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }

                    Button(
                        onClick = { eventToDelete = selectedEvent },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF3B1A1A)),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFFF5555).copy(alpha = 0.5f))
                    ) {
                        Text("🗑️ Delete Event", color = Color(0xFFFF8888), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }

            // ⚡ Live Camera Auto-Upload Mode Toggle
            Surface(
                color = if (isAutoUploadMode) GoldAccent.copy(alpha = 0.15f) else GraphiteCard.copy(alpha = 0.6f),
                shape = RoundedCornerShape(16.dp),
                border = androidx.compose.foundation.BorderStroke(
                    1.dp,
                    if (isAutoUploadMode) GoldAccent else GlassBorder
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable {
                        isAutoUploadMode = !isAutoUploadMode
                        val active = selectedEvent
                        if (isAutoUploadMode) {
                            if (active != null) {
                                Toast.makeText(context, "⚡ Live Auto-Upload ON: Photos will upload directly to ${active.name}!", Toast.LENGTH_SHORT).show()
                            } else {
                                Toast.makeText(context, "⚡ Live Auto-Upload ON: Please select an event to sync with", Toast.LENGTH_SHORT).show()
                            }
                        }
                    }
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.weight(1f)
                    ) {
                        Text(
                            text = if (isAutoUploadMode) "⚡" else "💤",
                            fontSize = 20.sp
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = if (isAutoUploadMode) "Live Auto-Upload: ACTIVE" else "Live Auto-Upload: OFF",
                                    color = if (isAutoUploadMode) GoldAccent else TextPrimary,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp
                                )
                                if (isAutoUploadMode) {
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Surface(
                                        color = GreenSuccess.copy(alpha = 0.25f),
                                        shape = RoundedCornerShape(6.dp)
                                    ) {
                                        Text(
                                            text = "LIVE",
                                            color = GreenSuccess,
                                            fontWeight = FontWeight.ExtraBold,
                                            fontSize = 9.sp,
                                            modifier = Modifier.padding(horizontal = 5.dp, vertical = 2.dp)
                                        )
                                    }
                                }
                            }
                            Text(
                                text = if (isAutoUploadMode) {
                                    if (selectedEvent != null) "Auto-syncing camera & gallery to \"${selectedEvent!!.name}\"" else "Tap an event above to select destination"
                                } else {
                                    "Enable to auto-sync camera shots straight to event cloud"
                                },
                                color = TextSecondary,
                                fontSize = 11.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }

                    Switch(
                        checked = isAutoUploadMode,
                        onCheckedChange = { isAutoUploadMode = it },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = DarkBackground,
                            checkedTrackColor = GoldAccent,
                            uncheckedThumbColor = TextSecondary,
                            uncheckedTrackColor = MidnightSurface
                        )
                    )
                }
            }

            if (autoUploadStatus != null) {
                Surface(
                    color = GoldAccent.copy(alpha = 0.2f),
                    shape = RoundedCornerShape(12.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, GoldAccent),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(14.dp),
                            color = GoldAccent,
                            strokeWidth = 2.dp
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(
                            text = autoUploadStatus!!,
                            color = GoldAccent,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }

            // AI Face Finder & Camera Buttons
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                // AI Face Finder
                Button(
                    onClick = { selfieLauncher.launch(null) },
                    modifier = Modifier
                        .weight(1f)
                        .height(50.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = GoldAccent)
                ) {
                    Text(
                        text = "✨ Find My Photos",
                        color = DarkBackground,
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 13.sp
                    )
                }

                // Snap Photo
                Button(
                    onClick = { cameraLauncher.launch(null) },
                    modifier = Modifier
                        .weight(1f)
                        .height(50.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (isAutoUploadMode) GoldAccent.copy(alpha = 0.25f) else GraphiteCard
                    ),
                    border = androidx.compose.foundation.BorderStroke(
                        1.dp,
                        if (isAutoUploadMode) GoldAccent else GlassBorder
                    )
                ) {
                    Text(
                        text = if (isAutoUploadMode) "⚡ Snap & Upload" else "📷 Snap Photo",
                        color = if (isAutoUploadMode) GoldAccent else TextPrimary,
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp
                    )
                }

                // Gallery
                IconButton(
                    onClick = { galleryLauncher.launch("image/*") },
                    modifier = Modifier
                        .size(50.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(GraphiteCard)
                        .border(1.dp, GlassBorder, RoundedCornerShape(16.dp))
                ) {
                    Text("🖼️", fontSize = 18.sp)
                }
            }


            // AI Filter Chips
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                AI_APP_TAGS.forEach { tag ->
                    val isSelected = activeTag == tag
                    Surface(
                        color = if (isSelected) GoldAccent else GraphiteCard,
                        shape = RoundedCornerShape(20.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, GlassBorder),
                        modifier = Modifier.clickable { activeTag = tag }
                    ) {
                        Text(
                            text = tag,
                            color = if (isSelected) DarkBackground else TextPrimary,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                            fontSize = 12.sp,
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 7.dp)
                        )
                    }
                }
            }


            // AI Catalog Sorting Options Bar
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "CATALOG SORT:",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = GoldAccent,
                    letterSpacing = 1.sp
                )
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("live" to "⚡ Live", "popular" to "🔥 Popular", "highlights" to "💎 Highlights").forEach { (mode, label) ->
                        val isSelected = sortMode == mode
                        Surface(
                            color = if (isSelected) GoldAccent.copy(alpha = 0.25f) else GraphiteCard,
                            shape = RoundedCornerShape(8.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, if (isSelected) GoldAccent else GlassBorder),
                            modifier = Modifier.clickable { sortMode = mode }
                        ) {
                            Text(
                                text = label,
                                color = if (isSelected) GoldAccent else TextPrimary,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 7.dp, vertical = 3.dp)
                            )
                        }
                    }
                }
            }

            // Live Grid Section Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Live Stream (${displayedPhotos.size})",
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary
                )
                if (isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(16.dp),
                        color = GoldAccent,
                        strokeWidth = 2.dp
                    )
                }
            }


            // Photos Grid
            if (displayedPhotos.isEmpty() && !isLoading) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("📷", fontSize = 42.sp)
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "No live photos yet",
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary
                        )
                        Text(
                            text = "Snap a photo or tap 'Find My Photos'!",
                            color = TextSecondary,
                            fontSize = 12.sp
                        )
                    }
                }
            }
 else {
                LazyVerticalGrid(
                    columns = GridCells.Fixed(2),
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(displayedPhotos) { photo ->
                        Card(
                            shape = RoundedCornerShape(16.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .aspectRatio(1f)
                                .clickable {
                                    selectedPhotoForViewer = photo
                                },
                            colors = CardDefaults.cardColors(containerColor = GraphiteCard)
                        ) {
                            Box(modifier = Modifier.fillMaxSize()) {
                                AsyncImage(
                                    model = photo.thumbnailUrl.ifBlank { photo.url },
                                    contentDescription = photo.name,
                                    contentScale = ContentScale.Crop,
                                    modifier = Modifier.fillMaxSize()
                                )
                                Box(
                                    modifier = Modifier
                                        .align(Alignment.BottomCenter)
                                        .fillMaxWidth()
                                        .background(Color(0x99000000))
                                        .padding(6.dp)
                                ) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Text(
                                            text = photo.guestName,
                                            color = Color.White,
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.SemiBold,
                                            maxLines = 1,
                                            modifier = Modifier.weight(1f)
                                        )
                                        Surface(
                                            color = if (photo.likes > 0) Color(0xDD3B141C) else Color(0x88000000),
                                            shape = RoundedCornerShape(10.dp),
                                            border = androidx.compose.foundation.BorderStroke(1.dp, if (photo.likes > 0) Color(0xFFFF4B6E).copy(alpha = 0.5f) else Color.Transparent),
                                            modifier = Modifier.clickable {
                                                val updated = photo.copy(likes = photo.likes + 1)
                                                photos = photos.map { if (it.id == photo.id) updated else it }
                                                scope.launch {
                                                    client.likePhoto(photo.id)
                                                }
                                            }
                                        ) {
                                            Text(
                                                text = "❤️ ${photo.likes}",
                                                color = if (photo.likes > 0) Color(0xFFFF6E8A) else GoldAccent,
                                                fontSize = 10.sp,
                                                fontWeight = FontWeight.Bold,
                                                maxLines = 1,
                                                softWrap = false,
                                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

        }
    }

    // AI Selfie Matching Results Dialog
    if (showAiSelfieDialog) {
        Dialog(onDismissRequest = { showAiSelfieDialog = false }) {
            Surface(
                shape = RoundedCornerShape(24.dp),
                color = MidnightSurface,
                border = androidx.compose.foundation.BorderStroke(1.dp, GlassBorder),
                modifier = Modifier
                    .fillMaxWidth()
                    .fillMaxHeight(0.85f)
            ) {
                Column(
                    modifier = Modifier
                        .padding(18.dp)
                        .fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "✨ AI Face Matches",
                            fontWeight = FontWeight.Bold,
                            color = GoldAccent,
                            fontSize = 18.sp
                        )
                        IconButton(onClick = { showAiSelfieDialog = false }) {
                            Text("✕", color = TextPrimary)
                        }
                    }

                    if (isAiScanning) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .weight(1f),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                CircularProgressIndicator(color = GoldAccent)
                                Spacer(modifier = Modifier.height(12.dp))
                                Text("Scanning facial landmarks...", color = TextPrimary, fontWeight = FontWeight.Bold)
                                Text("Matching against event photos", color = TextSecondary, fontSize = 12.sp)
                            }
                        }
                    } else if (selfieMatches.isEmpty()) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .weight(1f),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("No matching photos found in this event.", color = TextSecondary)
                        }
                    } else {
                        Text(
                            text = "Found ${selfieMatches.size} photos featuring you!",
                            color = GreenSuccess,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 13.sp
                        )
                        LazyVerticalGrid(
                            columns = GridCells.Fixed(2),
                            modifier = Modifier.weight(1f),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            items(selfieMatches) { match ->
                                Card(
                                    shape = RoundedCornerShape(14.dp),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .aspectRatio(1f)
                                        .clickable {
                                            selectedPhotoForViewer = match.photo
                                        },
                                    colors = CardDefaults.cardColors(containerColor = GraphiteCard)
                                ) {
                                    Box(modifier = Modifier.fillMaxSize()) {
                                        AsyncImage(
                                            model = match.photo.thumbnailUrl.ifBlank { match.photo.url },
                                            contentDescription = match.photo.name,
                                            contentScale = ContentScale.Crop,
                                            modifier = Modifier.fillMaxSize()
                                        )
                                        Surface(
                                            color = Color(0xCC000000),
                                            shape = RoundedCornerShape(8.dp),
                                            modifier = Modifier
                                                .align(Alignment.TopEnd)
                                                .padding(6.dp)
                                        ) {
                                            Text(
                                                text = "${match.matchScore}% Match",
                                                color = GoldAccent,
                                                fontSize = 10.sp,
                                                fontWeight = FontWeight.Bold,
                                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

        }
    }

    // Photo Upload Staging Dialog with Optional/Custom Name & Category Tags
    if (stagingImageBytes != null) {
        var customNameInput by remember {
            mutableStateOf(if (client.guestName == "Android Guest" || client.guestName == "Guest") "" else client.guestName)
        }

        Dialog(onDismissRequest = { if (!isUploading) stagingImageBytes = null }) {
            Surface(
                shape = RoundedCornerShape(24.dp),
                color = MidnightSurface,
                border = androidx.compose.foundation.BorderStroke(1.dp, GlassBorder)
            ) {
                Column(
                    modifier = Modifier
                        .padding(20.dp)
                        .fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "Upload to ${selectedEvent?.name ?: "Event"}",
                        fontWeight = FontWeight.Bold,
                        color = GoldAccent,
                        fontSize = 16.sp
                    )

                    OutlinedTextField(
                        value = customNameInput,
                        onValueChange = { customNameInput = it },
                        label = { Text("Your Name (Optional)") },
                        placeholder = { Text("e.g. Marvan or leave empty for Guest") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = GoldAccent,
                            unfocusedBorderColor = GlassBorder,
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary
                        )
                    )

                    // Quick Category Tag Selector
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        listOf("💃 Dance", "🥂 Toast", "💍 Romance", "✨ Candid", "🎂 Party", "🎉 Fun").forEach { tag ->
                            val isSelected = stagingCaption.contains(tag)
                            Surface(
                                color = if (isSelected) GoldAccent else GraphiteCard,
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier.clickable {
                                    stagingCaption = if (stagingCaption.isBlank()) tag else if (!stagingCaption.contains(tag)) "$tag $stagingCaption" else stagingCaption
                                }
                            ) {
                                Text(
                                    text = tag,
                                    color = if (isSelected) DarkBackground else TextPrimary,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Medium,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                )
                            }
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Caption", color = TextSecondary, fontSize = 12.sp)
                        Text(
                            text = "✨ AI Auto-Caption",
                            color = GoldAccent,
                            fontWeight = FontWeight.Bold,
                            fontSize = 11.sp,
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(GraphiteCard)
                                .clickable {
                                    val aiCaptions = listOf(
                                        "Dancing the night away! Incredible celebration ✨💃 #LivePhotos",
                                        "Heartfelt cheers and wonderful memories 🥂❤️ #Celebration2026",
                                        "Pure joy captured in the moment! ✨🍾 #EventHighlights"
                                    )
                                    stagingCaption = aiCaptions.random()
                                }
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        )
                    }

                    OutlinedTextField(
                        value = stagingCaption,
                        onValueChange = { stagingCaption = it },
                        placeholder = { Text("Add caption or tap AI Auto-Caption...") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = GoldAccent,
                            unfocusedBorderColor = GlassBorder,
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary
                        )
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Button(
                            onClick = { stagingImageBytes = null },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = GraphiteCard),
                            enabled = !isUploading
                        ) {
                            Text("Cancel", color = TextPrimary)
                        }

                        Button(
                            onClick = {
                                val bytes = stagingImageBytes ?: return@Button
                                val eventId = selectedEvent?.id ?: "general"
                                val resolvedName = if (customNameInput.trim().isNotBlank()) customNameInput.trim() else "Guest"
                                if (customNameInput.trim().isNotBlank()) {
                                    client.guestName = customNameInput.trim()
                                }
                                isUploading = true
                                scope.launch {
                                    val result = client.uploadPhoto(
                                        bytes = bytes,
                                        fileName = "mobile_${System.currentTimeMillis()}.jpg",
                                        eventId = eventId,
                                        guestName = resolvedName,
                                        caption = stagingCaption
                                    )
                                    isUploading = false
                                    stagingImageBytes = null
                                    stagingCaption = ""
                                    result.onSuccess {
                                        refresh(selectedEvent?.id)
                                    }.onFailure {
                                        statusMessage = "Upload failed: ${it.message}"
                                    }
                                }
                            },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = GoldAccent),
                            enabled = !isUploading
                        ) {
                            if (isUploading) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(16.dp),
                                    color = DarkBackground,
                                    strokeWidth = 2.dp
                                )
                            } else {
                                Text("Upload", color = DarkBackground, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }

        }
    }

    // Fullscreen Photo Viewer Dialog
    if (selectedPhotoForViewer != null) {
        val p = selectedPhotoForViewer!!

        Dialog(onDismissRequest = { selectedPhotoForViewer = null }) {
            Surface(
                shape = RoundedCornerShape(22.dp),
                color = MidnightSurface,
                border = androidx.compose.foundation.BorderStroke(1.dp, GlassBorder),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    // Header with Guest Name, Caption, and Close Button
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = p.guestName,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary,
                                fontSize = 16.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            if (p.caption.isNotBlank()) {
                                Text(
                                    text = p.caption,
                                    color = TextSecondary,
                                    fontSize = 12.sp,
                                    maxLines = 2,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                        }
                        IconButton(
                            onClick = { selectedPhotoForViewer = null },
                            modifier = Modifier
                                .size(36.dp)
                                .clip(CircleShape)
                                .background(GraphiteCard)
                                .border(1.dp, GlassBorder, CircleShape)
                        ) {
                            Text("✕", color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                        }
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    // Photo Preview
                    AsyncImage(
                        model = p.thumbnailUrl.ifBlank { p.url },
                        contentDescription = p.name,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(340.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(DarkBackground),
                        contentScale = ContentScale.Fit
                    )

                    Spacer(modifier = Modifier.height(14.dp))

                    // Action Row: Like & Share & Delete (Admin)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Like Button with single line and no wrapping
                        Button(
                            onClick = {
                                val updated = p.copy(likes = p.likes + 1)
                                selectedPhotoForViewer = updated
                                photos = photos.map { if (it.id == p.id) updated else it }
                                scope.launch {
                                    client.likePhoto(p.id)
                                }
                            },
                            modifier = Modifier
                                .weight(1f)
                                .height(44.dp),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (p.likes > 0) Color(0xFF38151B) else GraphiteCard
                            ),
                            border = androidx.compose.foundation.BorderStroke(
                                1.dp,
                                if (p.likes > 0) Color(0xFFFF4B6E).copy(alpha = 0.6f) else GlassBorder
                            )
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.Center
                            ) {
                                Text("❤️", fontSize = 14.sp)
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = "${p.likes} Likes",
                                    color = if (p.likes > 0) Color(0xFFFF6E8A) else TextPrimary,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                    maxLines = 1,
                                    softWrap = false
                                )
                            }
                        }

                        // Share Button
                        Button(
                            onClick = {
                                val sendIntent: Intent = Intent().apply {
                                    action = Intent.ACTION_SEND
                                    putExtra(Intent.EXTRA_TEXT, "${p.name}\n${p.url}")
                                    type = "text/plain"
                                }
                                val shareIntent = Intent.createChooser(sendIntent, "Share Photo")
                                context.startActivity(shareIntent)
                            },
                            modifier = Modifier.height(44.dp),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = GraphiteCard),
                            border = androidx.compose.foundation.BorderStroke(1.dp, GlassBorder)
                        ) {
                            Text("↗️ Share", color = TextPrimary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                        }

                        // Delete button (Admin only)
                        if (isAdmin) {
                            IconButton(
                                onClick = { photoToDelete = p },
                                modifier = Modifier
                                    .size(44.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(Color(0xFF3B1A1A))
                                    .border(1.dp, Color(0xFFFF5555).copy(alpha = 0.5f), RoundedCornerShape(12.dp))
                            ) {
                                Text("🗑️", fontSize = 15.sp)
                            }
                        }
                    }

                    // Prominent Full-Width Download Original Button
                    Spacer(modifier = Modifier.height(10.dp))
                    Button(
                        onClick = {
                            try {
                                val dm = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                                val downloadUri = Uri.parse(p.url)
                                val cleanName = if (p.name.isNotBlank()) p.name else "signature_marvan_${p.id}.jpg"
                                val req = DownloadManager.Request(downloadUri).apply {
                                    setTitle(cleanName)
                                    setDescription("Downloading full original photo")
                                    setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                                    setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, cleanName)
                                }
                                dm.enqueue(req)
                                Toast.makeText(context, "📥 Downloading full original photo to Downloads...", Toast.LENGTH_LONG).show()
                            } catch (e: Exception) {
                                Toast.makeText(context, "Download failed: ${e.message}", Toast.LENGTH_SHORT).show()
                            }
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp),
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = GoldAccent)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.Center
                        ) {
                            Text("📥", fontSize = 16.sp)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Download Full Size Photo",
                                color = DarkBackground,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        }
    }

    // Join Event / QR Dialog
    if (showJoinDialog) {
        var inputCode by remember { mutableStateOf("") }
        var searchError by remember { mutableStateOf<String?>(null) }
        var isSearching by remember { mutableStateOf(false) }

        Dialog(onDismissRequest = { showJoinDialog = false }) {
            Surface(
                shape = RoundedCornerShape(20.dp),
                color = MidnightSurface,
                border = androidx.compose.foundation.BorderStroke(1.dp, GlassBorder)
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "Join Event by Code / QR",
                        fontWeight = FontWeight.Bold,
                        color = GoldAccent,
                        fontSize = 18.sp
                    )
                    Text(
                        text = "Enter the 6-character code (e.g. GALA26) or event ID:",
                        color = TextSecondary,
                        fontSize = 12.sp
                    )

                    OutlinedTextField(
                        value = inputCode,
                        onValueChange = { inputCode = it.uppercase() },
                        placeholder = { Text("e.g. GALA26") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = GoldAccent,
                            unfocusedBorderColor = GlassBorder,
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary
                        )
                    )

                    if (searchError != null) {
                        Text(text = searchError!!, color = Color(0xFFFF8888), fontSize = 12.sp)
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Button(
                            onClick = { showJoinDialog = false },
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.buttonColors(containerColor = GraphiteCard)
                        ) {
                            Text("Cancel", color = TextPrimary)
                        }

                        Button(
                            onClick = {
                                if (inputCode.isBlank()) return@Button
                                isSearching = true
                                searchError = null
                                scope.launch {
                                    val res = client.fetchEvent(inputCode)
                                    isSearching = false
                                    res.onSuccess { ev ->
                                        selectedEvent = ev
                                        showJoinDialog = false
                                        refresh(ev.id)
                                    }.onFailure {
                                        searchError = "Event not found. Check code & server URL."
                                    }
                                }
                            },
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.buttonColors(containerColor = GoldAccent)
                        ) {
                            if (isSearching) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(16.dp),
                                    color = DarkBackground,
                                    strokeWidth = 2.dp
                                )
                            } else {
                                Text("Join", color = DarkBackground, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }

        }
    }

    // Create Event Dialog
    if (showCreateDialog) {
        var newName by remember { mutableStateOf("") }
        var newLocation by remember { mutableStateOf("") }
        var newDate by remember { mutableStateOf("2026-11-15") }
        var newCode by remember { mutableStateOf("") }
        var newCoverUrl by remember { mutableStateOf("") }
        var isUploadingCover by remember { mutableStateOf(false) }
        var isCreating by remember { mutableStateOf(false) }

        Dialog(onDismissRequest = { showCreateDialog = false }) {
            Surface(
                shape = RoundedCornerShape(20.dp),
                color = MidnightSurface,
                border = androidx.compose.foundation.BorderStroke(1.dp, GlassBorder)
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(
                        text = "Create Live Event",
                        fontWeight = FontWeight.Bold,
                        color = GoldAccent,
                        fontSize = 18.sp
                    )

                    OutlinedTextField(
                        value = newName,
                        onValueChange = { newName = it },
                        label = { Text("Event Name") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = GoldAccent,
                            unfocusedBorderColor = GlassBorder,
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary
                        )
                    )

                    OutlinedTextField(
                        value = newLocation,
                        onValueChange = { newLocation = it },
                        label = { Text("Location") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = GoldAccent,
                            unfocusedBorderColor = GlassBorder,
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary
                        )
                    )

                    OutlinedTextField(
                        value = newDate,
                        onValueChange = { newDate = it },
                        label = { Text("Date (YYYY-MM-DD)") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = GoldAccent,
                            unfocusedBorderColor = GlassBorder,
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary
                        )
                    )

                    OutlinedTextField(
                        value = newCode,
                        onValueChange = { newCode = it.uppercase() },
                        label = { Text("Custom Code (Optional)") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = GoldAccent,
                            unfocusedBorderColor = GlassBorder,
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary
                        )
                    )

                    // Cover Photo Thumbnail Selector
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Cover Photo Thumbnail", color = TextSecondary, fontSize = 12.sp)
                        Button(
                            onClick = {
                                onCoverPicked = { bytes ->
                                    isUploadingCover = true
                                    scope.launch {
                                        val res = client.uploadEventCover(bytes, "cover_${System.currentTimeMillis()}.jpg")
                                        isUploadingCover = false
                                        res.onSuccess { newCoverUrl = it }
                                    }
                                }
                                coverPickerLauncher.launch("image/*")
                            },
                            shape = RoundedCornerShape(8.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = GraphiteCard),
                            border = androidx.compose.foundation.BorderStroke(1.dp, GlassBorder)
                        ) {
                            if (isUploadingCover) {
                                CircularProgressIndicator(modifier = Modifier.size(14.dp), color = GoldAccent, strokeWidth = 2.dp)
                            } else {
                                Text(if (newCoverUrl.isBlank()) "🖼️ Pick Cover" else "✓ Changed", color = GoldAccent, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }

                    if (newCoverUrl.isNotBlank()) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(85.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .border(1.dp, GoldAccent.copy(alpha = 0.5f), RoundedCornerShape(12.dp))
                        ) {
                            AsyncImage(
                                model = newCoverUrl,
                                contentDescription = "Cover Preview",
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.fillMaxSize()
                            )
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Button(
                            onClick = { showCreateDialog = false },
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.buttonColors(containerColor = GraphiteCard)
                        ) {
                            Text("Cancel", color = TextPrimary)
                        }

                        Button(
                            onClick = {
                                if (newName.isBlank()) return@Button
                                isCreating = true
                                scope.launch {
                                    val res = client.createEvent(
                                        name = newName,
                                        date = newDate,
                                        location = newLocation,
                                        description = "Created from Android app",
                                        code = newCode,
                                        coverUrl = newCoverUrl
                                    )
                                    isCreating = false
                                    res.onSuccess { created ->
                                        showCreateDialog = false
                                        refresh(created.id)
                                    }.onFailure {
                                        statusMessage = "Create failed: ${it.message}"
                                    }
                                }
                            },
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.buttonColors(containerColor = GoldAccent)
                        ) {
                            if (isCreating) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(16.dp),
                                    color = DarkBackground,
                                    strokeWidth = 2.dp
                                )
                            } else {
                                Text("Create", color = DarkBackground, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }

        }
    }

    // Settings Dialog (Server URL & User Profile)
    if (showSettingsDialog) {
        var tempUrl by remember(showSettingsDialog) { mutableStateOf(client.serverUrl) }
        var tempGuestName by remember(showSettingsDialog) { mutableStateOf(client.guestName) }
        var testResultText by remember { mutableStateOf<String?>(null) }
        var isTesting by remember { mutableStateOf(false) }

        Dialog(onDismissRequest = { showSettingsDialog = false }) {
            Surface(
                shape = RoundedCornerShape(20.dp),
                color = MidnightSurface,
                border = androidx.compose.foundation.BorderStroke(1.dp, GlassBorder)
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "Website & Backend Sync",
                        fontWeight = FontWeight.Bold,
                        color = GoldAccent,
                        fontSize = 18.sp
                    )
                    Text(
                        text = "Connect phone to website. Choose preset or enter your PC's IP:",
                        color = TextSecondary,
                        fontSize = 12.sp
                    )

                    // Presets
                    Surface(
                        color = if (tempUrl.contains("vercel.app")) GoldAccent.copy(alpha = 0.25f) else GraphiteCard,
                        shape = RoundedCornerShape(10.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, if (tempUrl.contains("vercel.app")) GoldAccent else GlassBorder),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                tempUrl = LivePhotoApiClient.DEFAULT_CLOUD_URL
                                testResultText = null
                            }
                    ) {
                        Row(
                            modifier = Modifier.padding(vertical = 10.dp, horizontal = 12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.Center
                        ) {
                            Text("🌐", fontSize = 16.sp)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Live Cloud (web-rho-sage-25.vercel.app)",
                                color = if (tempUrl.contains("vercel.app")) GoldAccent else TextPrimary,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Surface(
                            color = if (tempUrl.contains("192.168.0.103")) GoldAccent.copy(alpha = 0.25f) else GraphiteCard,
                            shape = RoundedCornerShape(8.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, if (tempUrl.contains("192.168.0.103")) GoldAccent else GlassBorder),
                            modifier = Modifier
                                .weight(1f)
                                .clickable {
                                    tempUrl = "http://192.168.0.103:3000"
                                    testResultText = null
                                }
                        ) {
                            Text(
                                text = "📱 Wi-Fi LAN",
                                color = if (tempUrl.contains("192.168.0.103")) GoldAccent else TextPrimary,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                textAlign = TextAlign.Center,
                                modifier = Modifier.padding(vertical = 8.dp)
                            )
                        }
                        Surface(
                            color = if (tempUrl.contains("10.0.2.2")) GoldAccent.copy(alpha = 0.25f) else GraphiteCard,
                            shape = RoundedCornerShape(8.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, if (tempUrl.contains("10.0.2.2")) GoldAccent else GlassBorder),
                            modifier = Modifier
                                .weight(1f)
                                .clickable {
                                    tempUrl = "http://10.0.2.2:3000"
                                    testResultText = null
                                }
                        ) {
                            Text(
                                text = "💻 Emulator",
                                color = if (tempUrl.contains("10.0.2.2")) GoldAccent else TextPrimary,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                textAlign = TextAlign.Center,
                                modifier = Modifier.padding(vertical = 8.dp)
                            )
                        }
                    }

                    OutlinedTextField(
                        value = tempUrl,
                        onValueChange = {
                            tempUrl = it
                            testResultText = null
                        },
                        label = { Text("Server URL") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = GoldAccent,
                            unfocusedBorderColor = GlassBorder,
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary
                        )
                    )

                    // User Identity & Name Section
                    Text(
                        text = "Your Display Name:",
                        color = GoldAccent,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )
                    OutlinedTextField(
                        value = tempGuestName,
                        onValueChange = { tempGuestName = it },
                        placeholder = { Text("e.g. Marvan or leave empty for Guest") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = GoldAccent,
                            unfocusedBorderColor = GlassBorder,
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary
                        )
                    )

                    if (testResultText != null) {
                        Text(
                            text = testResultText!!,
                            color = if (testResultText!!.startsWith("✓")) GreenSuccess else Color(0xFFFF8888),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Button(
                            onClick = {
                                isTesting = true
                                testResultText = null
                                val prev = client.serverUrl
                                client.serverUrl = tempUrl
                                scope.launch {
                                    val res = client.fetchEvents()
                                    isTesting = false
                                    res.onSuccess {
                                        testResultText = "✓ Connected! Found ${it.size} events on website."
                                    }.onFailure {
                                        testResultText = "✕ Failed: ${it.message}"
                                        client.serverUrl = prev
                                    }
                                }
                            },
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.buttonColors(containerColor = GraphiteCard),
                            enabled = !isTesting
                        ) {
                            if (isTesting) {
                                CircularProgressIndicator(modifier = Modifier.size(14.dp), color = GoldAccent)
                            } else {
                                Text("Test Link", color = GoldAccent, fontSize = 11.sp)
                            }
                        }

                        Button(
                            onClick = {
                                val cleanUrl = tempUrl.trim()
                                client.serverUrl = cleanUrl
                                client.guestName = tempGuestName.trim()
                                showSettingsDialog = false
                                Toast.makeText(context, "Saved server: $cleanUrl", Toast.LENGTH_SHORT).show()
                                refresh()
                            },
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.buttonColors(containerColor = GoldAccent)
                        ) {
                            Text("Save", color = DarkBackground, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

        }
    }

    // Admin Login Dialog
    if (showAdminDialog) {
        var adminPass by remember { mutableStateOf("") }
        var adminError by remember { mutableStateOf<String?>(null) }

        Dialog(onDismissRequest = { showAdminDialog = false }) {
            Surface(
                shape = RoundedCornerShape(20.dp),
                color = MidnightSurface,
                border = androidx.compose.foundation.BorderStroke(1.dp, GlassBorder)
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = if (isAdmin) "Admin Organizer Mode" else "Admin Sign In",
                        fontWeight = FontWeight.Bold,
                        color = GoldAccent,
                        fontSize = 18.sp
                    )

                    if (isAdmin) {
                        Text(
                            text = "You are currently logged in with full organizer access. You can create live events and manage cloud storage.",
                            color = TextSecondary,
                            fontSize = 12.sp
                        )

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Button(
                                onClick = { showAdminDialog = false },
                                modifier = Modifier.weight(1f),
                                colors = ButtonDefaults.buttonColors(containerColor = GraphiteCard)
                            ) {
                                Text("Close", color = TextPrimary)
                            }
                            Button(
                                onClick = {
                                    isAdmin = false
                                    showAdminDialog = false
                                },
                                modifier = Modifier.weight(1f),
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4A1E1E))
                            ) {
                                Text("Sign Out", color = Color(0xFFFF8888), fontWeight = FontWeight.Bold)
                            }
                        }
                    } else {
                        Text(
                            text = "Enter admin password to unlock host features (Default: marvan2026):",
                            color = TextSecondary,
                            fontSize = 12.sp
                        )

                        OutlinedTextField(
                            value = adminPass,
                            onValueChange = {
                                adminPass = it
                                adminError = null
                            },
                            label = { Text("Password") },
                            placeholder = { Text("marvan2026") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true,
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = GoldAccent,
                                unfocusedBorderColor = GlassBorder,
                                focusedTextColor = TextPrimary,
                                unfocusedTextColor = TextPrimary
                            )
                        )

                        if (adminError != null) {
                            Text(text = adminError!!, color = Color(0xFFFF8888), fontSize = 12.sp)
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Button(
                                onClick = { showAdminDialog = false },
                                modifier = Modifier.weight(1f),
                                colors = ButtonDefaults.buttonColors(containerColor = GraphiteCard)
                            ) {
                                Text("Cancel", color = TextPrimary)
                            }

                            Button(
                                onClick = {
                                    if (adminPass.trim() == "marvan2026" || adminPass.trim() == "admin") {
                                        isAdmin = true
                                        showAdminDialog = false
                                    } else {
                                        adminError = "Invalid admin password. Default is marvan2026"
                                    }
                                },
                                modifier = Modifier.weight(1f),
                                colors = ButtonDefaults.buttonColors(containerColor = GoldAccent)
                            ) {
                                Text("Login", color = DarkBackground, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }

        }
    }

    // QR Code Display Modal
    if (qrEventForModal != null) {
        val ev = qrEventForModal!!
        val publicBase = if (client.serverUrl.contains("localhost") || client.serverUrl.contains("10.0.2.2") || client.serverUrl.contains("127.0.0.1")) {
            LivePhotoApiClient.DEFAULT_CLOUD_URL
        } else {
            client.serverUrl
        }
        val eventUrl = "$publicBase/event/${ev.id}"
        val qrImageUrl = "https://api.qrserver.com/v1/create-qr-code/?size=350x350&margin=10&data=" + Uri.encode(eventUrl)

        Dialog(onDismissRequest = { qrEventForModal = null }) {
            Surface(
                shape = RoundedCornerShape(24.dp),
                color = MidnightSurface,
                border = androidx.compose.foundation.BorderStroke(1.dp, GoldAccent.copy(alpha = 0.4f)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(22.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Text(
                        text = ev.name,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary,
                        fontSize = 17.sp,
                        textAlign = TextAlign.Center
                    )
                    Text(
                        text = eventUrl,
                        color = GoldAccent,
                        fontSize = 11.sp,
                        textAlign = TextAlign.Center
                    )

                    Surface(
                        color = Color.White,
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.size(240.dp)
                    ) {
                        AsyncImage(
                            model = qrImageUrl,
                            contentDescription = "Event QR Code",
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(12.dp)
                        )
                    }

                    Surface(
                        color = GraphiteCard,
                        shape = RoundedCornerShape(10.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, GlassBorder)
                    ) {
                        Text(
                            text = "CODE: ${ev.code}",
                            color = GoldAccent,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                        )
                    }

                    Text(
                        text = "Scan with phone camera to open gallery & upload live!",
                        color = TextSecondary,
                        fontSize = 11.sp,
                        textAlign = TextAlign.Center
                    )

                    Button(
                        onClick = { qrEventForModal = null },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = GraphiteCard)
                    ) {
                        Text("Done", color = TextPrimary)
                    }
                }
            }
        }
    }

    // Edit Event Dialog
    if (editingEventForModal != null) {
        val targetEvent = editingEventForModal!!
        var editName by remember(targetEvent.id) { mutableStateOf(targetEvent.name) }
        var editLocation by remember(targetEvent.id) { mutableStateOf(targetEvent.location) }
        var editDate by remember(targetEvent.id) { mutableStateOf(targetEvent.date) }
        var editDescription by remember(targetEvent.id) { mutableStateOf(targetEvent.description) }
        var editCoverUrl by remember(targetEvent.id) { mutableStateOf(targetEvent.coverUrl) }
        var isUploadingEditCover by remember { mutableStateOf(false) }
        var isSaving by remember { mutableStateOf(false) }

        Dialog(onDismissRequest = { editingEventForModal = null }) {
            Surface(
                shape = RoundedCornerShape(20.dp),
                color = MidnightSurface,
                border = androidx.compose.foundation.BorderStroke(1.dp, GoldAccent.copy(alpha = 0.4f))
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(
                        text = "Edit Event (${targetEvent.code})",
                        fontWeight = FontWeight.Bold,
                        color = GoldAccent,
                        fontSize = 18.sp
                    )

                    OutlinedTextField(
                        value = editName,
                        onValueChange = { editName = it },
                        label = { Text("Event Name") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = GoldAccent,
                            unfocusedBorderColor = GlassBorder,
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary
                        )
                    )

                    OutlinedTextField(
                        value = editLocation,
                        onValueChange = { editLocation = it },
                        label = { Text("Location") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = GoldAccent,
                            unfocusedBorderColor = GlassBorder,
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary
                        )
                    )

                    OutlinedTextField(
                        value = editDate,
                        onValueChange = { editDate = it },
                        label = { Text("Date (YYYY-MM-DD)") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = GoldAccent,
                            unfocusedBorderColor = GlassBorder,
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary
                        )
                    )

                    OutlinedTextField(
                        value = editDescription,
                        onValueChange = { editDescription = it },
                        label = { Text("Description") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = GoldAccent,
                            unfocusedBorderColor = GlassBorder,
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary
                        )
                    )

                    // Change Cover Photo Thumbnail
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Cover Photo Thumbnail", color = TextSecondary, fontSize = 12.sp)
                        Button(
                            onClick = {
                                onCoverPicked = { bytes ->
                                    isUploadingEditCover = true
                                    scope.launch {
                                        val res = client.uploadEventCover(bytes, "cover_${System.currentTimeMillis()}.jpg")
                                        isUploadingEditCover = false
                                        res.onSuccess { editCoverUrl = it }
                                    }
                                }
                                coverPickerLauncher.launch("image/*")
                            },
                            shape = RoundedCornerShape(8.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = GraphiteCard),
                            border = androidx.compose.foundation.BorderStroke(1.dp, GlassBorder)
                        ) {
                            if (isUploadingEditCover) {
                                CircularProgressIndicator(modifier = Modifier.size(14.dp), color = GoldAccent, strokeWidth = 2.dp)
                            } else {
                                Text("🖼️ Change Cover", color = GoldAccent, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }

                    if (editCoverUrl.isNotBlank()) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(85.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .border(1.dp, GoldAccent.copy(alpha = 0.5f), RoundedCornerShape(12.dp))
                        ) {
                            AsyncImage(
                                model = editCoverUrl,
                                contentDescription = "Cover Preview",
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.fillMaxSize()
                            )
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Button(
                            onClick = { editingEventForModal = null },
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.buttonColors(containerColor = GraphiteCard)
                        ) {
                            Text("Cancel", color = TextPrimary)
                        }

                        Button(
                            onClick = {
                                if (editName.isBlank()) return@Button
                                isSaving = true
                                scope.launch {
                                    val res = client.updateEvent(
                                        id = targetEvent.id,
                                        name = editName,
                                        date = editDate,
                                        location = editLocation,
                                        description = editDescription,
                                        coverUrl = editCoverUrl
                                    )
                                    isSaving = false
                                    res.onSuccess { updated ->
                                        editingEventForModal = null
                                        refresh(updated.id)
                                    }.onFailure {
                                        statusMessage = "Update failed: ${it.message}"
                                    }
                                }
                            },
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.buttonColors(containerColor = GoldAccent)
                        ) {
                            if (isSaving) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(16.dp),
                                    color = DarkBackground,
                                    strokeWidth = 2.dp
                                )
                            } else {
                                Text("Save", color = DarkBackground, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
    }

    // Delete Event Confirmation Dialog (with cloud cascade delete)
    if (eventToDelete != null) {
        val targetEvent = eventToDelete!!
        var isDeleting by remember { mutableStateOf(false) }

        Dialog(onDismissRequest = { if (!isDeleting) eventToDelete = null }) {
            Surface(
                shape = RoundedCornerShape(20.dp),
                color = MidnightSurface,
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFFF5555).copy(alpha = 0.5f))
            ) {
                Column(
                    modifier = Modifier.padding(22.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Text(
                        text = "Delete Event?",
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFFFF6E8A),
                        fontSize = 18.sp
                    )
                    Text(
                        text = "Are you sure you want to delete '${targetEvent.name}' (${targetEvent.code})?\n\nThis will permanently delete the event and all associated photos from cloud and local storage.",
                        color = TextSecondary,
                        fontSize = 13.sp
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Button(
                            onClick = { eventToDelete = null },
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.buttonColors(containerColor = GraphiteCard),
                            enabled = !isDeleting
                        ) {
                            Text("Cancel", color = TextPrimary)
                        }

                        Button(
                            onClick = {
                                isDeleting = true
                                scope.launch {
                                    val res = client.deleteEvent(targetEvent.id)
                                    isDeleting = false
                                    eventToDelete = null
                                    res.onSuccess {
                                        refresh()
                                    }.onFailure {
                                        statusMessage = "Delete failed: ${it.message}"
                                    }
                                }
                            },
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF5A1E1E)),
                            enabled = !isDeleting
                        ) {
                            if (isDeleting) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(16.dp),
                                    color = Color.White,
                                    strokeWidth = 2.dp
                                )
                            } else {
                                Text("Delete Event", color = Color(0xFFFF8888), fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
    }

    // Delete Photo Confirmation Dialog
    if (photoToDelete != null) {
        val targetPhoto = photoToDelete!!
        var isDeletingPhoto by remember { mutableStateOf(false) }

        Dialog(onDismissRequest = { if (!isDeletingPhoto) photoToDelete = null }) {
            Surface(
                shape = RoundedCornerShape(20.dp),
                color = MidnightSurface,
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFFF5555).copy(alpha = 0.5f))
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "Delete Photo?",
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFFFF6E8A),
                        fontSize = 18.sp
                    )
                    Text(
                        text = "Are you sure you want to permanently delete '${targetPhoto.name}' from storage?",
                        color = TextSecondary,
                        fontSize = 13.sp
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Button(
                            onClick = { photoToDelete = null },
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.buttonColors(containerColor = GraphiteCard),
                            enabled = !isDeletingPhoto
                        ) {
                            Text("Cancel", color = TextPrimary)
                        }

                        Button(
                            onClick = {
                                isDeletingPhoto = true
                                scope.launch {
                                    val res = client.deletePhoto(targetPhoto.id)
                                    isDeletingPhoto = false
                                    photoToDelete = null
                                    selectedPhotoForViewer = null
                                    res.onSuccess {
                                        photos = photos.filter { it.id != targetPhoto.id }
                                        refresh(selectedEvent?.id)
                                    }.onFailure {
                                        statusMessage = "Delete photo failed: ${it.message}"
                                    }
                                }
                            },
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF5A1E1E)),
                            enabled = !isDeletingPhoto
                        ) {
                            if (isDeletingPhoto) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(16.dp),
                                    color = Color.White,
                                    strokeWidth = 2.dp
                                )
                            } else {
                                Text("Delete", color = Color(0xFFFF8888), fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
    }
}
