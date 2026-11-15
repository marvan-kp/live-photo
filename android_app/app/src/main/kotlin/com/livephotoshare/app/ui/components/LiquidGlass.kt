package com.livephotoshare.app.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.livephotoshare.app.ui.theme.*

/**
 * Ultra-premium Liquid Glass Card Container with multi-stop obsidian gradient,
 * champagne gold specular edge highlight, and smooth rounded corners.
 */
@Composable
fun LiquidGlassCard(
    modifier: Modifier = Modifier,
    shape: Shape = RoundedCornerShape(22.dp),
    borderBrush: Brush = Brush.linearGradient(
        listOf(
            GoldAccent.copy(alpha = 0.40f),
            GlassBorder,
            GoldAccent.copy(alpha = 0.15f)
        )
    ),
    borderWidth: Dp = 1.dp,
    intensity: LiquidGlassIntensity = LiquidGlassIntensity.Medium,
    content: @Composable BoxScope.() -> Unit
) {
    val bgBrush = when (intensity) {
        LiquidGlassIntensity.Subtle -> Brush.verticalGradient(
            listOf(
                Color(0xFF141620).copy(alpha = 0.70f),
                Color(0xFF090A10).copy(alpha = 0.85f)
            )
        )
        LiquidGlassIntensity.Medium -> Brush.verticalGradient(
            listOf(
                Color(0xFF181B26).copy(alpha = 0.82f),
                Color(0xFF0B0C12).copy(alpha = 0.94f)
            )
        )
        LiquidGlassIntensity.Deep -> Brush.verticalGradient(
            listOf(
                Color(0xFF10121A).copy(alpha = 0.92f),
                Color(0xFF06070B).copy(alpha = 0.98f)
            )
        )
        LiquidGlassIntensity.GoldAccent -> Brush.verticalGradient(
            listOf(
                GoldAccent.copy(alpha = 0.18f),
                Color(0xFF10121A).copy(alpha = 0.90f)
            )
        )
    }

    Box(
        modifier = modifier
            .shadow(
                elevation = 14.dp,
                shape = shape,
                ambientColor = Color.Black.copy(alpha = 0.6f),
                spotColor = GoldAccent.copy(alpha = 0.25f)
            )
            .clip(shape)
            .background(bgBrush)
            .border(BorderStroke(borderWidth, borderBrush), shape),
        content = content
    )
}

enum class LiquidGlassIntensity {
    Subtle,
    Medium,
    Deep,
    GoldAccent
}

/**
 * Liquid Glass Primary Button with luminous Champagne Gold gradient and obsidian text.
 */
@Composable
fun LiquidGoldButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    leadingIcon: @Composable (() -> Unit)? = null,
    trailingIcon: @Composable (() -> Unit)? = null
) {
    val goldGradient = Brush.horizontalGradient(
        listOf(GoldAccentLight, GoldAccent, GoldAccentDark)
    )

    Surface(
        modifier = modifier
            .height(48.dp)
            .shadow(
                elevation = if (enabled) 12.dp else 0.dp,
                shape = RoundedCornerShape(16.dp),
                ambientColor = GoldAccent.copy(alpha = 0.4f),
                spotColor = GoldAccent.copy(alpha = 0.5f)
            )
            .clip(RoundedCornerShape(16.dp))
            .clickable(enabled = enabled, onClick = onClick),
        color = Color.Transparent
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(if (enabled) goldGradient else Brush.linearGradient(listOf(Color.Gray, Color.DarkGray))),
            contentAlignment = Alignment.Center
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center,
                modifier = Modifier.padding(horizontal = 18.dp)
            ) {
                if (leadingIcon != null) {
                    leadingIcon()
                    Spacer(modifier = Modifier.width(8.dp))
                }
                Text(
                    text = text,
                    color = ObsidianBlack,
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 13.sp,
                    letterSpacing = 0.3.sp
                )
                if (trailingIcon != null) {
                    Spacer(modifier = Modifier.width(8.dp))
                    trailingIcon()
                }
            }
        }
    }
}

/**
 * Liquid Glass Secondary Frosted Button with subtle border and white text.
 */
@Composable
fun LiquidFrostedButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    borderColor: Color = GlassBorderGold,
    textColor: Color = TextPrimary,
    leadingIcon: @Composable (() -> Unit)? = null
) {
    Surface(
        modifier = modifier
            .height(48.dp)
            .clip(RoundedCornerShape(16.dp))
            .border(BorderStroke(1.dp, borderColor), RoundedCornerShape(16.dp))
            .clickable(enabled = enabled, onClick = onClick),
        color = GlassSurface
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp)
        ) {
            if (leadingIcon != null) {
                leadingIcon()
                Spacer(modifier = Modifier.width(8.dp))
            }
            Text(
                text = text,
                color = textColor,
                fontWeight = FontWeight.Bold,
                fontSize = 13.sp
            )
        }
    }
}

/**
 * Liquid Glass Pill Badge for status indicators ("LIVE", "VIP", AI Scores).
 */
@Composable
fun LiquidGlassPill(
    text: String,
    modifier: Modifier = Modifier,
    backgroundColor: Color = GlassSurface,
    borderColor: Color = GlassBorderGold,
    textColor: Color = GoldAccent,
    fontSize: Int = 10
) {
    Surface(
        color = backgroundColor,
        shape = RoundedCornerShape(20.dp),
        border = BorderStroke(1.dp, borderColor),
        modifier = modifier
    ) {
        Text(
            text = text,
            color = textColor,
            fontSize = fontSize.sp,
            fontWeight = FontWeight.ExtraBold,
            modifier = Modifier.padding(horizontal = 9.dp, vertical = 4.dp),
            letterSpacing = 0.4.sp
        )
    }
}
