package com.livephotoshare.app.ui.reels

import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.net.Uri
import android.widget.Toast
import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil.compose.AsyncImage
import com.livephotoshare.app.R
import com.livephotoshare.app.model.Event
import com.livephotoshare.app.model.Photo
import com.livephotoshare.app.network.LivePhotoApiClient
import com.livephotoshare.app.ui.components.*
import com.livephotoshare.app.ui.theme.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.sin

enum class ReelTemplate(val displayName: String, val desc: String) {
    SIGNATURE_GOLD("Signature Gold", "Blurred aura + champagne gold border"),
    EDITORIAL_MINIMAL("Editorial Full", "Edge-to-edge 9:16 portrait"),
    CINEMA_NOIR("Cinema Noir", "Obsidian letterbox cinema bars")
}

@Composable
fun StoryReelStudioDialog(
    event: Event,
    allPhotos: List<Photo>,
    client: LivePhotoApiClient,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    // Curate highlight photos (non-culled, sorted by highlight score & likes)
    val reelPhotos = remember(allPhotos) {
        val approved = allPhotos.filter { !it.isCulled }
        val sorted = approved.sortedByDescending { it.highlightScore }
        if (sorted.isNotEmpty()) sorted.take(10) else allPhotos.take(10)
    }

    var template by remember { mutableStateOf(ReelTemplate.SIGNATURE_GOLD) }
    var slideDurationSec by remember { mutableFloatStateOf(2.2f) }
    var isPlaying by remember { mutableStateOf(true) }
    var currentSlideIndex by remember { mutableIntStateOf(0) }
    var slideProgress by remember { mutableFloatStateOf(0f) }
    var isMuted by remember { mutableStateOf(false) }

    // Ken Burns smooth camera motion animation
    val infiniteTransition = rememberInfiniteTransition(label = "kenBurns")
    val kenScale by infiniteTransition.animateFloat(
        initialValue = 1.0f,
        targetValue = 1.08f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 2800, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "scale"
    )

    // Slideshow advance timer
    LaunchedEffect(isPlaying, reelPhotos.size, slideDurationSec) {
        if (!isPlaying || reelPhotos.isEmpty()) return@LaunchedEffect
        val stepMs = 50L
        val totalMs = (slideDurationSec * 1000).toLong()

        while (isPlaying && reelPhotos.isNotEmpty()) {
            var elapsed = 0L
            while (elapsed < totalMs && isPlaying) {
                delay(stepMs)
                elapsed += stepMs
                slideProgress = (elapsed.toFloat() / totalMs).coerceIn(0f, 1f)
            }
            if (isPlaying) {
                currentSlideIndex = (currentSlideIndex + 1) % reelPhotos.size
                slideProgress = 0f
            }
        }
    }

    // Procedural ambient harmonic synth chord player
    DisposableEffect(isMuted, isPlaying) {
        var audioTrack: AudioTrack? = null
        var isAudioActive = true

        if (!isMuted && isPlaying) {
            scope.launch {
                try {
                    val sampleRate = 22050
                    val numSamples = sampleRate * 3
                    val buffer = ShortArray(numSamples)

                    // Warm Cmaj9 ambient frequencies: C4 (261.63Hz), E4 (329.63Hz), G4 (392.00Hz), B4 (493.88Hz)
                    val freqs = doubleArrayOf(261.63, 329.63, 392.00, 493.88)
                    for (i in 0 until numSamples) {
                        val t = i.toDouble() / sampleRate
                        val envelope = sin(Math.PI * (i.toDouble() / numSamples))
                        var sample = 0.0
                        for (f in freqs) {
                            sample += sin(2.0 * Math.PI * f * t)
                        }
                        buffer[i] = (sample * 0.12 * envelope * Short.MAX_VALUE).toInt().toShort()
                    }

                    audioTrack = AudioTrack.Builder()
                        .setAudioAttributes(
                            AudioAttributes.Builder()
                                .setUsage(AudioAttributes.USAGE_MEDIA)
                                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                                .build()
                        )
                        .setAudioFormat(
                            AudioFormat.Builder()
                                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                                .setSampleRate(sampleRate)
                                .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                                .build()
                        )
                        .setBufferSizeInBytes(buffer.size * 2)
                        .setTransferMode(AudioTrack.MODE_STREAM)
                        .build()

                    audioTrack.play()

                    while (isAudioActive && isPlaying && !isMuted) {
                        audioTrack.write(buffer, 0, buffer.size)
                        delay(2500L)
                    }
                } catch (_: Exception) {}
            }
        }

        onDispose {
            isAudioActive = false
            try {
                audioTrack?.stop()
                audioTrack?.release()
            } catch (_: Exception) {}
        }
    }

    val activePhoto = if (reelPhotos.isNotEmpty()) reelPhotos[currentSlideIndex.coerceIn(0, reelPhotos.size - 1)] else null

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            modifier = Modifier
                .fillMaxSize()
                .background(DarkBackground),
            color = DarkBackground
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.SpaceBetween
            ) {
                // Top Header Bar
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Surface(
                            color = GoldAccent.copy(alpha = 0.2f),
                            shape = CircleShape,
                            border = BorderStroke(1.dp, GoldAccent)
                        ) {
                            Text(
                                text = "🎬",
                                fontSize = 16.sp,
                                modifier = Modifier.padding(6.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Text(
                                text = "9:16 Story & Reels Studio",
                                color = TextPrimary,
                                fontWeight = FontWeight.ExtraBold,
                                fontSize = 16.sp
                            )
                            Text(
                                text = "${event.name} • ${reelPhotos.size} AI Curated Clips",
                                color = GoldAccent,
                                fontSize = 11.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }

                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        // Audio Mute Toggle
                        IconButton(
                            onClick = { isMuted = !isMuted },
                            modifier = Modifier
                                .size(38.dp)
                                .clip(CircleShape)
                                .background(GraphiteCard)
                                .border(1.dp, GlassBorder, CircleShape)
                        ) {
                            Text(text = if (isMuted) "🔇" else "🎵", fontSize = 16.sp)
                        }

                        // Close Button
                        IconButton(
                            onClick = onDismiss,
                            modifier = Modifier
                                .size(38.dp)
                                .clip(CircleShape)
                                .background(GraphiteCard)
                                .border(1.dp, GlassBorder, CircleShape)
                        ) {
                            Text("✕", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        }
                    }
                }

                // Center: 9:16 Smartphone Mockup Viewport
                if (reelPhotos.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth(),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("No photos available to create highlights reel.", color = TextSecondary)
                    }
                } else if (activePhoto != null) {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .aspectRatio(9f / 16f)
                            .clip(RoundedCornerShape(32.dp))
                            .border(BorderStroke(2.dp, GoldAccent.copy(alpha = 0.6f)), RoundedCornerShape(32.dp))
                            .background(Color.Black)
                            .clickable { isPlaying = !isPlaying },
                        contentAlignment = Alignment.Center
                    ) {
                        // Background Photo / Aura
                        when (template) {
                            ReelTemplate.EDITORIAL_MINIMAL -> {
                                AsyncImage(
                                    model = activePhoto.url.ifBlank { activePhoto.thumbnailUrl },
                                    contentDescription = activePhoto.name,
                                    modifier = Modifier
                                        .fillMaxSize()
                                        .scale(kenScale),
                                    contentScale = ContentScale.Crop
                                )
                                Box(
                                    modifier = Modifier
                                        .fillMaxSize()
                                        .background(
                                            Brush.verticalGradient(
                                                listOf(
                                                    Color.Black.copy(alpha = 0.45f),
                                                    Color.Transparent,
                                                    Color.Black.copy(alpha = 0.85f)
                                                )
                                            )
                                        )
                                )
                            }
                            ReelTemplate.CINEMA_NOIR -> {
                                AsyncImage(
                                    model = activePhoto.url.ifBlank { activePhoto.thumbnailUrl },
                                    contentDescription = activePhoto.name,
                                    modifier = Modifier
                                        .fillMaxSize()
                                        .padding(vertical = 44.dp)
                                        .scale(kenScale),
                                    contentScale = ContentScale.Crop
                                )
                                // Cinema Letterbox Bars
                                Column(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.SpaceBetween) {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .height(50.dp)
                                            .background(Color(0xFF07080C))
                                            .border(BorderStroke(1.dp, GoldAccent.copy(alpha = 0.3f)))
                                    )
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .height(50.dp)
                                            .background(Color(0xFF07080C))
                                            .border(BorderStroke(1.dp, GoldAccent.copy(alpha = 0.3f)))
                                    )
                                }
                            }
                            ReelTemplate.SIGNATURE_GOLD -> {
                                // Background blurred ambiance
                                AsyncImage(
                                    model = activePhoto.thumbnailUrl.ifBlank { activePhoto.url },
                                    contentDescription = null,
                                    modifier = Modifier
                                        .fillMaxSize()
                                        .scale(1.2f),
                                    contentScale = ContentScale.Crop,
                                    alpha = 0.40f
                                )
                                Box(
                                    modifier = Modifier
                                        .fillMaxSize()
                                        .background(
                                            Brush.verticalGradient(
                                                listOf(
                                                    Color(0xFF0B0D14).copy(alpha = 0.70f),
                                                    Color(0xFF0A0B10).copy(alpha = 0.35f),
                                                    Color(0xFF06070B).copy(alpha = 0.90f)
                                                )
                                            )
                                        )
                                )

                                // Inner Champagne Framed Card
                                Box(
                                    modifier = Modifier
                                        .fillMaxSize()
                                        .padding(horizontal = 14.dp, vertical = 52.dp)
                                        .clip(RoundedCornerShape(24.dp))
                                        .border(BorderStroke(2.dp, GoldAccent.copy(alpha = 0.75f)), RoundedCornerShape(24.dp))
                                        .background(Color(0xFF10121A))
                                ) {
                                    AsyncImage(
                                        model = activePhoto.url.ifBlank { activePhoto.thumbnailUrl },
                                        contentDescription = activePhoto.name,
                                        modifier = Modifier
                                            .fillMaxSize()
                                            .scale(kenScale),
                                        contentScale = ContentScale.Crop
                                    )
                                }
                            }
                        }

                        // Overlay: Segmented Instagram Story Progress Bar
                        Row(
                            modifier = Modifier
                                .align(Alignment.TopCenter)
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 14.dp),
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            for (i in reelPhotos.indices) {
                                val fillRatio = when {
                                    i < currentSlideIndex -> 1f
                                    i == currentSlideIndex -> slideProgress
                                    else -> 0f
                                }
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .height(3.dp)
                                        .clip(RoundedCornerShape(2.dp))
                                        .background(Color.White.copy(alpha = 0.3f))
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxHeight()
                                            .fillMaxWidth(fillRatio)
                                            .background(GoldAccent)
                                    )
                                }
                            }
                        }

                        // Top Header Pill: Event Name
                        Surface(
                            color = MidnightSurface.copy(alpha = 0.85f),
                            shape = RoundedCornerShape(20.dp),
                            border = BorderStroke(1.dp, GoldAccent.copy(alpha = 0.4f)),
                            modifier = Modifier
                                .align(Alignment.TopCenter)
                                .padding(top = 28.dp)
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 5.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text("✦ ${event.name}", color = GoldAccent, fontWeight = FontWeight.Bold, fontSize = 11.sp)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("${currentSlideIndex + 1}/${reelPhotos.size}", color = TextSecondary, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                            }
                        }

                        // Bottom Guest Credit & Score Pill
                        Column(
                            modifier = Modifier
                                .align(Alignment.BottomStart)
                                .padding(start = 16.dp, bottom = 18.dp, end = 16.dp)
                        ) {
                            Surface(
                                color = MidnightSurface.copy(alpha = 0.88f),
                                shape = RoundedCornerShape(14.dp),
                                border = BorderStroke(1.dp, GlassBorder)
                            ) {
                                Column(modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)) {
                                    Text(
                                        text = activePhoto.guestName,
                                        color = TextPrimary,
                                        fontWeight = FontWeight.ExtraBold,
                                        fontSize = 12.sp
                                    )
                                    Text(
                                        text = if (activePhoto.caption.isNotBlank()) activePhoto.caption else "AI Sharpness ${activePhoto.highlightScore}% • ♥ ${activePhoto.likes}",
                                        color = GoldAccent,
                                        fontSize = 10.sp,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                }
                            }
                        }

                        // Studio Watermark Logo in Bottom Right
                        Image(
                            painter = painterResource(id = R.drawable.app_logo),
                            contentDescription = "Signature by Marvan Watermark",
                            modifier = Modifier
                                .align(Alignment.BottomEnd)
                                .padding(end = 16.dp, bottom = 18.dp)
                                .height(28.dp)
                                .width(70.dp),
                            contentScale = ContentScale.Fit
                        )
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Bottom Controls: Template Switcher & Quick Actions
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    // Template Selector Chips
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        ReelTemplate.values().forEach { tpl ->
                            val isSelected = template == tpl
                            Surface(
                                modifier = Modifier
                                    .weight(1f)
                                    .clickable { template = tpl },
                                color = if (isSelected) GoldAccent.copy(alpha = 0.2f) else GraphiteCard,
                                shape = RoundedCornerShape(12.dp),
                                border = BorderStroke(1.dp, if (isSelected) GoldAccent else GlassBorder)
                            ) {
                                Text(
                                    text = tpl.displayName,
                                    color = if (isSelected) GoldAccent else TextSecondary,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    textAlign = TextAlign.Center,
                                    modifier = Modifier.padding(vertical = 8.dp)
                                )
                            }
                        }
                    }

                    // Action Buttons Row: Share & Full 1080×1920 HD Studio
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        // Share Active Photo / Link to Reel
                        LiquidFrostedButton(
                            text = "↗️ Share Story",
                            onClick = {
                                if (activePhoto != null) {
                                    val sendIntent = Intent().apply {
                                        action = Intent.ACTION_SEND
                                        putExtra(Intent.EXTRA_TEXT, "Watch our live event highlights reel ✨\n${client.serverUrl}/event/${event.id}/reel\n\nPhoto by ${activePhoto.guestName}: ${activePhoto.url}")
                                        type = "text/plain"
                                    }
                                    context.startActivity(Intent.createChooser(sendIntent, "Share Reel Highlights"))
                                }
                            },
                            modifier = Modifier.weight(1f)
                        )

                        // Launch full 1080×1920 Web Exporter
                        LiquidGoldButton(
                            text = "🎬 Export 1080×1920 HD",
                            onClick = {
                                val url = "${client.serverUrl}/event/${event.id}/reel"
                                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                                context.startActivity(intent)
                                Toast.makeText(context, "Opening 1080×1920 HD Exporter...", Toast.LENGTH_SHORT).show()
                            },
                            modifier = Modifier.weight(1.3f)
                        )
                    }
                }
            }
        }
    }
}
