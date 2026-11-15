package com.livephotoshare.app.ui.stage

import android.content.Intent
import android.net.Uri
import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.tween
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
import com.livephotoshare.app.ui.theme.*
import kotlinx.coroutines.delay

@Composable
fun LiveStageWallDialog(
    event: Event,
    photos: List<Photo>,
    client: LivePhotoApiClient,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    val approvedPhotos = remember(photos) {
        val list = photos.filter { !it.isCulled }
        if (list.isNotEmpty()) list else photos
    }

    var currentIndex by remember { mutableIntStateOf(0) }
    var isPaused by remember { mutableStateOf(false) }

    // Slideshow auto-rotation timer
    LaunchedEffect(isPaused, approvedPhotos.size) {
        if (approvedPhotos.isEmpty()) return@LaunchedEffect
        while (!isPaused && approvedPhotos.isNotEmpty()) {
            delay(4500L)
            if (!isPaused) {
                currentIndex = (currentIndex + 1) % approvedPhotos.size
            }
        }
    }

    val currentPhoto = if (approvedPhotos.isNotEmpty()) approvedPhotos[currentIndex.coerceIn(0, approvedPhotos.size - 1)] else null
    val publicBase = if (client.serverUrl.contains("localhost") || client.serverUrl.contains("10.0.2.2") || client.serverUrl.contains("127.0.0.1")) {
        LivePhotoApiClient.DEFAULT_CLOUD_URL
    } else {
        client.serverUrl
    }
    val eventUrl = "$publicBase/event/${event.id}"
    val qrImageUrl = "https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=8&data=" + Uri.encode(eventUrl)

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black),
            color = Color.Black
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .clickable { isPaused = !isPaused }
            ) {
                if (currentPhoto == null) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text("No live photos yet for this stage.", color = TextSecondary)
                    }
                } else {
                    // Fullscreen Ambient Slideshow with Crossfade
                    Crossfade(
                        targetState = currentPhoto,
                        animationSpec = tween(900),
                        label = "stageCrossfade"
                    ) { photo ->
                        Box(modifier = Modifier.fillMaxSize()) {
                            // Blurred aura backdrop
                            AsyncImage(
                                model = photo.thumbnailUrl.ifBlank { photo.url },
                                contentDescription = null,
                                modifier = Modifier.fillMaxSize(),
                                contentScale = ContentScale.Crop,
                                alpha = 0.45f
                            )
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .background(
                                        Brush.verticalGradient(
                                            listOf(
                                                Color.Black.copy(alpha = 0.65f),
                                                Color.Black.copy(alpha = 0.35f),
                                                Color.Black.copy(alpha = 0.85f)
                                            )
                                        )
                                    )
                            )

                            // Crisp Main Photo Centerpiece
                            AsyncImage(
                                model = photo.url.ifBlank { photo.thumbnailUrl },
                                contentDescription = photo.name,
                                modifier = Modifier
                                    .fillMaxSize()
                                    .padding(horizontal = 24.dp, vertical = 70.dp),
                                contentScale = ContentScale.Fit
                            )
                        }
                    }
                }

                // Top Floating Status Bar
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .align(Alignment.TopCenter)
                        .padding(horizontal = 20.dp, vertical = 18.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Surface(
                            color = GreenSuccess.copy(alpha = 0.25f),
                            shape = RoundedCornerShape(8.dp),
                            border = BorderStroke(1.dp, GreenSuccess)
                        ) {
                            Text(
                                text = "● LIVE STAGE",
                                color = GreenSuccess,
                                fontWeight = FontWeight.ExtraBold,
                                fontSize = 10.sp,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(
                            text = event.name,
                            color = TextPrimary,
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }

                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        Surface(
                            color = MidnightSurface.copy(alpha = 0.85f),
                            shape = RoundedCornerShape(10.dp),
                            border = BorderStroke(1.dp, GoldAccent.copy(alpha = 0.5f))
                        ) {
                            Text(
                                text = "${approvedPhotos.size} MOMENTS",
                                color = GoldAccent,
                                fontWeight = FontWeight.Bold,
                                fontSize = 11.sp,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)
                            )
                        }

                        // Close Button
                        IconButton(
                            onClick = onDismiss,
                            modifier = Modifier
                                .size(36.dp)
                                .clip(CircleShape)
                                .background(MidnightSurface.copy(alpha = 0.85f))
                                .border(1.dp, GlassBorder, CircleShape)
                        ) {
                            Text("✕", color = TextPrimary, fontWeight = FontWeight.Bold)
                        }
                    }
                }

                // Bottom Left: Current Photo Details Pill
                if (currentPhoto != null) {
                    Surface(
                        color = MidnightSurface.copy(alpha = 0.88f),
                        shape = RoundedCornerShape(16.dp),
                        border = BorderStroke(1.dp, GlassBorder),
                        modifier = Modifier
                            .align(Alignment.BottomStart)
                            .padding(20.dp)
                    ) {
                        Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp)) {
                            Text(
                                text = currentPhoto.guestName,
                                color = TextPrimary,
                                fontWeight = FontWeight.ExtraBold,
                                fontSize = 14.sp
                            )
                            if (currentPhoto.caption.isNotBlank()) {
                                Text(
                                    text = currentPhoto.caption,
                                    color = TextSecondary,
                                    fontSize = 12.sp,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                            Text(
                                text = "♥ ${currentPhoto.likes} Likes • ★ ${currentPhoto.highlightScore}% AI Quality",
                                color = GoldAccent,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }
                }

                // Bottom Right: QR Code for Guest Mobile Uploads
                Surface(
                    color = MidnightSurface.copy(alpha = 0.92f),
                    shape = RoundedCornerShape(20.dp),
                    border = BorderStroke(1.5.dp, GoldAccent.copy(alpha = 0.6f)),
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .padding(20.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(12.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Surface(
                            color = Color.White,
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.size(105.dp)
                        ) {
                            AsyncImage(
                                model = qrImageUrl,
                                contentDescription = "Scan to Upload",
                                modifier = Modifier
                                    .fillMaxSize()
                                    .padding(6.dp)
                            )
                        }
                        Text(
                            text = "CODE: ${event.code}",
                            color = GoldAccent,
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 11.sp
                        )
                        Text(
                            text = "Scan to upload live",
                            color = TextSecondary,
                            fontSize = 9.sp
                        )
                    }
                }
            }
        }
    }
}
