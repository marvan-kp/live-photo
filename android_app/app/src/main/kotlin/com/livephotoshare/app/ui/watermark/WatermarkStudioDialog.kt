package com.livephotoshare.app.ui.watermark

import android.widget.Toast
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.livephotoshare.app.R
import com.livephotoshare.app.model.WatermarkConfig
import com.livephotoshare.app.network.LivePhotoApiClient
import com.livephotoshare.app.ui.components.LiquidFrostedButton
import com.livephotoshare.app.ui.components.LiquidGoldButton
import com.livephotoshare.app.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun WatermarkStudioDialog(
    client: LivePhotoApiClient,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var config by remember { mutableStateOf(WatermarkConfig()) }
    var isLoading by remember { mutableStateOf(true) }
    var isSaving by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        val res = client.fetchWatermarkConfig()
        isLoading = false
        res.onSuccess { config = it }
    }

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(24.dp),
            color = MidnightSurface,
            border = BorderStroke(1.dp, GoldAccent.copy(alpha = 0.4f)),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier
                    .padding(22.dp)
                    .fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "Studio Watermark",
                            fontWeight = FontWeight.ExtraBold,
                            color = GoldAccent,
                            fontSize = 18.sp
                        )
                        Text(
                            text = "Branded overlay on all live uploads",
                            color = TextSecondary,
                            fontSize = 11.sp
                        )
                    }

                    IconButton(
                        onClick = onDismiss,
                        modifier = Modifier
                            .size(34.dp)
                            .clip(CircleShape)
                            .background(GraphiteCard)
                            .border(1.dp, GlassBorder, CircleShape)
                    ) {
                        Text("✕", color = TextPrimary, fontWeight = FontWeight.Bold)
                    }
                }

                if (isLoading) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(180.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = GoldAccent)
                    }
                } else {
                    // Watermark Enable Toggle
                    Surface(
                        color = GraphiteCard,
                        shape = RoundedCornerShape(14.dp),
                        border = BorderStroke(1.dp, if (config.enabled) GoldAccent else GlassBorder),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { config = config.copy(enabled = !config.enabled) }
                    ) {
                        Row(
                            modifier = Modifier.padding(14.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(
                                    text = if (config.enabled) "Watermark: ENABLED" else "Watermark: DISABLED",
                                    color = if (config.enabled) GoldAccent else TextPrimary,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp
                                )
                                Text(
                                    text = "Signature by Marvan studio logo",
                                    color = TextSecondary,
                                    fontSize = 11.sp
                                )
                            }
                            Switch(
                                checked = config.enabled,
                                onCheckedChange = { config = config.copy(enabled = it) },
                                colors = SwitchDefaults.colors(
                                    checkedThumbColor = DarkBackground,
                                    checkedTrackColor = GoldAccent
                                )
                            )
                        }
                    }

                    // Live Visual Preview Card
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(130.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color(0xFF0A0C14))
                            .border(BorderStroke(1.dp, GlassBorder), RoundedCornerShape(16.dp)),
                        contentAlignment = when (config.position) {
                            "center" -> Alignment.Center
                            "bottom-right" -> Alignment.BottomEnd
                            "bottom-left" -> Alignment.BottomStart
                            "top-center" -> Alignment.TopCenter
                            "top-right" -> Alignment.TopEnd
                            "top-left" -> Alignment.TopStart
                            else -> Alignment.BottomCenter
                        }
                    ) {
                        Text(
                            text = "PREVIEW PHOTO CANVAS",
                            color = Color.White.copy(alpha = 0.15f),
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp,
                            modifier = Modifier.align(Alignment.Center)
                        )

                        if (config.enabled) {
                            Image(
                                painter = painterResource(id = R.drawable.app_logo),
                                contentDescription = "Watermark Preview",
                                modifier = Modifier
                                    .padding(12.dp)
                                    .width((config.scale * 450).dp.coerceIn(60.dp, 160.dp))
                                    .height(28.dp),
                                alpha = config.opacity.coerceIn(0.2f, 1f),
                                contentScale = ContentScale.Fit
                            )
                        }
                    }

                    // Position Selector
                    Text(
                        text = "POSITION:",
                        color = GoldAccent,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        listOf(
                            "bottom-center" to "Bottom Center",
                            "bottom-right" to "Bottom Right",
                            "center" to "Center"
                        ).forEach { (pos, label) ->
                            val isSelected = config.position == pos
                            Surface(
                                modifier = Modifier
                                    .weight(1f)
                                    .clickable { config = config.copy(position = pos) },
                                color = if (isSelected) GoldAccent.copy(alpha = 0.2f) else GraphiteCard,
                                shape = RoundedCornerShape(10.dp),
                                border = BorderStroke(1.dp, if (isSelected) GoldAccent else GlassBorder)
                            ) {
                                Text(
                                    text = label,
                                    color = if (isSelected) GoldAccent else TextSecondary,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    textAlign = TextAlign.Center,
                                    modifier = Modifier.padding(vertical = 8.dp)
                                )
                            }
                        }
                    }

                    // Save Button
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        LiquidFrostedButton(
                            text = "Cancel",
                            onClick = onDismiss,
                            modifier = Modifier.weight(1f)
                        )

                        LiquidGoldButton(
                            text = if (isSaving) "Saving..." else "Save Changes",
                            onClick = {
                                isSaving = true
                                scope.launch {
                                    val res = client.saveWatermarkConfig(config)
                                    isSaving = false
                                    res.onSuccess {
                                        Toast.makeText(context, "✓ Watermark settings saved to Cloud!", Toast.LENGTH_SHORT).show()
                                        onDismiss()
                                    }.onFailure {
                                        Toast.makeText(context, "Save failed: ${it.message}", Toast.LENGTH_SHORT).show()
                                    }
                                }
                            },
                            enabled = !isSaving,
                            modifier = Modifier.weight(1.3f)
                        )
                    }
                }
            }
        }
    }
}
